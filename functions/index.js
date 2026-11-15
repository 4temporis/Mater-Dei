// Sends push notifications for parish messages, minister change requests and
// Sunday route updates. Notifications reach a phone even when the app is closed,
// as long as the minister has opened the app once and allowed notifications.
//
// Deploy with: cd functions && npm install && firebase deploy --only functions
// Requires the Blaze plan plus android/app/google-services.json.

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
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

function tokensFor(users) {
  return [
    ...new Set(users.flatMap((user) => (Array.isArray(user.fcmTokens) ? user.fcmTokens : [])))
  ].filter(Boolean);
}

/**
 * Sends one notification to every device token in `users` and prunes tokens FCM
 * reports as dead so later sends stay clean.
 */
async function sendPush(users, { title, body, data = {}, channelId = 'parish_messages' }) {
  const tokens = tokensFor(users);
  if (!tokens.length) {
    console.log(`No push tokens for "${title}".`);
    return null;
  }

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId,
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

  console.log(`"${title}": ${response.successCount} sent, ${response.failureCount} failed.`);

  const removals = new Map();
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (!INVALID_TOKEN_CODES.has(code)) return;
    const token = tokens[index];
    users.forEach((user) => {
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

  return response;
}

async function activeUsers(role) {
  const snap = await db
    .collection('users')
    .where('role', '==', role)
    .where('active', '==', true)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user) => user.deleted !== true);
}

// ---------------------------------------------------------------------------
// Parish messages from the admin console
// ---------------------------------------------------------------------------

exports.notifyMinisters = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message) return;

  let recipients = [];

  if (message.audience === 'all') {
    recipients = await activeUsers('minister');
  } else if (message.toUid) {
    const doc = await db.collection('users').doc(message.toUid).get();
    if (doc.exists) recipients.push({ id: doc.id, ...doc.data() });
  }

  await sendPush(recipients, {
    title: message.subject || 'Parish message',
    body: String(message.body || '').slice(0, 180),
    data: {
      type: 'message',
      messageId: event.params.messageId,
      audience: message.audience || 'all'
    },
    channelId: 'parish_messages'
  });
});

// ---------------------------------------------------------------------------
// Change requests submitted by ministers
// ---------------------------------------------------------------------------

exports.notifyAdminsOnChangeRequest = onDocumentCreated(
  'changeRequests/{requestId}',
  async (event) => {
    const request = event.data?.data();
    if (!request || request.status !== 'pending') return;

    const admins = await activeUsers('admin');
    const fields = (request.summary || [])
      .map((row) => row.label)
      .slice(0, 4)
      .join(', ');

    await sendPush(admins, {
      title: `Change request: ${request.parishionerName || 'Parishioner'}`,
      body: `${request.requestedByName || 'A minister'} suggested ${fields || 'an update'}. Tap to review.`,
      data: {
        type: 'changeRequest',
        requestId: event.params.requestId,
        parishionerId: request.parishionerId || ''
      },
      channelId: 'parish_admin'
    });
  }
);

// ---------------------------------------------------------------------------
// Sunday route updates made by an admin
// ---------------------------------------------------------------------------

const ROUTE_FIELDS = ['preferredVisitTime', 'status', 'active'];
const ADDRESS_FIELDS = ['street', 'city', 'state', 'zip', 'gateCode'];

const differs = (before, after, key) =>
  String(before?.[key] ?? '') !== String(after?.[key] ?? '');

/**
 * Fires when a parishioner record changes. Notifies the minister who gained the
 * visit, the one who lost it, and the assigned minister when the visit details
 * (preferred time, status, address) change.
 */
exports.notifyRouteUpdate = onDocumentUpdated(
  'parishioners/{parishionerId}',
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};

    if (before.deleted === true || after.deleted === true) return;

    const prevUid = before.assignedMinisterId || '';
    const nextUid = after.assignedMinisterId || '';
    if (!prevUid && !nextUid) return;

    const detailsChanged =
      ROUTE_FIELDS.some((key) => differs(before, after, key)) ||
      ADDRESS_FIELDS.some((key) => differs(before.address, after.address, key));

    if (prevUid === nextUid && !detailsChanged) return;

    const name = after.name || before.name || 'A parishioner';
    const jobs = [];

    if (nextUid && nextUid !== prevUid) {
      jobs.push([
        nextUid,
        'New visit on your Sunday route',
        `${name} has been added to your route. Tap to review.`
      ]);
    } else if (nextUid && detailsChanged) {
      jobs.push([
        nextUid,
        'Sunday route updated',
        `${name}'s visit details have changed. Tap to review your route.`
      ]);
    }

    if (prevUid && prevUid !== nextUid) {
      jobs.push([
        prevUid,
        'Sunday route updated',
        `${name} has been removed from your route.`
      ]);
    }

    for (const [uid, title, body] of jobs) {
      const snap = await db.collection('users').doc(uid).get();
      if (!snap.exists) continue;
      const user = { id: snap.id, ...snap.data() };
      if (user.active === false || user.deleted === true) continue;

      await sendPush([user], {
        title,
        body,
        data: { type: 'route', parishionerId: event.params.parishionerId },
        channelId: 'parish_route'
      });
    }

    console.log(`Route update for ${name}: ${jobs.length} notification(s).`);
  }
);
