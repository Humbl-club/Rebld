import React, { useState, useMemo, useEffect } from 'react';
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
   PROFILE PAGE - Clean, Sophisticated Design

   - Warm coral accent (#F0725C)
   - Clean system typography
   - Proper visual hierarchy
   - Easy on the eyes
   ═══════════════════════════════════════════════════════════════ */

// Accent color - warm coral
const ACCENT = '#F0725C';
const ACCENT_SOFT = 'rgba(240, 114, 92, 0.15)';
const ACCENT_GLOW = 'rgba(240, 114, 92, 0.25)';

interface ProfilePageProps {
  logs: WorkoutLog[];
  userProfile: UserProfile | null;
  onUpdateProfile: (data: Partial<UserProfile>) => void;
  onCreateNewPlan?: () => void;
}

export default function ProfilePage({ logs, userProfile, onUpdateProfile, onCreateNewPlan }: ProfilePageProps) {
  const { t } = useTranslation();
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [viewAllPhotos, setViewAllPhotos] = useState(false);
  const [showTrainingPrefs, setShowTrainingPrefs] = useState(false);
  const [showInjuryProfile, setShowInjuryProfile] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const deleteAccount = useMutation(api.mutations.deleteUserAccount);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pull-to-refresh
  const handleRefresh = async () => {
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

  const userId = user?.id || null;
  const fullUserData = useQuery(
    api.queries.getUserProfile,
    userId ? { userId } : "skip"
  );

  const achievements = useQuery(
    api.achievementQueries.getUserAchievements,
    userId ? { userId } : "skip"
  );

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
      <PullToRefreshIndicator
        distance={pullDistance}
        isTriggered={isTriggered}
        isRefreshing={isRefreshing}
      />

      <div
        className={cn(
          "w-full min-h-screen bg-[#0A0A0A]",
          "px-5",
          "pt-[calc(env(safe-area-inset-top)+12px)]",
          "pb-[calc(100px+env(safe-area-inset-bottom))]",
          "overflow-y-auto"
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header */}
        <header
          className={cn(
            "mb-6 transition-all duration-500",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-sm font-medium mb-1">
                {t('profile.account')}
              </p>
              <h1 className="text-white text-2xl font-semibold tracking-tight">
                {t('profile.title')}
              </h1>
            </div>
            <LanguageSwitcher />
          </div>
        </header>

        <main className="space-y-5">
          {/* Account Info Card */}
          <div
            className={cn(
              "rounded-2xl p-5",
              "bg-white/[0.03] border border-white/10",
              "transition-all duration-500 delay-100",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#F0725C]/10 flex items-center justify-center">
                <UserIcon className="w-7 h-7 text-[#F0725C]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[18px] font-bold text-white truncate">
                  {user?.emailAddresses[0]?.emailAddress?.split('@')[0] || t('profile.defaultName')}
                </h2>
                <p className="text-[13px] text-white/50">
                  {t('profile.workoutsCompleted', { count: logs.length })}
                </p>
              </div>
            </div>

            {/* Sign Out Button - HIGH CONTRAST */}
            <button
              onClick={handleSignOut}
              className={cn(
                "w-full flex items-center justify-between",
                "px-4 py-4 rounded-xl",
                "bg-white/[0.08] border border-white/10",
                "active:scale-[0.98] transition-all duration-200"
              )}
            >
              <span className="text-[15px] font-semibold text-white">
                {t('auth.signOut')}
              </span>
              <SignOutIcon className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Body Metrics */}
          <div
            className={cn(
              "rounded-2xl p-5",
              "bg-white/[0.03] border border-white/10",
              "transition-all duration-500 delay-150",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-white">
                {t('profile.bodyMetrics')}
              </h3>
              <button
                onClick={() => setIsEditingMetrics(!isEditingMetrics)}
                className="p-2 rounded-lg active:bg-white/10 transition-colors"
              >
                <CogIcon className="w-5 h-5 text-white/50" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Weight */}
              <div className="text-center p-4 rounded-2xl bg-[#F0725C]/10 border border-[#F0725C]/20">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                  Weight
                </p>
                <p className="text-[24px] font-semibold text-[#F0725C] tabular-nums">
                  {bodyMetrics?.weight || '—'}
                </p>
                <p className="text-[11px] text-white/40 font-semibold">kg</p>
              </div>

              {/* Body Fat */}
              <div className="text-center p-4 rounded-2xl bg-[#F0725C]/10 border border-[#F0725C]/20">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                  Body Fat
                </p>
                <p className="text-[24px] font-semibold text-[#F0725C] tabular-nums">
                  {bodyMetrics?.bodyFatPercentage || '—'}
                </p>
                <p className="text-[11px] text-white/40 font-semibold">%</p>
              </div>

              {/* Workouts */}
              <div className="text-center p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                  Workouts
                </p>
                <p className="text-[24px] font-semibold text-green-400 tabular-nums">
                  {logs.length}
                </p>
                <p className="text-[11px] text-white/40 font-semibold">total</p>
              </div>
            </div>

            {!bodyMetrics && (
              <p className="text-[12px] text-white/40 text-center mt-4">
                {t('profile.addBodyMetrics')}
              </p>
            )}
          </div>

          {/* Streak Counter */}
          {userId && <StreakCounter userId={userId} />}

          {/* Recent Workouts */}
          <div
            className={cn(
              "rounded-2xl p-5",
              "bg-white/[0.03] border border-white/10",
              "transition-all duration-500 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <div className="flex items-center gap-2 mb-4">
              <BookCheckIcon className="w-5 h-5 text-[#F0725C]" />
              <h3 className="text-[16px] font-bold text-white">
                {t('profile.recentWorkouts')}
              </h3>
            </div>

            {logs.length > 0 ? (
              <div className="space-y-2">
                {logs
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((log, index) => {
                    const logDate = new Date(log.date);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                      >
                        <div>
                          <p className="text-[14px] font-semibold text-white">
                            {log.focus}
                          </p>
                          <p className="text-[12px] text-white/40 mt-0.5">
                            {logDate.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })}
                            {log.durationMinutes && ` · ${log.durationMinutes} ${t('workout.min')}`}
                          </p>
                        </div>
                        <p className="text-[13px] text-white/50 whitespace-nowrap">
                          {log.exercises.length} {t('workout.exercises')}
                        </p>
                      </div>
                    );
                  })}

                <button
                  className={cn(
                    "w-full py-3 mt-2 rounded-xl",
                    "bg-white/[0.05] border border-white/10",
                    "text-[14px] font-medium text-white/70",
                    "active:scale-[0.98] transition-all duration-200"
                  )}
                >
                  {t('profile.viewAllHistory')}
                </button>
              </div>
            ) : (
              <p className="text-[14px] text-white/50 text-center py-8">
                {t('profile.noWorkoutsYet')}
              </p>
            )}
          </div>

          {/* Section Divider */}
          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black px-4 text-[10px] uppercase tracking-widest font-bold text-white/30">
                Your Progress
              </span>
            </div>
          </div>

          {/* Progress Photos Section */}
          {userId && (
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500 delay-250",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#F0725C]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    Progress Photos
                  </h3>
                  <button
                    onClick={() => setIsPhotoCaptureOpen(true)}
                    className={cn(
                      "px-3 py-2 rounded-lg",
                      "text-[12px] font-bold",
                      "bg-[#F0725C] text-white",
                      "active:scale-[0.95] transition-all duration-200"
                    )}
                  >
                    + Add Photo
                  </button>
                </div>
              </div>
              <div className="p-5">
                {latestPhoto ? (
                  <div className="space-y-3">
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
                        "w-full py-3 rounded-xl",
                        "bg-white/[0.05] border border-white/10",
                        "text-[14px] font-medium text-white/70",
                        "active:scale-[0.98] transition-all duration-200"
                      )}
                    >
                      View All Photos
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white/30">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                    <p className="text-[16px] font-semibold text-white mb-1">
                      No progress photos yet
                    </p>
                    <p className="text-[13px] text-white/50 max-w-sm mx-auto mb-5">
                      Start tracking your transformation with AI-powered body composition analysis
                    </p>
                    <button
                      onClick={() => setIsPhotoCaptureOpen(true)}
                      className={cn(
                        "px-6 py-3 rounded-xl",
                        "bg-[#F0725C] text-white",
                        "text-[14px] font-bold",
                        "active:scale-[0.95] transition-all duration-200"
                      )}
                    >
                      Upload First Photo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Achievements Section */}
          {userId && (
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500 delay-300",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="p-5 border-b border-white/10">
                <h3 className="text-[16px] font-bold text-white flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5 text-[#F0725C]" />
                  Achievements
                </h3>
              </div>
              <div className="p-5">
                <HeatMapCalendar userId={userId} />

                <div className="mt-5">
                  <p className="text-[12px] font-bold text-white mb-3">
                    Unlocked Badges
                  </p>
                  {achievements && achievements.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {achievements.map((achievement) => (
                        <div
                          key={achievement._id}
                          className={cn(
                            "p-4 rounded-xl text-center",
                            "bg-[#F0725C]/5 border border-white/10",
                            "active:scale-[0.98] transition-all duration-200"
                          )}
                        >
                          <div className="text-3xl mb-2">{achievement.icon}</div>
                          <p className="text-[13px] font-bold text-white mb-1">
                            {achievement.displayName}
                          </p>
                          <p className="text-[11px] text-white/50 mb-2">
                            {achievement.description}
                          </p>
                          <div
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5",
                              "text-[10px] font-bold uppercase",
                              achievement.tier === 'platinum' ? 'bg-purple-500/20 text-purple-300' :
                                achievement.tier === 'gold' ? 'bg-yellow-500/20 text-yellow-300' :
                                  achievement.tier === 'silver' ? 'bg-gray-400/20 text-gray-300' :
                                    'bg-orange-500/20 text-orange-300'
                            )}
                          >
                            {achievement.tier}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-[13px] text-white/50">
                        Complete your first workout to unlock achievements!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          {logs.length > 0 && (
            <div className="space-y-4">
              <VolumeChart data={volumeData} />
              <PRHistoryChart records={prHistory} />
            </div>
          )}

          {/* User Code Card */}
          {userProfile?.userCode && (
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500 delay-350",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="p-5 border-b border-white/10">
                <h3 className="text-[16px] font-bold text-white flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-[#F0725C]" />
                  Your Buddy Code
                </h3>
              </div>
              <div className="p-5">
                <div className="p-6 rounded-2xl bg-[#F0725C]/10 border border-[#F0725C]/20 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">
                    Share This Code
                  </p>
                  <p className="text-[28px] font-semibold font-mono tracking-wider text-[#F0725C] mb-4">
                    {userProfile.userCode}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userProfile.userCode!);
                      notify({ type: 'success', message: 'Code copied to clipboard!' });
                    }}
                    className={cn(
                      "px-6 py-3 rounded-xl",
                      "bg-[#F0725C] text-white",
                      "font-bold text-[14px]",
                      "active:scale-[0.95] transition-all duration-200"
                    )}
                  >
                    Copy Code
                  </button>
                </div>
                <p className="text-[12px] text-white/40 text-center mt-3">
                  Share this code with friends to become workout buddies!
                </p>
              </div>
            </div>
          )}

          {/* Section Divider - Settings */}
          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black px-4 text-[10px] uppercase tracking-widest font-bold text-white/30">
                Settings & Details
              </span>
            </div>
          </div>

          {/* Training Preferences (Collapsible) */}
          {userProfile?.trainingPreferences && (
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <button
                onClick={() => setShowTrainingPrefs(!showTrainingPrefs)}
                className="w-full p-5 flex items-center justify-between active:bg-white/5 transition-colors"
              >
                <h3 className="text-[16px] font-bold text-white">
                  {t('profile.trainingPreferences')}
                </h3>
                <svg
                  className={cn(
                    "w-5 h-5 text-white/40 transition-transform duration-200",
                    showTrainingPrefs && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTrainingPrefs && (
                <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                      {t('profile.primaryGoal')}
                    </p>
                    <p className="text-[14px] font-semibold text-white">
                      {userProfile.trainingPreferences.primary_goal}
                    </p>
                    {userProfile.trainingPreferences.goal_explanation && (
                      <p className="text-[12px] text-white/50 mt-1 italic">
                        "{userProfile.trainingPreferences.goal_explanation}"
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                        {t('profile.experience')}
                      </p>
                      <p className="text-[14px] font-semibold text-white">
                        {userProfile.trainingPreferences.experience_level}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                        {t('profile.frequency')}
                      </p>
                      <p className="text-[14px] font-semibold text-white">
                        {t('profile.daysPerWeek', { days: userProfile.trainingPreferences.training_frequency })}
                      </p>
                    </div>
                  </div>

                  {userProfile.trainingPreferences.pain_points.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                        {t('profile.painPoints')}
                      </p>
                      <p className="text-[13px] text-white/70">
                        {userProfile.trainingPreferences.pain_points.join(', ')}
                      </p>
                    </div>
                  )}

                  {userProfile.trainingPreferences.sport && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                        {t('profile.sport')}
                      </p>
                      <p className="text-[13px] text-white/70">
                        {userProfile.trainingPreferences.sport}
                      </p>
                    </div>
                  )}

                  {userProfile.trainingPreferences.additional_notes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                        {t('profile.additionalNotes')}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {userProfile.trainingPreferences.additional_notes}
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-white/30 mt-3 pt-3 border-t border-white/10">
                    {t('profile.lastUpdated', { date: new Date(userProfile.trainingPreferences.last_updated).toLocaleDateString() })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Injury Profile (Collapsible) */}
          {userId && fullUserData?.injuryProfile && (
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <button
                onClick={() => setShowInjuryProfile(!showInjuryProfile)}
                className="w-full p-5 flex items-center justify-between active:bg-white/5 transition-colors"
              >
                <h3 className="text-[16px] font-bold text-white">
                  Injury Profile
                </h3>
                <svg
                  className={cn(
                    "w-5 h-5 text-white/40 transition-transform duration-200",
                    showInjuryProfile && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showInjuryProfile && (
                <div className="border-t border-white/10">
                  <InjuryProfile
                    userId={userId}
                    injuryProfile={fullUserData?.injuryProfile}
                  />
                </div>
              )}
            </div>
          )}

          {/* Settings Section */}
          <div
            className={cn(
              "rounded-2xl p-5",
              "bg-white/[0.03] border border-white/10",
              "transition-all duration-500",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <h3 className="text-[16px] font-bold text-white mb-5">
              Settings
            </h3>

            {/* Plan Management */}
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">
                Plan Management
              </p>
              <button
                onClick={handleCreateNewPlan}
                className={cn(
                  "w-full py-4 rounded-xl",
                  "bg-[#F0725C] text-white",
                  "font-bold text-[14px]",
                  "shadow-[0_4px_12px_rgba(240,114,92,0.3)]",
                  "active:scale-[0.98] transition-all duration-200"
                )}
              >
                {t('profile.createNewPlan')}
              </button>
            </div>

            {/* Preferences */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">
                Preferences
              </p>
              <div className="space-y-2">
                <button
                  className={cn(
                    "w-full flex items-center justify-between",
                    "px-4 py-4 rounded-xl",
                    "bg-white/[0.05] border border-white/10",
                    "active:bg-white/10 transition-all duration-200"
                  )}
                >
                  <span className="text-[14px] font-medium text-white">
                    {t('profile.notificationSettings')}
                  </span>
                  <span className="text-white/30 text-lg">›</span>
                </button>
                <button
                  className={cn(
                    "w-full flex items-center justify-between",
                    "px-4 py-4 rounded-xl",
                    "bg-white/[0.05] border border-white/10",
                    "active:bg-white/10 transition-all duration-200"
                  )}
                >
                  <span className="text-[14px] font-medium text-white">
                    {t('profile.units')}
                  </span>
                  <span className="text-white/30 text-lg">›</span>
                </button>
                <button
                  className={cn(
                    "w-full flex items-center justify-between",
                    "px-4 py-4 rounded-xl",
                    "bg-white/[0.05] border border-white/10",
                    "active:bg-white/10 transition-all duration-200"
                  )}
                >
                  <span className="text-[14px] font-medium text-white">
                    {t('profile.exportData')}
                  </span>
                  <span className="text-white/30 text-lg">›</span>
                </button>

                {/* Delete Account - Danger Zone */}
                <div className="pt-3">
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className={cn(
                      "w-full flex items-center justify-between",
                      "px-4 py-4 rounded-xl",
                      "bg-red-500/10 border border-red-500/20",
                      "active:bg-red-500/20 transition-all duration-200"
                    )}
                  >
                    <span className="text-[14px] font-semibold text-red-400">
                      Delete Account
                    </span>
                    <span className="text-red-400/50 text-lg">›</span>
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
            className="fixed inset-0 z-50 bg-black overflow-y-auto animate-fade-in"
            onClick={() => setViewAllPhotos(false)}
          >
            <div
              className="min-h-screen p-5 pb-[calc(32px+env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-black py-4 z-10 border-b border-white/10">
                <h2 className="text-[20px] font-bold text-white">
                  All Progress Photos
                </h2>
                <button
                  onClick={() => setViewAllPhotos(false)}
                  className="p-2 rounded-full bg-white/10 active:bg-white/20 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
