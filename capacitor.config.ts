import type { CapacitorConfig } from '@capacitor/cli';

// For iOS builds: NEVER use localhost server
// The app loads from bundled files in dist/
const config: CapacitorConfig = {
  appId: 'de.rebld.app',
  appName: 'REBLD',
  webDir: 'dist',
  ios: {
    contentInset: 'never', // Don't add insets - we handle safe areas in CSS
    preferredContentMode: 'mobile',
    scheme: 'REBLD',
    backgroundColor: '#000000', // Match app background
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // We manually hide when HTML is ready
      launchShowDuration: 3000, // Max time before auto-hide (fallback)
      backgroundColor: '#0A0A0A', // Match HTML splash exactly
      showSpinner: false,
      launchFadeOutDuration: 200, // Quick fade when we hide it
    },
    StatusBar: {
      style: 'light', // Light text for dark background
      backgroundColor: '#000000',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  // NO server block - app loads from bundled dist/ files
};

export default config;
