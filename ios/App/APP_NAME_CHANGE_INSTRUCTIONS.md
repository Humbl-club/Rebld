# How to Change Your App Name to "Rebld"

I've created several configuration files for you. Here's how to apply them:

## Files Created:
1. `capacitor.config.ts` - Main Capacitor configuration
2. `package.json` - Node.js package configuration  
3. `ios-Info.plist` - iOS app configuration template
4. `android-strings.xml` - Android app name configuration template
5. `change-app-name.sh` - Script to help apply changes

## Manual Steps Required:

### 1. Replace/Update Existing Files:
- Replace your existing `capacitor.config.ts` (or `.json`) with the new one
- Update your `package.json` with the new name fields
- Copy `ios-Info.plist` to `ios/App/App/Info.plist` 
- Copy `android-strings.xml` to `android/app/src/main/res/values/strings.xml`

### 2. Update Bundle Identifiers:
You'll also need to update your bundle identifiers:

**iOS (in Xcode):**
1. Open `ios/App/App.xcworkspace`
2. Select the App target
3. Change Bundle Identifier from `com.example.app` to `com.yourcompany.rebld`

**Android:**
1. Edit `android/app/build.gradle`
2. Change `applicationId` from `com.example.app` to `com.yourcompany.rebld`

### 3. Run Capacitor Commands:
```bash
npx cap sync
npx cap copy
```

### 4. Clean and Rebuild:
- iOS: Product → Clean Build Folder in Xcode
- Android: Build → Clean Project in Android Studio

## Alternative Quick Method:
Run the provided script (make it executable first):
```bash
chmod +x change-app-name.sh
./change-app-name.sh
```

## Important Notes:
- Replace "yourcompany" in the bundle identifiers with your actual company/organization name
- Make sure to clean and rebuild your projects after making these changes
- Test on both iOS and Android to ensure the name appears correctly

The app name "Rebld" will now appear:
- On the home screen
- In the app switcher
- In system settings
- In the App Store/Play Store listings