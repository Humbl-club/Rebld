import React, { useState, useCallback, useEffect } from 'react';
import { PlanDay, WorkoutLog, LoggedExercise, WorkoutPlan, DailyRoutine, UserProfile, WorkoutSession } from './types';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useMutation } from 'convex/react';
import { api } from './convex/_generated/api';
import { Id } from './convex/_generated/dataModel';
import PersonalOnboarding from './components/onboarding/PersonalOnboarding';
import ZenSessionTracker from './components/ZenSessionTracker';
import PreWorkoutScreen from './components/PreWorkoutScreen';
import Chatbot from './components/Chatbot';
import Navbar from './components/layout/Navbar';
import { ZapIcon } from './components/icons';
import ZenHomePage from './pages/ZenHomePage';
import PlanPage from './pages/PlanPage';
import ProfilePage from './pages/ProfilePage';
import GoalTrackingPage from './pages/GoalTrackingPage';
import SessionSummaryPage from './pages/SessionSummaryPage';
import BuddiesPage from './pages/BuddiesPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import useWorkoutLogs from './hooks/useWorkoutLogs';
import useWorkoutPlan from './hooks/useWorkoutPlan';
import useUserProfile from './hooks/useUserProfile';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import FullScreenLoader from './components/layout/FullScreenLoader';
// AnimatedSplash is now pure HTML/CSS in index.html for instant loading
import SSOCallback from './components/SSOCallback';
import ToastContainer, { notify } from './components/layout/Toast';
import { useTheme } from './hooks/useTheme';
import { useAnalytics, analytics, EventTypes } from './services/analyticsService';
import { trackUserLogin } from './services/locationService';
import { ariaAnnouncer } from './services/ariaAnnouncer';
import ErrorBoundary from './components/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import OfflineIndicator from './components/OfflineIndicator';
import { useExercisePreload } from './hooks/useExercisePreload';
import { useSwipeNavigation } from './hooks/useSwipeNavigation';
import { SplashScreen } from '@capacitor/splash-screen';

// Storage keys
const LANDING_SEEN_KEY = 'rebld:seen_landing';
const LOCATION_TRACKED_KEY = 'rebld:location_tracked';
const SPLASH_SHOWN_KEY = 'rebld:splash_shown_session';


type Page = 'home' | 'goals' | 'buddies' | 'plan' | 'profile' | 'admin' | 'privacy' | 'terms';
// Extended to support WorkoutSession for 2x daily training
type SessionType = PlanDay | DailyRoutine | WorkoutSession;

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash once per session
    if (typeof window !== 'undefined') {
      const shown = sessionStorage.getItem(SPLASH_SHOWN_KEY);
      if (!shown) {
        sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
        return true;
      }
    }
    return false;
  });

  // Announce page changes for screen readers
  useEffect(() => {
    const pageNames: Record<Page, string> = {
      home: 'Home',
      goals: 'Goals',
      buddies: 'Buddies',
      plan: 'Plan',
      profile: 'Profile',
      admin: 'Admin Dashboard',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    };
    ariaAnnouncer.announcePage(pageNames[currentPage]);
  }, [currentPage]);

  // Handle Clerk Auth Error (Common on Localhost with Prod keys)
  const { user, isLoaded: clerkLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();

  // If Clerk fails to load for an extended period, it's likely a key issue
  const [clerkError, setClerkError] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!clerkLoaded) {
        console.error("Clerk failed to load. Likely production key on localhost.");
        setClerkError(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [clerkLoaded]);

  if (clerkError) {
    return (
      <div className="h-screen w-full bg-black text-white flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-16 h-16 rounded-full border-2 border-red-500 flex items-center justify-center mb-6">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-4">Configuration Error</h1>
        <p className="text-stone-400 mb-8 max-w-md">
          The application cannot connect to the authentication server. This usually happens when running <span className="text-white font-mono">localhost</span> with Production keys.
        </p>
        <div className="bg-stone-900 p-4 rounded text-xs font-mono text-left mb-8 border border-white/10">
          <p className="text-stone-500 mb-2">// .env.local</p>
          <p className="text-red-400">VITE_CLERK_PUBLISHABLE_KEY=pk_live_...</p>
          <p className="text-green-400 mt-1">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</p>
        </div>
        <p className="text-sm text-stone-500">Please switch to your Development keys to run locally.</p>
      </div>
    );
  }

  const { theme, toggleTheme } = useTheme();

  // Debug: Test Clerk JWT token retrieval
  useEffect(() => {
    if (isSignedIn) {
      getToken({ template: 'convex' })
        .then(token => {
          console.log('[Auth Debug] Convex JWT token:', token ? `${token.substring(0, 50)}...` : 'NULL');
          if (token) {
            // Decode and log the payload (middle part of JWT)
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              console.log('[Auth Debug] JWT payload:', payload);
            } catch (e) {
              console.error('[Auth Debug] Failed to decode token:', e);
            }
          }
        })
        .catch(err => {
          console.error('[Auth Debug] getToken error:', err);
        });
    }
  }, [isSignedIn, getToken]);

  // Initialize analytics
  useAnalytics(user?.id || null);

  // Capacitor splash is hidden by inline script in index.html
  // This ensures it hides as soon as HTML renders, before React even loads

  // Initialize ARIA announcer for accessibility
  useEffect(() => {
    ariaAnnouncer.init();
    return () => {
      ariaAnnouncer.destroy();
    };
  }, []);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true, // Can be disabled for iPhone-only mode
    shortcuts: [
      {
        key: 'k',
        meta: true,
        ctrl: true,
        action: () => setIsChatOpen(true),
        description: 'Open AI Chatbot',
        category: 'general',
      },
      {
        key: 'n',
        meta: true,
        ctrl: true,
        action: () => {
          if (activePlan?.weeklyPlan?.[0]) {
            handleStartSession(activePlan.weeklyPlan[0]);
          }
        },
        description: 'Start New Workout',
        category: 'workout',
      },
    ],
  });

  // NOTE: Exercise preloader DISABLED - was making 4000+ unnecessary API calls
  // Explanations are fetched on-demand when user taps an exercise
  // useExercisePreload({
  //   enabled: false,
  //   userId: user?.id || null,
  // });

  const {
    activePlan,
    allPlans,
    addPlan,
    deletePlan,
    updatePlan,
    setActivePlan,
    planLoaded
  } = useWorkoutPlan();
  const { logs, addLog, logsLoaded } = useWorkoutLogs();
  const { userProfile, updateUserProfile, profileLoaded } = useUserProfile();

  // Ensure user code is generated on login
  const ensureUserCodeMutation = useMutation(api.userCodeMutations.ensureUserCode);
  const updateLocationMutation = useMutation(api.healthMetrics.updateLocationData);
  const updateDeviceMutation = useMutation(api.healthMetrics.updateDeviceData);
  const deleteLogMutation = useMutation(api.mutations.deleteWorkoutLog);

  // Track user location and device on first login (once per session)
  useEffect(() => {
    if (user?.id && clerkLoaded) {
      // Generate user code
      ensureUserCodeMutation({ userId: user.id }).catch(() => {
        // Silent fail, will try again next time
      });

      // Track location (once per session to avoid rate limits)
      const sessionKey = `${LOCATION_TRACKED_KEY}_${user.id}`;
      const alreadyTracked = sessionStorage.getItem(sessionKey);

      if (!alreadyTracked) {
        trackUserLogin()
          .then(({ locationData, deviceData }) => {
            // Update location data
            if (locationData.country || locationData.timezone) {
              updateLocationMutation({
                userId: user.id,
                ...locationData,
              }).catch(console.error);
            }

            // Update device data - filter out null values (Convex expects undefined, not null)
            const filteredDeviceData = Object.fromEntries(
              Object.entries(deviceData).filter(([_, v]) => v !== null)
            );
            updateDeviceMutation({
              userId: user.id,
              ...filteredDeviceData,
            }).catch(console.error);

            // Mark as tracked for this session
            sessionStorage.setItem(sessionKey, 'true');
          })
          .catch((error) => {
            console.error('Location tracking failed:', error);
          });
      }
    }
  }, [user?.id, clerkLoaded, ensureUserCodeMutation, updateLocationMutation, updateDeviceMutation]);

  // Admin dashboard URL handler
  useEffect(() => {
    // Check URL for admin access (#admin or /admin path)
    const hash = window.location.hash;
    const path = window.location.pathname;

    if (hash === '#admin' || path.endsWith('/admin')) {
      setCurrentPage('admin');
    }

    // Listen for hash changes
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setCurrentPage('admin');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [activeSession, setActiveSession] = useState<PlanDay | null>(null);
  const [pendingSession, setPendingSession] = useState<PlanDay | null>(null); // For PreWorkoutScreen
  const [sessionToSummarize, setSessionToSummarize] = useState<WorkoutLog | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialChatMessage, setInitialChatMessage] = useState('');

  // State for landing page flow
  const [showAuth, setShowAuth] = useState(() => {
    // Check if user has seen landing page before
    return localStorage.getItem(LANDING_SEEN_KEY) === 'true';
  });

  // Swipe navigation between pages (only when not in a session/modal)
  const swipeEnabled = !activeSession && !pendingSession && !sessionToSummarize && !isChatOpen && !!activePlan;
  const { swipeStyle, swipeDirection } = useSwipeNavigation({
    currentPage: currentPage as 'home' | 'goals' | 'buddies' | 'plan' | 'profile',
    onNavigate: setCurrentPage,
    enabled: swipeEnabled,
    threshold: 0.25, // 25% of screen width to trigger navigation
  });

  const handleStartSession = useCallback((session: SessionType) => {
    // Normalize different session types into a PlanDay so ZenSessionTracker can handle it
    let normalizedSession: PlanDay;
    const today = new Date();
    const dow = today.getDay() === 0 ? 7 : today.getDay();

    // Case 1: DailyRoutine - has exercises array, no blocks
    if ('exercises' in session && !('blocks' in session)) {
      normalizedSession = {
        day_of_week: dow,
        focus: session.focus || 'Daily Routine',
        notes: session.notes,
        blocks: [
          {
            type: 'single',
            title: 'Daily Routine',
            exercises: session.exercises,
          },
        ],
      };
    }
    // Case 2: WorkoutSession (2x daily) - has session_name and time_of_day
    // Note: HomePage may add day_of_week to the spread, so we check for session_name/time_of_day
    // AND verify there's no 'focus' field (WorkoutSession uses session_name instead)
    else if ('session_name' in session && 'time_of_day' in session && !('focus' in session)) {
      const workoutSession = session as WorkoutSession & { day_of_week?: number };
      normalizedSession = {
        day_of_week: workoutSession.day_of_week || dow,
        focus: workoutSession.session_name || (workoutSession.time_of_day === 'morning' ? 'AM Session' : 'PM Session'),
        notes: `${workoutSession.time_of_day === 'morning' ? '☀️ Morning' : '🌙 Evening'} session`,
        blocks: workoutSession.blocks || [],
      };
    }
    // Case 3: Already a valid PlanDay (has focus field)
    else {
      normalizedSession = session as PlanDay;
    }

    // Show PreWorkoutScreen with "Beat Your Last Session" if user has workout history
    // Skip directly to workout if no history (first-time users get no friction)
    if (logs && logs.length > 0) {
      setPendingSession(normalizedSession);
    } else {
      // No history - go directly to workout
      setActiveSession(normalizedSession);

      // Track workout started
      if (user?.id) {
        analytics.track(EventTypes.WORKOUT_STARTED, {
          planId: activePlan?.id,
          dayOfWeek: normalizedSession.day_of_week,
          focus: normalizedSession.focus,
          blockCount: normalizedSession.blocks?.length || 0,
        });
      }
    }
  }, [user?.id, activePlan?.id, logs]);

  // Called when user confirms start from PreWorkoutScreen
  const handleConfirmStart = useCallback(() => {
    if (pendingSession) {
      setActiveSession(pendingSession);
      setPendingSession(null);

      // Track workout started
      if (user?.id) {
        analytics.track(EventTypes.WORKOUT_STARTED, {
          planId: activePlan?.id,
          dayOfWeek: pendingSession.day_of_week,
          focus: pendingSession.focus,
          blockCount: pendingSession.blocks?.length || 0,
        });
      }
    }
  }, [pendingSession, user?.id, activePlan?.id]);

  // Called when user cancels from PreWorkoutScreen
  const handleCancelPreWorkout = useCallback(() => {
    setPendingSession(null);
  }, []);

  const updateStreakMutation = useMutation(api.achievementMutations.updateStreak);

  const handleFinishSession = useCallback(async (sessionLog: { focus: string, exercises: LoggedExercise[], durationMinutes: number }) => {
    // Save workout log and handle result
    const result = await addLog({
      focus: sessionLog.focus,
      exercises: sessionLog.exercises,
      durationMinutes: sessionLog.durationMinutes,
    });

    if (!result.success) {
      // Show error notification to user - workout NOT saved
      notify({
        type: 'error',
        message: result.error || 'Failed to save workout'
      });
      // Don't proceed to summary if save failed
      setActiveSession(null);
      return;
    }

    // Workout saved successfully - show success notification
    notify({
      type: 'success',
      message: 'Workout saved!'
    });

    // Track workout completed
    if (user?.id) {
      const totalSets = sessionLog.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
      analytics.track(EventTypes.WORKOUT_COMPLETED, {
        focus: sessionLog.focus,
        exerciseCount: sessionLog.exercises.length,
        totalSets,
        durationMinutes: sessionLog.durationMinutes,
        completionRate: 100, // Completed since they finished
      });
    }

    // Update streak and check achievements
    if (user?.id) {
      updateStreakMutation({
        userId: user.id,
        workoutDate: new Date().toISOString()
      }).then((streakResult) => {
        if (streakResult.achievementsUnlocked.length > 0) {
          // Track achievement unlocked
          streakResult.achievementsUnlocked.forEach((achievement: any) => {
            analytics.track(EventTypes.ACHIEVEMENT_UNLOCKED, {
              achievementType: achievement.type,
              achievementTier: achievement.tier,
              achievementName: achievement.displayName,
            });
          });

          // Show achievement unlock notification
          notify({
            type: 'success',
            message: 'Achievement unlocked!'
          });
        }
      }).catch(() => {
        // Silent fail - streak tracking is not critical
      });
    }

    setSessionToSummarize({
      ...sessionLog,
      date: new Date().toISOString()
    });
    setActiveSession(null);
  }, [addLog, user, updateStreakMutation]);

  const handleCancelSession = useCallback(() => {
    // Track workout abandoned
    if (user?.id && activeSession) {
      analytics.track(EventTypes.WORKOUT_ABANDONED, {
        focus: activeSession.focus,
        dayOfWeek: activeSession.day_of_week,
      });
    }
    setActiveSession(null);
  }, [user?.id, activeSession]);

  const handleDeleteActivePlan = useCallback(async () => {
    if (activePlan?.id) {
      try {
        await deletePlan(activePlan.id as any);
        notify({ type: 'success', message: 'Plan deleted successfully' });
        setCurrentPage('home');
      } catch (error) {
        console.error('Error deleting plan:', error);
        notify({ type: 'error', message: 'Failed to delete plan. Please try again.' });
      }
    }
  }, [deletePlan, activePlan]);

  const handlePlanUpdate = (updatedPlan: WorkoutPlan) => {
    updatePlan(updatedPlan);
  };

  const handlePlanGenerated = useCallback(async (plan: Omit<WorkoutPlan, 'id' | 'createdAt'>) => {
    // Navigate to home immediately - don't wait for save to complete
    setCurrentPage('home');

    // If plan is empty (error case), we're already navigating home
    if (!plan || !plan.name || !plan.weeklyPlan) {
      // Track plan generation failure
      if (user?.id) {
        analytics.track(EventTypes.PLAN_GENERATION_FAILED, {
          reason: 'Empty plan returned',
        });
      }
      return;
    }

    try {
      // Save plan in background - Convex will update activePlan query automatically
      await addPlan(plan);

      // Track successful plan generation
      if (user?.id) {
        analytics.track(EventTypes.PLAN_ACCEPTED, {
          planName: plan.name,
          daysInWeek: plan.weeklyPlan.length,
          hasDailyRoutine: !!plan.dailyRoutine,
        });
      }
    } catch (error) {
      console.error("Failed to save plan:", error);
      notify({ type: 'error', message: 'Failed to save your plan. Please try generating again.' });

      // Track save failure
      if (user?.id) {
        analytics.trackError(EventTypes.PLAN_GENERATION_FAILED, error as Error, {
          reason: 'Save failed',
        });
      }
    }
  }, [addPlan, user?.id]);

  const handleCreateNewPlan = useCallback(async () => {
    // Delete active plan to trigger onboarding flow
    if (activePlan?.id) {
      if (confirm('Create a new plan? This will replace your current workout plan.')) {
        try {
          await deletePlan(activePlan.id as Id<"workoutPlans">);
          setCurrentPage('home'); // Navigate to home where onboarding will show
        } catch (error) {
          console.error('Error deleting plan:', error);
          notify({ type: 'error', message: 'Failed to delete plan. Please try again.' });
        }
      }
    }
  }, [activePlan, deletePlan]);

  const handleOpenChatWithMessage = useCallback((message: string) => {
    setInitialChatMessage(message);
    setIsChatOpen(true);
  }, []);

  const handleChatClose = useCallback(() => {
    setIsChatOpen(false);
    setInitialChatMessage('');
  }, []);

  const todayDayOfWeek = new Date().getDay();
  const dayIndexForGemini = todayDayOfWeek === 0 ? 7 : todayDayOfWeek;

  const renderPage = () => {
    if (sessionToSummarize) {
      return <SessionSummaryPage
        sessionLog={sessionToSummarize}
        onDone={() => setSessionToSummarize(null)}
        allLogs={logs || []}
        userProfile={userProfile}
      />;
    }

    if (activeSession) {
      return (
        <ErrorBoundary componentName="ZenSessionTracker">
          <ZenSessionTracker
            session={activeSession}
            onFinish={handleFinishSession}
            onCancel={handleCancelSession}
            allLogs={logs || []}
            userProfile={userProfile}
          />
        </ErrorBoundary>
      );
    }

    // Show PreWorkoutScreen before starting workout
    if (pendingSession) {
      return <PreWorkoutScreen
        session={pendingSession}
        recentLogs={logs || []}
        onStart={handleConfirmStart}
        onCancel={handleCancelPreWorkout}
      />;
    }

    // Show onboarding only if no active plan exists
    // After plan creation, we navigate immediately, and Convex will update activePlan automatically
    if (!activePlan) {
      return <PersonalOnboarding onPlanGenerated={handlePlanGenerated} />
    }

    switch (currentPage) {
      case 'home':
        return (
          <ErrorBoundary componentName="ZenHomePage">
            <ZenHomePage
              plan={activePlan}
              onStartSession={handleStartSession}
              onOpenChat={() => setIsChatOpen(true)}
              userProfile={userProfile}
            />
          </ErrorBoundary>
        );
      case 'goals':
        return (
          <ErrorBoundary componentName="GoalTrackingPage">
            <GoalTrackingPage logs={logs || []} plan={activePlan} userGoals={userProfile?.goals} onDeleteLog={handleDeleteLog} />
          </ErrorBoundary>
        );
      case 'buddies':
        return (
          <ErrorBoundary componentName="BuddiesPage">
            <BuddiesPage />
          </ErrorBoundary>
        );
      case 'admin':
        return (
          <ErrorBoundary componentName="AdminDashboardPage">
            <AdminDashboardPage />
          </ErrorBoundary>
        );
      case 'privacy':
        return <PrivacyPolicyPage onBack={() => setCurrentPage('profile')} />;
      case 'terms':
        return <TermsOfServicePage onBack={() => setCurrentPage('profile')} />;
      case 'plan':
        return (
          <ErrorBoundary componentName="PlanPage">
            <PlanPage activePlan={activePlan} onStartSession={handleStartSession} />
          </ErrorBoundary>
        );
      case 'profile':
        return (
          <ErrorBoundary componentName="ProfilePage">
            <ProfilePage logs={logs || []} userProfile={userProfile} onUpdateProfile={updateUserProfile} onCreateNewPlan={handleCreateNewPlan} />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary componentName="ZenHomePage">
            <ZenHomePage
              plan={activePlan}
              onStartSession={handleStartSession}
              onOpenChat={() => setIsChatOpen(true)}
            />
          </ErrorBoundary>
        );
    }
  };

  // Pull-to-refresh handler (Convex queries auto-refresh, just provide feedback)
  const handleRefreshPlan = useCallback(async () => {
    // Convex will automatically re-fetch, just add small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
  }, []);

  // Delete workout log handler
  const handleDeleteLog = useCallback(async (logId: string) => {
    try {
      await deleteLogMutation({ logId: logId as any });
      notify({ type: 'success', message: 'Workout log deleted' });
    } catch (error) {
      console.error('Failed to delete log:', error);
      notify({ type: 'error', message: 'Failed to delete log' });
      throw error;
    }
  }, [deleteLogMutation]);

  const handleGetStarted = useCallback(() => {
    localStorage.setItem(LANDING_SEEN_KEY, 'true');
    setShowAuth(true);
  }, []);

  const handleSignIn = useCallback(() => {
    localStorage.setItem(LANDING_SEEN_KEY, 'true');
    setShowAuth(true);
  }, []);

  // Handle SSO callback (OAuth redirect) - skip splash for this
  if (window.location.pathname === '/sso-callback') {
    // Hide HTML splash immediately for SSO
    document.getElementById('native-splash')?.classList.add('hiding');
    return <SSOCallback />;
  }

  // Determine if app is fully ready
  // For logged-out users: just need Clerk to load
  // For logged-in users: need Clerk + Convex data
  const isAppReady = clerkLoaded && (!user || (logsLoaded && planLoaded && profileLoaded));

  // Debug: Log loading states (remove in production)
  useEffect(() => {
    console.log('[App] Loading states:',
      'clerkLoaded:', clerkLoaded,
      '| user:', !!user,
      '| logsLoaded:', logsLoaded,
      '| planLoaded:', planLoaded,
      '| profileLoaded:', profileLoaded,
      '| isAppReady:', isAppReady
    );
  }, [clerkLoaded, user, logsLoaded, planLoaded, profileLoaded, isAppReady]);

  // Hide the HTML splash when app is ready
  useEffect(() => {
    if (!showSplash) return; // Already hidden

    if (isAppReady) {
      console.log('[App] App ready, hiding splash');

      // Minimum display time for branding (let animation complete)
      const minTime = 1000;
      const elapsed = performance.now();
      const remaining = Math.max(0, minTime - elapsed);

      const hideTimer = setTimeout(() => {
        const splash = document.getElementById('native-splash');
        if (splash) {
          splash.classList.add('hiding');
          setTimeout(() => {
            splash.remove();
            setShowSplash(false);
          }, 400);
        } else {
          setShowSplash(false);
        }
      }, remaining);

      return () => clearTimeout(hideTimer);
    }

    // Timeout fallback - never stay stuck on splash more than 5 seconds
    const timeout = setTimeout(() => {
      console.warn('Splash timeout - forcing app to show');
      const splash = document.getElementById('native-splash');
      if (splash) {
        splash.classList.add('hiding');
        setTimeout(() => {
          splash.remove();
          setShowSplash(false);
        }, 400);
      } else {
        setShowSplash(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isAppReady, showSplash]);

  // While splash is showing, return null (HTML splash is visible)
  if (showSplash) {
    return null;
  }

  // If data still loading after splash dismissed, show loader
  if (!isAppReady) {
    return <FullScreenLoader />;
  }

  // Show legal pages (accessible without login)
  if (currentPage === 'privacy') {
    return <PrivacyPolicyPage onBack={() => setCurrentPage('home')} />;
  }
  if (currentPage === 'terms') {
    return <TermsOfServicePage onBack={() => setCurrentPage('home')} />;
  }

  // Not logged in flow: Landing → Auth
  if (!user) {
    if (!showAuth) {
      return (
        <LandingPage
          onGetStarted={handleGetStarted}
          onSignIn={handleSignIn}
          onPrivacy={() => setCurrentPage('privacy')}
          onTerms={() => setCurrentPage('terms')}
        />
      );
    }
    return <AuthPage />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Page container with swipe animation - NO SCROLL here, pages handle their own scroll */}
      <div
        className="h-screen w-full flex flex-col items-center selection:bg-[var(--accent-light)] selection:text-[var(--accent)] overflow-hidden"
        style={swipeEnabled ? swipeStyle : undefined}
      >
        {renderPage()}
      </div>

      {/* Fixed elements - navbar and chat button stay in place during swipe */}
      {!activeSession && !pendingSession && !sessionToSummarize && (
        <>
          {activePlan && (
            <>
              <Navbar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
              />
              {/* Floating Chat Button - semi-transparent, above navbar, toggle expand/retract */}
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`
                            fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4
                            w-11 h-11 rounded-[14px]
                            flex items-center justify-center
                            focus:outline-none focus:ring-2 focus:ring-offset-2
                            focus:ring-offset-[var(--background-primary)] focus:ring-[var(--accent)]
                            transition-all duration-200 active:scale-95 z-30
                            ${isChatOpen
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)]/70 text-[var(--text-primary)] backdrop-blur-xl border border-[var(--border-default)]/50'
                  }
                        `}
                style={{
                  boxShadow: isChatOpen
                    ? '0 3px 16px rgba(0,0,0,0.2)'
                    : '0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.05) inset',
                  WebkitBackdropFilter: isChatOpen ? 'none' : 'blur(20px) saturate(180%)',
                  backdropFilter: isChatOpen ? 'none' : 'blur(20px) saturate(180%)',
                }}
                aria-label={isChatOpen ? "Close AI Assistant" : "Open AI Assistant"}
                aria-expanded={isChatOpen}
              >
                {isChatOpen ? (
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <ZapIcon className="h-[18px] w-[18px]" />
                )}
              </button>
            </>
          )}
        </>
      )}

      <Chatbot
        isOpen={isChatOpen}
        onClose={handleChatClose}
        plan={activePlan}
        onPlanUpdate={handlePlanUpdate}
        initialMessage={initialChatMessage}
        dayOfWeek={dayIndexForGemini}
      />
      <ToastContainer />
    </div>
  );
}
