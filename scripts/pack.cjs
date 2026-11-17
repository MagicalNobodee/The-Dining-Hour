'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });

const zipName = `The-Dining-Hour-v${manifest.version}.zip`;
const outPath = path.join(outDir, zipName);
if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

execFileSync('zip', ['-r', '-X', outPath, 'extension', '-x', '*.DS_Store'], { cwd: root, stdio: 'inherit' });
console.log(`Packaged: ${outPath}`);
