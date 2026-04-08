const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const signUpUser = async (req, res, next) => {
    try {
        const { email, phone, plain_password, role } = req.body;
        if (role !== 'patient' && role !== 'doctor' && role !== 'admin') {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid role');
        }
        if (!email || !phone || !plain_password) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields');
        }
        const password_hash = await bcrypt.hash(plain_password, 12);
        const checkUser = await pool.query(
            'SELECT id, email, phone FROM users WHERE email = $1 OR phone = $2 LIMIT 1',
            [email, phone]
        );

        if (checkUser.rowCount > 0) {
            return errorResponse(res, 409, 'CONFLICT', 'Email or phone already registered');
        }
        const result = await pool.query(
            'INSERT INTO users (email, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING email, phone, role',
            [email, phone, password_hash, role]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create user');
        }

        return successResponse(res, 201, result.rows[0], 'User created successfully');
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, 409, 'CONFLICT', 'Email or phone already registered');
        }
        return next(error);
    }
};

const userLogin = async (req, res, next) => {
    try {
        const { email, phone, role, plain_password } = req.body;

        if (!role || !plain_password || (!email && !phone)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Fill all required fields: role, plain_password and (email or phone)');
        }

        const userResult = await pool.query(
            `SELECT id, password_hash FROM users
             WHERE role = $1 AND (email = $2 OR phone = $3)`,
            [role, email || null, phone || null]
        );

        if (userResult.rowCount === 0) {
            return errorResponse(res, 404, 'NOT_FOUND', 'User not found');
        }

        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(plain_password, user.password_hash);
        if (!passwordMatch) {
            return errorResponse(res, 401, 'UNAUTHORIZED', 'Invalid credentials');
        }

        const payload = {
            userId: user.id,
            role,
            email: email || null,
            phone: phone || null,
        };

        const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
        const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });

        return successResponse(res, 200, { token }, 'Login successful');
    } catch (error) {
        return next(error);
    }
};

const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isUuid(id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid user ID format');
        }

        const result = await pool.query(
            'SELECT id, email, phone, role, created_at FROM users WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'NOT_FOUND', 'User not found');
        }

        return successResponse(res, 200, result.rows[0], 'User retrieved successfully');
    } catch (error) {
        return next(error);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const { role } = req.query; // Optional filter by role
        let query = 'SELECT id, email, phone, role, created_at FROM users';
        const params = [];

        if (role) {
            if (role !== 'patient' && role !== 'doctor' && role !== 'admin') {
                return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid role');
            }
            query += ' WHERE role = $1';
            params.push(role);
        }

        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);

        return successResponse(res, 200, result.rows, 'Users retrieved successfully');
    } catch (error) {
        return next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { email, phone, plain_password } = req.body;

        if (!isUuid(id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid user ID format');
        }

        const checkUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (checkUser.rowCount === 0) {
            return errorResponse(res, 404, 'NOT_FOUND', 'User not found');
        }

        let updateQuery = 'UPDATE users SET ';
        const params = [];
        let paramCount = 1;

        if (email) {
            updateQuery += `email = $${paramCount}, `;
            params.push(email);
            paramCount++;
        }

        if (phone) {
            updateQuery += `phone = $${paramCount}, `;
            params.push(phone);
            paramCount++;
        }

        if (plain_password) {
            const password_hash = await bcrypt.hash(plain_password, 12);
            updateQuery += `password_hash = $${paramCount}, `;
            params.push(password_hash);
            paramCount++;
        }

        if (params.length === 0) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'No fields to update');
        }

        updateQuery += `updated_at = NOW() WHERE id = $${paramCount} RETURNING id, email, phone, role, updated_at`;
        params.push(id);

        const result = await pool.query(updateQuery, params);

        return successResponse(res, 200, result.rows[0], 'User updated successfully');
    } catch (error) {
        return next(error);
    }
};

const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isUuid(id)) {
            return errorResponse(res, 400, 'BAD_REQUEST', 'Invalid user ID format');
        }

        const checkUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (checkUser.rowCount === 0) {
            return errorResponse(res, 404, 'NOT_FOUND', 'User not found');
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        return successResponse(res, 200, { id }, 'User deleted successfully');
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    signUpUser,
    userLogin,
    getUserById,
    getAllUsers,
    updateUser,
    deleteUser
};