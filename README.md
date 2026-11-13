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

## Push notifications (optional)

Push notifications use Firebase Cloud Messaging through the `notifyMinisters`
Cloud Function:

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
