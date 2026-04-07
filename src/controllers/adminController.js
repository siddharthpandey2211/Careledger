const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');

async function verifyDoctor(req, res, next) {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
    }

    const q = await pool.query(
      `update doctors
       set is_verified = true, updated_at = now()
       where id = $1
       returning id, user_id, is_verified`,
      [id]
    );

    if (q.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Doctor not found');
    }

    return successResponse(res, 200, q.rows[0], 'Operation successful.');
  } catch (err) {
    return next(err);
  }
}

module.exports = { verifyDoctor };
