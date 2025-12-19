import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import App from './App';
import './i18n/config'; // Initialize i18n
import './styles/theme.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file.");
}

if (!CONVEX_URL) {
  throw new Error("Missing Convex URL. Please run 'npx convex dev' to configure Convex.");
}

// Create Convex client
const convex = new ConvexReactClient(CONVEX_URL);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Check for misconfiguration: Production key on Localhost
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isProdKey = PUBLISHABLE_KEY.startsWith('pk_live_');

const root = ReactDOM.createRoot(rootElement);

if (isLocalhost && isProdKey) {
  root.render(
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: '#000',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '-0.05em' }}>Configuration Error</h1>
      <p style={{ color: '#a8a29e', marginBottom: '2rem', maxWidth: '400px', lineHeight: 1.5 }}>
        You are running <code style={{ color: '#fff' }}>localhost</code> with a <strong style={{ color: '#ef4444' }}>Production</strong> Clerk key.
        <br />
        Clerk blocks this for security.
      </p>
      <div style={{ backgroundColor: '#1c1917', padding: '1.5rem', borderRadius: '0.5rem', textAlign: 'left', border: '1px solid #333', fontSize: '13px', fontFamily: 'monospace' }}>
        <p style={{ color: '#78716c', marginBottom: '0.5rem' }}>// .env.local</p>
        <p style={{ color: '#f87171', textDecoration: 'line-through', opacity: 0.7 }}>VITE_CLERK_PUBLISHABLE_KEY={PUBLISHABLE_KEY.substring(0, 15)}...</p>
        <p style={{ color: '#4ade80', marginTop: '0.5rem' }}>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</p>
      </div>
      <p style={{ marginTop: '2rem', color: '#78716c', fontSize: '0.875rem' }}>Switch to your Development keys to proceed.</p>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        allowedRedirectOrigins={['capacitor://localhost', 'http://localhost:3000']}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </React.StrictMode>
  );
}
