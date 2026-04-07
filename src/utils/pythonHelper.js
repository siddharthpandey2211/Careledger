const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '../../');

function getLocalPythonCandidates() {
    return [
        path.join(projectRoot, '.venv311', 'Scripts', 'python.exe'),
        path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
    ].filter((candidate) => fs.existsSync(candidate));
}

/**
 * Check if Python is available in system PATH
 * @returns {string|null} - Python command ('python', 'python3', or null)
 */
const getPythonCommand = () => {
    const localPython = getLocalPythonCandidates()[0];
    if (localPython) {
        return localPython;
    }

    try {
        // Try python first
        execSync('python --version', { stdio: 'pipe' });
        return 'python';
    } catch (e) {
        try {
            // Try python3
            execSync('python3 --version', { stdio: 'pipe' });
            return 'python3';
        } catch (e) {
            return null;
        }
    }
};

/**
 * Get Python version info
 * @returns {string} - Python version string
 */
const getPythonVersion = () => {
    const cmd = getPythonCommand();
    if (!cmd) return 'Python not found';

    try {
        const version = execSync(`${cmd} --version`, { encoding: 'utf-8' }).trim();
        return version;
    } catch (e) {
        return 'Unable to determine version';
    }
};

module.exports = {
    getPythonCommand,
    getPythonVersion
};
