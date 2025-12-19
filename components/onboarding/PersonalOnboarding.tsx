import React, { useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useMutation, useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { WorkoutPlan } from '../../types';
import { useHaptic } from '../../hooks/useAnimations';
import { cn } from '../../lib/utils';
import { Check } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONAL ONBOARDING - Editorial Noir (Brutalist Edition)
// ═══════════════════════════════════════════════════════════════════════════════

interface PersonalOnboardingProps {
  onPlanGenerated: (plan: Omit<WorkoutPlan, 'id'>) => void;
}

// ════════════════════════════════════════════════════════════════════
// NOIR TOKENS
// ════════════════════════════════════════════════════════════════════

const NOIR_STYLES = {
  // Layout
  pageContainer: "h-[100dvh] bg-black text-white flex flex-col",
  contentContainer: "flex-1 flex flex-col px-6 pt-safe-top",

  // Typography
  headHuge: "font-inter font-black text-5xl leading-[0.9] tracking-tighter uppercase mb-2",
  headLarge: "font-inter font-black text-3xl leading-none tracking-tighter uppercase mb-4",
  headMedium: "font-inter font-bold text-xl tracking-tight uppercase mb-2",
  bodyText: "font-inter text-base text-[#A3A3A3] leading-relaxed",
  label: "font-mono text-xs text-[#525252] uppercase tracking-widest mb-2",
  valueDisplay: "font-inter font-bold text-white text-lg",

  // Components
  btnPrimary: "w-full bg-white text-black font-bold h-14 rounded-full active:scale-[0.98] transition-all uppercase tracking-wide text-sm flex items-center justify-center",
  btnSecondary: "w-full bg-transparent border border-white/20 text-white font-bold h-14 rounded-full active:scale-[0.98] transition-all uppercase tracking-wide text-sm hover:border-white flex items-center justify-center",
  btnBack: "text-[#A3A3A3] text-xs font-mono uppercase tracking-widest mb-8 flex items-center gap-2 hover:text-white transition-colors self-start",

  // Inputs
  input: "w-full bg-transparent border-b border-white/20 text-2xl font-bold py-4 focus:outline-none focus:border-white transition-colors rounded-none placeholder:text-[#333] font-mono",

  // Selection Cards/Buttons
  card: "w-full text-left p-6 border border-white/10 rounded-none mb-4 active:bg-white/5 transition-all hover:border-white/30 group",
  cardActive: "border-white bg-white/10",
  cardHead: "font-black text-xl uppercase tracking-tight group-hover:text-white transition-colors",
  cardBody: "text-sm text-[#737373] mt-1 font-mono tracking-tight",

  gridBtn: "aspect-square flex flex-col items-center justify-center border border-white/10 active:scale-95 transition-all hover:bg-white/5",
  gridBtnActive: "bg-white text-black border-white",
};

// ════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ════════════════════════════════════════════════════════════════════

type Path = 'competition' | 'general' | null;
type GeneralGoal = 'aesthetic' | 'strong' | 'athletic' | 'shredded' | 'curves' | 'balanced';
type Experience = 'beginner' | 'intermediate' | 'advanced';
type Step = 'welcome' | 'path' | 'goal' | 'schedule' | 'body' | 'strength' | 'final' | 'generating' | 'import';

const SPORTS = [
  { id: 'hyrox', name: 'HYROX', desc: 'Hybrid Racing' },
  { id: 'crossfit', name: 'CROSSFIT', desc: 'Functional Fitness' },
  { id: 'powerlifting', name: 'POWERLIFTING', desc: 'SBD Focus' },
  { id: 'other', name: 'CUSTOM', desc: 'Sport Specific' },
];

const GENERAL_GOALS = [
  { id: 'aesthetic', title: 'AESTHETIC', desc: 'Hypertrophy Focus' },
  { id: 'strong', title: 'STRENGTH', desc: 'Power & Force' },
  { id: 'athletic', title: 'PERFORMANCE', desc: 'Speed & Agility' },
  { id: 'shredded', title: 'DEFINITION', desc: 'Leanness Focus' },
  { id: 'curves', title: 'STRUCTURE', desc: 'Glute Emphasis' },
  { id: 'balanced', title: 'LONGEVITY', desc: 'Health Focus' },
];

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const BODY_AREAS = [
  { id: 'shoulders', label: 'SHOULDERS' },
  { id: 'lower_back', label: 'LOWER BACK' },
  { id: 'knees', label: 'KNEES' },
  { id: 'wrists', label: 'WRISTS' },
  { id: 'neck', label: 'NECK' },
  { id: 'hips', label: 'HIPS' },
];

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════

export default function PersonalOnboarding({ onPlanGenerated }: PersonalOnboardingProps) {
  const { user } = useUser();
  const haptic = useHaptic();

  // State
  const [step, setStep] = useState<Step>('welcome');
  const [path, setPath] = useState<Path>(null);

  // Form Data
  const [sport, setSport] = useState<string | null>(null);
  const [generalGoal, setGeneralGoal] = useState<GeneralGoal | null>(null);
  const [experience, setExperience] = useState<Experience>('intermediate');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 2, 4]); // Mon, Wed, Fri
  const [sessionLength, setSessionLength] = useState<number>(60);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [benchmarks, setBenchmarks] = useState<{ bench?: string, squat?: string, deadlift?: string }>({});
  const [importText, setImportText] = useState('');

  // Generation
  const generatePlanAction = useAction(api.ai.generateWorkoutPlan);
  const parsePlanAction = useAction(api.ai.parseWorkoutPlan);
  const incrementPlanUsageMutation = useMutation(api.mutations.incrementPlanUsage);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('INITIALIZING');

  // ════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════════════════════

  const goToStep = (newStep: Step) => {
    haptic.light();
    setStep(newStep);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setIsGenerating(true);
    setStatusText('PARSING DATA');
    try {
      const plan = await parsePlanAction({ planText: importText, userId: user?.id || 'anonymous' });
      if (plan) {
        if (user?.id) await incrementPlanUsageMutation({ userId: user.id });
        onPlanGenerated(plan as any);
      }
    } catch (e) {
      setIsGenerating(false);
      alert('IMPORT FAILED');
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStatusText('COMPILING PROGRAM');

    const primaryGoal = path === 'competition'
      ? 'Athletic Performance'
      : {
        aesthetic: 'Aesthetic Physique',
        strong: 'Strength & Power',
        athletic: 'Athletic Performance',
        shredded: 'Fat Loss & Definition',
        curves: 'Aesthetic Physique',
        balanced: 'Health & Longevity'
      }[generalGoal || 'balanced'];

    try {
      const plan = await generatePlanAction({
        preferences: {
          primary_goal: primaryGoal as any,
          experience_level: experience,
          training_frequency: String(selectedDays.length),
          preferred_session_length: String(sessionLength),
          equipment: 'commercial_gym',
          pain_points: painPoints,
          current_strength: {
            bench_kg: benchmarks.bench ? Number(benchmarks.bench) : undefined,
            squat_kg: benchmarks.squat ? Number(benchmarks.squat) : undefined,
            deadlift_kg: benchmarks.deadlift ? Number(benchmarks.deadlift) : undefined,
          },
          training_split: { sessions_per_day: '1', training_type: 'strength_only' },
          sport: path === 'competition' ? sport || undefined : undefined,
          _useSilverPrompt: true,
          _useFlashModel: true,
        },
        userId: user?.id,
      });

      if (plan) {
        setStatusText('FINALIZING');
        if (user?.id) await incrementPlanUsageMutation({ userId: user.id });
        onPlanGenerated(plan);
      }
    } catch (e) {
      setIsGenerating(false);
      alert('GENERATION ERROR');
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // STEPS
  // ════════════════════════════════════════════════════════════════════

  // 1. WELCOME
  const renderWelcome = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className="flex-1 flex flex-col justify-end pb-12 px-6">
        <p className={NOIR_STYLES.label}>SYSTEM READY</p>
        <h1 className={NOIR_STYLES.headHuge}>BUILD<br />YOUR<br />PROGRAM</h1>
        <div className="h-8" />
        <button onClick={() => goToStep('path')} className={NOIR_STYLES.btnPrimary}>
          INITIATE SEQUENCE
        </button>
      </div>
    </div>
  );

  // 2. PATH
  const renderPath = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('welcome')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>OBJECTIVE</h1>
        <button onClick={() => { setPath('competition'); goToStep('goal'); }} className={`${NOIR_STYLES.card} ${path === 'competition' ? NOIR_STYLES.cardActive : ''}`}>
          <div className={NOIR_STYLES.cardHead}>COMPETITION</div>
          <div className={NOIR_STYLES.cardBody}>Event Specific. Peaking. Performance.</div>
        </button>
        <button onClick={() => { setPath('general'); goToStep('goal'); }} className={`${NOIR_STYLES.card} ${path === 'general' ? NOIR_STYLES.cardActive : ''}`}>
          <div className={NOIR_STYLES.cardHead}>PHYSIQUE</div>
          <div className={NOIR_STYLES.cardBody}>Aesthetics. Hypertrophy. Strength.</div>
        </button>
        <div className="flex-1" />
        <button onClick={() => goToStep('import')} className="w-full py-4 text-center text-xs font-mono text-[#525252] uppercase tracking-widest hover:text-white transition-colors">
          IMPORT DATA
        </button>
        <div className="h-8" />
      </div>
    </div>
  );

  // 3. GOAL
  const renderGoal = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('path')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>FOCUS</h1>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-24">
          {path === 'competition' ? (
            SPORTS.map(s => (
              <button key={s.id} onClick={() => { setSport(s.id); goToStep('schedule'); }} className={NOIR_STYLES.card}>
                <div className={NOIR_STYLES.cardHead}>{s.name}</div>
                <div className={NOIR_STYLES.cardBody}>{s.desc}</div>
              </button>
            ))
          ) : (
            GENERAL_GOALS.map(g => (
              <button key={g.id} onClick={() => { setGeneralGoal(g.id as any); goToStep('schedule'); }} className={NOIR_STYLES.card}>
                <div className={NOIR_STYLES.cardHead}>{g.title}</div>
                <div className={NOIR_STYLES.cardBody}>{g.desc}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // 4. SCHEDULE
  const renderSchedule = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('goal')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>FREQUENCY</h1>

        <p className={NOIR_STYLES.label}>SELECT ACTIVE DAYS</p>
        <div className="flex justify-between mb-12">
          {DAYS.map((day, i) => {
            const isSelected = selectedDays.includes(i);
            return (
              <button key={day} onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort())}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${isSelected ? 'bg-white text-black' : 'bg-[#1A1A1A] text-[#525252]'}`}
              >
                {day[0]}
              </button>
            );
          })}
        </div>

        <p className={NOIR_STYLES.label}>DURATION: {sessionLength} MIN</p>
        <input
          type="range"
          min="30" max="120" step="15"
          value={sessionLength} onChange={(e) => setSessionLength(Number(e.target.value))}
          className="w-full accent-white h-1 bg-[#1A1A1A] appearance-none rounded-full mb-12"
        />

        <div className="flex-1" />
        <button onClick={() => goToStep('body')} className={NOIR_STYLES.btnPrimary} disabled={selectedDays.length === 0}>CONTINUE</button>
        <div className="h-8" />
      </div>
    </div>
  );

  // 5. BODY (Constraints)
  const renderBody = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('schedule')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>CONSTRAINTS</h1>
        <p className={`${NOIR_STYLES.bodyText} mb-8`}>Select any areas that require caution or exclusion.</p>

        <div className="grid grid-cols-2 gap-4">
          {BODY_AREAS.map(area => {
            const isActive = painPoints.includes(area.id);
            return (
              <button
                key={area.id}
                onClick={() => setPainPoints(prev => isActive ? prev.filter(p => p !== area.id) : [...prev, area.id])}
                className={cn(NOIR_STYLES.gridBtn, isActive && NOIR_STYLES.gridBtnActive)}
              >
                {isActive && <Check className="w-4 h-4 mb-2" />}
                <span className="text-xs font-bold tracking-widest">{area.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex-1" />
        <button onClick={() => goToStep('strength')} className={NOIR_STYLES.btnPrimary}>CONTINUE</button>
        <div className="h-8" />
      </div>
    </div>
  );

  // 6. STRENGTH (Calibration)
  const renderStrength = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('body')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>CALIBRATION</h1>
        <p className={`${NOIR_STYLES.bodyText} mb-12`}>Enter current 1RM (Optional).</p>

        <div className="space-y-8">
          <div>
            <p className={NOIR_STYLES.label}>BENCH PRESS</p>
            <div className="flex items-baseline border-b border-white/20 pb-2">
              <input
                type="number"
                placeholder="0"
                value={benchmarks.bench || ''}
                onChange={e => setBenchmarks(prev => ({ ...prev, bench: e.target.value }))}
                className="bg-transparent text-3xl font-black text-white w-full focus:outline-none placeholder:text-[#333]"
              />
              <span className="font-mono text-sm text-[#525252]">KG</span>
            </div>
          </div>

          <div>
            <p className={NOIR_STYLES.label}>SQUAT</p>
            <div className="flex items-baseline border-b border-white/20 pb-2">
              <input
                type="number"
                placeholder="0"
                value={benchmarks.squat || ''}
                onChange={e => setBenchmarks(prev => ({ ...prev, squat: e.target.value }))}
                className="bg-transparent text-3xl font-black text-white w-full focus:outline-none placeholder:text-[#333]"
              />
              <span className="font-mono text-sm text-[#525252]">KG</span>
            </div>
          </div>

          <div>
            <p className={NOIR_STYLES.label}>DEADLIFT</p>
            <div className="flex items-baseline border-b border-white/20 pb-2">
              <input
                type="number"
                placeholder="0"
                value={benchmarks.deadlift || ''}
                onChange={e => setBenchmarks(prev => ({ ...prev, deadlift: e.target.value }))}
                className="bg-transparent text-3xl font-black text-white w-full focus:outline-none placeholder:text-[#333]"
              />
              <span className="font-mono text-sm text-[#525252]">KG</span>
            </div>
          </div>
        </div>

        <div className="flex-1" />
        <button onClick={() => goToStep('final')} className={NOIR_STYLES.btnPrimary}>CONTINUE</button>
        <div className="h-8" />
      </div>
    </div>
  );

  // 7. FINAL (Confirmation)
  const renderFinal = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('strength')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>CONFIRMATION</h1>

        <div className="space-y-6 mb-12 border-t border-white/10 pt-6">
          <div className="flex justify-between items-center">
            <span className={NOIR_STYLES.label}>OBJECTIVE</span>
            <span className="text-white text-sm font-bold uppercase">{path}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={NOIR_STYLES.label}>FOCUS</span>
            <span className="text-white text-sm font-bold uppercase">{path === 'competition' ? SPORTS.find(s => s.id === sport)?.name : GENERAL_GOALS.find(g => g.id === generalGoal)?.title}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={NOIR_STYLES.label}>FREQUENCY</span>
            <span className="text-white text-sm font-bold uppercase">{selectedDays.length} DAYS / WEEK</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={NOIR_STYLES.label}>LIMITATIONS</span>
            <span className="text-white text-sm font-bold uppercase">{painPoints.length > 0 ? `${painPoints.length} PRESET` : 'NONE'}</span>
          </div>
        </div>

        <div className="bg-[#111] p-6 border border-white/5 mb-8">
          <p className="font-mono text-xs text-[#737373] leading-relaxed mb-4">
            SYSTEM WILL GENERATE A PERIODIZED HYPERTROPHY AND STRENGTH PROTOCOL BASED ON THE PROVIDED PARAMETERS.
          </p>
          <div className="flex items-center gap-2 text-white/40">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-mono text-[10px] uppercase">AI MODEL READY</span>
          </div>
        </div>

        <div className="flex-1" />
        <button onClick={handleGenerate} className={NOIR_STYLES.btnPrimary}>EXECUTE PROGRAM</button>
        <div className="h-8" />
      </div>
    </div>
  );

  // 8. IMPORT STEP
  const renderImportStep = () => (
    <div className={NOIR_STYLES.pageContainer}>
      <div className={NOIR_STYLES.contentContainer}>
        <button onClick={() => goToStep('path')} className={NOIR_STYLES.btnBack}>← BACK</button>
        <h1 className={NOIR_STYLES.headLarge}>DATA ENTRY</h1>

        <textarea
          className="w-full h-64 bg-[#0A0A0A] border border-white/10 p-4 font-mono text-xs text-[#A3A3A3] focus:border-white focus:outline-none resize-none mb-8"
          placeholder="// PASTE RAW COMPONENT DATA HERE..."
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />

        <button onClick={handleImport} disabled={!importText.trim()} className={NOIR_STYLES.btnPrimary}>
          PARSING SEQUENCE
        </button>
      </div>
    </div>
  );

  // LOADING STATE
  if (isGenerating) {
    return (
      <div className="h-[100dvh] bg-black text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-t-white border-white/10 rounded-full animate-spin mb-6" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#525252] animate-pulse">{statusText}</p>
      </div>
    )
  }

  // MAIN ROUTER
  switch (step) {
    case 'welcome': return renderWelcome();
    case 'path': return renderPath();
    case 'goal': return renderGoal();
    case 'schedule': return renderSchedule();
    case 'body': return renderBody();
    case 'strength': return renderStrength();
    case 'final': return renderFinal();
    case 'import': return renderImportStep();
    default: return renderWelcome();
  }
}
