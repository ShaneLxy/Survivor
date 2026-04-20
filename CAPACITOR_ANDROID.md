# Capacitor Android Packaging

This project now includes a Capacitor wrapper configuration for Android.

## 1. Install dependencies

Run in the project root:

```bash
npm install
npm run android:doctor
```

## 2. Prepare the web assets

This copies the current game files into `mobile/web` for Capacitor:

```bash
npm run cap:prepare
```

## 3. Create the Android project

Run this once:

```bash
npx cap add android
```

## 4. Sync and configure the Android project

```bash
npm run cap:sync
npm run cap:android-config
```

This will:

1. copy the current web game into `mobile/web`
2. sync Capacitor assets into the native Android project
3. apply the current mobile defaults:
   - portrait orientation
   - non-resizable activity
   - internet permission
   - Chinese app name
   - immersive fullscreen main activity

## 5. Build the APK / AAB

### Option A: with Android Studio

In Android Studio:

1. wait for Gradle sync to finish
2. choose `Build`
3. choose `Build Bundle(s) / APK(s)`
4. build either:
   - `APK` for direct installation and testing
   - `AAB` for store-style publishing

### Option B: without Android Studio

You can also build from the command line, but you still need:

1. JDK
2. Android SDK command-line tools
3. Gradle support from the generated Android project

Commands:

```bash
npm run android:doctor
npm run android:build:debug
npm run android:build:release
```

Outputs are usually generated under:

- `android/app/build/outputs/apk/debug/`
- `android/app/build/outputs/bundle/release/`

## Notes

- App ID is currently `com.survivor.game`
- App name is currently `末日生存`
- Web assets are staged into `mobile/web`
- Each time the game files change, rerun:

```bash
npm run cap:sync
```

## Recommended next step

After `npx cap add android`, we should still do one Android-specific pass for:

- app icon and splash screen
- final device testing
