// Syntax-checks the inline module scripts in every page and verifies that the
// local assets they reference exist.
//
// Usage: node scripts/check-pages.js

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'stitch_mater_dei_pastoral_tracker');

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

(async () => {
  let failures = 0;

  for (const file of htmlFiles(WEB)) {
    const html = fs.readFileSync(file, 'utf8');
    const label = path.relative(ROOT, file);

    const moduleScripts = [...html.matchAll(/<script\s+type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const [index, match] of moduleScripts.entries()) {
      try {
        await esbuild.transform(match[1], { loader: 'js', format: 'esm', target: 'es2020' });
      } catch (err) {
        failures += 1;
        console.error(`Syntax error in ${label} (module script ${index + 1}):`);
        console.error(`  ${err.message.split('\n')[0]}`);
      }
    }

    for (const match of html.matchAll(/(?:href|src)=["']([^"'#:]+\.(?:css|js))["']/gi)) {
      const url = match[1];
      if (url.startsWith('http')) continue;
      const resolved = path.resolve(path.dirname(file), url);
      if (!fs.existsSync(resolved)) {
        failures += 1;
        console.error(`Missing asset ${url} referenced by ${label}`);
      }
    }
  }

  if (failures) {
    console.error(`\n${failures} page problem(s) found.`);
    process.exitCode = 1;
  } else {
    console.log('All pages parse and their local assets exist.');
  }
})();
