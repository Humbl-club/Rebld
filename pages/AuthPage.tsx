import React, { useState, useEffect } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useHaptic, useSequentialReveal, usePulse } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   AUTH PAGE - Custom Clerk Integration

   Fully custom authentication UI using Clerk hooks.
   Supports: Email/Password, Google OAuth, Apple OAuth
   60fps animations, haptic feedback, REBLD design language.
   ═══════════════════════════════════════════════════════════════ */

// Apple icon
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

// Google icon
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Mail icon
const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

// Lock icon
const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

// Eye icons for password visibility
const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Animated background orbs
function BackgroundOrbs() {
  const pulse1 = usePulse(4000);
  const pulse2 = usePulse(5000);
  const pulse3 = usePulse(3500);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main coral orb */}
      <div
        className="absolute will-change-transform"
        style={{
          width: '300px',
          height: '300px',
          top: '-100px',
          right: '-80px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224, 122, 95, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: `scale(${1 + pulse1 * 0.15})`,
        }}
      />
      {/* Secondary amber orb */}
      <div
        className="absolute will-change-transform"
        style={{
          width: '250px',
          height: '250px',
          bottom: '10%',
          left: '-60px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244, 162, 97, 0.12) 0%, transparent 70%)',
          filter: 'blur(50px)',
          transform: `scale(${1 + pulse2 * 0.1})`,
        }}
      />
      {/* Subtle accent orb */}
      <div
        className="absolute will-change-transform"
        style={{
          width: '200px',
          height: '200px',
          top: '40%',
          left: '60%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224, 122, 95, 0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          transform: `scale(${1 + pulse3 * 0.12})`,
        }}
      />
    </div>
  );
}

type AuthMode = 'select' | 'signin' | 'signup' | 'verify' | 'forgot' | 'reset';

export default function AuthPage() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const haptic = useHaptic();

  const [mode, setMode] = useState<AuthMode>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Animation reveal
  const revealed = useSequentialReveal(6, 80, 200);

  // Clear error when switching modes
  useEffect(() => {
    setError('');
    setPassword('');
    setCode('');
    setResetCode('');
    setNewPassword('');
  }, [mode]);

  // OAuth handlers
  const handleOAuth = async (provider: 'oauth_google' | 'oauth_apple') => {
    if (!signInLoaded || !signIn) return;

    haptic.medium();
    setLoading(true);
    setError('');

    try {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'OAuth failed. Please try again.');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;

    haptic.light();
    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        haptic.success();
        await setSignInActive({ session: result.createdSessionId });
      } else {
        // Handle additional verification if needed
        console.log('Sign in requires additional steps:', result);
      }
    } catch (err: any) {
      const message = err.errors?.[0]?.message || 'Sign in failed. Check your credentials.';
      setError(message);
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;

    haptic.light();
    setLoading(true);
    setError('');

    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
      setMode('verify');
      haptic.success();
    } catch (err: any) {
      const message = err.errors?.[0]?.message || 'Sign up failed. Please try again.';
      setError(message);
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Forgot password - send reset code
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;

    haptic.light();
    setLoading(true);
    setError('');

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      haptic.success();
      setMode('reset');
    } catch (err: any) {
      const message = err.errors?.[0]?.message || 'Failed to send reset code. Check your email.';
      setError(message);
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Reset password with code
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;

    haptic.light();
    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });

      if (result.status === 'complete') {
        haptic.success();
        await setSignInActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      const message = err.errors?.[0]?.message || 'Failed to reset password. Check the code.';
      setError(message);
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Verify email code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;

    haptic.light();
    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        haptic.success();
        await setSignUpActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      const message = err.errors?.[0]?.message || 'Verification failed. Check the code.';
      setError(message);
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Method selection screen
  const renderSelect = () => (
    <div className="space-y-4">
      {/* Social buttons */}
      <div
        className={cn(
          'space-y-3',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        {/* Apple Sign In */}
        <button
          onClick={() => handleOAuth('oauth_apple')}
          disabled={loading}
          className={cn(
            'w-full h-14',
            'flex items-center justify-center gap-3',
            'bg-white text-black',
            'rounded-2xl',
            'font-semibold text-base',
            'active:scale-[0.98]',
            'transition-transform duration-150',
            'disabled:opacity-50'
          )}
        >
          <AppleIcon className="w-5 h-5" />
          Continue with Apple
        </button>

        {/* Google Sign In */}
        <button
          onClick={() => handleOAuth('oauth_google')}
          disabled={loading}
          className={cn(
            'w-full h-14',
            'flex items-center justify-center gap-3',
            'bg-[var(--surface-primary)]',
            'border border-[var(--border-default)]',
            'rounded-2xl',
            'font-semibold text-base',
            'text-[var(--text-primary)]',
            'active:scale-[0.98]',
            'transition-transform duration-150',
            'disabled:opacity-50'
          )}
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </button>
      </div>

      {/* Divider */}
      <div
        className={cn(
          'flex items-center gap-4 py-2',
          'opacity-0',
          revealed[1] && 'opacity-100 transition-opacity duration-500'
        )}
      >
        <div className="flex-1 h-px bg-[var(--border-default)]" />
        <span className="text-sm text-[var(--text-tertiary)]">or</span>
        <div className="flex-1 h-px bg-[var(--border-default)]" />
      </div>

      {/* Email options */}
      <div
        className={cn(
          'space-y-3',
          'opacity-0 translate-y-4',
          revealed[2] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => { haptic.light(); setMode('signin'); }}
          className="h-14 rounded-2xl"
        >
          <MailIcon className="w-5 h-5 mr-2" />
          Sign in with Email
        </Button>

        <button
          onClick={() => { haptic.light(); setMode('signup'); }}
          className={cn(
            'w-full py-3',
            'text-[var(--brand-primary)]',
            'font-semibold text-base',
            'active:opacity-70',
            'transition-opacity duration-150'
          )}
        >
          Create an account
        </button>
      </div>
    </div>
  );

  // Sign in form
  const renderSignIn = () => (
    <form onSubmit={handleSignIn} className="space-y-5">
      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<MailIcon className="w-5 h-5" />}
          size="lg"
          autoComplete="email"
          autoCapitalize="none"
          required
        />

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<LockIcon className="w-5 h-5" />}
            size="lg"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2',
              'p-2 -m-2',
              'text-[var(--text-tertiary)]',
              'active:text-[var(--text-primary)]'
            )}
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* Forgot password link */}
        <button
          type="button"
          onClick={() => { haptic.light(); setMode('forgot'); }}
          className={cn(
            'w-full text-right',
            'text-sm font-medium',
            'text-[var(--brand-primary)]',
            'active:opacity-70',
            'transition-opacity duration-150',
            'min-h-[44px] flex items-center justify-end'
          )}
        >
          Forgot Password?
        </button>
      </div>

      {error && (
        <p className="text-[var(--status-error-bg)] text-sm font-medium animate-fade-in">
          {error}
        </p>
      )}

      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[1] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          className="h-14 rounded-2xl"
        >
          Sign In
        </Button>

        <button
          type="button"
          onClick={() => { haptic.light(); setMode('select'); }}
          className="w-full py-2 text-[var(--text-secondary)] text-sm font-medium"
        >
          ← Back to options
        </button>
      </div>
    </form>
  );

  // Forgot password form - enter email
  const renderForgot = () => (
    <form onSubmit={handleForgotPassword} className="space-y-5">
      <div
        className={cn(
          'text-center space-y-2 mb-4',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--brand-primary-subtle)] flex items-center justify-center">
          <LockIcon className="w-8 h-8 text-[var(--brand-primary)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Reset Password</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Enter your email and we'll send you a code to reset your password.
        </p>
      </div>

      <div
        className={cn(
          'opacity-0 translate-y-4',
          revealed[1] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<MailIcon className="w-5 h-5" />}
          size="lg"
          autoComplete="email"
          autoCapitalize="none"
          required
        />
      </div>

      {error && (
        <p className="text-[var(--status-error-bg)] text-sm font-medium animate-fade-in text-center">
          {error}
        </p>
      )}

      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[2] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          className="h-14 rounded-2xl"
        >
          Send Reset Code
        </Button>

        <button
          type="button"
          onClick={() => { haptic.light(); setMode('signin'); }}
          className="w-full py-2 text-[var(--text-secondary)] text-sm font-medium"
        >
          ← Back to sign in
        </button>
      </div>
    </form>
  );

  // Reset password form - enter code and new password
  const renderReset = () => (
    <form onSubmit={handleResetPassword} className="space-y-5">
      <div
        className={cn(
          'text-center space-y-2',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--brand-primary-subtle)] flex items-center justify-center">
          <MailIcon className="w-8 h-8 text-[var(--brand-primary)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Check your email</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          We sent a reset code to<br />
          <span className="font-semibold text-[var(--text-primary)]">{email}</span>
        </p>
      </div>

      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[1] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Input
          type="text"
          placeholder="Enter 6-digit code"
          value={resetCode}
          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          size="lg"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="text-center text-2xl tracking-[0.5em] font-bold"
          required
        />

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<LockIcon className="w-5 h-5" />}
            size="lg"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2',
              'p-2 -m-2',
              'text-[var(--text-tertiary)]',
              'active:text-[var(--text-primary)]'
            )}
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>

        <p className="text-xs text-[var(--text-tertiary)]">
          Password must be at least 8 characters
        </p>
      </div>

      {error && (
        <p className="text-[var(--status-error-bg)] text-sm font-medium animate-fade-in text-center">
          {error}
        </p>
      )}

      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[2] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={resetCode.length !== 6 || newPassword.length < 8}
          className="h-14 rounded-2xl"
        >
          Reset Password
        </Button>

        <button
          type="button"
          onClick={() => { haptic.light(); setMode('forgot'); }}
          className="w-full py-2 text-[var(--text-secondary)] text-sm font-medium"
        >
          ← Use different email
        </button>
      </div>
    </form>
  );

  // Sign up form
  const renderSignUp = () => (
    <form onSubmit={handleSignUp} className="space-y-5">
      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<MailIcon className="w-5 h-5" />}
          size="lg"
          autoComplete="email"
          autoCapitalize="none"
          required
        />

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<LockIcon className="w-5 h-5" />}
            size="lg"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2',
              'p-2 -m-2',
              'text-[var(--text-tertiary)]',
              'active:text-[var(--text-primary)]'
            )}
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>

        <p className="text-xs text-[var(--text-tertiary)]">
          Password must be at least 8 characters
        </p>
      </div>

      {error && (
        <p className="text-[var(--status-error-bg)] text-sm font-medium animate-fade-in">
          {error}
        </p>
      )}

      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[1] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          className="h-14 rounded-2xl"
        >
          Create Account
        </Button>

        <button
          type="button"
          onClick={() => { haptic.light(); setMode('select'); }}
          className="w-full py-2 text-[var(--text-secondary)] text-sm font-medium"
        >
          ← Back to options
        </button>
      </div>
    </form>
  );

  // Email verification form
  const renderVerify = () => (
    <form onSubmit={handleVerify} className="space-y-5">
      <div
        className={cn(
          'text-center space-y-2',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--brand-primary-subtle)] flex items-center justify-center">
          <MailIcon className="w-8 h-8 text-[var(--brand-primary)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Check your email</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          We sent a verification code to<br />
          <span className="font-semibold text-[var(--text-primary)]">{email}</span>
        </p>
      </div>

      <div
        className={cn(
          'opacity-0 translate-y-4',
          revealed[1] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Input
          type="text"
          placeholder="Enter 6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          size="lg"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="text-center text-2xl tracking-[0.5em] font-bold"
          required
        />
      </div>

      {error && (
        <p className="text-[var(--status-error-bg)] text-sm font-medium animate-fade-in text-center">
          {error}
        </p>
      )}

      <div
        className={cn(
          'space-y-4',
          'opacity-0 translate-y-4',
          revealed[2] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
        )}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={code.length !== 6}
          className="h-14 rounded-2xl"
        >
          Verify Email
        </Button>

        <button
          type="button"
          onClick={() => {
            haptic.light();
            setPendingVerification(false);
            setMode('signup');
          }}
          className="w-full py-2 text-[var(--text-secondary)] text-sm font-medium"
        >
          ← Use different email
        </button>
      </div>
    </form>
  );

  // Get title based on mode
  const getTitle = () => {
    switch (mode) {
      case 'signin': return 'Welcome back';
      case 'signup': return 'Create account';
      case 'verify': return 'Verify email';
      case 'forgot': return 'Forgot password';
      case 'reset': return 'Reset password';
      default: return 'Get Started';
    }
  };

  return (
    <div
      className={cn(
        'min-h-screen',
        'bg-[var(--bg-primary)]',
        'flex flex-col',
        'px-6',
        'pt-[max(60px,env(safe-area-inset-top))]',
        'pb-[max(24px,env(safe-area-inset-bottom))]',
        'relative overflow-hidden'
      )}
    >
      {/* Animated background */}
      <BackgroundOrbs />

      {/* Logo */}
      <div
        className={cn(
          'text-center mb-8',
          'opacity-0 translate-y-4',
          revealed[0] && 'opacity-100 translate-y-0 transition-all duration-700 ease-out'
        )}
      >
        <div className="font-display text-5xl font-black tracking-tight mb-2">
          <span className="text-[var(--text-primary)]">RE</span>
          <span className="text-[var(--brand-primary)]">BLD</span>
        </div>
        <p className="text-sm text-[var(--text-tertiary)] font-medium">
          Your AI Training Partner
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        {/* Title */}
        <h1
          className={cn(
            'text-2xl font-bold text-[var(--text-primary)] mb-6',
            'opacity-0 translate-y-4',
            revealed[1] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
          )}
          style={{ transitionDelay: '100ms' }}
        >
          {getTitle()}
        </h1>

        {/* Auth forms */}
        <div
          className={cn(
            'opacity-0 translate-y-4',
            revealed[2] && 'opacity-100 translate-y-0 transition-all duration-500 ease-out'
          )}
          style={{ transitionDelay: '200ms' }}
        >
          {mode === 'select' && renderSelect()}
          {mode === 'signin' && renderSignIn()}
          {mode === 'signup' && renderSignUp()}
          {mode === 'verify' && renderVerify()}
          {mode === 'forgot' && renderForgot()}
          {mode === 'reset' && renderReset()}
        </div>
      </div>

      {/* Footer */}
      <div
        className={cn(
          'text-center pt-6',
          'opacity-0',
          revealed[3] && 'opacity-100 transition-opacity duration-500'
        )}
        style={{ transitionDelay: '400ms' }}
      >
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          By continuing, you agree to our{' '}
          <span className="text-[var(--text-secondary)]">Terms of Service</span>
          {' '}and{' '}
          <span className="text-[var(--text-secondary)]">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
