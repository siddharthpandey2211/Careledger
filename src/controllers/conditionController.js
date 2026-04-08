const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');


// add new chronic condition
async function createCondition(req, res, next) {
  try {
    const { condition_name, status, diagnosed_date } = req.body;

    if (!condition_name || !status) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields: condition_name, status');
    }

    const validStatus = ['active', 'managed', 'resolved'];
    if (!validStatus.includes(status.toLowerCase())) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'status must be one of: active, managed, resolved');
    }

    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can add chronic conditions');
    }

    const patientQuery = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientQuery.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientQuery.rows[0].id;

    const existingCondition = await pool.query(
      `select id from chronic_conditions where patient_id = $1 and condition_name ilike $2`,
      [patientId, condition_name]
    );

    if (existingCondition.rowCount > 0) {
      return errorResponse(res, 409, 'CONFLICT', 'This chronic condition already exists for this patient');
    }

    // add new chronic condition
    const inserted = await pool.query(
      `insert into chronic_conditions (patient_id, condition_name, status, diagnosed_date)
       values ($1, $2, $3, $4)
       returning id, patient_id, condition_name, status, diagnosed_date`,
      [patientId, condition_name, status.toLowerCase(), diagnosed_date || null]
    );

    return successResponse(res, 201, inserted.rows[0], 'Chronic condition added successfully.');
  } catch (error) {
    return next(error);
  }
}


// get own chronic conditions
async function getOwnConditions(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can view chronic conditions');
    }

    const patientQuery = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientQuery.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientQuery.rows[0].id;

    // Get all chronic conditions
    const getAllConditions = await pool.query(
      `select id, patient_id, condition_name, status, diagnosed_date
       from chronic_conditions
       where patient_id = $1
       order by diagnosed_date desc`,
      [patientId]
    );

    return successResponse(res, 200, getAllConditions.rows, 'Operation successful.');
  } catch (error) {
    return next(error);
  }
}


// update chronic condition
async function updateCondition(req, res, next) {
  try {
    const id = req.params.id;
    if (!id || !isUuid(id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
    }

    const { condition_name, status, diagnosed_date } = req.body;

    if (!condition_name && !status && !diagnosed_date) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'At least one field must be provided for update');
    }

    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can update chronic conditions');
    }
    const patientQuery = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientQuery.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }
    if (status) {
      const validStatus = ['active', 'managed', 'resolved'];
      if (!validStatus.includes(status.toLowerCase())) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'status must be one of: active, managed, resolved');
      }
    }

    const patientId = patientQuery.rows[0].id;

    const fetchOldDetails = await pool.query(
      `select condition_name, status, diagnosed_date from chronic_conditions
       where id = $1 and patient_id = $2`,
      [id, patientId]
    );

    if (fetchOldDetails.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Chronic condition not found or access denied');
    }
    const finalConditionName = condition_name || fetchOldDetails.rows[0].condition_name;
    const finalStatus = status ? status.toLowerCase() : fetchOldDetails.rows[0].status;
    const finalDiagnosedDate = diagnosed_date !== undefined ? diagnosed_date : fetchOldDetails.rows[0].diagnosed_date;


    const updated = await pool.query(
      `update chronic_conditions
       set condition_name = $1, status = $2, diagnosed_date = $3
       where id = $4
       returning id, patient_id, condition_name, status, diagnosed_date`,
      [finalConditionName, finalStatus, finalDiagnosedDate, id]
    );

    return successResponse(res, 200, updated.rows[0], 'Chronic condition updated successfully.');
  } catch (error) {
    return next(error);
  }
}


// delete chronic condition
async function deleteCondition(req, res, next) {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
    }

    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can delete chronic conditions');
    }

    const patientQuery = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientQuery.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientQuery.rows[0].id;


    const deleted = await pool.query(
      `delete from chronic_conditions
       where id = $1 and patient_id = $2
       returning id`,
      [id, patientId]
    );

    if (deleted.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Chronic condition not found or access denied');
    }

    return successResponse(res, 200, { id: deleted.rows[0].id }, 'Chronic condition deleted successfully.');
  } catch (error) {
    return next(error);
  }
}

//get patient chronic condition
async function getPatientConditions(req, res, next) {
  try {
    const { patientId } = req.params;

    if (!isUuid(patientId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'patientId must be a valid UUID');
    }

    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
    }


    const access = await pool.query(
      `select id from access_permissions
       where patient_id = $1 and doctor_id = $2 and status = 'active' and (expires_at is null or expires_at > now())`,
      [patientId, doctorId]
    );

    if (access.rowCount === 0) {
      return errorResponse(res, 403, 'FORBIDDEN', 'No active access permission for this patient');
    }

    // Get patient chronic conditions
    const conditions = await pool.query(
      `select id, patient_id, condition_name, status, diagnosed_date
       from chronic_conditions
       where patient_id = $1
       order by diagnosed_date desc, condition_name asc`,
      [patientId]
    );

    return successResponse(res, 200, conditions.rows, 'Operation successful.');
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  createCondition,
  getOwnConditions,
  updateCondition,
  deleteCondition,
  getPatientConditions
};
