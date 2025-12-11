import React, { useState, useEffect, useRef } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   AUTH PAGE - "BUILDING" CONCEPT

   The auth page IS the brand. No forms floating on screens.
   You're literally building your account - blocks stack up.
   Typography does the heavy lifting. No decoration.

   Inspired by: Brutalist architecture, Apple's confidence,
   construction sites, the act of "rebuilding"
   ═══════════════════════════════════════════════════════════════ */

const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

type AuthMode = 'landing' | 'method' | 'email-signin' | 'email-signup' | 'verify' | 'forgot' | 'reset';

export default function AuthPage() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const haptic = useHaptic();

  const [mode, setMode] = useState<AuthMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Block animation state
  const [blocksBuilt, setBlocksBuilt] = useState(0);
  const [showTagline, setShowTagline] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  // Code input refs
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Landing animation sequence
  useEffect(() => {
    if (mode !== 'landing') return;

    // Build blocks one by one
    const intervals: NodeJS.Timeout[] = [];
    for (let i = 0; i < 4; i++) {
      intervals.push(setTimeout(() => {
        setBlocksBuilt(i + 1);
        haptic.light();
      }, 400 + i * 200));
    }

    // Show tagline after blocks
    intervals.push(setTimeout(() => setShowTagline(true), 1400));

    // Show CTA
    intervals.push(setTimeout(() => setShowCTA(true), 2000));

    return () => intervals.forEach(clearTimeout);
  }, [mode]);

  // Reset form state on mode change
  useEffect(() => {
    setError('');
    if (mode === 'landing' || mode === 'method') {
      setPassword('');
      setCode('');
      setResetCode('');
      setNewPassword('');
    }
  }, [mode]);

  // OAuth
  const handleOAuth = async (provider: 'oauth_google' | 'oauth_apple') => {
    if (!signInLoaded || !signIn) return;
    haptic.medium();
    setLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Authentication failed');
      haptic.error();
      setLoading(false);
    }
  };

  // Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;
    haptic.light();
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        haptic.success();
        await setSignInActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid credentials');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    haptic.light();
    setLoading(true);
    setError('');
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMode('verify');
      haptic.success();
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Sign up failed');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Verify
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
      setError(err.errors?.[0]?.message || 'Invalid code');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;
    haptic.light();
    setLoading(true);
    setError('');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      haptic.success();
      setMode('reset');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to send reset code');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Reset Password
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
      setError(err.errors?.[0]?.message || 'Reset failed');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Code input handler
  const handleCodeInput = (index: number, value: string, setter: React.Dispatch<React.SetStateAction<string>>, current: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = current.padEnd(6, ' ').split('');
    arr[index] = digit || ' ';
    setter(arr.join('').trim());
    if (digit && index < 5) codeInputRefs.current[index + 1]?.focus();
    haptic.light();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent, current: string) => {
    if (e.key === 'Backspace' && !current[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Navigate
  const goBack = () => {
    haptic.light();
    if (mode === 'email-signin' || mode === 'email-signup') setMode('method');
    else if (mode === 'verify') setMode('email-signup');
    else if (mode === 'forgot') setMode('email-signin');
    else if (mode === 'reset') setMode('forgot');
    else if (mode === 'method') setMode('landing');
    else setMode('landing');
  };

  // ═══════════════════════════════════════════════════════════════
  // LANDING - The "Building" Experience
  // ═══════════════════════════════════════════════════════════════
  const renderLanding = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Main content - centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* THE BLOCKS - they ARE the logo */}
        <div className="mb-12">
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-12 h-12 bg-[#E07A5F]",
                  "transition-all duration-300 ease-out"
                )}
                style={{
                  opacity: blocksBuilt > i ? 1 : 0,
                  transform: blocksBuilt > i
                    ? 'translateY(0) scale(1)'
                    : 'translateY(-20px) scale(0.8)',
                }}
              />
            ))}
          </div>
        </div>

        {/* REBLD - appears after blocks */}
        <h1
          className={cn(
            "text-7xl font-black tracking-tighter mb-4",
            "transition-all duration-500",
            blocksBuilt >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <span className="text-white">RE</span>
          <span className="text-[#E07A5F]">BLD</span>
        </h1>

        {/* Tagline - simple, direct */}
        <p
          className={cn(
            "text-white/60 text-xl font-medium",
            "transition-all duration-500 delay-200",
            showTagline ? "opacity-100" : "opacity-0"
          )}
        >
          Build yourself.
        </p>
      </div>

      {/* CTA - single tap to enter */}
      <div
        className={cn(
          "px-6 pb-8",
          "transition-all duration-500",
          showCTA ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        <button
          onClick={() => { haptic.medium(); setMode('method'); }}
          className={cn(
            "w-full h-16 bg-[#E07A5F]",
            "text-white text-lg font-bold tracking-wide",
            "active:scale-[0.98] transition-transform"
          )}
        >
          START
        </button>

        <p className="text-center text-white/30 text-xs mt-6">
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // METHOD SELECTION - Choose how to authenticate
  // ═══════════════════════════════════════════════════════════════
  const renderMethod = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Back */}
      <div className="px-6 pt-4">
        <button
          onClick={goBack}
          className="text-white/60 text-base font-medium min-h-[44px] -ml-2 px-2 active:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-12">
        <h1 className="text-5xl font-black text-white leading-none">
          How do you<br />want to<br />sign in?
        </h1>
      </div>

      {/* Options - stacked full-width */}
      <div className="flex-1 px-6">
        <div className="space-y-3">
          {/* Apple */}
          <button
            onClick={() => handleOAuth('oauth_apple')}
            disabled={loading}
            className={cn(
              "w-full h-16 bg-white text-black",
              "flex items-center justify-center gap-3",
              "text-base font-semibold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-50"
            )}
          >
            <AppleIcon className="w-6 h-6" />
            Apple
          </button>

          {/* Google */}
          <button
            onClick={() => handleOAuth('oauth_google')}
            disabled={loading}
            className={cn(
              "w-full h-16 bg-white/10 text-white",
              "flex items-center justify-center gap-3",
              "text-base font-semibold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-50"
            )}
          >
            <GoogleIcon className="w-6 h-6" />
            Google
          </button>

          {/* Email Sign In */}
          <button
            onClick={() => { haptic.light(); setMode('email-signin'); }}
            className={cn(
              "w-full h-16 bg-transparent border-2 border-white/20 text-white",
              "text-base font-semibold",
              "active:bg-white/5 transition-colors"
            )}
          >
            Email
          </button>
        </div>

        {/* Create account option */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <button
            onClick={() => { haptic.light(); setMode('email-signup'); }}
            className="w-full text-center"
          >
            <span className="text-white/50">New here? </span>
            <span className="text-[#E07A5F] font-semibold">Create account</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // EMAIL SIGN IN
  // ═══════════════════════════════════════════════════════════════
  const renderEmailSignIn = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Back */}
      <div className="px-6 pt-4">
        <button
          onClick={goBack}
          className="text-white/60 text-base font-medium min-h-[44px] -ml-2 px-2 active:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-8">
        <h1 className="text-4xl font-black text-white leading-tight">
          Welcome<br />back.
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSignIn} className="flex-1 px-6">
        <div className="space-y-6">
          {/* Email */}
          <div>
            <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
              className={cn(
                "w-full h-14 px-0 bg-transparent",
                "text-white text-xl font-medium",
                "border-b-2 border-white/20 rounded-none",
                "focus:border-[#E07A5F] focus:outline-none",
                "placeholder:text-white/20",
                "transition-colors"
              )}
              placeholder="you@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={cn(
                  "w-full h-14 px-0 pr-12 bg-transparent",
                  "text-white text-xl font-medium",
                  "border-b-2 border-white/20 rounded-none",
                  "focus:border-[#E07A5F] focus:outline-none",
                  "placeholder:text-white/20",
                  "transition-colors"
                )}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/40"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Forgot */}
          <button
            type="button"
            onClick={() => { haptic.light(); setMode('forgot'); }}
            className="text-[#E07A5F] text-sm font-semibold min-h-[44px] active:opacity-70"
          >
            Forgot password?
          </button>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border-l-4 border-red-500">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="mt-12">
          <button
            type="submit"
            disabled={loading || !email || !password}
            className={cn(
              "w-full h-16 bg-[#E07A5F] text-white",
              "text-lg font-bold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-30"
            )}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // EMAIL SIGN UP
  // ═══════════════════════════════════════════════════════════════
  const renderEmailSignUp = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Back */}
      <div className="px-6 pt-4">
        <button
          onClick={goBack}
          className="text-white/60 text-base font-medium min-h-[44px] -ml-2 px-2 active:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-8">
        <h1 className="text-4xl font-black text-white leading-tight">
          Let's build<br />your account.
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSignUp} className="flex-1 px-6">
        <div className="space-y-6">
          {/* Email */}
          <div>
            <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
              className={cn(
                "w-full h-14 px-0 bg-transparent",
                "text-white text-xl font-medium",
                "border-b-2 border-white/20 rounded-none",
                "focus:border-[#E07A5F] focus:outline-none",
                "placeholder:text-white/20",
                "transition-colors"
              )}
              placeholder="you@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className={cn(
                  "w-full h-14 px-0 pr-12 bg-transparent",
                  "text-white text-xl font-medium",
                  "border-b-2 border-white/20 rounded-none",
                  "focus:border-[#E07A5F] focus:outline-none",
                  "placeholder:text-white/20",
                  "transition-colors"
                )}
                placeholder="8+ characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/40"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border-l-4 border-red-500">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="mt-12">
          <button
            type="submit"
            disabled={loading || !email || password.length < 8}
            className={cn(
              "w-full h-16 bg-[#E07A5F] text-white",
              "text-lg font-bold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-30"
            )}
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </div>

        {/* Sign in link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { haptic.light(); setMode('email-signin'); }}
            className="text-white/50 text-sm min-h-[44px]"
          >
            Already have an account? <span className="text-[#E07A5F] font-semibold">Sign in</span>
          </button>
        </div>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // VERIFY EMAIL
  // ═══════════════════════════════════════════════════════════════
  const renderVerify = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Back */}
      <div className="px-6 pt-4">
        <button
          onClick={goBack}
          className="text-white/60 text-base font-medium min-h-[44px] -ml-2 px-2 active:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-8">
        <h1 className="text-4xl font-black text-white leading-tight">
          Check your<br />email.
        </h1>
        <p className="text-white/50 text-base mt-4">
          We sent a 6-digit code to<br />
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      {/* Code input */}
      <form onSubmit={handleVerify} className="flex-1 px-6">
        <div className="flex justify-between gap-2 max-w-xs">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <input
              key={i}
              ref={(el) => (codeInputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={code[i] || ''}
              onChange={(e) => handleCodeInput(i, e.target.value, setCode, code)}
              onKeyDown={(e) => handleCodeKeyDown(i, e, code)}
              className={cn(
                "w-12 h-16 bg-transparent",
                "text-white text-3xl font-bold text-center",
                "border-b-4 rounded-none",
                "focus:outline-none",
                "transition-colors",
                code[i] ? "border-[#E07A5F]" : "border-white/20"
              )}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border-l-4 border-red-500">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-12">
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className={cn(
              "w-full h-16 bg-[#E07A5F] text-white",
              "text-lg font-bold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-30"
            )}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {/* Resend */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => haptic.light()}
            className="text-white/50 text-sm min-h-[44px]"
          >
            Didn't get it? <span className="text-[#E07A5F] font-semibold">Resend code</span>
          </button>
        </div>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════
  const renderForgot = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Back */}
      <div className="px-6 pt-4">
        <button
          onClick={goBack}
          className="text-white/60 text-base font-medium min-h-[44px] -ml-2 px-2 active:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-8">
        <h1 className="text-4xl font-black text-white leading-tight">
          Reset your<br />password.
        </h1>
        <p className="text-white/50 text-base mt-4">
          Enter your email and we'll send you a reset code.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleForgotPassword} className="flex-1 px-6">
        <div>
          <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
            className={cn(
              "w-full h-14 px-0 bg-transparent",
              "text-white text-xl font-medium",
              "border-b-2 border-white/20 rounded-none",
              "focus:border-[#E07A5F] focus:outline-none",
              "placeholder:text-white/20",
              "transition-colors"
            )}
            placeholder="you@email.com"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border-l-4 border-red-500">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-12">
          <button
            type="submit"
            disabled={loading || !email}
            className={cn(
              "w-full h-16 bg-[#E07A5F] text-white",
              "text-lg font-bold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-30"
            )}
          >
            {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
        </div>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RESET PASSWORD
  // ═══════════════════════════════════════════════════════════════
  const renderReset = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Back */}
      <div className="px-6 pt-4">
        <button
          onClick={goBack}
          className="text-white/60 text-base font-medium min-h-[44px] -ml-2 px-2 active:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-8">
        <h1 className="text-4xl font-black text-white leading-tight">
          New<br />password.
        </h1>
        <p className="text-white/50 text-base mt-4">
          Code sent to <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleResetPassword} className="flex-1 px-6">
        {/* Code */}
        <div className="mb-8">
          <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
            Code
          </label>
          <div className="flex justify-between gap-2 max-w-xs">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                ref={(el) => (codeInputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={resetCode[i] || ''}
                onChange={(e) => handleCodeInput(i, e.target.value, setResetCode, resetCode)}
                onKeyDown={(e) => handleCodeKeyDown(i, e, resetCode)}
                className={cn(
                  "w-12 h-16 bg-transparent",
                  "text-white text-3xl font-bold text-center",
                  "border-b-4 rounded-none",
                  "focus:outline-none",
                  "transition-colors",
                  resetCode[i] ? "border-[#E07A5F]" : "border-white/20"
                )}
              />
            ))}
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3 block">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className={cn(
                "w-full h-14 px-0 pr-12 bg-transparent",
                "text-white text-xl font-medium",
                "border-b-2 border-white/20 rounded-none",
                "focus:border-[#E07A5F] focus:outline-none",
                "placeholder:text-white/20",
                "transition-colors"
              )}
              placeholder="8+ characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/40"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border-l-4 border-red-500">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-12">
          <button
            type="submit"
            disabled={loading || resetCode.length !== 6 || newPassword.length < 8}
            className={cn(
              "w-full h-16 bg-[#E07A5F] text-white",
              "text-lg font-bold",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-30"
            )}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {mode === 'landing' && renderLanding()}
      {mode === 'method' && renderMethod()}
      {mode === 'email-signin' && renderEmailSignIn()}
      {mode === 'email-signup' && renderEmailSignUp()}
      {mode === 'verify' && renderVerify()}
      {mode === 'forgot' && renderForgot()}
      {mode === 'reset' && renderReset()}
    </>
  );
}
