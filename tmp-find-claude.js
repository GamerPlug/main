const fs = require('fs');
const path = require('path');

const searchPaths = [
    process.env.LOCALAPPDATA,
    path.join(process.env.LOCALAPPDATA, 'Programs'),
    path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages'),
    path.join(process.env.APPDATA, 'npm'),
    process.env.USERPROFILE,
    'C:/Program Files',
    'C:/Program Files (x86)'
];

function findFile(base, target) {
    try {
        const files = fs.readdirSync(base);
        for (const file of files) {
            const fullPath = path.join(base, file);
            if (file.toLowerCase() === target.toLowerCase()) {
                console.log('FOUND:', fullPath);
                return;
            }
            // Shallow search for performance
            if (fs.statSync(fullPath).isDirectory() && (file === 'ClaudeCode' || file === 'claude-code' || file === 'Anthropic.ClaudeCode')) {
                findFile(fullPath, target);
            }
        }
    } catch (e) {}
}

console.log('Searching for claude.exe/claude.cmd...');
for (const p of searchPaths) {
    if (p) {
        findFile(p, 'claude.exe');
        findFile(p, 'claude.cmd');
    }
}
