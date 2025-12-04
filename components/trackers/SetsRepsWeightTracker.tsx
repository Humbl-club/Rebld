import React, { useEffect } from 'react';
import { LoggedSetSRW } from '../../types';
import { InformationCircleIcon, SparklesIcon } from '../icons';

interface SetsRepsWeightTrackerProps {
  controlled: true;
  weight: number | string;
  reps: number | string;
  rpe: number | string;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  onRpeChange: (value: string) => void;
  setNumber: number;
  targetReps: string;
  targetRPE?: string | null;
  lastSessionSetData?: LoggedSetSRW; // Note: for displaying previous data, not for pre-filling
  showLogButton: boolean;
  suggestedWeight?: number | null; // AI-suggested weight based on strength profile
}

const getRpeDescription = (rpe: string | null | undefined): string => {
    if (!rpe) return "Rate of Perceived Exertion: How hard the set felt on a scale of 1-10.";
    const rpeNum = parseFloat(rpe);
    if (rpeNum >= 10) return "RPE 10: Maximum effort. No more reps possible.";
    if (rpeNum >= 9) return "RPE 9: Very hard. 1 rep left in the tank.";
    if (rpeNum >= 8) return "RPE 8: Hard. 2 reps left in the tank.";
    if (rpeNum >= 7) return "RPE 7: Moderately hard. 3 reps left in the tank.";
    if (rpeNum >= 5) return "RPE 5-6: Moderate. 4-6 reps left in the tank. Good for warm-ups.";
    return "RPE < 5: Very light. Easy warm-up pace.";
};


const SetsRepsWeightTracker: React.FC<SetsRepsWeightTrackerProps> = (props) => {
  const { setNumber, targetReps, targetRPE, lastSessionSetData, weight, reps, rpe, onWeightChange, onRepsChange, onRpeChange, showLogButton, suggestedWeight } = props;

  // Show suggestion only if no weight entered and no last session data and suggestion available
  const showSuggestion = suggestedWeight && suggestedWeight > 0 && !weight && !lastSessionSetData?.weight;

  const handleUseSuggestedWeight = () => {
    if (suggestedWeight) {
      onWeightChange(suggestedWeight.toString());
    }
  };

  return (
    <div className="pt-2">
        <div className="space-y-3">
             <div className="flex justify-between items-center px-1">
                <h4 className="text-base font-bold text-white">Set {setNumber}</h4>
                {lastSessionSetData && (
                    <div className="text-xs font-semibold text-stone-300 bg-black/30 px-2 py-1 rounded">
                        Last: {lastSessionSetData.weight}kg &times; {lastSessionSetData.reps} reps {lastSessionSetData.rpe && `@${lastSessionSetData.rpe}`}
                    </div>
                )}
            </div>

            {/* AI Weight Suggestion */}
            {showSuggestion && (
                <button
                    onClick={handleUseSuggestedWeight}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 rounded-lg text-sm text-purple-300 hover:bg-purple-600/30 transition-colors"
                >
                    <SparklesIcon className="w-4 h-4" />
                    <span>AI suggests <strong>{suggestedWeight}kg</strong> based on your profile</span>
                </button>
            )}

            <div className={`grid ${targetRPE ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                <div>
                    <label className="text-xs font-semibold text-stone-400">WEIGHT (KG)</label>
                    <input
                        type="number"
                        step="0.5"
                        value={weight}
                        onChange={(e) => onWeightChange(e.target.value)}
                        placeholder={suggestedWeight ? suggestedWeight.toString() : "0"}
                        className="w-full p-2 mt-1 text-center text-lg font-bold text-white bg-stone-900/50 border border-stone-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                </div>
                 <div>
                    <label className="text-xs font-semibold text-stone-400">REPS</label>
                    <input
                        type="number"
                        value={reps}
                        onChange={(e) => onRepsChange(e.target.value)}
                        placeholder={targetReps.toString()}
                        className="w-full p-2 mt-1 text-center text-lg font-bold text-white bg-stone-900/50 border border-stone-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                </div>
                {targetRPE && (
                    <div className="relative group">
                        <label className="text-xs font-semibold text-stone-400 flex items-center gap-1">
                            RPE
                            <InformationCircleIcon className="w-4 h-4 text-stone-500"/>
                        </label>
                        <input
                            type="number"
                            step="0.5"
                            value={rpe}
                            onChange={(e) => onRpeChange(e.target.value)}
                            placeholder={targetRPE}
                            className="w-full p-2 mt-1 text-center text-lg font-bold text-white bg-stone-900/50 border border-stone-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 text-xs text-center text-white bg-stone-800 border border-stone-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {getRpeDescription(targetRPE)}
                        </div>
                    </div>
                )}
            </div>
             {showLogButton && (
                 <button
                    type="submit"
                    // This button is now effectively a dummy, logic is in the footer
                    // It could be used with a form's onSubmit if we refactor, but for now it does nothing
                    disabled={weight === '' || reps === ''}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 focus:ring-red-500 disabled:bg-stone-500 disabled:text-stone-300 disabled:cursor-not-allowed transition-colors"
                >
                    Log Set
                </button>
             )}
        </div>
    </div>
  );
}
export default SetsRepsWeightTracker;