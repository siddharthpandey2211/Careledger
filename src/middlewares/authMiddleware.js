const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseFormatter');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return errorResponse(res, 401, 'UNAUTHORIZED', 'Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid Authorization header format');
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload || !payload.userId || !payload.role) {
            return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid token payload');
        }

        req.user = {
            id: payload.userId,
            role: payload.role,
        };

        return next();
    } catch (err) {
        return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
}

module.exports = { authenticate };
