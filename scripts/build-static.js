const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public');
const output = path.join(root, 'dist');

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });

console.log(`Static site built to ${path.relative(root, output)}`);
