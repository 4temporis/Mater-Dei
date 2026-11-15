# Publishing on Google Play — parish admin, multi-parish, and languages

Prepared for the Mater Dei Pastoral Care app (Capacitor + Firebase).

Short version: three separate jobs — **multi-parish (multi-tenant) data**, **Google Play compliance**, and **localisation**. The admin login page already exists; what is missing is turning a single-parish app into a product you can sell to many parishes.

---

## 1. The admin login you already have (and its one blocker)

`stitch_mater_dei_pastoral_tracker/login.html` already has:

- Minister / Administrator tabs
- Password reset
- A "signed in as…" session banner
- Post-sign-in routing driven by `users/{uid}.role` from Firestore
- A rejection message if a non-admin picks the Administrator tab

That is the right model — **role lives in the database, not in the app**.

The blocker is at **`login.html:119`**:

```js
const ADMIN_EMAIL = 'materdei.parowvalley@gmail.com'; // pre-fills the admin email
```

plus the "Contact the parish office" hint on the same screen. For a product that is wrong twice over: it exposes one customer's address, and it implies only that email can administer.

Replace it with:

- One sign-in form, **no pre-filled email**.
- Access decided entirely by `users/{uid}.role` (and later `parishId`).
- Keep the two tabs only as a UX nicety, but nothing in the client should hard-code who an admin is.

---

## 2. What "sell to many parishes" actually requires

Right now everything is scoped to one parish: `parishioners`, `visits`, `messages`, `invites`, `settings`, the app title, and `parishName: 'Mater Dei Parish'` in `web/firebase-client.js`. Two parishes in one database would see each other's people.

### Proposed data model

```text
parishes/{parishId}         name, diocese, address, defaultLanguage, logo, licence, active
users/{uid}                 role, parishId, active
parishioners/{id}           + parishId
visits/{id}                 + parishId
messages/{id}               + parishId
invites/{code}              + parishId
changeRequests/{id}         + parishId
settings/{id}               + parishId
```

### What else changes

- **Rules isolation** — every rule becomes
  `isActiveUser() && userDoc().parishId == resource.data.parishId`
  and on create `request.resource.data.parishId == userDoc().parishId`.
  This is the single most important change; without it you have a data breach between customers.
- **Signed-in user carries the parish** — no parish picker needed. Invites are created by an admin and stamped with their `parishId`, so new ministers land in the right parish automatically.
- **Per-parish admin onboarding** — when you sell a licence, create the parish document plus the first admin account (or send a one-time "parish setup" code). The parish head then invites their own ministers and runs the console. You should **not** be manually editing Firestore for each sale.
- **Per-parish branding and settings** — name, office phone, priest on call, next Sunday, default language. Most already live in `settings`; move the hard-coded titles into it so the header is not "Mater Dei" for everyone.
- **Cloud Functions** — `notifyMinisters` and `notifyAdminsOnChangeRequest` must filter recipients by `parishId`; messages should carry `parishId`.
- **Queries and indexes** — every list gets `where('parishId','==',...)`, which needs composite indexes (`firestore.indexes.json` plus `firebase deploy --only firestore:indexes`).
- **Data lifecycle** — per-parish export and delete (a parish leaving should be able to take and remove their data), plus backups. Play expects deletion; POPIA expects a retention policy.
- **Rename the package now** — `org.materdei.pastoraltracker` is permanent once uploaded and contains one customer's name. If this is a product, pick a neutral ID such as `app.parishcare.tracker` **before** the first upload; changing it later means a new listing and losing installs.

---

## 3. Google Play publishing checklist

### Technical

- Build an **`.aab`** (`bundleRelease`), not an APK.
- Enrol in **Play App Signing**; your current keystore becomes the *upload* key. Back it up — it is your identity for every future update.
- `targetSdk 36` is already correct. Check the **16 KB page-size** requirement for native libraries (Capacitor plugins) on Android 15+.
- Turn off `allowMixedContent: true` in `capacitor.config.json` — Play flags it and it is not needed.
- Add **account deletion** (in-app, plus a web link). Play requires it for any app that lets people create an account.
- Use a single version source of truth — `package.json` says 1.0.0 while Android is 1.3. `versionCode` must always increase.
- Verify the release build has no debug flags and that the service-account JSON can never ship (it is git-ignored today — keep it that way).

### Console and paperwork

- **Developer account**: $25 one-time. A personal account needs **12 testers for 14 continuous days** on a closed track before production. A company account (needs a D-U-N-S number) is better if you are invoicing parishes.
- **Privacy policy URL** (required).
- **Data safety form**, **content rating questionnaire**, target audience, ads declaration.
- **Store listing per language**:
  - title (30 characters)
  - short description (80)
  - full description (4000)
  - icon 512×512
  - feature graphic 1024×500
  - phone screenshots
  - Each language needs its own translated listing — that is what "on the store in different languages" means at store level.
- **Support email / URL**.
- **Pricing model**: free download with licences invoiced to parishes avoids Play Billing. If you sell subscriptions *inside* the app you must use Play Billing (15–30% fee).
- **Sensitive data**: you store names, addresses, phone numbers, sacramental records and well-being/mobility notes — special-category personal data.
  - Privacy policy and Data safety answers must declare this.
  - Firebase/Google must be declared as a processor.
  - Data is already encrypted in transit.
  - Under **POPIA** you need a lawful basis, an information officer, retention limits, and a cross-border transfer note (Firebase stores in the US).
  - Have a lawyer review the policy — it is cheap relative to a data incident.

---

## 4. Making it multilingual

The UI is HTML, so translation belongs in the web layer, not in Android resources.

1. **Extract every string** — page text, `showToast()` messages, `confirm()` / `prompt()` text, error messages and placeholders. Right now they are inline English in the HTML and JS.
2. **Dictionary files** — `web/i18n/en.json`, `af.json`, `zu.json`, `xh.json`, `st.json` (whatever parishes need), plus `t('key')` and `data-i18n="key"` attributes. A small runtime that swaps text on load is enough; i18next is the off-the-shelf option.
3. **Language selection** — an in-app picker (stored in `users.settings.language`, falling back to the parish default, then `navigator.language`), plus Android 13+ **per-app language** support (`android:localeConfig` + `locales_config.xml`) so it also appears in Android Settings.
4. **Formatting** — use `Intl.DateTimeFormat` and `Intl.NumberFormat`; no hard-coded month names.
5. **Fonts** — Inter covers Afrikaans; isiZulu / isiXhosa / Sesotho need system fallbacks or Noto.
6. **Do not translate records** — parishioner names, notes and addresses stay exactly as typed. Only UI chrome and parish settings text are localised.
7. **RTL readiness** — not needed for South African languages, but if you ever add Arabic or Hebrew, use logical CSS (`ms-` / `me-`) and `dir="rtl"` from day one to avoid a rewrite.
8. **Store listing** — translate title, short and full description and screenshots per language; Google indexes the listing per locale.

---

## 5. Sensible order of work

1. **Productise the identity**
   - Remove the hard-coded admin email.
   - Add `parishes` plus `parishId` everywhere.
   - Rewrite rules with tenant isolation.
   - Move branding into settings.
   - Choose the final app ID.
   - Deploy rules via the REST route (the CLI key is broken), and test with two parishes side by side.
2. **Play readiness**
   - Account deletion.
   - `allowMixedContent: false`.
   - `.aab` + Play App Signing.
   - Privacy policy and Data safety answers.
3. **i18n scaffold**
   - Extract strings.
   - Ship English + Afrikaans first.
   - Add the language picker.
   - Commission the remaining translations once the wording is stable.
4. **Closed testing**
   - 12 testers, 14 days.
   - Fix findings, then production with a staged rollout.

---

## Recommended first move

The highest-value first move is **tenant isolation** (`parishId` on every collection plus rules), because doing it after you have paying parishes is painful. The alternative starting point is the **login + i18n refactor** (no hard-coded admin email, string extraction with English and Afrikaans).

---

*Reference files: `stitch_mater_dei_pastoral_tracker/login.html`, `web/firebase-client.js`, `firestore.rules`, `android/app/build.gradle`, `capacitor.config.json`, `functions/index.js`.*
