// Permanently removes a minister from the parish database and Firebase Auth.
//
// In the app, the bin icon on a minister card performs a safe removal: access is
// revoked, personal details are cleared, parishioners are unassigned, and the
// sign-in record is detached. The Firebase Authentication account itself (email +
// password) can only be deleted with the Admin SDK, which is what this script is
// for.
//
// Usage:
//   node scripts/delete-minister.js --list
//   node scripts/delete-minister.js --email minister@example.org --yes
//   node scripts/delete-minister.js --uid <firebase-uid> --yes
//
// Add --force to allow deleting an administrator account.
// Without --yes the script only shows what it would delete.

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ROOT = path.join(__dirname, '..');
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(ROOT, 'eucharistic-ministers-firebase-adminsdk-fbsvc-6cc2c9e6b7.json');

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (match) return match.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return '';
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

const serviceAccount = require(path.resolve(KEY_PATH));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

async function printMinisters() {
  const snap = await db.collection('users').where('role', '==', 'minister').get();
  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  if (!rows.length) {
    console.log('No minister accounts found.');
    return;
  }

  console.log('Minister accounts:\n');
  rows.forEach((row) => {
    const state = row.deleted ? 'removed' : row.active === false ? 'paused' : 'active';
    console.log(`  ${row.displayName || '(no name)'} <${row.email || 'no email'}> [${state}]`);
    console.log(`    uid: ${row.id}`);
  });
}

async function main() {
  console.log(`Project: ${serviceAccount.project_id}\n`);

  if (hasFlag('list')) {
    await printMinisters();
    return;
  }

  let uid = readArg('uid');
  const email = readArg('email').trim().toLowerCase();

  if (!uid && !email) {
    throw new Error('Provide --uid <uid> or --email <address>. Use --list to see ministers.');
  }

  if (!uid) {
    const record = await auth.getUserByEmail(email);
    uid = record.uid;
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.log(`No users/${uid} document exists.`);
  }
  const user = userSnap.exists ? userSnap.data() : {};
  const label = user.displayName || email || uid;

  let authEmail = '(no sign-in account)';
  try {
    authEmail = (await auth.getUser(uid)).email || '(no email)';
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  if (user.role === 'admin' && !hasFlag('force')) {
    throw new Error('That account is an administrator. Re-run with --force to delete it.');
  }

  const assignedSnap = await db
    .collection('parishioners')
    .where('assignedMinisterId', '==', uid)
    .get();

  console.log(`Minister: ${label}`);
  console.log(`Auth email: ${authEmail}`);
  console.log(`Role: ${user.role || 'minister'}`);
  console.log(`Assigned parishioners: ${assignedSnap.size}`);

  if (!hasFlag('yes')) {
    console.log('\nDry run only. Re-run with --yes to permanently delete this account.');
    return;
  }

  const batch = db.batch();
  assignedSnap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      assignedMinisterId: '',
      assignedMinisterName: '',
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  if (userSnap.exists) batch.delete(userRef);
  await batch.commit();

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  console.log(`\nDone. Removed ${label}, deleted the sign-in account and unassigned ${assignedSnap.size} parishioner(s).`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
