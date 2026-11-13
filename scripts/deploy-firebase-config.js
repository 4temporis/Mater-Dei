// Deploys Firestore security rules and composite indexes using the Admin SDK
// service account (useful when the Firebase CLI login has expired).
//
// Usage: node scripts/deploy-firebase-config.js

const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.join(__dirname, '..');
const KEY_PATH =
  process.argv[2] ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(ROOT, 'eucharistic-ministers-firebase-adminsdk-fbsvc-6cc2c9e6b7.json');

const serviceAccount = require(path.resolve(KEY_PATH));
const projectId = serviceAccount.project_id;
const database = '(default)';

let accessToken = '';

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`${response.status} ${body?.error?.message || text || response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function deployRules() {
  const content = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  process.stdout.write('• Uploading Firestore rules … ');

  const ruleset = await api(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({
      source: {
        files: [{ name: 'firestore.rules', content }]
      }
    })
  });

  const releaseName = `projects/${projectId}/releases/cloud.firestore`;
  const rulesetName = ruleset.name;

  try {
    await api(
      `https://firebaserules.googleapis.com/v1/${releaseName}?updateMask=ruleset_name`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          release: { name: releaseName, rulesetName }
        })
      }
    );
  } catch (err) {
    if (err.status !== 404) throw err;
    await api(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify({
        name: releaseName,
        rulesetName
      })
    });
  }

  console.log('deployed');
}

async function deployIndexes() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'));

  for (const index of config.indexes || []) {
    const collectionGroup = index.collectionGroup;
    const label = `${collectionGroup}: ${(index.fields || []).map((f) => `${f.fieldPath} ${f.order}`).join(', ')}`;
    process.stdout.write(`• Index ${label} … `);
    try {
      const operation = await api(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}/collectionGroups/${collectionGroup}/indexes`,
        {
          method: 'POST',
          body: JSON.stringify({
            queryScope: index.queryScope || 'COLLECTION',
            fields: index.fields
          })
        }
      );
      console.log(operation.done ? 'created' : 'building');
    } catch (err) {
      if (err.status === 409) {
        console.log('already exists');
        continue;
      }
      if (err.status === 400 && /already exists/i.test(err.message)) {
        console.log('already exists');
        continue;
      }
      console.log('FAILED');
      console.log(`  ${err.message.split('\n')[0]}`);
    }
  }
}

async function main() {
  console.log(`Project: ${projectId}\n`);
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  accessToken = (await (await auth.getClient()).getAccessToken()).token;

  await deployRules();
  await deployIndexes();

  console.log('\nDone. If rule deployment failed with 403, run: firebase login --reauth');
  console.log('then: firebase deploy --only firestore:rules,firestore:indexes');
}

main().catch((err) => {
  console.error(`\nDeploy failed: ${err.message}`);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
