# Mater Dei Pastoral Care (Android)

## Get the APK (no Android Studio needed)
1. Create a free GitHub account and a new PRIVATE repository.
2. Upload everything in this folder (including the hidden .github folder).
3. Open the repository's Actions tab, choose "Build Android APK", click Run workflow.
4. When it finishes (about 5 minutes), open the run and download the
   "MaterDei-PastoralCare-apk" artifact. Unzip it to get app-debug.apk.
5. Send app-debug.apk to your phone, tap it, and allow "Install unknown apps" if asked.

## Build locally instead
    npm install
    npx cap add android
    npx cap sync android
    npx cap open android      # then Build > Build APK(s) in Android Studio

## Editing the app
All app code is in www/index.html. After changes run: npx cap sync android
