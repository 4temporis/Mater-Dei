// One-time Firebase project setup for the Mater Dei Pastoral Care app.
//
//  1. Enables the Identity Toolkit (Firebase Authentication) API.
//  2. Turns on the Email/Password sign-in provider.
//  3. Registers the Android app in the Firebase project.
//  4. Downloads android/app/google-services.json.
//
// Usage: node scripts/setup-firebase.js
//
// Requires a service account key in the project root (or GOOGLE_APPLICATION_CREDENTIALS).

const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.join(__dirname, '..');
const KEY_PATH =
  process.argv[2] ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(ROOT, 'eucharistic-ministers-firebase-adminsdk-fbsvc-6cc2c9e6b7.json');

const ANDROID_PACKAGE = 'org.materdei.pastoraltracker';
const ANDROID_DISPLAY_NAME = 'Mater Dei Pastoral Care';

const serviceAccount = require(path.resolve(KEY_PATH));
const projectId = serviceAccount.project_id;

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
  } catch (err) {
    body = { raw: text };
  }

  if (!response.ok) {
    const message = body?.error?.message || text || response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function pollOperation(name, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const started = Date.now();
  let operationName = name;
  while (Date.now() - started < timeoutMs) {
    const operation = await api(`https://serviceusage.googleapis.com/v1/${operationName}`);
    if (operation.done) {
      if (operation.error) {
        throw new Error(`Operation failed: ${operation.error.message}`);
      }
      return operation.response;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for operation ${operationName}`);
}

async function enableService(service) {
  process.stdout.write(`• Enabling ${service} … `);
  try {
    const operation = await api(
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}:enable`,
      { method: 'POST', body: '{}' }
    );

    if (operation.done) {
      console.log('already enabled');
      return true;
    }

    if (operation.name) {
      await pollOperation(operation.name);
    }
    console.log('enabled');
    return true;
  } catch (err) {
    if (err.status === 409 || /already enabled/i.test(err.message)) {
      console.log('already enabled');
      return true;
    }
    console.log('SKIPPED (no permission)');
    console.log(`  ${err.message.split('\n')[0]}`);
    return false;
  }
}

async function enableEmailPasswordProvider() {
  process.stdout.write('• Enabling Email/Password sign-in … ');
  try {
    await api(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          signIn: {
            email: {
              enabled: true,
              passwordRequired: true
            }
          }
        })
      }
    );
    console.log('done');
    return true;
  } catch (err) {
    console.log('SKIPPED');
    console.log(`  ${err.message.split('\n')[0]}`);
    return false;
  }
}

async function listAndroidApps() {
  const apps = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await api(url.toString());
    apps.push(...(body.apps || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return apps;
}

async function pollFirebaseOperation(operationName) {
  const started = Date.now();
  while (Date.now() - started < 120000) {
    const operation = await api(`https://firebase.googleapis.com/v1beta1/${operationName}`);
    if (operation.done) {
      if (operation.error) throw new Error(operation.error.message);
      return operation.response;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timed out waiting for the Firebase app operation.');
}

async function ensureAndroidApp() {
  process.stdout.write(`• Registering Android app ${ANDROID_PACKAGE} … `);
  const existing = await listAndroidApps();
  const match = existing.find((app) => app.packageName === ANDROID_PACKAGE);
  if (match) {
    console.log(`already registered (${match.appId})`);
    return match.appId;
  }

  const operation = await api(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`,
    {
      method: 'POST',
      body: JSON.stringify({
        packageName: ANDROID_PACKAGE,
        displayName: ANDROID_DISPLAY_NAME
      })
    }
  );

  let app = operation.response;
  if (!app && operation.name) {
    app = await pollFirebaseOperation(operation.name);
  }

  const appId = app?.appId;
  if (!appId) throw new Error('Firebase did not return an appId for the new Android app.');
  console.log(`registered (${appId})`);
  return appId;
}

async function downloadGoogleServices(appId) {
  process.stdout.write('• Downloading google-services.json … ');
  const body = await api(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps/${appId}/config`
  );
  if (!body?.configFileContents) {
    throw new Error('Firebase did not return the Android config file.');
  }

  const destination = path.join(ROOT, 'android', 'app', 'google-services.json');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(body.configFileContents, 'base64'));
  console.log(`saved to ${path.relative(ROOT, destination)}`);
}

async function main() {
  console.log(`Project: ${projectId}\n`);

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  accessToken = (await client.getAccessToken()).token;
  if (!accessToken) throw new Error('Could not obtain a Google access token.');

  await enableService('identitytoolkit.googleapis.com');
  await enableService('securetoken.googleapis.com');
  await enableService('firebaseinstallations.googleapis.com');

  const authReady = await enableEmailPasswordProvider();

  const appId = await ensureAndroidApp();
  await downloadGoogleServices(appId);

  if (!authReady) {
    console.log('\nNote: the service account cannot enable Firebase Authentication.');
    console.log('Open the Firebase console → Authentication → Get started, then enable');
    console.log('the Email/Password provider. After that run: node scripts/create-admin.js');
  }

  console.log('\nFirebase setup complete.');
  console.log('Next: node scripts/create-admin.js');
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
