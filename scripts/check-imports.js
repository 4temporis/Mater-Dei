// Verifies that every named import from firebase-client.js in the HTML pages
// actually exists in web/firebase-client.js.
//
// Usage: node scripts/check-imports.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sourcePath = path.join(ROOT, 'web', 'firebase-client.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const exported = new Set();
for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) {
  exported.add(match[1]);
}
for (const match of source.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
  exported.add(match[1]);
}
const reExport = source.match(/export\s*\{([\s\S]*?)\};?\s*$/m);
if (reExport) {
  for (const part of reExport[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop();
    if (name) exported.add(name);
  }
}

function htmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'assets') continue;
      htmlFiles(full, results);
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

let failures = 0;
for (const file of htmlFiles(path.join(ROOT, 'stitch_mater_dei_pastoral_tracker'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"][^'"]*firebase-client\.js['"]/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim();
      if (!name) continue;
      if (!exported.has(name)) {
        failures += 1;
        console.error(`MISSING export ${name} — ${path.relative(ROOT, file)}`);
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} unresolved import(s).`);
  process.exitCode = 1;
} else {
  console.log(`All firebase-client.js imports resolve (${exported.size} exports checked).`);
}
