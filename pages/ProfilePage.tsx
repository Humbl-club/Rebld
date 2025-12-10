import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, UserProfile, BodyMetrics } from '../types';
import { UserIcon, SignOutIcon, ScaleIcon, BookCheckIcon, CogIcon, UsersIcon, TrophyIcon } from '../components/icons';
import { useClerk, useUser } from '@clerk/clerk-react';
import { notify } from '../components/layout/Toast';
import InjuryProfile from '../components/InjuryProfile';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HeatMapCalendar from '../components/HeatMapCalendar';
import StreakCounter from '../components/StreakCounter';
import PhotoCaptureDialog from '../components/PhotoCaptureDialog';
import ProgressPhotoCard from '../components/ProgressPhotoCard';
import PhotoTimeline from '../components/PhotoTimeline';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { AlertDialog } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/ui/PullToRefreshIndicator';
import { ProgressChart } from '../components/ui/ProgressChart';
import { VolumeChart } from '../components/ui/VolumeChart';
import { PRHistoryChart } from '../components/ui/PRHistoryChart';
import { getAllPRs } from '../services/prService';

/* ═══════════════════════════════════════════════════════════════
   PROFILE PAGE - Phase 9.4 Page Redesign

   User profile, stats, achievements, and settings.
   Uses design tokens for consistent styling.
   ═══════════════════════════════════════════════════════════════ */

interface ProfilePageProps {
  logs: WorkoutLog[];
  userProfile: UserProfile | null;
  onUpdateProfile: (data: Partial<UserProfile>) => void;
  onCreateNewPlan?: () => void;
}

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  unit: string;
  onEdit: () => void;
}> = ({ label, value, unit, onEdit }) => (
  <button
    onClick={onEdit}
    className={cn(
      'bg-[var(--surface-primary)]',
      'border border-[var(--border-default)]',
      'rounded-[var(--radius-lg)]',
      'p-[var(--space-3)]',
      'text-left',
      'hover:border-[var(--brand-primary)]',
      'transition-all duration-[var(--duration-fast)]',
      'w-full',
      'shadow-[var(--shadow-sm)]'
    )}
  >
    <p
      className={cn(
        'text-[var(--text-2xs)]',
        'uppercase tracking-[var(--tracking-wider)]',
        'text-[var(--text-tertiary)]',
        'font-[var(--weight-bold)]',
        'mb-[var(--space-0-5)]'
      )}
    >
      {label}
    </p>
    <p className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)]">
      {value || '—'}
      <span className="text-[var(--text-xs)] text-[var(--text-secondary)] ml-[var(--space-1)]">
        {unit}
      </span>
    </p>
  </button>
);

export default function ProfilePage({ logs, userProfile, onUpdateProfile, onCreateNewPlan }: ProfilePageProps) {
  const { t } = useTranslation();
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [viewAllPhotos, setViewAllPhotos] = useState(false);
  const [showTrainingPrefs, setShowTrainingPrefs] = useState(false);
  const [showInjuryProfile, setShowInjuryProfile] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const deleteAccount = useMutation(api.mutations.deleteUserAccount);

  // Pull-to-refresh
  const handleRefresh = async () => {
    // Convex queries auto-refresh, just add delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  const { pullDistance, isRefreshing, isTriggered } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const handleDeleteAccount = async () => {
    try {
      if (!user?.id) return;
      await deleteAccount({ userId: user.id });
      await signOut();
      notify({ type: 'success', message: 'Account deleted successfully' });
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting account:', error);
      notify({ type: 'error', message: 'Failed to delete account' });
      setIsDeleteModalOpen(false);
    }
  };

  // Get full user data with injury profile from Convex
  const userId = user?.id || null;
  const fullUserData = useQuery(
    api.queries.getUserProfile,
    userId ? { userId } : "skip"
  );

  // Get achievements
  const achievements = useQuery(
    api.achievementQueries.getUserAchievements,
    userId ? { userId } : "skip"
  );

  // Get latest progress photo
  const latestPhoto = useQuery(
    api.photoQueries.getLatestPhoto,
    userId ? { userId } : "skip"
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      notify({ type: 'error', message: 'Failed to sign out. Please try again.' });
    }
  };

  const handleEditMetric = () => {
    notify({ type: 'info', message: t('profile.bodyMetricsComingSoon') });
  };

  const handleCreateNewPlan = () => {
    if (onCreateNewPlan) {
      onCreateNewPlan();
    } else {
      notify({ type: 'info', message: t('profile.planCreationComingSoon') });
    }
  };

  const bodyMetrics = userProfile?.bodyMetrics;

  // Prepare chart data
  const volumeData = useMemo(() => {
    return logs.slice(-10).map(log => ({
      date: log.date,
      volume: log.exercises.reduce((total, ex) => {
        return total + ex.sets.reduce((setTotal, set) => {
          if ('weight' in set && 'reps' in set) {
            const weight = typeof set.weight === 'string' ? parseFloat(set.weight) || 0 : set.weight;
            const reps = typeof set.reps === 'string' ? parseFloat(set.reps) || 0 : set.reps;
            return setTotal + (weight * reps);
          }
          return setTotal;
        }, 0);
      }, 0),
      workoutName: log.focus
    }));
  }, [logs]);

  const prHistory = useMemo(() => {
    const prs = getAllPRs(logs);
    return prs.map(pr => ({
      date: pr.date || new Date().toISOString(),
      exerciseName: pr.exercise_name,
      weight: pr.weight,
      reps: pr.reps
    }));
  }, [logs]);

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        distance={pullDistance}
        isTriggered={isTriggered}
        isRefreshing={isRefreshing}
      />

      <div
        className={cn(
          'w-full max-w-lg mx-auto',
          'h-full overflow-y-auto', // Enable scrolling
          'px-[var(--space-4)]',
          'pt-[env(safe-area-inset-top)]', // Tight to Dynamic Island
          'pb-[calc(var(--height-tab-bar)+var(--space-6)+env(safe-area-inset-bottom)+60px)]', // Extra padding for navbar
          'animate-fade-in'
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <header className="mb-[var(--space-4)]">
          <div className="flex items-center justify-between mb-[var(--space-2)]">
            <div>
              <p
                className={cn(
                  'text-[var(--text-2xs)]',
                  'uppercase tracking-[var(--tracking-wide)]',
                  'text-[var(--text-tertiary)]',
                  'font-[var(--weight-semibold)]',
                  'mb-[var(--space-1)]'
                )}
              >
                {t('profile.account')}
              </p>
              <h1
                className={cn(
                  'text-[var(--text-xl)]',
                  'font-[var(--weight-bold)]',
                  'text-[var(--text-primary)]',
                  'leading-[var(--leading-tight)]'
                )}
              >
                {t('profile.title')}
              </h1>
            </div>
            <LanguageSwitcher />
          </div>
        </header>

        <main className="space-y-[var(--space-5)] pb-[var(--space-4)]">
          {/* Account Info */}
          <div
            className={cn(
              'bg-[var(--surface-primary)]',
              'border border-[var(--border-default)]',
              'rounded-[var(--radius-xl)]',
              'p-[var(--space-4)]',
              'shadow-[var(--shadow-sm)]'
            )}
          >
            <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-3)]">
              <div
                className={cn(
                  'w-12 h-12',
                  'bg-[var(--brand-primary-subtle)]',
                  'rounded-full',
                  'flex items-center justify-center'
                )}
              >
                <UserIcon className="w-6 h-6 text-[var(--brand-primary)]" />
              </div>
              <div>
                <h2 className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                  {user?.emailAddresses[0]?.emailAddress?.split('@')[0] || t('profile.defaultName')}
                </h2>
                <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                  {t('profile.workoutsCompleted', { count: logs.length })}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className={cn(
                'w-full',
                'flex items-center justify-between',
                'px-[var(--space-3)] py-[var(--space-2-5)]',
                'rounded-[var(--radius-lg)]',
                'bg-[var(--surface-secondary)]',
                'hover:bg-[var(--surface-hover)]',
                'transition-all duration-[var(--duration-fast)]'
              )}
            >
              <span className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--text-primary)]">
                {t('auth.signOut')}
              </span>
              <SignOutIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Body Metrics */}
          <div
            className={cn(
              'bg-[var(--surface-primary)]',
              'border border-[var(--border-default)]',
              'rounded-[var(--radius-xl)]',
              'p-[var(--space-4)]',
              'shadow-[var(--shadow-sm)]'
            )}
          >
            <div className="flex items-center justify-between mb-[var(--space-3)]">
              <h3 className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                {t('profile.bodyMetrics')}
              </h3>
              <button
                onClick={() => setIsEditingMetrics(!isEditingMetrics)}
                className={cn(
                  'p-[var(--space-1-5)]',
                  'rounded-[var(--radius-lg)]',
                  'hover:bg-[var(--surface-secondary)]',
                  'transition-all duration-[var(--duration-fast)]'
                )}
              >
                <CogIcon className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-[var(--space-3)]">
              <div
                className={cn(
                  'text-center',
                  'p-[var(--space-4)]',
                  'bg-gradient-to-br from-[var(--brand-primary-subtle)] to-transparent',
                  'rounded-[var(--radius-2xl)]',
                  'border border-[var(--brand-primary)]/20',
                  'hover:border-[var(--brand-primary)]/50',
                  'hover:shadow-[var(--shadow-md)]',
                  'hover:-translate-y-[2px]',
                  'transition-all duration-[var(--duration-normal)]',
                  'cursor-default group'
                )}
              >
                <p
                  className={cn(
                    'text-[var(--text-2xs)]',
                    'uppercase tracking-[var(--tracking-wider)]',
                    'text-[var(--text-tertiary)]',
                    'font-[var(--weight-bold)]',
                    'mb-[var(--space-1)]'
                  )}
                >
                  Weight
                </p>
                <p
                  className={cn(
                    'text-[var(--text-2xl)]',
                    'font-[var(--weight-black)]',
                    'text-[var(--brand-primary)]',
                    'tabular-nums',
                    'mb-[var(--space-1)]',
                    'group-hover:scale-105',
                    'transition-transform duration-[var(--duration-fast)]'
                  )}
                >
                  {bodyMetrics?.weight || '—'}
                </p>
                <p className="text-[var(--text-2xs)] text-[var(--text-secondary)] font-[var(--weight-semibold)]">
                  kg
                </p>
              </div>

              <div
                className={cn(
                  'text-center',
                  'p-[var(--space-4)]',
                  'bg-gradient-to-br from-[var(--brand-primary)]/10 to-transparent',
                  'rounded-[var(--radius-2xl)]',
                  'border border-[var(--brand-primary)]/20',
                  'hover:border-[var(--brand-primary)]/50',
                  'hover:shadow-[var(--shadow-md)]',
                  'hover:-translate-y-[2px]',
                  'transition-all duration-[var(--duration-normal)]',
                  'cursor-default group'
                )}
              >
                <p
                  className={cn(
                    'text-[var(--text-2xs)]',
                    'uppercase tracking-[var(--tracking-wider)]',
                    'text-[var(--text-tertiary)]',
                    'font-[var(--weight-bold)]',
                    'mb-[var(--space-1)]'
                  )}
                >
                  Body Fat
                </p>
                <p
                  className={cn(
                    'text-[var(--text-2xl)]',
                    'font-[var(--weight-black)]',
                    'text-[var(--brand-primary)]',
                    'tabular-nums',
                    'mb-[var(--space-1)]',
                    'group-hover:scale-105',
                    'transition-transform duration-[var(--duration-fast)]'
                  )}
                >
                  {bodyMetrics?.bodyFatPercentage || '—'}
                </p>
                <p className="text-[var(--text-2xs)] text-[var(--text-secondary)] font-[var(--weight-semibold)]">
                  %
                </p>
              </div>

              <div
                className={cn(
                  'text-center',
                  'p-[var(--space-4)]',
                  'bg-gradient-to-br from-[var(--status-success-bg)]/10 to-transparent',
                  'rounded-[var(--radius-2xl)]',
                  'border border-[var(--status-success-bg)]/20',
                  'hover:border-[var(--status-success-bg)]/50',
                  'hover:shadow-[var(--shadow-md)]',
                  'hover:-translate-y-[2px]',
                  'transition-all duration-[var(--duration-normal)]',
                  'cursor-default group'
                )}
              >
                <p
                  className={cn(
                    'text-[var(--text-2xs)]',
                    'uppercase tracking-[var(--tracking-wider)]',
                    'text-[var(--text-tertiary)]',
                    'font-[var(--weight-bold)]',
                    'mb-[var(--space-1)]'
                  )}
                >
                  Workouts
                </p>
                <p
                  className={cn(
                    'text-[var(--text-2xl)]',
                    'font-[var(--weight-black)]',
                    'text-[var(--status-success-bg)]',
                    'tabular-nums',
                    'mb-[var(--space-1)]',
                    'group-hover:scale-105',
                    'transition-transform duration-[var(--duration-fast)]'
                  )}
                >
                  {logs.length}
                </p>
                <p className="text-[var(--text-2xs)] text-[var(--text-secondary)] font-[var(--weight-semibold)]">
                  total
                </p>
              </div>
            </div>

            {!bodyMetrics && (
              <p className="text-[var(--text-2xs)] text-[var(--text-tertiary)] text-center mt-[var(--space-3)]">
                {t('profile.addBodyMetrics')}
              </p>
            )}
          </div>

          {/* Streak Counter */}
          {userId && <StreakCounter userId={userId} />}

          {/* Recent Workouts */}
          <div
            className={cn(
              'bg-[var(--surface-primary)]',
              'border border-[var(--border-default)]',
              'rounded-[var(--radius-xl)]',
              'p-[var(--space-4)]',
              'shadow-[var(--shadow-sm)]'
            )}
          >
            <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-3)]">
              <BookCheckIcon className="w-4 h-4 text-[var(--brand-primary)]" />
              <h3 className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                {t('profile.recentWorkouts')}
              </h3>
            </div>

            {logs.length > 0 ? (
              <div className="space-y-[var(--space-2)]">
                {logs
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((log, index) => {
                    const logDate = new Date(log.date);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between py-[var(--space-2)] border-b border-[var(--border-default)] last:border-0"
                      >
                        <div>
                          <p className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--text-primary)]">
                            {log.focus}
                          </p>
                          <p className="text-[var(--text-2xs)] text-[var(--text-tertiary)] mt-[var(--space-0-5)]">
                            {logDate.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })}
                            {log.durationMinutes && ` · ${log.durationMinutes} ${t('workout.min')}`}
                          </p>
                        </div>
                        <p className="text-[var(--text-2xs)] text-[var(--text-secondary)]">
                          {t('workout.exerciseCount', { count: log.exercises.length })}
                        </p>
                      </div>
                    );
                  })}

                <button
                  className={cn(
                    'w-full',
                    'py-[var(--space-2-5)]',
                    'rounded-[var(--radius-lg)]',
                    'bg-[var(--surface-secondary)]',
                    'hover:bg-[var(--surface-hover)]',
                    'text-[var(--text-sm)]',
                    'font-[var(--weight-medium)]',
                    'text-[var(--text-primary)]',
                    'transition-all duration-[var(--duration-fast)]'
                  )}
                >
                  {t('profile.viewAllHistory')}
                </button>
              </div>
            ) : (
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)] text-center py-[var(--space-6)]">
                {t('profile.noWorkoutsYet')}
              </p>
            )}
          </div>

          {/* Section Divider - Your Progress */}
          <div className="relative py-[var(--space-2)]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-[var(--border-default)]"></div>
            </div>
            <div className="relative flex justify-center">
              <span
                className={cn(
                  'bg-[var(--bg-primary)]',
                  'px-[var(--space-4)]',
                  'text-[var(--text-2xs)]',
                  'uppercase tracking-[var(--tracking-widest)]',
                  'font-[var(--weight-bold)]',
                  'text-[var(--text-tertiary)]'
                )}
              >
                Your Progress
              </span>
            </div>
          </div>

          {/* Progress Photos Section */}
          {userId && (
            <Card>
              <CardHeader className="p-[var(--space-4)] border-b border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[var(--text-md)] font-[var(--weight-bold)] text-[var(--text-primary)] flex items-center gap-[var(--space-2)]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[var(--brand-primary)]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    Progress Photos
                  </h3>
                  <button
                    onClick={() => setIsPhotoCaptureOpen(true)}
                    className={cn(
                      'px-[var(--space-3)] py-[var(--space-1-5)]',
                      'text-[var(--text-xs)]',
                      'font-[var(--weight-bold)]',
                      'bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
                      'text-[var(--text-on-brand)]',
                      'rounded-[var(--radius-lg)]',
                      'hover:shadow-[var(--shadow-lg)]',
                      'transition-all duration-[var(--duration-fast)]'
                    )}
                  >
                    + Add Photo
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-[var(--space-4)]">
                {latestPhoto ? (
                  <div className="space-y-[var(--space-3)]">
                    <div className="max-w-sm mx-auto">
                      <ProgressPhotoCard
                        photoUrl={latestPhoto.photoUrl}
                        photoType={latestPhoto.photoType}
                        date={latestPhoto.date}
                        aiAnalysis={latestPhoto.aiAnalysis}
                      />
                    </div>
                    <button
                      onClick={() => setViewAllPhotos(true)}
                      className={cn(
                        'w-full',
                        'py-[var(--space-2-5)]',
                        'rounded-[var(--radius-lg)]',
                        'bg-[var(--surface-secondary)]',
                        'hover:bg-[var(--surface-hover)]',
                        'text-[var(--text-sm)]',
                        'font-[var(--weight-medium)]',
                        'text-[var(--text-primary)]',
                        'transition-all duration-[var(--duration-fast)]'
                      )}
                    >
                      View All Photos
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-[var(--space-8)]">
                    <div
                      className={cn(
                        'w-16 h-16',
                        'mx-auto mb-[var(--space-4)]',
                        'rounded-full',
                        'bg-[var(--surface-secondary)]',
                        'flex items-center justify-center'
                      )}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[var(--text-tertiary)]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                    <p className="text-[var(--text-base)] font-[var(--weight-semibold)] text-[var(--text-primary)] mb-[var(--space-2)]">
                      No progress photos yet
                    </p>
                    <p className="text-[var(--text-sm)] text-[var(--text-secondary)] max-w-sm mx-auto mb-[var(--space-4)]">
                      Start tracking your transformation with AI-powered body composition analysis
                    </p>
                    <button
                      onClick={() => setIsPhotoCaptureOpen(true)}
                      className={cn(
                        'px-[var(--space-6)] py-[var(--space-3)]',
                        'bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
                        'text-[var(--text-on-brand)]',
                        'text-[var(--text-sm)]',
                        'font-[var(--weight-bold)]',
                        'rounded-[var(--radius-lg)]',
                        'hover:shadow-[var(--shadow-lg)]',
                        'transition-all duration-[var(--duration-fast)]'
                      )}
                    >
                      Upload First Photo
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Achievements Section */}
          {userId && (
            <Card>
              <CardHeader className="p-[var(--space-4)] border-b border-[var(--border-default)]">
                <h3 className="text-[var(--text-md)] font-[var(--weight-bold)] text-[var(--text-primary)] flex items-center gap-[var(--space-2)]">
                  <TrophyIcon className="w-5 h-5 text-[var(--brand-primary)]" />
                  Achievements
                </h3>
              </CardHeader>
              <CardContent className="p-[var(--space-4)]">
                {/* Heat Map */}
                <HeatMapCalendar userId={userId} />

                {/* Achievement Badges */}
                <div className="mt-[var(--space-4)]">
                  <p className="text-[var(--text-xs)] font-[var(--weight-bold)] text-[var(--text-primary)] mb-[var(--space-3)]">
                    Unlocked Badges
                  </p>
                  {achievements && achievements.length > 0 ? (
                    <div className="grid grid-cols-2 gap-[var(--space-3)] animate-stagger">
                      {achievements.map((achievement) => (
                        <div
                          key={achievement._id}
                          className={cn(
                            'p-[var(--space-4)]',
                            'bg-gradient-to-br from-[var(--brand-primary-subtle)] to-[var(--brand-primary)]/5',
                            'border border-[var(--border-default)]',
                            'rounded-[var(--radius-xl)]',
                            'text-center',
                            'hover:border-[var(--brand-primary)]',
                            'hover:shadow-[var(--shadow-lg)]',
                            'hover:-translate-y-[4px]',
                            'transition-all duration-[var(--duration-normal)]',
                            'cursor-default group'
                          )}
                        >
                          <div className="text-4xl mb-[var(--space-2)] group-hover:scale-110 transition-transform duration-[var(--duration-normal)]">
                            {achievement.icon}
                          </div>
                          <p className="text-[var(--text-sm)] font-[var(--weight-bold)] text-[var(--text-primary)] mb-[var(--space-1)]">
                            {achievement.displayName}
                          </p>
                          <p className="text-[var(--text-2xs)] text-[var(--text-secondary)] mb-[var(--space-2)]">
                            {achievement.description}
                          </p>
                          <div
                            className={cn(
                              'inline-flex items-center',
                              'rounded-full',
                              'px-[var(--space-2-5)] py-[var(--space-0-5)]',
                              'text-[var(--text-2xs)]',
                              'font-[var(--weight-semibold)]',
                              'transition-transform group-hover:scale-105',
                              achievement.tier === 'platinum' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' :
                                achievement.tier === 'gold' ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white' :
                                  achievement.tier === 'silver' ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800' :
                                    'bg-gradient-to-r from-orange-600 to-orange-700 text-white'
                            )}
                          >
                            {achievement.tier.toUpperCase()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-[var(--space-6)]">
                      <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                        Complete your first workout to unlock achievements!
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts Section */}
          {logs.length > 0 && (
            <div className="space-y-[var(--space-4)]">
              {/* Volume Chart */}
              <VolumeChart data={volumeData} />

              {/* PR History */}
              <PRHistoryChart records={prHistory} />
            </div>
          )}

          {/* User Code Card */}
          {userProfile?.userCode && (
            <Card>
              <CardHeader className="p-[var(--space-4)] border-b border-[var(--border-default)]">
                <h3 className="text-[var(--text-md)] font-[var(--weight-bold)] text-[var(--text-primary)] flex items-center gap-[var(--space-2)]">
                  <UsersIcon className="w-5 h-5 text-[var(--brand-primary)]" />
                  Your Buddy Code
                </h3>
              </CardHeader>
              <CardContent className="p-[var(--space-4)]">
                <div
                  className={cn(
                    'p-[var(--space-5)]',
                    'bg-gradient-to-br from-[var(--brand-primary-subtle)] to-[var(--brand-primary)]/10',
                    'border-2 border-[var(--brand-primary)]/20',
                    'rounded-[var(--radius-2xl)]',
                    'text-center'
                  )}
                >
                  <p
                    className={cn(
                      'text-[var(--text-2xs)]',
                      'uppercase tracking-[var(--tracking-widest)]',
                      'text-[var(--text-tertiary)]',
                      'font-[var(--weight-bold)]',
                      'mb-[var(--space-2)]'
                    )}
                  >
                    Share This Code
                  </p>
                  <p
                    className={cn(
                      'text-[var(--text-2xl)]',
                      'font-[var(--weight-black)]',
                      'font-mono',
                      'tracking-[var(--tracking-wider)]',
                      'text-[var(--brand-primary)]',
                      'mb-[var(--space-3)]'
                    )}
                  >
                    {userProfile.userCode}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userProfile.userCode!);
                      notify({ type: 'success', message: 'Code copied to clipboard!' });
                    }}
                    className={cn(
                      'px-[var(--space-4)] py-[var(--space-2)]',
                      'bg-[var(--brand-primary)]',
                      'text-[var(--text-on-brand)]',
                      'rounded-[var(--radius-lg)]',
                      'font-[var(--weight-bold)]',
                      'text-[var(--text-sm)]',
                      'hover:bg-[var(--brand-primary-hover)]',
                      'transition-all duration-[var(--duration-fast)]',
                      'active:scale-[0.95]'
                    )}
                  >
                    Copy Code
                  </button>
                </div>
                <p className="text-[var(--text-xs)] text-[var(--text-secondary)] text-center mt-[var(--space-3)]">
                  Share this code with friends to become workout buddies!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Section Divider - Settings */}
          <div className="relative py-[var(--space-2)]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-[var(--border-default)]"></div>
            </div>
            <div className="relative flex justify-center">
              <span
                className={cn(
                  'bg-[var(--bg-primary)]',
                  'px-[var(--space-4)]',
                  'text-[var(--text-2xs)]',
                  'uppercase tracking-[var(--tracking-widest)]',
                  'font-[var(--weight-bold)]',
                  'text-[var(--text-tertiary)]'
                )}
              >
                Settings & Details
              </span>
            </div>
          </div>

          {/* Collapsible Training Preferences */}
          {userProfile?.trainingPreferences && (
            <div
              className={cn(
                'bg-[var(--surface-primary)]',
                'border border-[var(--border-default)]',
                'rounded-[var(--radius-xl)]',
                'overflow-hidden',
                'shadow-[var(--shadow-sm)]'
              )}
            >
              <button
                onClick={() => setShowTrainingPrefs(!showTrainingPrefs)}
                className={cn(
                  'w-full',
                  'p-[var(--space-4)]',
                  'flex items-center justify-between',
                  'hover:bg-[var(--surface-hover)]',
                  'transition-colors duration-[var(--duration-fast)]'
                )}
              >
                <h3 className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                  {t('profile.trainingPreferences')}
                </h3>
                <svg
                  className={cn(
                    'w-5 h-5 text-[var(--text-secondary)]',
                    'transition-transform duration-[var(--duration-fast)]',
                    showTrainingPrefs && 'rotate-180'
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTrainingPrefs && (
                <div className="px-[var(--space-4)] pb-[var(--space-4)] border-t border-[var(--border-default)] pt-[var(--space-4)] space-y-[var(--space-2-5)]">
                  <div>
                    <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-1)]">
                      {t('profile.primaryGoal')}
                    </p>
                    <p className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-white">
                      {userProfile.trainingPreferences.primary_goal}
                    </p>
                    {userProfile.trainingPreferences.goal_explanation && (
                      <p className="text-[var(--text-2xs)] text-white/60 mt-[var(--space-1)] italic">
                        "{userProfile.trainingPreferences.goal_explanation}"
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-[var(--space-2)]">
                    <div>
                      <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-1)]">
                        {t('profile.experience')}
                      </p>
                      <p className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-white">
                        {userProfile.trainingPreferences.experience_level}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-1)]">
                        {t('profile.frequency')}
                      </p>
                      <p className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-white">
                        {t('profile.daysPerWeek', { days: userProfile.trainingPreferences.training_frequency })}
                      </p>
                    </div>
                  </div>

                  {userProfile.trainingPreferences.pain_points.length > 0 && (
                    <div>
                      <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-1)]">
                        {t('profile.painPoints')}
                      </p>
                      <p className="text-[var(--text-sm)] text-white/90">
                        {userProfile.trainingPreferences.pain_points.join(', ')}
                      </p>
                    </div>
                  )}

                  {userProfile.trainingPreferences.sport && (
                    <div>
                      <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-1)]">
                        {t('profile.sport')}
                      </p>
                      <p className="text-[var(--text-sm)] text-white/90">
                        {userProfile.trainingPreferences.sport}
                      </p>
                    </div>
                  )}

                  {userProfile.trainingPreferences.additional_notes && (
                    <div>
                      <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-1)]">
                        {t('profile.additionalNotes')}
                      </p>
                      <p className="text-[var(--text-xs)] text-white/70">
                        {userProfile.trainingPreferences.additional_notes}
                      </p>
                    </div>
                  )}

                  <p className="text-[var(--text-2xs)] text-white/40 mt-[var(--space-3)] pt-[var(--space-3)] border-t border-white/10">
                    {t('profile.lastUpdated', { date: new Date(userProfile.trainingPreferences.last_updated).toLocaleDateString() })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Injury Profile */}
          {userId && fullUserData?.injuryProfile && (
            <div
              className={cn(
                'bg-[var(--surface-primary)]',
                'border border-[var(--border-default)]',
                'rounded-[var(--radius-xl)]',
                'overflow-hidden',
                'shadow-[var(--shadow-sm)]'
              )}
            >
              <button
                onClick={() => setShowInjuryProfile(!showInjuryProfile)}
                className={cn(
                  'w-full',
                  'p-[var(--space-4)]',
                  'flex items-center justify-between',
                  'hover:bg-[var(--surface-hover)]',
                  'transition-colors duration-[var(--duration-fast)]'
                )}
              >
                <h3 className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                  Injury Profile
                </h3>
                <svg
                  className={cn(
                    'w-5 h-5 text-[var(--text-secondary)]',
                    'transition-transform duration-[var(--duration-fast)]',
                    showInjuryProfile && 'rotate-180'
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showInjuryProfile && (
                <div className="border-t border-[var(--border-default)]">
                  <InjuryProfile
                    userId={userId}
                    injuryProfile={fullUserData?.injuryProfile}
                  />
                </div>
              )}
            </div>
          )}

          {/* Combined Settings Section - Enhanced Contrast */}
          <div
            className={cn(
              'bg-[var(--surface-primary)]',
              'border border-[var(--border-strong)]',
              'rounded-[var(--radius-xl)]',
              'p-[var(--space-4)]',
              'shadow-[var(--shadow-sm)]'
            )}
          >
            <h3 className="text-[var(--text-base)] font-[var(--weight-bold)] text-[var(--text-primary)] mb-[var(--space-4)]">
              Settings
            </h3>

            {/* Plan Management */}
            <div className="mb-[var(--space-5)]">
              <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-2)]">
                Plan Management
              </p>
              <button
                onClick={handleCreateNewPlan}
                className={cn(
                  'w-full',
                  'py-[var(--space-3)]',
                  'rounded-[var(--radius-lg)]',
                  'font-[var(--weight-semibold)]',
                  'text-[var(--text-sm)]',
                  'text-[var(--text-on-brand)]',
                  'bg-[var(--brand-primary)]',
                  'hover:bg-[var(--brand-primary-hover)]',
                  'active:scale-[0.98]',
                  'transition-all duration-[var(--duration-fast)]',
                  'shadow-[var(--shadow-md)]'
                )}
              >
                {t('profile.createNewPlan')}
              </button>
            </div>

            {/* App Preferences */}
            <div>
              <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-white/50 font-[var(--weight-bold)] mb-[var(--space-2)]">
                Preferences
              </p>
              <div className="space-y-[var(--space-2)]">
                <button
                  className={cn(
                    'w-full',
                    'flex items-center justify-between',
                    'px-[var(--space-3)] py-[var(--space-3)]',
                    'rounded-[var(--radius-lg)]',
                    'bg-white/[0.06]',
                    'border border-white/[0.08]',
                    'hover:bg-white/[0.1]',
                    'active:scale-[0.99]',
                    'transition-all duration-[var(--duration-fast)]'
                  )}
                >
                  <span className="text-[var(--text-sm)] font-[var(--weight-medium)] text-white/90">
                    {t('profile.notificationSettings')}
                  </span>
                  <span className="text-white/40 text-lg">›</span>
                </button>
                <button
                  className={cn(
                    'w-full',
                    'flex items-center justify-between',
                    'px-[var(--space-3)] py-[var(--space-3)]',
                    'rounded-[var(--radius-lg)]',
                    'bg-white/[0.06]',
                    'border border-white/[0.08]',
                    'hover:bg-white/[0.1]',
                    'active:scale-[0.99]',
                    'transition-all duration-[var(--duration-fast)]'
                  )}
                >
                  <span className="text-[var(--text-sm)] font-[var(--weight-medium)] text-white/90">
                    {t('profile.units')}
                  </span>
                  <span className="text-white/40 text-lg">›</span>
                </button>
                <button
                  className={cn(
                    'w-full',
                    'flex items-center justify-between',
                    'px-[var(--space-3)] py-[var(--space-3)]',
                    'rounded-[var(--radius-lg)]',
                    'bg-white/[0.06]',
                    'border border-white/[0.08]',
                    'hover:bg-white/[0.1]',
                    'active:scale-[0.99]',
                    'transition-all duration-[var(--duration-fast)]'
                  )}
                >
                  <span className="text-[var(--text-sm)] font-[var(--weight-medium)] text-white/90">
                    {t('profile.exportData')}
                  </span>
                  <span className="text-white/40 text-lg">›</span>
                </button>

                {/* Danger Zone Separator */}
                <div className="pt-[var(--space-2)]">
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className={cn(
                      'w-full',
                      'flex items-center justify-between',
                      'px-[var(--space-3)] py-[var(--space-3)]',
                      'rounded-[var(--radius-lg)]',
                      'bg-red-500/10',
                      'border border-red-500/20',
                      'hover:bg-red-500/20',
                      'active:scale-[0.99]',
                      'transition-all duration-[var(--duration-fast)]'
                    )}
                  >
                    <span className="text-[var(--text-sm)] font-[var(--weight-medium)] text-red-400">
                      Delete Account
                    </span>
                    <span className="text-red-400/60 text-lg">›</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Delete Account Confirmation */}
        <AlertDialog
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          title="Delete Account?"
          description="This action cannot be undone. This will permanently delete your account and remove your data from our servers."
          confirmText="Delete Account"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleDeleteAccount}
        />

        {/* Photo Capture Dialog */}
        {userId && (
          <PhotoCaptureDialog
            userId={userId}
            isOpen={isPhotoCaptureOpen}
            onClose={() => setIsPhotoCaptureOpen(false)}
            onPhotoUploaded={() => {
              notify({ type: 'success', message: 'Photo uploaded successfully!' });
            }}
          />
        )}

        {/* View All Photos Modal */}
        {viewAllPhotos && userId && (
          <div
            className={cn(
              'fixed inset-0',
              'z-[var(--z-modal)]',
              'bg-[var(--bg-primary)]',
              'overflow-y-auto',
              'animate-fade-in'
            )}
            onClick={() => setViewAllPhotos(false)}
          >
            <div
              className="min-h-screen p-[var(--space-4)] pb-[calc(var(--space-8)+env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={cn(
                  'flex items-center justify-between',
                  'mb-[var(--space-6)]',
                  'sticky top-0',
                  'bg-[var(--bg-primary)]',
                  'py-[var(--space-4)]',
                  'z-[var(--z-sticky)]',
                  'border-b border-[var(--border-default)]'
                )}
              >
                <h2 className="text-[var(--text-xl)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                  All Progress Photos
                </h2>
                <button
                  onClick={() => setViewAllPhotos(false)}
                  className={cn(
                    'p-[var(--space-2)]',
                    'rounded-full',
                    'bg-[var(--surface-secondary)]',
                    'hover:bg-[var(--surface-hover)]',
                    'transition-all duration-[var(--duration-fast)]'
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[var(--text-primary)]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Photo Timeline */}
              <div className="max-w-6xl mx-auto">
                <PhotoTimeline userId={userId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
