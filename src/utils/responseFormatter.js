function successResponse(res, statusCode, data, message) {
    return res.status(statusCode).json({
        success: true,
        data,
        message: message || 'Operation successful.',
    });
}

function errorResponse(res, statusCode, code, message) {
    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
        },
    });
}

module.exports = {
    successResponse,
    errorResponse,
};
