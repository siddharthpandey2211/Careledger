const pool = require('../config/db');
const { errorResponse } = require('../utils/responseFormatter');

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 401, 'UNAUTHORIZED', 'Missing authentication context');
        }

        if (req.user.role !== role) {
            return errorResponse(res, 403, 'FORBIDDEN', 'Insufficient role');
        }

        return next();
    };
}

async function requireVerifiedDoctor(req, res, next) {
    try {
        if (!req.user) {
            return errorResponse(res, 401, 'UNAUTHORIZED', 'Missing authentication context');
        }

        if (req.user.role !== 'doctor') {
            return errorResponse(res, 403, 'FORBIDDEN', 'Insufficient role');
        }

        const q = await pool.query(
            `select id, user_id, is_verified
       from doctors
       where user_id = $1`,
            [req.user.id]
        );

        if (q.rowCount === 0) {
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor profile not found');
        }

        const doctor = q.rows[0];
        if (!doctor.is_verified) {
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor is not verified');
        }

        req.doctor = doctor;
        return next();
    } catch (err) {
        return next(err);
    }
}

function requireAdmin(req, res, next) {
    if (!req.user) {
        return errorResponse(res, 401, 'UNAUTHORIZED', 'Missing authentication context');
    }

    if (req.user.role !== 'admin') {
        return errorResponse(res, 403, 'FORBIDDEN', 'Insufficient role');
    }

    return next();
}

module.exports = {
    requireRole,
    requireVerifiedDoctor,
    requireAdmin,
};
