// Sends a push notification to Eucharistic Ministers whenever the parish office
// creates a message in the messages collection.
//
// Deploy with: cd functions && npm install && firebase deploy --only functions
// Requires the Blaze plan plus android/app/google-services.json.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

exports.notifyMinisters = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message) return;

  const recipients = [];

  if (message.audience === 'all') {
    const snap = await db
      .collection('users')
      .where('role', '==', 'minister')
      .where('active', '==', true)
      .get();
    snap.docs.forEach((doc) => recipients.push({ id: doc.id, ...doc.data() }));
  } else if (message.toUid) {
    const doc = await db.collection('users').doc(message.toUid).get();
    if (doc.exists) recipients.push({ id: doc.id, ...doc.data() });
  }

  const tokens = [
    ...new Set(recipients.flatMap((user) => (Array.isArray(user.fcmTokens) ? user.fcmTokens : [])))
  ].filter(Boolean);

  if (!tokens.length) {
    console.log(`No push tokens for message ${event.params.messageId}.`);
    return;
  }

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: message.subject || 'Parish message',
      body: String(message.body || '').slice(0, 180)
    },
    data: {
      type: 'message',
      messageId: event.params.messageId,
      audience: message.audience || 'all'
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'parish_messages',
        color: '#1b365d',
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: { sound: 'default', badge: 1 }
      }
    }
  });

  console.log(
    `Message ${event.params.messageId}: ${response.successCount} sent, ${response.failureCount} failed.`
  );

  // Remove tokens FCM reported as dead so future sends stay clean.
  const removals = new Map();
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (!INVALID_TOKEN_CODES.has(code)) return;
    const token = tokens[index];
    recipients.forEach((user) => {
      if (Array.isArray(user.fcmTokens) && user.fcmTokens.includes(token)) {
        if (!removals.has(user.id)) removals.set(user.id, []);
        removals.get(user.id).push(token);
      }
    });
  });

  await Promise.all(
    [...removals.entries()].map(([uid, staleTokens]) =>
      db
        .collection('users')
        .doc(uid)
        .update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) })
        .catch((err) => console.warn(`Could not prune tokens for ${uid}:`, err.message))
    )
  );
});
