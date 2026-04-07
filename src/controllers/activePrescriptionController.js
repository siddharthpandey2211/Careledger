const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');


const getActiveMedicationByUserId = async (req, res, next) => {
    try {
        const id = req.params.userId;

        if (!id) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'UserId not provided');
        }

        if (!isUuid(id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid user ID format');
        }

        const result = await pool.query(
            `SELECT id, name, dosage, prescibed_for, prescibed_at, prescribed_by, user_id 
             FROM active_medication WHERE user_id = $1 ORDER BY prescibed_at DESC`,
            [id]
        );

        if (result.rowCount === 0) {
            return successResponse(res, 200, [], 'No active medications found');
        }

        return successResponse(res, 200, result.rows, 'Medications fetched successfully');
    } catch (error) {
        return next(error);
    }
};

const deleteActiveMedicationById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const doctorId = req.doctor?.id;

        if (!id) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Medication ID not provided');
        }

        if (!isUuid(id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid medication ID format');
        }

        if (!doctorId) {
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const checkMed = await pool.query(
            'SELECT id FROM active_medication WHERE id = $1',
            [id]
        );

        if (checkMed.rowCount === 0) {
            return errorResponse(res, 404, 'NOT_FOUND', 'Medication not found');
        }

        const result = await pool.query(
            'DELETE FROM active_medication WHERE id = $1 RETURNING id, name, user_id',
            [id]
        );

        return successResponse(res, 200, result.rows[0], 'Medication deleted successfully');
    } catch (error) {
        return next(error);
    }
};

const addActiveMedication = async (req, res, next) => {
    try {
        const { user_id, name, dosage, prescibed_for, prescibed_at } = req.body;
        const doctorId = req.doctor?.id;

        // Validation
        if (!user_id || !name || !dosage || !prescibed_for || !prescibed_at) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields: user_id, name, dosage, prescibed_for, prescibed_at');
        }

        if (!isUuid(user_id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid user ID format');
        }

        if (!doctorId) {
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const result = await pool.query(
            `INSERT INTO active_medication (name, dosage, prescibed_for, prescibed_at, prescribed_by, user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, dosage, prescibed_for, prescibed_at, prescribed_by, user_id`,
            [name, dosage, prescibed_for, prescibed_at, doctorId, user_id]
        );

        return successResponse(res, 201, result.rows[0], 'Medication added successfully');
    } catch (error) {
        return next(error);
    }
};

const updateActiveMedication = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, dosage, prescibed_for, prescibed_at } = req.body;
        const doctorId = req.doctor?.id;

        if (!id) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Medication ID not provided');
        }

        if (!isUuid(id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid medication ID format');
        }

        if (!doctorId) {
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        if (!name && !dosage && !prescibed_for && !prescibed_at) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'At least one field must be provided for update');
        }
        const checkMed = await pool.query(
            'SELECT id FROM active_medication WHERE id = $1',
            [id]
        );

        if (checkMed.rowCount === 0) {
            return errorResponse(res, 404, 'NOT_FOUND', 'Medication not found');
        }

        let updateQuery = 'UPDATE active_medication SET ';
        const params = [];
        let paramCount = 1;

        if (name) {
            updateQuery += `name = $${paramCount}, `;
            params.push(name);
            paramCount++;
        }

        if (dosage) {
            updateQuery += `dosage = $${paramCount}, `;
            params.push(dosage);
            paramCount++;
        }

        if (prescibed_for) {
            updateQuery += `prescibed_for = $${paramCount}, `;
            params.push(prescibed_for);
            paramCount++;
        }

        if (prescibed_at) {
            updateQuery += `prescibed_at = $${paramCount}, `;
            params.push(prescibed_at);
            paramCount++;
        }

        updateQuery += `prescribed_by = $${paramCount} WHERE id = $${paramCount + 1} RETURNING id, name, dosage, prescibed_for, prescibed_at, prescribed_by, user_id`;
        params.push(doctorId, id);

        const result = await pool.query(updateQuery, params);

        return successResponse(res, 200, result.rows[0], 'Medication updated successfully');
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getActiveMedicationByUserId,
    deleteActiveMedicationById,
    addActiveMedication,
    updateActiveMedication
};