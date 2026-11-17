'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
  ].filter(Boolean);
  for (const mod of candidates) {
    try { return require(mod); } catch {}
  }
  throw new Error('Playwright module not found. Install playwright or set PLAYWRIGHT_MODULE.');
}

function resolveChromiumExecutable(chromium) {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  try {
    const builtin = chromium.executablePath();
    if (builtin && fs.existsSync(builtin)) return builtin;
  } catch {}
  const cacheRoots = [
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright')
  ];
  const binaryRelPaths = [
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-linux/chrome',
    'chrome-win/chrome.exe'
  ];
  for (const root of cacheRoots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter(d => d.startsWith('chromium-')).sort().reverse();
    for (const dir of dirs) {
      for (const rel of binaryRelPaths) {
        const full = path.join(root, dir, rel);
        if (fs.existsSync(full)) return full;
      }
    }
  }
  return undefined;
}

const playwright = loadPlaywright();
const executablePath = resolveChromiumExecutable(playwright.chromium);

module.exports = { chromium: playwright.chromium, executablePath };
