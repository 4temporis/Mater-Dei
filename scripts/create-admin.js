// Creates (or updates) the parish admin account and grants it the admin role.
//
// Usage:
//   node scripts/create-admin.js
//   node scripts/create-admin.js --email you@parish.org --password "MyPassword123!"
//
// The account is created in Firebase Authentication and a matching document is
// written to users/{uid} with role = "admin".

const path = require('path');
const crypto = require('crypto');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const ROOT = path.join(__dirname, '..');
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(ROOT, 'eucharistic-ministers-firebase-adminsdk-fbsvc-6cc2c9e6b7.json');

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (match) return match.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return '';
}

function generatePassword() {
  const base = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '');
  return `MaterDei-${base}9!`;
}

const EMAIL = (readArg('email') || process.env.ADMIN_EMAIL || 'materdei.parowvalley@gmail.com').trim().toLowerCase();
const PASSWORD = readArg('password') || process.env.ADMIN_PASSWORD || generatePassword();
const DISPLAY_NAME = readArg('name') || 'Parish Admin';

const serviceAccount = require(path.resolve(KEY_PATH));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

async function main() {
  console.log(`Project: ${serviceAccount.project_id}`);
  console.log(`Admin email: ${EMAIL}\n`);

  let user;
  let created = false;

  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log('• Existing Firebase Auth account found — updating password.');
    user = await auth.updateUser(user.uid, { password: PASSWORD, displayName: DISPLAY_NAME });
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      emailVerified: false
    });
    created = true;
    console.log('• Created Firebase Auth account.');
  }

  await db.collection('users').doc(user.uid).set(
    {
      displayName: DISPLAY_NAME,
      email: EMAIL,
      role: 'admin',
      active: true,
      updatedAt: new Date().toISOString(),
      ...(created ? { createdAt: new Date().toISOString() } : {})
    },
    { merge: true }
  );

  console.log('• users/' + user.uid + ' set to role: admin');

  console.log('\n============================================================');
  console.log(' Admin login');
  console.log('------------------------------------------------------------');
  console.log(` Email:    ${EMAIL}`);
  console.log(` Password: ${PASSWORD}`);
  console.log('============================================================');
  console.log('Sign in at the app login screen, then open the Admin Console.');
  console.log('Change this password from Firebase Authentication when ready.');
}

main().catch((err) => {
  console.error('\nCould not create the admin account:', err.message || err);
  if (err.code === 'auth/configuration-not-found') {
    console.error('Firebase Authentication is not configured yet. Run: node scripts/setup-firebase.js');
  }
  process.exitCode = 1;
});
