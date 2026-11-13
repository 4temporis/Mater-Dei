// Script to seed Firestore from sample-data.json
// Usage: node seed.js <path-to-service-account-key.json>

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const keyPath = process.argv[2] || 'eucharistic-ministers-firebase-adminsdk-fbsvc-6cc2c9e6b7.json';

try {
  const serviceAccount = require(path.resolve(keyPath));

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();
  const rawData = fs.readFileSync(path.join(__dirname, 'sample-data.json'), 'utf8');
  const data = JSON.parse(rawData);

  async function seed() {
    console.log("Connecting to Firestore for project:", serviceAccount.project_id);

    console.log("\n1. Seeding Ministers...");
    for (const minister of data.ministers) {
      await db.collection('ministers').doc(minister.id).set(minister);
      console.log(`   ✔ Added minister: ${minister.name} (${minister.team})`);
    }

    console.log("\n2. Seeding Parishioners...");
    for (const parishioner of data.parishioners) {
      await db.collection('parishioners').doc(parishioner.id).set(parishioner);
      console.log(`   ✔ Added parishioner: ${parishioner.name} (ID: ${parishioner.id})`);
    }

    console.log("\n3. Seeding Routes...");
    for (const route of data.routes) {
      await db.collection('routes').doc(route.id).set(route);
      console.log(`   ✔ Added route: ${route.id} for date: ${route.date}`);
    }

    console.log("\n4. Seeding Visits...");
    for (const visit of data.visits) {
      await db.collection('visits').doc(visit.id).set(visit);
      console.log(`   ✔ Added visit log: ${visit.id} for parishioner: ${visit.parishionerId}`);
    }

    console.log("\n🎉 Firestore database successfully populated with pastoral care records!");
  }

  seed().catch(err => {
    console.error("\n❌ Error connecting/seeding Firestore:", err.message);
    if (err.message.includes('NOT_FOUND') || err.message.includes('does not exist')) {
      console.error("\nPlease make sure you clicked 'Create database' under 'Firestore Database' in the Firebase Console.");
    }
  });
} catch (e) {
  console.error("Initialization error:", e.message);
}
