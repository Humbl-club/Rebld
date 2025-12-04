import { useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';

/* ═══════════════════════════════════════════════════════════════
   SSO CALLBACK - OAuth Redirect Handler

   Handles the redirect from OAuth providers (Google, Apple).
   Completes the sign-in flow and redirects to home.
   ═══════════════════════════════════════════════════════════════ */

export default function SSOCallback() {
  const { handleRedirectCallback } = useClerk();

  useEffect(() => {
    // Let Clerk handle the OAuth callback automatically
    handleRedirectCallback({
      afterSignInUrl: '/',
      afterSignUpUrl: '/',
    }).catch((error) => {
      console.error('SSO callback error:', error);
      // Redirect to home on error
      window.location.href = '/';
    });
  }, [handleRedirectCallback]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-center">
        <div className="font-display text-4xl font-black tracking-tight mb-4">
          <span className="text-[var(--text-primary)]">RE</span>
          <span className="text-[var(--brand-primary)]">BLD</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
          <span className="text-[var(--text-secondary)] text-sm">Signing you in...</span>
        </div>
      </div>
    </div>
  );
}
