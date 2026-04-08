const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const rootDir = __dirname;

app.use(express.static(rootDir));

app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { ok: true }, message: 'Static site is running.' });
});

app.get('*', (_req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[SERVER] Static site listening on port ${PORT}`);
});
