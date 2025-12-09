import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, TimerIcon } from './icons';
import { WorkoutBlock } from '../types';

interface BlockCompletionScreenProps {
  completedBlock: WorkoutBlock;
  blockNumber: number;
  totalBlocks: number;
  nextBlock?: WorkoutBlock;
  onContinue: () => void;
}

export default function BlockCompletionScreen({
  completedBlock,
  blockNumber,
  totalBlocks,
  nextBlock,
  onContinue
}: BlockCompletionScreenProps) {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen w-full max-w-lg mx-auto flex flex-col items-center justify-center px-4 py-6 animate-scale-in">
      {/* Completion Icon */}
      <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center mb-4 animate-pulse-subtle shadow-card">
        <CheckCircleIcon className="w-8 h-8 text-white" />
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1.5 text-center">
        {t('session.blockCompleteTitle')}
      </h2>
      <p className="text-[13px] text-[var(--text-secondary)] mb-5 text-center">
        {completedBlock.title || t('plan.block', { number: blockNumber })}
      </p>

      {/* Progress Dots */}
      <div className="flex items-center gap-1.5 mb-5">
        {[...Array(totalBlocks)].map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < blockNumber
                ? 'w-6 bg-[var(--accent)]'
                : i === blockNumber
                ? 'w-1.5 bg-[var(--accent)]'
                : 'w-1.5 bg-[var(--surface-secondary)]'
            }`}
          />
        ))}
      </div>

      {/* Next Block Preview */}
      {nextBlock ? (
        <div className="w-full bg-[var(--surface-primary)] border border-[var(--border-default)] rounded-xl p-4 mb-5 shadow-sm">
          <p className="text-[var(--text-2xs)] uppercase tracking-wider text-[var(--text-tertiary)] font-bold mb-1.5">
            {t('session.upNext')}
          </p>
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">
            {nextBlock.title || t('session.nextBlockTitle')}
          </h3>
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
            {Array.isArray(nextBlock.exercises) ? nextBlock.exercises.length : 0} {t('session.exercises')}
            {nextBlock.type === 'superset' && ` · ${(nextBlock as any).rounds} ${t('session.rounds')}`}
            {nextBlock.type === 'amrap' && ` · ${(nextBlock as any).duration_minutes} ${t('session.minAmrap')}`}
          </p>
        </div>
      ) : (
        <div className="w-full bg-[var(--surface-primary)] border border-[var(--border-default)] rounded-xl p-4 mb-5 shadow-sm">
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)] text-center">
            {t('session.finalBlock')}
          </p>
        </div>
      )}

      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="w-full py-3 rounded-xl font-bold text-[13px] text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all shadow-card"
      >
        <TimerIcon className="w-4 h-4 inline mr-2" />
        {nextBlock ? t('session.continueWorkout') : t('session.finalBlockLetsGo')}
      </button>
    </div>
  );
}
