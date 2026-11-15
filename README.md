# Mater Dei Pastoral Care

Eucharistic Ministry and homebound-visit tracker for Mater Dei Parish, built as a
Firebase-backed web app and packaged for Android with Capacitor.

## What is included

- **Sign in / invite signup** — Firebase Authentication (email + password).
- **Minister portal** — live parish directory, Sunday route, visit logging and inbox.
- **Admin console** — add/edit parishioners, assign ministers, generate one-time
  invite codes, send messages, and edit parish settings.
- **Messages** — in-app inbox with unread badges. Optional push notifications are
  delivered by the Cloud Function in `functions/`.
- **Offline-friendly Firestore** — persistent local cache for poor reception.

All screens read and write the Firebase project `eucharistic-ministers`. There is no
hard-coded sample content in the UI.

## Prerequisites

- Node.js 22+
- Java 21 (Android Studio's bundled JBR works)
- Android SDK with platform 36
- A Firebase project with Firestore enabled

## First-time Firebase setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create `android/app/google-services.json` and register the Android app:

   ```powershell
   npm run firebase:setup
   ```

3. **Enable Firebase Authentication** (required once per project):

   - Open the [Firebase console](https://console.firebase.google.com/project/eucharistic-ministers/authentication).
   - Choose **Get started**.
   - Open **Sign-in method** and enable **Email/Password**.

   The setup script cannot enable Authentication with the Admin SDK service
   account, so this step is manual.

4. Deploy the security rules and indexes:

   ```powershell
   npm run firebase:deploy-config
   ```

   If the Admin SDK service account is not allowed to deploy indexes, run:

   ```powershell
   firebase login --reauth
   firebase deploy --only firestore:rules,firestore:indexes
   ```

5. Create the admin login:

   ```powershell
   npm run admin:create
   ```

   The script prints the email and temporary password. The default email is
   `materdei.parowvalley@gmail.com`. Pass `--email` / `--password` to override,
   or set `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

   On the sign-in screen, choose the **Administrator** tab, confirm the parish
   email is filled in, and enter the password. The **Minister** tab is for
   Eucharistic Ministers who joined with an invite code. Both password fields
   have an eye button to reveal what you typed.

## Running locally

```powershell
npm run build:web
npm run serve
```

Then open <http://localhost:3000/login.html>.

> The pages use ES modules, so they must be served over HTTP (not opened as files).

## Building the Android APK

### Option A — GitHub Actions (no Android Studio needed)

Every push to `main` runs `.github/workflows/android.yml`. To get the APK:

1. Open the repository's **Actions** tab.
2. Select **Build Android APK → Debug APK**.
3. Download the `MaterDei-PastoralCare-apk` artifact and unzip it to get
   `app-debug.apk`.

You can also trigger a build manually with **Run workflow**.

### Option B — build locally

```powershell
npm run apk
```

This rebuilds the Tailwind CSS and Firebase bundle, copies the web assets into the
Android project, and runs Gradle `assembleDebug`.

The debug APK is written to:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

For a release build:

```powershell
npm run android:release
```

The release APK is written to:

```
android/app/build/outputs/apk/release/app-release.apk
```

Release builds are signed with the key described by `android/key.properties`
(`android/app/release.keystore`, PKCS12). Keep `release.keystore`,
`release-key.pem` and `key.properties` backed up and private — Android requires the
same key for every future update, and they are excluded from git.

### Install on a phone

Copy `app-release.apk` (or `app-debug.apk`) to the phone, tap it, and allow
"Install unknown apps" for the file manager or browser when prompted. The package
id is `org.materdei.pastoraltracker`.

### Mobile safe areas (status bar and navigation bar)

The app targets Android 15+ (targetSdk 36), which forces edge-to-edge drawing, so
the web view runs behind the phone's system bars. Typical Android dimensions are
a 24dp status bar (28–32dp around a camera cutout), a 48dp navigation bar with
3-button navigation, and a ~24dp inset for gesture navigation, but OEMs and
landscape differ — so nothing is hard-coded.

Instead, `web/input.css` consumes the runtime insets:

- Capacitor 8 injects `--safe-area-inset-top/right/bottom/left` from
  `WindowInsets` (`SystemBars` plugin, configured in `capacitor.config.json`).
- `env(safe-area-inset-*)` is used as the fallback for iOS and newer WebViews.
- `--safe-top` / `--safe-bottom` take the `max()` of both, and `.safe-top`,
  `.safe-bottom` and `.safe-modal` apply them to headers, bottom navigation and
  dialogs. Page bodies reserve `calc(6rem + var(--safe-bottom))` so content is
  never hidden behind the fixed bottom nav.
- `styleSystemBars()` in `web/firebase-client.js` picks light icons over the dark
  blue header and dark icons over light headers.

When changing the layout, keep new fixed/sticky bars inside these utilities
instead of adding fixed pixel padding.

### Searching parishioners

Search boxes on the dashboard and in the Admin Console match every word you type
in any order, against name, street, city, sector, phone, gate code, assigned
minister and record ID. So `alma snyders` finds "Alma Wilmina Snyders",
`ernest ada` finds "Mrs Ada Ernest", and `sny`, `parow` or `MD-6016` all work.
Matching ignores accents, punctuation and capitalisation (see `matchesSearch`
in `web/firebase-client.js`).

### Hiding the bottom navigation while scrolling

Every page with a bottom tab bar gets the shared behaviour from
`initAutoHideBottomNav()` (called by `initNativeShell()`). The bar slides away
while you scroll down and returns as soon as you scroll up, reach the top or
focus a field. It is CSS-only in `web/input.css` (`.bottom-nav` /
`.bottom-nav--hidden`) and respects `prefers-reduced-motion`.

### Minister change requests

Ministers never edit a parishioner record directly. On the parishioner page
they tap **Edit my details**, change the fields and tap **Send change request**:

1. `submitChangeRequest()` writes a `pending` document to `changeRequests` with
   a field-by-field summary, the proposed values and a snapshot of the record.
2. The parish office sees a banner on the dashboard, a badge on the **Requests**
   tab in the Admin Console and (when push is configured) a notification on the
   `parish_admin` channel.
3. An admin opens **Requests**, reviews the summary, and taps **Approve & save**.
   Only then does `approveChangeRequest()` update the parishioner, keeping the
   live visit and minister-assignment fields intact.
4. **Decline** stores an optional reason and leaves the record untouched. A
   minister can withdraw their own request while it is pending.

The `changeRequests` rules in `firestore.rules` restrict creation to the
signed-in minister and updates to admins; deploy them with
`firebase deploy --only firestore:rules`.

### Managing ministers and administrators

Admins can change both kinds of record without leaving the console.

**Parishioners.** Admin Console → **People** → pencil icon (name, age, status,
guild, sector, phone, assignment, address, gate code, access notes, dietary,
mobility, prayer intentions, notes) or the bin icon to delete. Tapping a name
opens the full record, where every field including sacraments is editable and
**Save parishioner record** writes directly.

**Ministers.** Admin Console → **Ministers** lists every sign-in account
(ministers first, administrators flagged with an **Admin** badge). Each card has:

- the **Active/Paused** chip – immediately grants or blocks access;
- the pencil icon – edit full name, mobile number, care team, role
  (Minister/Administrator) and access state, or send a password-reset email;
- the **person_remove** icon – remove the minister from the parish.

Removing a minister is a soft delete done entirely in the client:
`deleteMinisterAccount()` unassigns every parishioner assigned to them, then
clears the profile (name, email, phone, team, push tokens) and sets
`active: false` + `deleted: true`. Access is revoked instantly and the account
disappears from the minister list. To purge the Firebase Authentication record
(email and password) as well, run the Admin SDK script from the parish computer:

```powershell
npm run minister:delete -- --list
npm run minister:delete -- --email former-minister@example.org --yes
```

Add `--force` if the account is an administrator. Without `--yes` the script
only reports what it would delete. An admin cannot remove, demote or pause their
own account from the console, so the parish always keeps one way in.

## Push notifications (optional)

Push notifications use Firebase Cloud Messaging through the `notifyMinisters`
Cloud Function (new parish messages) and `notifyAdminsOnChangeRequest` (a
minister submitted a change request). Channel `parish_messages` carries the
messages; `parish_admin` carries the approval alerts:

```powershell
npm run functions:install
firebase deploy --only functions
```

Requirements:

- The Firebase project must be on the **Blaze** (pay-as-you-go) plan.
- `android/app/google-services.json` must exist before building the APK.
- Ministers must open the app once and grant notification permission.

The in-app inbox works even if push is not configured.

## Data model

| Collection      | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `users/{uid}`   | Profile and role (`admin` or `minister`), active flag, FCM tokens |
| `invites/{code}`| One-time minister invitation codes                             |
| `parishioners/{id}` | Homebound parishioner record and assignment                |
| `visits/{id}`   | Pastoral visit logs                                            |
| `messages/{id}` | Parish office messages (`audience: all` or a specific `toUid`)  |
| `settings/app`  | Parish name, Sunday details, office and on-call contacts       |

Roles are stored on `users/{uid}.role`. Security rules read that document rather
than relying on custom claims.

## Useful scripts

| Command                          | Purpose                                        |
| -------------------------------- | ---------------------------------------------- |
| `npm run build:web`              | Rebuild Tailwind CSS and the Firebase bundle   |
| `npm run cap:sync`               | Build web assets and copy them into Android    |
| `npm run apk`                    | Build a debug APK                              |
| `npm run firebase:setup`         | Register the Android app and download config   |
| `npm run firebase:deploy-config` | Deploy Firestore rules and indexes             |
| `npm run admin:create`           | Create/reset the admin login                   |
| `npm run minister:delete`        | Purge a removed minister's Auth account        |
| `npm run inspect`                | Print the current Firestore/Auth state         |
| `npm run check:pages`            | Syntax-check pages and local asset references  |

## Project layout

```
web/                                  Firebase client source + Tailwind entry
scripts/                              Setup, admin, validation and inspection tools
stitch_mater_dei_pastoral_tracker/    Web app (Capacitor webDir)
  index.html                          Portal / directory
  login.html, signup.html             Authentication
  minister_sunday_route_map/          Sunday route
  parishioner_sacramental_profile/    Parishioner record
  visit_notes_sacramental_log/        Visit form
  messages/                           Inbox
  admin_sunday_visit_roster/          Admin console
functions/                            FCM push Cloud Function
android/                              Capacitor Android project
.github/workflows/android.yml         CI build that produces the APK artifact
seed.js, sample-data.json             Optional Firestore sample data loader
```
