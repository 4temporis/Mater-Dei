// Prints a summary of the current Firestore + Auth state.
// Usage: node scripts/inspect-firestore.js [path-to-service-account.json]

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const keyPath =
  process.argv[2] ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, '..', 'eucharistic-ministers-firebase-adminsdk-fbsvc-6cc2c9e6b7.json');

const serviceAccount = require(path.resolve(keyPath));

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

async function main() {
  console.log(`Project: ${serviceAccount.project_id}\n`);

  for (const name of ['users', 'ministers', 'parishioners', 'routes', 'visits', 'messages', 'invites', 'settings']) {
    const snap = await db.collection(name).get();
    console.log(`${name}: ${snap.size} document(s)`);
    snap.docs.slice(0, 5).forEach((d) => {
      const data = d.data();
      console.log(`  - ${d.id}: ${data.name || data.displayName || data.email || data.subject || ''}`);
    });
  }

  const users = await auth.listUsers(1000);
  console.log(`\nAuth users: ${users.users.length}`);
  users.users.forEach((u) => console.log(`  - ${u.email || u.uid} (${u.uid})`));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
