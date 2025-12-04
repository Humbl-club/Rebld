#!/bin/bash

# Script to change app name from "app" to "Rebld"
echo "Changing app name to Rebld..."

# Step 1: Copy configuration files to correct locations
echo "Step 1: Copying configuration files..."

# Copy iOS Info.plist (you'll need to adjust the path based on your project structure)
if [ -d "ios/App/App" ]; then
    cp ios-Info.plist ios/App/App/Info.plist
    echo "✓ iOS Info.plist updated"
else
    echo "⚠ iOS directory not found - please manually copy ios-Info.plist to ios/App/App/Info.plist"
fi

# Copy Android strings.xml (you'll need to adjust the path based on your project structure)
if [ -d "android/app/src/main/res/values" ]; then
    cp android-strings.xml android/app/src/main/res/values/strings.xml
    echo "✓ Android strings.xml updated"
else
    echo "⚠ Android directory not found - please manually copy android-strings.xml to android/app/src/main/res/values/strings.xml"
fi

# Step 2: Run Capacitor sync
echo "Step 2: Syncing Capacitor..."
npx cap sync

echo "Step 3: Copying assets..."
npx cap copy

echo "✅ App name change complete!"
echo ""
echo "Next steps:"
echo "1. Open your iOS project: npx cap open ios"
echo "2. Open your Android project: npx cap open android"
echo "3. Clean and rebuild both projects"
echo "4. Update your bundle identifier in Xcode (iOS) and build.gradle (Android) if needed"