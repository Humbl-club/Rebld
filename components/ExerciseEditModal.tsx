import React, { useState, useEffect } from 'react';
import { PlanExercise, MetricTemplate } from '../types';
import { XMarkIcon } from './icons';

interface ExerciseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exercise: PlanExercise) => void;
  exercise?: PlanExercise;
  initialCategory?: 'warmup' | 'main' | 'cooldown';
}

const METRIC_TYPES: MetricTemplate['type'][] = [
  'sets_reps_weight',
  'sets_reps',
  'sets_reps_weight_tempo',
  'sets_duration',
  'sets_duration_rest',
  'sets_duration_weight',
  'sets_distance_rest',
  'distance_time',
  'duration_only',
  'tempo',
];

const DEFAULT_METRICS: Record<MetricTemplate['type'], MetricTemplate> = {
  sets_reps_weight: { type: 'sets_reps_weight', target_sets: 3, target_reps: '8-12', rest_period_s: 90 },
  sets_reps: { type: 'sets_reps', target_sets: 3, target_reps: '15', rest_period_s: 60 },
  sets_reps_weight_tempo: { type: 'sets_reps_weight_tempo', target_sets: 3, target_reps: '5', target_tempo: '2:1:2', rest_period_s: 120 },
  sets_duration: { type: 'sets_duration', target_sets: 3, target_duration_s: 30, rest_period_s: 60 },
  sets_duration_rest: { type: 'sets_duration_rest', sets: 8, duration_seconds: 30, rest_seconds: 90 },
  sets_duration_weight: { type: 'sets_duration_weight', target_sets: 3, duration_seconds: 45, target_weight: 24, rest_period_s: 90 },
  sets_distance_rest: { type: 'sets_distance_rest', target_sets: 5, target_distance_m: 100, target_rest_s: 60, rest_period_s: 60 },
  distance_time: { type: 'distance_time', target_distance_km: 5 },
  duration_only: { type: 'duration_only', target_duration_minutes: 20 },
  tempo: { type: 'tempo', target_sets: 4, target_reps: '6', target_tempo: '3-1-1-0', rest_period_s: 120 },
};

const getDefaultExercise = (category: 'warmup' | 'main' | 'cooldown' = 'main'): Partial<PlanExercise> => ({
    category: category,
    metrics_template: DEFAULT_METRICS['sets_reps_weight']
});


export default function ExerciseEditModal({ isOpen, onClose, onSave, exercise, initialCategory }: ExerciseEditModalProps) {
  const [formData, setFormData] = useState<Partial<PlanExercise>>(exercise || getDefaultExercise(initialCategory));
  
  useEffect(() => {
    setFormData(exercise || getDefaultExercise(initialCategory));
  }, [exercise, isOpen, initialCategory]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof PlanExercise, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMetricChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metrics_template: { ...prev.metrics_template, [field]: value } as MetricTemplate,
    }));
  };

  const handleMetricTypeChange = (type: MetricTemplate['type']) => {
    setFormData(prev => ({
      ...prev,
      metrics_template: DEFAULT_METRICS[type],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.exercise_name || !formData.metrics_template || !formData.category) return;
    onSave(formData as PlanExercise);
  };
  
  const mt = formData.metrics_template;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative z-50 w-full max-w-lg flex flex-col bg-stone-900/80 border border-stone-700 backdrop-blur-xl rounded-2xl shadow-2xl max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-stone-800">
          <h2 className="text-lg font-bold text-white">{exercise ? 'Edit' : 'Add'} Exercise</h2>
          <button onClick={onClose} className="p-1 rounded-full text-stone-400 hover:bg-stone-800 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-4 bg-stone-800/50 rounded-lg border border-stone-700">
                <h3 className="text-base font-bold text-white mb-3">Core Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Exercise Name</label>
                        <input
                            type="text"
                            value={formData.exercise_name || ''}
                            onChange={(e) => handleInputChange('exercise_name', e.target.value)}
                            required
                            className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                    </div>
                     <div>
                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Category</label>
                        <select 
                            value={formData.category || 'main'} 
                            onChange={(e) => handleInputChange('category', e.target.value as PlanExercise['category'])} 
                            className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        >
                            <option value="warmup">Warm-up</option>
                            <option value="main">Main</option>
                            <option value="cooldown">Cool-down</option>
                        </select>
                    </div>
                </div>
                 <div className="mt-3">
                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Notes (Optional)</label>
                    <textarea value={formData.notes || ''} onChange={(e) => handleInputChange('notes', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none h-20 resize-none"/>
                </div>
            </div>

            <div className="p-4 bg-stone-800/50 rounded-lg border border-stone-700">
                <h3 className="text-base font-bold text-white mb-3">Tracking Metrics</h3>
                <div>
                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Metric Type</label>
                    <select value={mt?.type || 'sets_reps_weight'} onChange={(e) => handleMetricTypeChange(e.target.value as MetricTemplate['type'])} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none">
                        {METRIC_TYPES.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ').toUpperCase()}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
                    {mt && 'target_sets' in mt && (
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Sets</label>
                            <input type="number" value={(mt as any).target_sets || ''} onChange={(e) => handleMetricChange('target_sets', Number(e.target.value))} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                     {mt && 'target_reps' in mt && (
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Reps</label>
                            <input type="text" value={(mt as any).target_reps || ''} onChange={(e) => handleMetricChange('target_reps', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                     {mt && 'target_duration_s' in mt && (
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Duration (s)</label>
                            <input type="number" value={(mt as any).target_duration_s || ''} onChange={(e) => handleMetricChange('target_duration_s', Number(e.target.value))} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                    {mt && 'target_duration_minutes' in mt && (
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Duration (min)</label>
                            <input type="number" value={(mt as any).target_duration_minutes || ''} onChange={(e) => handleMetricChange('target_duration_minutes', Number(e.target.value))} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                    {mt && 'target_tempo' in mt && (
                         <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Tempo</label>
                            <input type="text" value={(mt as any).target_tempo || ''} onChange={(e) => handleMetricChange('target_tempo', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                     {mt && 'rest_period_s' in mt && (
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Rest (s)</label>
                            <input type="number" value={mt.rest_period_s || ''} onChange={(e) => handleMetricChange('rest_period_s', Number(e.target.value))} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                    {mt && 'one_rep_max_percentage' in mt && (
                         <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">1RM %</label>
                            <input type="text" value={mt.one_rep_max_percentage || ''} placeholder="e.g., 75%" onChange={(e) => handleMetricChange('one_rep_max_percentage', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                    {mt && 'incline' in mt && (
                         <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Incline</label>
                            <input type="text" value={mt.incline || ''} placeholder="e.g., 5%" onChange={(e) => handleMetricChange('incline', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                     {mt && 'speed' in mt && (
                         <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Speed</label>
                            <input type="text" value={mt.speed || ''} placeholder="e.g., 10km/h" onChange={(e) => handleMetricChange('speed', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                     {mt && 'resistance' in mt && (
                         <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Resistance</label>
                            <input type="text" value={mt.resistance || ''} placeholder="e.g., Level 8" onChange={(e) => handleMetricChange('resistance', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                     {mt && 'pulse_target' in mt && (
                         <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Pulse Target</label>
                            <input type="text" value={mt.pulse_target || ''} placeholder="e.g., 140bpm" onChange={(e) => handleMetricChange('pulse_target', e.target.value)} className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                        </div>
                    )}
                </div>
                 <div className="mt-3">
                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">RPE (Optional)</label>
                    <input type="text" value={formData.rpe || ''} onChange={(e) => handleInputChange('rpe', e.target.value)} placeholder="e.g., 7-8" className="w-full mt-1 p-2 bg-stone-900/70 border border-stone-700 rounded-md outline-none"/>
                </div>
            </div>

        </form>
        
        <footer className="p-4 border-t border-stone-800 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-semibold text-stone-300 bg-stone-800/80 rounded-lg hover:bg-stone-700/80 transition">Cancel</button>
            <button onClick={handleSubmit} type="submit" className="px-6 py-2 text-sm font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition">Save Changes</button>
        </footer>
      </div>
    </div>
  );
}