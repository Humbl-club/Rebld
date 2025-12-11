import React, { useState, useEffect, useRef } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   AUTH PAGE - Premium Athlete Welcome

   Design Philosophy:
   - Consistent with app aesthetic (rounded corners, coral accent)
   - Premium typography with Syne display font
   - Subtle coral glow for depth without gimmicks
   - Smooth iOS-style transitions
   - Rounded input fields matching onboarding
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

const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
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

  // Animation state
  const [showContent, setShowContent] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  // Code input refs
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Landing animation sequence
  useEffect(() => {
    if (mode !== 'landing') return;

    const t1 = setTimeout(() => setShowContent(true), 200);
    const t2 = setTimeout(() => setShowCTA(true), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
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

  // Shared input styles - rounded with subtle inner shadow
  const inputStyles = cn(
    "w-full h-14 px-4 bg-white/[0.04] rounded-xl",
    "text-white text-[17px] font-medium",
    "border border-white/[0.08]",
    "focus:border-[#E07A5F]/60 focus:bg-white/[0.06] focus:outline-none",
    "placeholder:text-white/30",
    "transition-all duration-200",
    "shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
  );

  // Primary button styles
  const primaryButtonStyles = cn(
    "w-full h-14 rounded-xl",
    "bg-[#E07A5F] text-white",
    "text-[17px] font-semibold",
    "active:scale-[0.98] active:brightness-90",
    "transition-all duration-150",
    "disabled:opacity-40 disabled:active:scale-100",
    "shadow-[0_2px_8px_rgba(224,122,95,0.3)]"
  );

  // Secondary button styles
  const secondaryButtonStyles = cn(
    "w-full h-14 rounded-xl",
    "bg-white/[0.06] text-white",
    "text-[17px] font-semibold",
    "border border-white/[0.08]",
    "active:bg-white/[0.1] active:scale-[0.98]",
    "transition-all duration-150"
  );

  // ═══════════════════════════════════════════════════════════════
  // LANDING - Premium Welcome
  // ═══════════════════════════════════════════════════════════════
  const renderLanding = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Main content - centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Coral glow behind logo */}
        <div className="relative mb-6">
          <div
            className="absolute inset-0 blur-[80px] opacity-25"
            style={{
              background: 'radial-gradient(circle, #E07A5F 0%, transparent 70%)',
              transform: 'scale(3)',
            }}
          />

          {/* Logo mark - four rounded squares */}
          <div
            className={cn(
              "relative grid grid-cols-2 gap-1.5",
              "transition-all duration-700 ease-out",
              showContent ? "opacity-100 scale-100" : "opacity-0 scale-90"
            )}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-8 h-8 bg-[#E07A5F] rounded-lg"
                style={{
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* REBLD wordmark */}
        <h1
          className={cn(
            "font-display text-[56px] font-black tracking-tight mb-3",
            "transition-all duration-700 delay-200",
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          <span className="text-white">RE</span>
          <span className="text-[#E07A5F]">BLD</span>
        </h1>

        {/* Tagline */}
        <p
          className={cn(
            "text-white/60 text-lg font-medium tracking-wide",
            "transition-all duration-700 delay-400",
            showContent ? "opacity-100" : "opacity-0"
          )}
        >
          Train smarter. Progress faster.
        </p>
      </div>

      {/* CTA Section */}
      <div
        className={cn(
          "px-6 pb-8",
          "transition-all duration-500 delay-600",
          showCTA ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        )}
      >
        <button
          onClick={() => { haptic.medium(); setMode('method'); }}
          className={primaryButtonStyles}
        >
          Get Started
        </button>

        <button
          onClick={() => { haptic.light(); setMode('email-signin'); }}
          className="w-full h-12 mt-3 text-white/60 text-[15px] font-medium active:text-white transition-colors"
        >
          I already have an account
        </button>

        <p className="text-center text-white/30 text-xs mt-6">
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // METHOD SELECTION
  // ═══════════════════════════════════════════════════════════════
  const renderMethod = () => (
    <div className="min-h-[100dvh] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="w-11 h-11 -ml-2 flex items-center justify-center text-white/70 active:text-white rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-10">
        <h1
          className="text-[34px] font-bold text-white leading-tight tracking-tight"
          style={{ fontFamily: "'Syne', var(--font-sans)" }}
        >
          Create your<br />account
        </h1>
        <p className="text-white/50 text-[15px] mt-3">
          Choose how you'd like to sign up
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 px-6">
        <div className="space-y-3">
          {/* Apple - primary white */}
          <button
            onClick={() => handleOAuth('oauth_apple')}
            disabled={loading}
            className={cn(
              "w-full h-14 rounded-xl",
              "bg-white text-black",
              "flex items-center justify-center gap-3",
              "text-[17px] font-semibold",
              "active:scale-[0.98] active:bg-white/90",
              "transition-all duration-150",
              "disabled:opacity-50"
            )}
          >
            <AppleIcon className="w-5 h-5" />
            Continue with Apple
          </button>

          {/* Google */}
          <button
            onClick={() => handleOAuth('oauth_google')}
            disabled={loading}
            className={cn(secondaryButtonStyles, "flex items-center justify-center gap-3")}
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 py-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email */}
          <button
            onClick={() => { haptic.light(); setMode('email-signup'); }}
            className={secondaryButtonStyles}
          >
            Continue with Email
          </button>
        </div>

        {/* Sign in link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => { haptic.light(); setMode('email-signin'); }}
            className="text-white/50 text-[15px] min-h-[44px]"
          >
            Already have an account? <span className="text-[#E07A5F] font-semibold">Sign in</span>
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="w-11 h-11 -ml-2 flex items-center justify-center text-white/70 active:text-white rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-8">
        <h1
          className="text-[34px] font-bold text-white leading-tight tracking-tight"
          style={{ fontFamily: "'Syne', var(--font-sans)" }}
        >
          Welcome back
        </h1>
        <p className="text-white/50 text-[15px] mt-3">
          Sign in to continue your training
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignIn} className="flex-1 px-6">
        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-white/70 text-[13px] font-medium mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
              className={inputStyles}
              placeholder="you@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-white/70 text-[13px] font-medium mb-2 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={cn(inputStyles, "pr-12")}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/40 active:text-white/60"
              >
                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Forgot */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { haptic.light(); setMode('forgot'); }}
              className="text-[#E07A5F] text-[14px] font-medium py-2 active:opacity-70"
            >
              Forgot password?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
              <p className="text-[#FF6B6B] text-[14px]">{error}</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={loading || !email || !password}
            className={primaryButtonStyles}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        {/* Create account */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { haptic.light(); setMode('email-signup'); }}
            className="text-white/50 text-[15px] min-h-[44px]"
          >
            New here? <span className="text-[#E07A5F] font-semibold">Create account</span>
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="w-11 h-11 -ml-2 flex items-center justify-center text-white/70 active:text-white rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-8">
        <h1
          className="text-[34px] font-bold text-white leading-tight tracking-tight"
          style={{ fontFamily: "'Syne', var(--font-sans)" }}
        >
          Create account
        </h1>
        <p className="text-white/50 text-[15px] mt-3">
          Start your training journey
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignUp} className="flex-1 px-6">
        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-white/70 text-[13px] font-medium mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
              className={inputStyles}
              placeholder="you@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-white/70 text-[13px] font-medium mb-2 block">
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
                className={cn(inputStyles, "pr-12")}
                placeholder="8+ characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/40 active:text-white/60"
              >
                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-white/40 text-[12px] mt-2">
              Must be at least 8 characters
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
              <p className="text-[#FF6B6B] text-[14px]">{error}</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={loading || !email || password.length < 8}
            className={primaryButtonStyles}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </div>

        {/* Sign in link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { haptic.light(); setMode('email-signin'); }}
            className="text-white/50 text-[15px] min-h-[44px]"
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="w-11 h-11 -ml-2 flex items-center justify-center text-white/70 active:text-white rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-8">
        <h1
          className="text-[34px] font-bold text-white leading-tight tracking-tight"
          style={{ fontFamily: "'Syne', var(--font-sans)" }}
        >
          Check your email
        </h1>
        <p className="text-white/50 text-[15px] mt-3">
          We sent a 6-digit code to<br />
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      {/* Code input */}
      <form onSubmit={handleVerify} className="flex-1 px-6">
        <div className="flex justify-center gap-2">
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
                "w-12 h-14 rounded-xl text-center",
                "bg-white/[0.04] border",
                "text-white text-2xl font-bold",
                "focus:outline-none transition-all duration-200",
                "shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",
                code[i]
                  ? "border-[#E07A5F]/60 bg-white/[0.06]"
                  : "border-white/[0.08]"
              )}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
            <p className="text-[#FF6B6B] text-[14px]">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className={primaryButtonStyles}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </div>

        {/* Resend */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => haptic.light()}
            className="text-white/50 text-[15px] min-h-[44px]"
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="w-11 h-11 -ml-2 flex items-center justify-center text-white/70 active:text-white rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-8">
        <h1
          className="text-[34px] font-bold text-white leading-tight tracking-tight"
          style={{ fontFamily: "'Syne', var(--font-sans)" }}
        >
          Reset password
        </h1>
        <p className="text-white/50 text-[15px] mt-3">
          Enter your email and we'll send you a reset code
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleForgotPassword} className="flex-1 px-6">
        <div>
          <label className="text-white/70 text-[13px] font-medium mb-2 block">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
            className={inputStyles}
            placeholder="you@email.com"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
            <p className="text-[#FF6B6B] text-[14px]">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={loading || !email}
            className={primaryButtonStyles}
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="w-11 h-11 -ml-2 flex items-center justify-center text-white/70 active:text-white rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-8">
        <h1
          className="text-[34px] font-bold text-white leading-tight tracking-tight"
          style={{ fontFamily: "'Syne', var(--font-sans)" }}
        >
          New password
        </h1>
        <p className="text-white/50 text-[15px] mt-3">
          Code sent to <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleResetPassword} className="flex-1 px-6">
        {/* Code */}
        <div className="mb-6">
          <label className="text-white/70 text-[13px] font-medium mb-2 block">
            Verification code
          </label>
          <div className="flex justify-center gap-2">
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
                  "w-12 h-14 rounded-xl text-center",
                  "bg-white/[0.04] border",
                  "text-white text-2xl font-bold",
                  "focus:outline-none transition-all duration-200",
                  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",
                  resetCode[i]
                    ? "border-[#E07A5F]/60 bg-white/[0.06]"
                    : "border-white/[0.08]"
                )}
              />
            ))}
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="text-white/70 text-[13px] font-medium mb-2 block">
            New password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className={cn(inputStyles, "pr-12")}
              placeholder="8+ characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/40 active:text-white/60"
            >
              {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
            <p className="text-[#FF6B6B] text-[14px]">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={loading || resetCode.length !== 6 || newPassword.length < 8}
            className={primaryButtonStyles}
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
