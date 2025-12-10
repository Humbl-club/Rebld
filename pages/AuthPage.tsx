import React, { useState, useEffect } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   AUTH PAGE - Premium Brutalist Design

   Design Philosophy:
   - Large, confident typography (Syne display font)
   - Building blocks animation (REBLD brand)
   - Brutalist 2px borders on premium elements
   - Coral accent strategically placed
   - OLED-optimized pure black background
   - Athletic, data-driven aesthetic
   ═══════════════════════════════════════════════════════════════ */

// Icons
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

const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
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

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

// Building blocks animation component (REBLD brand identity)
function BuildingBlocks() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-center gap-[clamp(4px,1.1vw,6px)] mb-[clamp(20px,5.3vw,28px)]">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'w-[clamp(12px,3.2vw,16px)] h-[clamp(12px,3.2vw,16px)] bg-[var(--brand-primary)] transition-all',
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          )}
          style={{
            transitionDelay: `${i * 100 + 200}ms`,
            transitionDuration: '400ms',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      ))}
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      setError(err.errors?.[0]?.message || 'Authentication failed');
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

  // Email/Password Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    haptic.light();
    setLoading(true);
    setError('');
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
      setMode('verify');
      haptic.success();
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Sign up failed');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  // Forgot password
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

  // Reset password
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

  // Verify email
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

  // Input component with brutalist styling
  const Input = ({
    icon,
    type = 'text',
    rightElement,
    ...props
  }: {
    icon?: React.ReactNode;
    type?: string;
    rightElement?: React.ReactNode;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="relative">
      {icon && (
        <div className="absolute left-[clamp(14px,3.7vw,18px)] top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
          {icon}
        </div>
      )}
      <input
        type={type}
        className={cn(
          'w-full h-[clamp(52px,13.9vw,60px)] bg-[var(--bg-secondary)]',
          'border-2 border-[var(--border-strong)] rounded-[var(--radius-lg)]',
          'text-[var(--text-primary)] type-body font-medium',
          'placeholder:text-[var(--text-disabled)]',
          'focus:border-[var(--brand-primary)] focus:outline-none',
          'transition-colors duration-150',
          icon ? 'pl-[clamp(44px,11.7vw,52px)] pr-[clamp(14px,3.7vw,18px)]' : 'px-[clamp(14px,3.7vw,18px)]',
          rightElement ? 'pr-[clamp(44px,11.7vw,52px)]' : ''
        )}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-[clamp(14px,3.7vw,18px)] top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  );

  // Premium button with brutalist styling
  const PremiumButton = ({
    children,
    variant = 'primary',
    loading: isLoading,
    ...props
  }: {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
    loading?: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      className={cn(
        'w-full h-[clamp(52px,13.9vw,60px)] rounded-[var(--radius-lg)]',
        'type-button',
        'transition-all duration-150 active:scale-[0.97]',
        'flex items-center justify-center gap-3',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-[var(--brand-primary)] text-white border-2 border-[var(--brand-primary)]',
        variant === 'secondary' && 'bg-transparent text-[var(--text-primary)] border-2 border-[var(--border-strong)] hover:border-[var(--brand-primary)]',
        variant === 'ghost' && 'bg-transparent text-[var(--text-secondary)] border-none hover:text-[var(--text-primary)]'
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );

  // Social button (Apple-style solid buttons)
  const SocialButton = ({
    icon,
    children,
    dark,
    ...props
  }: {
    icon: React.ReactNode;
    children: React.ReactNode;
    dark?: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      className={cn(
        'w-full h-[clamp(52px,13.9vw,60px)] rounded-[var(--radius-lg)]',
        'type-body font-semibold',
        'transition-all duration-150 active:scale-[0.97]',
        'flex items-center justify-center gap-3',
        'disabled:opacity-50',
        dark
          ? 'bg-white text-black'
          : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-2 border-[var(--border-strong)]'
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );

  // Main selection screen
  const renderSelect = () => (
    <div className={cn(
      'space-y-[clamp(14px,3.7vw,18px)] transition-all duration-500',
      mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    )}>
      {/* Social logins */}
      <SocialButton
        dark
        icon={<AppleIcon className="w-5 h-5" />}
        onClick={() => handleOAuth('oauth_apple')}
        disabled={loading}
      >
        Continue with Apple
      </SocialButton>

      <SocialButton
        icon={<GoogleIcon className="w-5 h-5" />}
        onClick={() => handleOAuth('oauth_google')}
        disabled={loading}
      >
        Continue with Google
      </SocialButton>

      {/* Divider */}
      <div className="flex items-center gap-[clamp(14px,3.7vw,18px)] py-[clamp(14px,3.7vw,18px)]">
        <div className="flex-1 h-[2px] bg-[var(--border-strong)]" />
        <span className="type-label-sm">
          Or
        </span>
        <div className="flex-1 h-[2px] bg-[var(--border-strong)]" />
      </div>

      {/* Email options */}
      <PremiumButton
        variant="secondary"
        onClick={() => { haptic.light(); setMode('signin'); }}
      >
        <MailIcon className="w-5 h-5" />
        Sign in with Email
      </PremiumButton>

      <button
        onClick={() => { haptic.light(); setMode('signup'); }}
        className={cn(
          'w-full py-[clamp(14px,3.7vw,18px)] text-center',
          'text-[var(--brand-primary)] type-body font-bold',
          'active:opacity-70 transition-opacity'
        )}
      >
        Create new account
      </button>
    </div>
  );

  // Sign in form
  const renderSignIn = () => (
    <form onSubmit={handleSignIn} className="space-y-[clamp(14px,3.7vw,18px)]">
      <Input
        icon={<MailIcon className="w-5 h-5" />}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoCapitalize="none"
        required
      />

      <Input
        icon={<LockIcon className="w-5 h-5" />}
        type={showPassword ? 'text' : 'password'}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-2 -m-2 text-[var(--text-tertiary)] active:text-[var(--text-primary)]"
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        }
      />

      <button
        type="button"
        onClick={() => { haptic.light(); setMode('forgot'); }}
        className="block w-full text-right text-[var(--brand-primary)] type-body-sm font-semibold py-2"
      >
        Forgot password?
      </button>

      {error && (
        <div className="p-[clamp(14px,3.7vw,18px)] bg-[var(--status-error-subtle)] border-2 border-[var(--status-error-bg)] rounded-[var(--radius-md)]">
          <p className="text-[var(--status-error-bg)] type-body-sm font-medium">{error}</p>
        </div>
      )}

      <PremiumButton type="submit" loading={loading}>
        Sign In
      </PremiumButton>
    </form>
  );

  // Sign up form
  const renderSignUp = () => (
    <form onSubmit={handleSignUp} className="space-y-[clamp(14px,3.7vw,18px)]">
      <Input
        icon={<MailIcon className="w-5 h-5" />}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoCapitalize="none"
        required
      />

      <Input
        icon={<LockIcon className="w-5 h-5" />}
        type={showPassword ? 'text' : 'password'}
        placeholder="Create password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-2 -m-2 text-[var(--text-tertiary)] active:text-[var(--text-primary)]"
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        }
      />

      <p className="type-label-sm text-[var(--text-disabled)]">
        Minimum 8 characters
      </p>

      {error && (
        <div className="p-[clamp(14px,3.7vw,18px)] bg-[var(--status-error-subtle)] border-2 border-[var(--status-error-bg)] rounded-[var(--radius-md)]">
          <p className="text-[var(--status-error-bg)] type-body-sm font-medium">{error}</p>
        </div>
      )}

      <PremiumButton type="submit" loading={loading}>
        Create Account
      </PremiumButton>
    </form>
  );

  // Verify email form
  const renderVerify = () => (
    <form onSubmit={handleVerify} className="space-y-[clamp(20px,5.3vw,28px)]">
      <div className="text-center space-y-2">
        <div className="w-[clamp(56px,14.9vw,68px)] h-[clamp(56px,14.9vw,68px)] mx-auto mb-[clamp(14px,3.7vw,18px)] bg-[var(--brand-primary-subtle)] border-2 border-[var(--brand-primary)] rounded-[var(--radius-lg)] flex items-center justify-center">
          <MailIcon className="w-[clamp(28px,7.5vw,36px)] h-[clamp(28px,7.5vw,36px)] text-[var(--brand-primary)]" />
        </div>
        <p className="type-body text-[var(--text-secondary)]">
          We sent a code to
        </p>
        <p className="type-body font-bold text-[var(--text-primary)]">{email}</p>
      </div>

      <Input
        type="text"
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: 'var(--text-2xl)', fontWeight: 700 }}
        required
      />

      {error && (
        <div className="p-[clamp(14px,3.7vw,18px)] bg-[var(--status-error-subtle)] border-2 border-[var(--status-error-bg)] rounded-[var(--radius-md)]">
          <p className="text-[var(--status-error-bg)] type-body-sm font-medium">{error}</p>
        </div>
      )}

      <PremiumButton type="submit" loading={loading} disabled={code.length !== 6}>
        Verify
      </PremiumButton>
    </form>
  );

  // Forgot password form
  const renderForgot = () => (
    <form onSubmit={handleForgotPassword} className="space-y-[clamp(20px,5.3vw,28px)]">
      <div className="text-center space-y-2 mb-[clamp(24px,6.4vw,32px)]">
        <div className="w-[clamp(56px,14.9vw,68px)] h-[clamp(56px,14.9vw,68px)] mx-auto mb-[clamp(14px,3.7vw,18px)] bg-[var(--brand-primary-subtle)] border-2 border-[var(--brand-primary)] rounded-[var(--radius-lg)] flex items-center justify-center">
          <LockIcon className="w-[clamp(28px,7.5vw,36px)] h-[clamp(28px,7.5vw,36px)] text-[var(--brand-primary)]" />
        </div>
        <p className="type-body text-[var(--text-secondary)] leading-relaxed">
          Enter your email and we'll send you a code to reset your password.
        </p>
      </div>

      <Input
        icon={<MailIcon className="w-5 h-5" />}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoCapitalize="none"
        required
      />

      {error && (
        <div className="p-[clamp(14px,3.7vw,18px)] bg-[var(--status-error-subtle)] border-2 border-[var(--status-error-bg)] rounded-[var(--radius-md)]">
          <p className="text-[var(--status-error-bg)] type-body-sm font-medium">{error}</p>
        </div>
      )}

      <PremiumButton type="submit" loading={loading}>
        Send Reset Code
      </PremiumButton>
    </form>
  );

  // Reset password form
  const renderReset = () => (
    <form onSubmit={handleResetPassword} className="space-y-[clamp(20px,5.3vw,28px)]">
      <div className="text-center space-y-2 mb-[clamp(24px,6.4vw,32px)]">
        <p className="type-body text-[var(--text-secondary)]">
          Code sent to <span className="font-bold text-[var(--text-primary)]">{email}</span>
        </p>
      </div>

      <Input
        type="text"
        placeholder="000000"
        value={resetCode}
        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: 'var(--text-2xl)', fontWeight: 700 }}
        required
      />

      <Input
        icon={<LockIcon className="w-5 h-5" />}
        type={showPassword ? 'text' : 'password'}
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
        required
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-2 -m-2 text-[var(--text-tertiary)] active:text-[var(--text-primary)]"
          >
            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        }
      />

      {error && (
        <div className="p-[clamp(14px,3.7vw,18px)] bg-[var(--status-error-subtle)] border-2 border-[var(--status-error-bg)] rounded-[var(--radius-md)]">
          <p className="text-[var(--status-error-bg)] type-body-sm font-medium">{error}</p>
        </div>
      )}

      <PremiumButton type="submit" loading={loading} disabled={resetCode.length !== 6 || newPassword.length < 8}>
        Reset Password
      </PremiumButton>
    </form>
  );

  // Page titles and subtitles
  const getPageContent = () => {
    switch (mode) {
      case 'signin':
        return { title: 'Welcome\nBack', subtitle: null };
      case 'signup':
        return { title: 'Start\nBuilding', subtitle: 'Create your account' };
      case 'verify':
        return { title: 'Verify\nEmail', subtitle: null };
      case 'forgot':
        return { title: 'Reset\nPassword', subtitle: null };
      case 'reset':
        return { title: 'New\nPassword', subtitle: null };
      default:
        return { title: null, subtitle: null };
    }
  };

  const pageContent = getPageContent();
  const showBackButton = mode !== 'select';

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-primary)] flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(224, 122, 95, 0.08) 0%, transparent 50%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 pt-[max(16px,env(safe-area-inset-top))] px-[clamp(20px,5.3vw,28px)]">
        {showBackButton && (
          <button
            onClick={() => {
              haptic.light();
              if (mode === 'verify') {
                setPendingVerification(false);
                setMode('signup');
              } else if (mode === 'reset') {
                setMode('forgot');
              } else {
                setMode('select');
              }
            }}
            className="flex items-center gap-2 text-[var(--text-secondary)] min-h-[44px] -ml-2 px-2 active:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="type-body font-medium">Back</span>
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col px-[clamp(20px,5.3vw,28px)] pb-[max(24px,env(safe-area-inset-bottom))]">
        {/* Logo area - large and confident */}
        {mode === 'select' && (
          <div className={cn(
            'flex-1 flex flex-col justify-center items-center transition-all duration-700',
            mounted ? 'opacity-100' : 'opacity-0'
          )}>
            <BuildingBlocks />

            {/* Large Logo */}
            <h1 className="type-logo-lg mb-[clamp(10px,2.7vw,14px)]">
              <span className="text-[var(--text-primary)]">RE</span>
              <span className="text-[var(--brand-primary)]">BLD</span>
            </h1>

            {/* Tagline */}
            <p className="type-tagline mb-[clamp(40px,10.7vw,52px)]">
              Your AI Training Partner
            </p>
          </div>
        )}

        {/* Form pages */}
        {mode !== 'select' && (
          <div className="flex-1 flex flex-col">
            {/* Page title - large, bold, broken into lines */}
            {pageContent.title && (
              <div className="mt-[clamp(24px,6.4vw,32px)] mb-[clamp(24px,6.4vw,32px)]">
                <h1 className="type-headline-1 text-[var(--text-primary)] whitespace-pre-line">
                  {pageContent.title}
                </h1>
                {pageContent.subtitle && (
                  <p className="mt-[clamp(10px,2.7vw,14px)] type-body text-[var(--text-secondary)]">
                    {pageContent.subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Form content */}
            <div className="flex-1 flex flex-col justify-center">
              {mode === 'signin' && renderSignIn()}
              {mode === 'signup' && renderSignUp()}
              {mode === 'verify' && renderVerify()}
              {mode === 'forgot' && renderForgot()}
              {mode === 'reset' && renderReset()}
            </div>
          </div>
        )}

        {/* Selection buttons */}
        {mode === 'select' && renderSelect()}

        {/* Footer */}
        {mode === 'select' && (
          <p className="text-center type-caption text-[var(--text-disabled)] leading-relaxed mt-[clamp(20px,5.3vw,28px)]">
            By continuing, you agree to our{' '}
            <span className="text-[var(--text-tertiary)]">Terms</span>
            {' '}and{' '}
            <span className="text-[var(--text-tertiary)]">Privacy Policy</span>
          </p>
        )}
      </div>
    </div>
  );
}
