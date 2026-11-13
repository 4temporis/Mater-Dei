// ---------------------------------------------------------------------------
// Mater Dei Pastoral Care — Firebase client (source)
// Bundled by esbuild into stitch_mater_dei_pastoral_tracker/firebase-client.js
// ---------------------------------------------------------------------------

import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { App as CapacitorApp } from '@capacitor/app';

export const firebaseConfig = {
  apiKey: 'AIzaSyCdjLmyEtckA-dqW-FXtV6p-9xGKPODH9U',
  authDomain: 'eucharistic-ministers.firebaseapp.com',
  projectId: 'eucharistic-ministers',
  storageBucket: 'eucharistic-ministers.firebasestorage.app',
  messagingSenderId: '211167104882',
  appId: '1:211167104882:web:2c1c765e1d3bd33c8517eb'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline-first cache so ministers can keep working with poor reception.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const ROOT_URL = new URL('./', import.meta.url);

export function appUrl(path = '') {
  return new URL(path, ROOT_URL).href;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, options);
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function nextSunday(from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  const add = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + add);
  return date;
}

export function toDateInputValue(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function sortByCreatedAtDesc(items) {
  return items.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() || new Date(a.timestamp || 0).getTime();
    const bt = b.createdAt?.toMillis?.() || new Date(b.timestamp || 0).getTime();
    return bt - at;
  });
}

// ---------------------------------------------------------------------------
// Auth + session
// ---------------------------------------------------------------------------

export function waitForAuthUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signOutSession() {
  await signOut(auth);
}

export async function signOutUser() {
  await signOut(auth);
  window.location.replace(appUrl('login.html'));
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signUpWithInvite({ name, email, password, phone = '', code }) {
  const inviteCode = String(code || '').trim().toUpperCase();
  if (!inviteCode) throw new Error('An invitation code is required.');

  const inviteRef = doc(db, 'invites', inviteCode);
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

  try {
    await updateProfile(cred.user, { displayName: name.trim() });
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('That invitation code was not found.');
    if (inviteSnap.data().used) throw new Error('That invitation code has already been used.');

    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      team: inviteSnap.data().team || '',
      role: 'minister',
      active: true,
      inviteCode,
      createdAt: serverTimestamp()
    });

    await updateDoc(inviteRef, {
      used: true,
      usedBy: cred.user.uid,
      usedAt: serverTimestamp()
    });

    return cred.user;
  } catch (err) {
    try {
      await deleteUser(cred.user);
    } catch (cleanupError) {
      console.warn('Could not clean up failed signup:', cleanupError);
    }
    throw err;
  }
}

/**
 * Resolves the signed-in profile or redirects to the login page.
 * Returns null when a redirect happened.
 */
export async function requireSession({ roles = ['admin', 'minister'], allowInactive = false } = {}) {
  const user = await waitForAuthUser();
  if (!user) {
    const next = encodeURIComponent(
      window.location.pathname.replace(/^\/+/, '') + window.location.search
    );
    window.location.replace(appUrl(`login.html?next=${next}`));
    return null;
  }

  let profile;
  try {
    profile = await getUserProfile(user.uid);
  } catch (err) {
    console.error('Unable to load user profile:', err);
    window.location.replace(appUrl('login.html?error=profile'));
    return null;
  }

  if (!profile) {
    window.location.replace(appUrl('login.html?error=profile'));
    return null;
  }

  if (!allowInactive && profile.active === false) {
    window.location.replace(appUrl('login.html?error=inactive'));
    return null;
  }

  if (roles && !roles.includes(profile.role)) {
    window.location.replace(appUrl('index.html?denied=1'));
    return null;
  }

  return { user, profile };
}

/**
 * Fills data-session-* placeholders, hides admin-only links and binds sign-out.
 */
export function applySessionUI(profile) {
  const name = profile.displayName || profile.email || 'Parish Member';
  document.querySelectorAll('[data-session-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-session-initials]').forEach((el) => {
    el.textContent = initials(name);
  });
  document.querySelectorAll('[data-session-role]').forEach((el) => {
    el.textContent = profile.role === 'admin' ? 'Parish Admin' : 'Eucharistic Minister';
  });
  document.querySelectorAll('[data-session-email]').forEach((el) => {
    el.textContent = profile.email || '';
  });

  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    if (profile.role === 'admin') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  document.querySelectorAll('[data-minister-only]').forEach((el) => {
    if (profile.role === 'minister') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  document.querySelectorAll('[data-sign-out]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      signOutUser();
    });
  });
}

// ---------------------------------------------------------------------------
// Native shell helpers (Capacitor)
// ---------------------------------------------------------------------------

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function initNativeShell() {
  if (!isNativeApp()) return;
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  });
}

export async function registerPushNotifications(user) {
  if (!isNativeApp() || !user) return;

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return;

    try {
      await PushNotifications.createChannel({
        id: 'parish_messages',
        name: 'Parish Messages',
        description: 'Messages from the parish office',
        importance: 4,
        visibility: 1,
        vibration: true
      });
    } catch (channelError) {
      console.warn('Notification channel:', channelError);
    }

    PushNotifications.addListener('registration', async (token) => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          fcmTokens: arrayUnion(token.value),
          lastTokenAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Could not store push token:', err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error:', err);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', () => {
      window.location.href = appUrl('messages/code.html');
    });

    await PushNotifications.register();
    localStorage.setItem('pushEnabled', '1');
  } catch (err) {
    console.warn('Push notifications unavailable:', err);
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS = {
  parishName: 'Mater Dei Parish',
  parishSubtitle: 'Eucharistic Ministry & Homebound Care',
  priestOnCallName: '',
  priestOnCallPhone: '',
  officePhone: '',
  officeEmail: '',
  nextSundayDate: '',
  liturgicalSunday: '',
  welcomeMessage: ''
};

export async function getAppSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'app'));
    return { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
  } catch (err) {
    console.warn('Using default settings:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAppSettings(settings) {
  await setDoc(
    doc(db, 'settings', 'app'),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Parishioners
// ---------------------------------------------------------------------------

function normalizeParishioner(data = {}) {
  const address = data.address || {};
  return {
    name: (data.name || '').trim(),
    age: data.age === '' || data.age == null ? null : Number(data.age),
    guild: data.guild || '',
    status: data.status || 'Homebound',
    sector: data.sector || '',
    phone: data.phone || '',
    active: data.active !== false,
    assignedMinisterId: data.assignedMinisterId || '',
    assignedMinisterName: data.assignedMinisterName || '',
    lastVisitAt: data.lastVisitAt || '',
    address: {
      street: address.street || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.zip || '',
      gateCode: address.gateCode || '',
      accessNotes: address.accessNotes || ''
    },
    sacramentalLife: {
      baptism: data.sacramentalLife?.baptism || { verified: false, year: '' },
      firstCommunion: data.sacramentalLife?.firstCommunion || { verified: false, year: '' },
      confirmation: data.sacramentalLife?.confirmation || { verified: false, year: '' },
      anointingOfSick: data.sacramentalLife?.anointingOfSick || { lastDate: '', notes: '' }
    },
    pastoralCare: {
      dietary: data.pastoralCare?.dietary || '',
      mobility: data.pastoralCare?.mobility || '',
      prayerIntentions: data.pastoralCare?.prayerIntentions || ''
    },
    preferredVisitTime: data.preferredVisitTime || '',
    notes: data.notes || ''
  };
}

export function fullAddress(parishioner) {
  const a = parishioner?.address || {};
  return [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ');
}

export function mapsUrl(parishioner) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(parishioner))}`;
}

export function telUrl(phone) {
  return `tel:${String(phone || '').replace(/[^+\d]/g, '')}`;
}

export async function getParishioner(id) {
  const snap = await getDoc(doc(db, 'parishioners', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllParishioners() {
  const snap = await getDocs(collection(db, 'parishioners'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.active !== false);
}

export async function getAssignedParishioners(ministerUid) {
  if (!ministerUid) return [];
  const snap = await getDocs(
    query(collection(db, 'parishioners'), where('assignedMinisterId', '==', ministerUid))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.active !== false);
}

export async function addParishioner(data) {
  const payload = normalizeParishioner(data);
  if (!payload.name) throw new Error('A parishioner name is required.');

  let id = `MD-${Math.floor(1000 + Math.random() * 9000)}`;
  for (let i = 0; i < 5; i += 1) {
    const existing = await getDoc(doc(db, 'parishioners', id));
    if (!existing.exists()) break;
    id = `MD-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  await setDoc(doc(db, 'parishioners', id), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return id;
}

export async function updateParishioner(id, data) {
  const payload = normalizeParishioner(data);
  if (!payload.name) throw new Error('A parishioner name is required.');
  await setDoc(
    doc(db, 'parishioners', id),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return id;
}

export async function assignParishionerMinister(parishionerId, ministerUid, ministerName) {
  await updateDoc(doc(db, 'parishioners', parishionerId), {
    assignedMinisterId: ministerUid || '',
    assignedMinisterName: ministerName || '',
    updatedAt: serverTimestamp()
  });
}

export async function deleteParishioner(id) {
  await deleteDoc(doc(db, 'parishioners', id));
}

// ---------------------------------------------------------------------------
// Ministers (approved users)
// ---------------------------------------------------------------------------

export async function listMinisters() {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'minister')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

export async function listAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setMinisterActive(uid, active) {
  await updateDoc(doc(db, 'users', uid), { active: !!active, updatedAt: serverTimestamp() });
}

export async function updateOwnProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), {
    displayName: data.displayName || '',
    phone: data.phone || '',
    updatedAt: serverTimestamp()
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

function randomInviteCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

export async function createInvite({ name = '', email = '', team = '', phone = '' }) {
  let code = randomInviteCode();
  for (let i = 0; i < 5; i += 1) {
    const existing = await getDoc(doc(db, 'invites', code));
    if (!existing.exists()) break;
    code = randomInviteCode();
  }

  await setDoc(doc(db, 'invites', code), {
    code,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    team: team.trim(),
    used: false,
    createdAt: serverTimestamp()
  });
  return code;
}

export async function listInvites() {
  const snap = await getDocs(query(collection(db, 'invites'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteInvite(code) {
  await deleteDoc(doc(db, 'invites', code));
}

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

export async function saveVisitLog({
  parishionerId,
  parishionerName = '',
  ministerUid,
  ministerName = '',
  routeId = '',
  eucharistAdministered = false,
  lowGlutenHost = false,
  scriptureRead = '',
  priestVisitRequested = false,
  notes = '',
  wellBeing = {},
  visitDate = new Date().toISOString()
}) {
  if (!parishionerId) throw new Error('A parishioner is required.');
  if (!ministerUid) throw new Error('A signed-in minister is required.');

  const payload = {
    parishionerId,
    parishionerName,
    ministerUid,
    ministerName,
    routeId,
    eucharistAdministered: !!eucharistAdministered,
    lowGlutenHost: !!lowGlutenHost,
    scriptureRead,
    priestVisitRequested: !!priestVisitRequested,
    notes,
    wellBeing: {
      physical: wellBeing.physical || '',
      spiritual: wellBeing.spiritual || '',
      mood: wellBeing.mood || ''
    },
    timestamp: visitDate,
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'visits'), payload);

  try {
    await updateDoc(doc(db, 'parishioners', parishionerId), {
      lastVisitAt: visitDate,
      lastVisitBy: ministerName,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Could not stamp last visit on parishioner:', err);
  }

  return ref.id;
}

export async function getVisitsForParishioner(parishionerId, max = 20) {
  const snap = await getDocs(
    query(collection(db, 'visits'), where('parishionerId', '==', parishionerId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    .slice(0, max);
}

export async function getMinisterVisits(ministerUid, max = 200) {
  if (!ministerUid) return [];
  const snap = await getDocs(
    query(collection(db, 'visits'), where('ministerUid', '==', ministerUid))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    .slice(0, max);
}

export async function getAllVisits(max = 500) {
  const snap = await getDocs(query(collection(db, 'visits'), orderBy('timestamp', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function visitsToday(visits = []) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();
  return visits.filter((visit) => (visit.timestamp || '') >= startIso);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function sendMessage({ subject, body, toUid = '', toName = '', sender }) {
  const payload = {
    subject: subject.trim(),
    body: body.trim(),
    audience: toUid ? 'minister' : 'all',
    toUid: toUid || '',
    toName: toName || '',
    senderUid: sender?.uid || '',
    senderName: sender?.displayName || sender?.email || 'Parish Office',
    readBy: [],
    createdAt: serverTimestamp()
  };
  if (!payload.subject) throw new Error('A subject is required.');
  if (!payload.body) throw new Error('A message body is required.');
  const ref = await addDoc(collection(db, 'messages'), payload);
  return ref.id;
}

export async function getInbox(uid, isAdmin = false) {
  if (isAdmin) {
    const snap = await getDocs(collection(db, 'messages'));
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  const [allSnap, directSnap] = await Promise.all([
    getDocs(query(collection(db, 'messages'), where('audience', '==', 'all'))),
    getDocs(query(collection(db, 'messages'), where('toUid', '==', uid)))
  ]);

  const map = new Map();
  [...allSnap.docs, ...directSnap.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
  return sortByCreatedAtDesc([...map.values()]);
}

export function subscribeInbox(uid, isAdmin, onChange) {
  if (isAdmin) {
    return onSnapshot(collection(db, 'messages'), (snap) => {
      onChange(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
  }

  const buckets = { all: [], direct: [] };
  const emit = () => {
    const map = new Map();
    [...buckets.all, ...buckets.direct].forEach((m) => map.set(m.id, m));
    onChange(sortByCreatedAtDesc([...map.values()]));
  };

  const unsubAll = onSnapshot(
    query(collection(db, 'messages'), where('audience', '==', 'all')),
    (snap) => {
      buckets.all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => console.warn('Inbox subscription:', err)
  );
  const unsubDirect = onSnapshot(
    query(collection(db, 'messages'), where('toUid', '==', uid)),
    (snap) => {
      buckets.direct = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => console.warn('Direct messages subscription:', err)
  );

  return () => {
    unsubAll();
    unsubDirect();
  };
}

export function unreadMessages(messages = [], uid) {
  return messages.filter((m) => m.senderUid !== uid && !(m.readBy || []).includes(uid));
}

export async function markMessageRead(messageId, uid) {
  await updateDoc(doc(db, 'messages', messageId), { readBy: arrayUnion(uid) });
}

export async function deleteMessage(messageId) {
  await deleteDoc(doc(db, 'messages', messageId));
}

export async function markAllMessagesRead(messages, uid) {
  await Promise.all(
    unreadMessages(messages, uid).map((message) => markMessageRead(message.id, uid))
  );
}

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const [parishionersSnap, ministersSnap, visitsSnap] = await Promise.all([
    getDocs(collection(db, 'parishioners')),
    getDocs(query(collection(db, 'users'), where('role', '==', 'minister'))),
    getDocs(query(collection(db, 'visits'), orderBy('timestamp', 'desc'), limit(500)))
  ]);

  const parishioners = parishionersSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.active !== false);
  const ministers = ministersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const visits = visitsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return {
    parishioners: parishioners.length,
    ministers: ministers.filter((m) => m.active !== false).length,
    assigned: parishioners.filter((p) => !!p.assignedMinisterId).length,
    unassigned: parishioners.filter((p) => !p.assignedMinisterId).length,
    visitsToday: visitsToday(visits).length,
    visitsThisMonth: visits.filter((v) => new Date(v.timestamp || 0) >= startOfMonth).length,
    totalVisits: visits.length,
    parishionersList: parishioners,
    ministersList: ministers,
    visitsList: visits
  };
}

// ---------------------------------------------------------------------------
// Re-exports used by the UI pages
// ---------------------------------------------------------------------------

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp
};
