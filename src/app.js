const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const frontendDir = path.resolve(__dirname, '../frontend');

app.use(express.json());
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    return next();
});
app.use(express.static(frontendDir));

app.get('/health', (req, res) => {
    res.status(200).json({ success: true, data: { ok: true }, message: 'Operation successful.' });
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use('/api', apiRoutes);

app.use(errorHandler);

module.exports = app;
