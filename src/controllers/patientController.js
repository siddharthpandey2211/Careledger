const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');


async function createPatientProfile(req, res, next) {
  try {
    const { full_name, health_id, date_of_birth, gender, blood_group } = req.body;

    if (!full_name || !health_id) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields: full_name, health_id');
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only users with patient role can create patient profile');
    }

    const existing = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (existing.rowCount > 0) {
      return errorResponse(res, 409, 'CONFLICT', 'Patient profile already exists for this user');
    }
    const duplicateHealthId = await pool.query(
      `SELECT id FROM patients WHERE health_id = $1`,
      [health_id]
    );

    if (duplicateHealthId.rowCount > 0) {
      return errorResponse(res, 409, 'CONFLICT', 'Health ID already registered');
    }

    const validGenders = ['male', 'female', 'other'];
    if (gender && !validGenders.includes(gender.toLowerCase())) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'gender must be one of: male, female, other');
    }

    const inserted = await pool.query(
      `INSERT INTO patients (user_id, full_name, health_id, date_of_birth, gender, blood_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, full_name, health_id, date_of_birth, gender, blood_group`,
      [userId, full_name, health_id, date_of_birth || null, gender || null, blood_group || null]
    );

    return successResponse(res, 201, inserted.rows[0], 'Patient profile created successfully.');
  } catch (err) {
    if (err.code === '23505') {
      return errorResponse(res, 409, 'CONFLICT', 'Health ID already registered');
    }
    return next(err);
  }
}


async function getOwnProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can access this endpoint');
    }

    const patient = await pool.query(
      `SELECT
         p.id, p.user_id, p.full_name, p.health_id,
         p.date_of_birth, p.gender, p.blood_group,
         u.email, u.phone
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [userId]
    );

    if (patient.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found. Please create your profile first.');
    }

    return successResponse(res, 200, patient.rows[0], 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

async function getPatientById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!isUuid(id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
    }

    
    if (userRole === 'patient') {
      const ownProfile = await pool.query(
        `SELECT id FROM patients WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (ownProfile.rowCount === 0) {
        return errorResponse(res, 403, 'FORBIDDEN', 'You can only view your own profile');
      }
    } else if (userRole === 'doctor') {
      const doctorProfile = await pool.query(
        `SELECT id FROM doctors WHERE user_id = $1`,
        [userId]
      );

      if (doctorProfile.rowCount === 0) {
        return errorResponse(res, 403, 'FORBIDDEN', 'Doctor profile not found');
      }

      const doctorId = doctorProfile.rows[0].id;

      const access = await pool.query(
        `SELECT id FROM access_permissions
         WHERE patient_id = $1 AND doctor_id = $2
           AND status = 'ACTIVE'
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [id, doctorId]
      );

      if (access.rowCount === 0) {
        return errorResponse(res, 403, 'FORBIDDEN', 'No active access permission for this patient');
      }
    } else {
      return errorResponse(res, 403, 'FORBIDDEN', 'Unauthorized access');
    }

  
    const patient = await pool.query(
      `SELECT
         p.id, p.full_name, p.health_id,
         p.date_of_birth, p.gender, p.blood_group
       FROM patients p
       WHERE p.id = $1`,
      [id]
    );

    if (patient.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient not found');
    }

    return successResponse(res, 200, patient.rows[0], 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}


async function updateOwnProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can access this endpoint');
    }

    const { full_name, date_of_birth, gender, blood_group } = req.body;
    if (!full_name && !date_of_birth && !gender && !blood_group) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'At least one field must be provided for update');
    }


    const validGenders = ['male', 'female', 'other'];
    if (gender && !validGenders.includes(gender.toLowerCase())) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'gender must be one of: male, female, other');
    }

   
    const existing = await pool.query(
      `SELECT full_name, date_of_birth, gender, blood_group FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const currentProfile = existing.rows[0];
    const updatedFullName = full_name || currentProfile.full_name;
    const updatedDateOfBirth = date_of_birth || currentProfile.date_of_birth;
    const updatedGender = gender !== undefined ? gender : currentProfile.gender;
    const updatedBloodGroup = blood_group !== undefined ? blood_group : currentProfile.blood_group;

    const updated = await pool.query(
      `UPDATE patients
       SET full_name = $1, date_of_birth = $2, gender = $3, blood_group = $4
       WHERE user_id = $5
       RETURNING id, user_id, full_name, health_id, date_of_birth, gender, blood_group`,
      [updatedFullName, updatedDateOfBirth, updatedGender, updatedBloodGroup, userId]
    );

    return successResponse(res, 200, updated.rows[0], 'Profile updated successfully.');
  } catch (err) {
    return next(err);
  }
}

async function getOwnConsultations(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId || req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can access this endpoint');
    }

    const patientProfile = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientProfile.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientProfile.rows[0].id;

    const consultations = await pool.query(
      `SELECT
         c.id, c.doctor_id, c.consultation_date, c.status,
         d.full_name AS doctor_name, d.specialization, d.clinic_name
       FROM consultations c
       JOIN doctors d ON d.id = c.doctor_id
       WHERE c.patient_id = $1
       ORDER BY c.consultation_date DESC`,
      [patientId]
    );

    return successResponse(res, 200, consultations.rows, 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

async function grantDoctorAccess(req, res, next) {
  try {
    const { doctor_id, expires_at } = req.body;
    const userId = req.user?.id;

    if (!doctor_id) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required field: doctor_id');
    }

    if (!isUuid(doctor_id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'doctor_id must be a valid UUID');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can grant access');
    }

  
    const patientProfile = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientProfile.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientProfile.rows[0].id;

    
    const doctor = await pool.query(
      `SELECT id FROM doctors WHERE id = $1 AND is_verified = true`,
      [doctor_id]
    );

    if (doctor.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Doctor not found or not verified');
    }

    
    const existing = await pool.query(
      `SELECT id FROM access_permissions
       WHERE patient_id = $1 AND doctor_id = $2 AND status = 'ACTIVE'
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [patientId, doctor_id]
    );

    if (existing.rowCount > 0) {
      return errorResponse(res, 409, 'CONFLICT', 'Active access permission already exists for this doctor');
    }

    const inserted = await pool.query(
      `INSERT INTO access_permissions (patient_id, doctor_id, status, expires_at)
       VALUES ($1, $2, 'ACTIVE', $3)
       RETURNING id, patient_id, doctor_id, status, expires_at, created_at`,
      [patientId, doctor_id, expires_at || null]
    );

    return successResponse(res, 201, inserted.rows[0], 'Access granted successfully.');
  } catch (err) {
    return next(err);
  }
}


async function revokeDoctorAccess(req, res, next) {
  try {
    const { doctorId } = req.params;
    const userId = req.user?.id;

    if (!isUuid(doctorId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'doctorId must be a valid UUID');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can revoke access');
    }

   
    const patientProfile = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientProfile.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientProfile.rows[0].id;

 
    const updated = await pool.query(
      `UPDATE access_permissions
       SET status = 'REVOKED'
       WHERE patient_id = $1 AND doctor_id = $2 AND status = 'ACTIVE'
       RETURNING id, patient_id, doctor_id, status`,
      [patientId, doctorId]
    );

    if (updated.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'No active access permission found');
    }

    return successResponse(res, 200, updated.rows[0], 'Access revoked successfully.');
  } catch (err) {
    return next(err);
  }
}


async function getAccessList(req, res, next) {
  try {
    const userId = req.user?.id;

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can view access list');
    }


    const patientProfile = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientProfile.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientProfile.rows[0].id;

    const accessList = await pool.query(
      `SELECT
         ap.id, ap.doctor_id, ap.status, ap.expires_at, ap.created_at,
         d.full_name AS doctor_name, d.specialization, d.clinic_name
       FROM access_permissions ap
       JOIN doctors d ON d.id = ap.doctor_id
       WHERE ap.patient_id = $1
       ORDER BY ap.created_at DESC`,
      [patientId]
    );

    return successResponse(res, 200, accessList.rows, 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPatientProfile,
  getOwnProfile,
  getPatientById,
  updateOwnProfile,
  getOwnConsultations,
  grantDoctorAccess,
  revokeDoctorAccess,
  getAccessList,
};
