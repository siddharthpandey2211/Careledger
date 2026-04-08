const { errorResponse } = require('../utils/responseFormatter');

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'SERVER_ERROR';
    const message = err.message || 'Internal server error';

    if (res.headersSent) return next(err);
    return errorResponse(res, statusCode, code, message);
}

module.exports = errorHandler;
