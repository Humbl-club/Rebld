import React from 'react';
import { WorkoutLog, UserProfile } from '../types';
import ZenVictoryScreen from '../components/ZenVictoryScreen';

interface SessionSummaryPageProps {
  sessionLog: WorkoutLog;
  onDone: () => void;
  allLogs?: WorkoutLog[];
  userProfile?: UserProfile | null;
}

export default function SessionSummaryPage({ sessionLog, onDone, allLogs, userProfile }: SessionSummaryPageProps) {
  return (
    <ZenVictoryScreen
      sessionLog={sessionLog}
      onDone={onDone}
      allLogs={allLogs}
      userProfile={userProfile}
    />
  );
}
