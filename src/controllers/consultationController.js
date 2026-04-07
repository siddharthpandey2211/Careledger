const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');

const CONSULTATION_STATUSES = new Set(['in_progress', 'completed']);

async function startConsultation(req, res, next) {
  try {
    const { patient_id } = req.body || {};

    if (!patient_id) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required field: patient_id');
    }

    if (!isUuid(patient_id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'patient_id must be a valid UUID');
    }

    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
    }

    const access = await pool.query(
      `select id, status, expires_at
       from access_permissions
       where patient_id = $1 and doctor_id = $2
         and status = 'ACTIVE'
         and (expires_at is null or expires_at > now())
       order by created_at desc
       limit 1`,
      [patient_id, doctorId]
    );

    if (access.rowCount === 0) {
      return errorResponse(res, 403, 'FORBIDDEN', 'No active access permission for this patient');
    }

    const inserted = await pool.query(
      `insert into consultations (patient_id, doctor_id, status)
       values ($1, $2, 'in_progress')
       returning id, patient_id, doctor_id, status, consultation_date`,
      [patient_id, doctorId]
    );

    return successResponse(res, 201, inserted.rows[0], 'Consultation created.');
  } catch (err) {
    return next(err);
  }
}

async function getConsultationById(req, res, next) {
  try {
    const { consultationId } = req.params;

    if (!isUuid(consultationId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'consultationId must be a valid UUID');
    }

    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
    }

    const q = await pool.query(
      `select c.*
       from consultations c
       where c.id = $1 and c.doctor_id = $2`,
      [consultationId, doctorId]
    );

    if (q.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Consultation not found');
    }

    return successResponse(res, 200, q.rows[0], 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

async function updateConsultationStatus(req, res, next) {
  try {
    const { consultationId } = req.params;
    const { status } = req.body || {};

    if (!isUuid(consultationId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'consultationId must be a valid UUID');
    }

    if (!status) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required field: status');
    }

    if (!CONSULTATION_STATUSES.has(status)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', "status must be one of ['in_progress','completed]");
    }

    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
    }

    const updated = await pool.query(
      `update consultations
       set status = $1, updated_at = now()
       where id = $2 and doctor_id = $3
       returning id, patient_id, doctor_id, status, updated_at`,
      [status, consultationId, doctorId]
    );

    if (updated.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Consultation not found');
    }

    return successResponse(res, 200, updated.rows[0], 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

async function upsertPrescription(req, res, next) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { consultationId } = req.params;  
    const { items } = req.body;             
    

    if (!isUuid(consultationId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid consultation ID');
    }
    
   
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'items must be a non-empty array');
    }
    
    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor context missing');
    }
    
    
    const consultation = await client.query(
      `SELECT id, patient_id, status FROM consultations 
       WHERE id = $1 AND doctor_id = $2`,
      [consultationId, doctorId]  
    );
    
    if (consultation.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Consultation not found');
    }
    
    const { status, patient_id } = consultation.rows[0];
    

    if (status === 'completed') {
      return errorResponse(res, 403, 'FORBIDDEN', 
        `Cannot modify prescription for ${status} consultation`);
    }
    
    const prescription = await client.query(
      `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (consultation_id) 
       DO UPDATE SET issued_at = now()
       RETURNING id`,
      [consultationId, patient_id, doctorId]
    );
    
    const prescriptionId = prescription.rows[0].id;
    
    await client.query(
      `DELETE FROM prescription_items WHERE prescription_id = $1`,
      [prescriptionId]
    );
    

    for (const item of items) {
      if (!item.drug_name || !item.dosage || !item.frequency || !item.duration_days) {
        await client.query('ROLLBACK');
        return errorResponse(res, 400, 'VALIDATION_ERROR', 
          'Each item must have drug_name, dosage, frequency, and duration_days');
      }
      
      await client.query(
        `INSERT INTO prescription_items 
         (prescription_id, drug_name, dosage, frequency, duration_days)
         VALUES ($1, $2, $3, $4, $5)`,
        [prescriptionId, item.drug_name, item.dosage, 
         item.frequency, item.duration_days]
      );
    }
    
    await client.query('COMMIT');
    
    return successResponse(res, 200, {
      prescription_id: prescriptionId,
      consultation_id: consultationId,
      items_count: items.length
    }, 'Prescription saved successfully');
    
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
}

async function getPrescription(req, res, next) {
  try {
    const { consultationId } = req.params;

    if (!isUuid(consultationId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'consultationId must be a valid UUID');
    }

    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
    }

    const consultation = await pool.query(
      `select id
       from consultations
       where id = $1 and doctor_id = $2`,
      [consultationId, doctorId]
    );

    if ( consultation.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Consultation not found');
    }

    const q = await pool.query(
      `select p.id AS prescription_id,
         p.consultation_id,
         p.patient_id,
         p.doctor_id,
         p.issued_at, jsonb_agg(
        json_build_object(
            'drug_name', p_items.drug_name, 
            'dosage', p_items.dosage, 
            'frequency', p_items.frequency, 
            'duration_days', p_items.duration_days
        )
    ) AS items
       from prescription p
       left join prescription_items p_items ON p_items.prescription_id = p.id
       where p.consultation_id = $1 and p.doctor_id = $2
       group by p.id, p.consultation_id, p.doctor_id`,
      [consultationId, doctorId]
    );

    if (q.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Prescription not found');
    }

    return successResponse(res, 200, q.rows[0], 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  startConsultation,
  getConsultationById,
  updateConsultationStatus,
  upsertPrescription,
  getPrescription,
};
