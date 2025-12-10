import React from 'react';
import { WorkoutLog } from '../types';
import ZenVictoryScreen from '../components/ZenVictoryScreen';

interface SessionSummaryPageProps {
  sessionLog: WorkoutLog;
  onDone: () => void;
}

export default function SessionSummaryPage({ sessionLog, onDone }: SessionSummaryPageProps) {
  return <ZenVictoryScreen sessionLog={sessionLog} onDone={onDone} />;
}
