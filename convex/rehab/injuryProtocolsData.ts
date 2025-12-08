/**
 * Evidence-Based Injury Rehabilitation Protocols
 *
 * Sources: ATG (Knees Over Toes), Dr. Stuart McGill (Back Mechanic),
 * Dr. John Rusin (Pain-Free Performance), Physical Therapy research
 *
 * Each protocol includes:
 * - Exercises to AVOID (absolute contraindications)
 * - Exercises to USE INSTEAD (safe alternatives)
 * - REHAB exercises (therapeutic exercises to include)
 * - Warning signs to watch for
 */

export interface InjuryProtocol {
  issue: string;
  display_name: string;
  exercises_to_avoid: {
    exercise: string;
    reason: string;
  }[];
  safe_alternatives: {
    avoid: string;
    use_instead: string;
    reason: string;
  }[];
  rehab_exercises: {
    exercise: string;
    category: 'warmup' | 'main' | 'cooldown';
    priority: 'essential' | 'recommended' | 'optional';
    sets: number;
    reps: string;
    notes: string;
    evidence_level: 'high' | 'moderate' | 'low';
  }[];
  warning_signs: string[];
  when_to_progress: string;
  when_to_regress: string;
}

export const INJURY_PROTOCOLS: InjuryProtocol[] = [
  // ═══════════════════════════════════════════════════════════
  // KNEE PAIN PROTOCOL (ATG / Knees Over Toes style)
  // ═══════════════════════════════════════════════════════════
  {
    issue: "knee_pain",
    display_name: "Knee Pain / Knee Issues",
    exercises_to_avoid: [
      { exercise: "Deep Barbell Back Squat", reason: "High compressive forces on unprepared knee" },
      { exercise: "Walking Lunges", reason: "Dynamic knee loading with forward momentum" },
      { exercise: "Box Jumps", reason: "High-impact landing stresses knee joint" },
      { exercise: "Jump Squats", reason: "Plyometric stress on unprepared tissues" },
      { exercise: "Leg Extensions (heavy)", reason: "Isolated shear force on patella" },
      { exercise: "Sissy Squats (untrained)", reason: "Extreme knee flexion without preparation" },
      { exercise: "Running (high volume)", reason: "Repetitive impact without conditioning" },
    ],
    safe_alternatives: [
      { avoid: "Deep Squat", use_instead: "Box Squat to Safe Depth", reason: "Controlled depth limits stress" },
      { avoid: "Walking Lunges", use_instead: "Reverse Lunges", reason: "Controlled deceleration, less knee travel" },
      { avoid: "Leg Extension Machine", use_instead: "Spanish Squat", reason: "Quad activation without shear force" },
      { avoid: "Running", use_instead: "Cycling or Rowing", reason: "Low impact cardio maintains fitness" },
      { avoid: "Jump Squat", use_instead: "Kettlebell Swing", reason: "Hip-dominant power without knee impact" },
    ],
    rehab_exercises: [
      // ESSENTIAL - Include in EVERY session for knee pain
      {
        exercise: "Backwards Walking / Sled Drag",
        category: "warmup",
        priority: "essential",
        sets: 1,
        reps: "5-10 minutes",
        notes: "THE most important knee rehab exercise. Walk backwards on treadmill (incline 10-15%) or drag sled backwards. Builds VMO, bulletproofs knees.",
        evidence_level: "high"
      },
      {
        exercise: "Tibialis Raises",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "25",
        notes: "Strengthens tibialis anterior - the 'shock absorber' of the lower leg. Use Tib Bar or stand on heels.",
        evidence_level: "high"
      },
      {
        exercise: "Patrick Step / Peterson Step",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "15 each leg",
        notes: "Controlled knee-over-toe movement. Step down slowly with heel kiss, drive back up. Gold standard for VMO.",
        evidence_level: "high"
      },
      // RECOMMENDED - Include when possible
      {
        exercise: "Poliquin Step-ups",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "8-12 each leg",
        notes: "Controlled step-up with full knee extension at top. Keep torso upright.",
        evidence_level: "high"
      },
      {
        exercise: "ATG Split Squat",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "8-12 each leg",
        notes: "Progress slowly. Start with bodyweight, elevate front foot if needed. Knee travels over toe.",
        evidence_level: "high"
      },
      {
        exercise: "Terminal Knee Extensions (TKE)",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "15-20 each leg",
        notes: "Band around knee, extend fully against resistance. Activates VMO.",
        evidence_level: "high"
      },
      {
        exercise: "Elevated Heel Goblet Squat",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "10-12",
        notes: "Heels on small plates or slant board. Allows knee-forward travel with less hip mobility demand.",
        evidence_level: "moderate"
      },
      // OPTIONAL - Add when progressing well
      {
        exercise: "Nordic Hamstring Curl (assisted)",
        category: "main",
        priority: "optional",
        sets: 3,
        reps: "5-8",
        notes: "Eccentric hamstring strength protects ACL. Use band assistance initially.",
        evidence_level: "high"
      },
      {
        exercise: "Calf Raises (full ROM)",
        category: "cooldown",
        priority: "recommended",
        sets: 2,
        reps: "20-25",
        notes: "Full stretch at bottom, full contraction at top. Builds Achilles and calf resilience.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Sharp pain during exercise (stop immediately)",
      "Swelling after workout (reduce volume)",
      "Pain going downstairs (indicates patella issues)",
      "Locking or giving way (see doctor)",
      "Pain that worsens over days (not recovering)"
    ],
    when_to_progress: "Pain-free for 2 weeks with current exercises. Can add load or ROM gradually.",
    when_to_regress: "Any return of sharp pain, swelling, or instability. Drop load 20-30% and rebuild."
  },

  // ═══════════════════════════════════════════════════════════
  // LOWER BACK PAIN PROTOCOL (McGill Method)
  // ═══════════════════════════════════════════════════════════
  {
    issue: "lower_back_pain",
    display_name: "Lower Back Pain",
    exercises_to_avoid: [
      { exercise: "Conventional Deadlift (heavy)", reason: "High spinal loading with flexion risk" },
      { exercise: "Good Mornings", reason: "Spinal flexion under load" },
      { exercise: "Bent Over Barbell Row", reason: "Sustained spinal flexion with load" },
      { exercise: "Sit-ups / Crunches", reason: "Repeated spinal flexion aggravates discs" },
      { exercise: "Russian Twists", reason: "Loaded spinal rotation" },
      { exercise: "Back Extensions (heavy)", reason: "Hyperextension under load" },
      { exercise: "Leg Press (excessive ROM)", reason: "Lumbar flexion at bottom position" },
    ],
    safe_alternatives: [
      { avoid: "Conventional Deadlift", use_instead: "Trap Bar Deadlift", reason: "Neutral spine, handles beside body" },
      { avoid: "Bent Over Row", use_instead: "Chest-Supported Row", reason: "Removes spinal loading entirely" },
      { avoid: "Sit-ups", use_instead: "Dead Bug", reason: "Core activation without spinal flexion" },
      { avoid: "Good Mornings", use_instead: "Hip Hinge with Band", reason: "Pattern practice without load" },
      { avoid: "Back Extensions", use_instead: "Bird Dog", reason: "Spine-sparing extension pattern" },
      { avoid: "Leg Press", use_instead: "Bulgarian Split Squat", reason: "Unilateral loading, spine neutral" },
    ],
    rehab_exercises: [
      // ESSENTIAL - McGill Big 3
      {
        exercise: "McGill Curl-up",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "10 (5 sec holds)",
        notes: "Hands under lower back, lift head/shoulders only. NO spinal flexion. Build endurance.",
        evidence_level: "high"
      },
      {
        exercise: "Side Plank",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "30-45 sec each side",
        notes: "Keep body straight. Progres to stacked feet. Builds lateral stability.",
        evidence_level: "high"
      },
      {
        exercise: "Bird Dog",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "10 each side (5 sec holds)",
        notes: "Extend opposite arm/leg while keeping spine PERFECTLY still. Anti-rotation exercise.",
        evidence_level: "high"
      },
      // RECOMMENDED
      {
        exercise: "Cat-Cow Stretch",
        category: "warmup",
        priority: "recommended",
        sets: 1,
        reps: "10 cycles",
        notes: "Gentle spinal mobility. Move slowly through flexion/extension.",
        evidence_level: "moderate"
      },
      {
        exercise: "Dead Bug",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "10 each side",
        notes: "Press lower back into floor. Extend opposite arm/leg. Core bracing practice.",
        evidence_level: "high"
      },
      {
        exercise: "Glute Bridge",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "12-15",
        notes: "Builds glute strength to unload spine. Squeeze at top, don't hyperextend.",
        evidence_level: "high"
      },
      {
        exercise: "Pallof Press",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "10 each side",
        notes: "Anti-rotation core exercise. Press cable/band away from chest, resist rotation.",
        evidence_level: "high"
      },
      {
        exercise: "Hip Hinge Practice (dowel)",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "10",
        notes: "Dowel on spine (head, upper back, tailbone contact). Practice hip hinge pattern.",
        evidence_level: "moderate"
      },
      // OPTIONAL
      {
        exercise: "Suitcase Carry",
        category: "main",
        priority: "optional",
        sets: 3,
        reps: "30-40m each side",
        notes: "Single-arm carry. Resist lateral flexion. Builds core stability.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Pain radiating down leg (sciatica - see doctor)",
      "Numbness or tingling in legs/feet",
      "Pain worse in morning (disc-related)",
      "Pain that wakes you at night",
      "Loss of bladder/bowel control (emergency)"
    ],
    when_to_progress: "Can perform McGill Big 3 pain-free for 2 weeks. Add load to hinge patterns gradually.",
    when_to_regress: "Any return of radiating pain or morning stiffness. Return to bodyweight Big 3."
  },

  // ═══════════════════════════════════════════════════════════
  // SHOULDER PAIN PROTOCOL
  // ═══════════════════════════════════════════════════════════
  {
    issue: "shoulder_pain",
    display_name: "Shoulder Pain / Impingement",
    exercises_to_avoid: [
      { exercise: "Behind-the-Neck Press", reason: "Extreme external rotation under load" },
      { exercise: "Upright Rows", reason: "Internal rotation + abduction = impingement" },
      { exercise: "Dips (deep)", reason: "Anterior shoulder stress at bottom" },
      { exercise: "Wide-Grip Bench Press", reason: "Excessive horizontal abduction" },
      { exercise: "Behind-the-Neck Pulldown", reason: "Impingement position under load" },
      { exercise: "Overhead Tricep Extension (heavy)", reason: "Loaded shoulder flexion" },
    ],
    safe_alternatives: [
      { avoid: "Behind-the-Neck Press", use_instead: "Landmine Press", reason: "Scapular-plane pressing, shoulder-friendly" },
      { avoid: "Upright Row", use_instead: "High Pull or Face Pull", reason: "External rotation maintained" },
      { avoid: "Dips", use_instead: "Close-Grip Bench Press", reason: "Tricep work without shoulder stress" },
      { avoid: "Wide-Grip Bench", use_instead: "Neutral-Grip DB Press", reason: "Reduced shoulder strain" },
      { avoid: "Behind-the-Neck Pulldown", use_instead: "Lat Pulldown to Chest", reason: "Proper scapular mechanics" },
    ],
    rehab_exercises: [
      // ESSENTIAL - Rotator cuff and scapular stability
      {
        exercise: "Band Pull-Aparts",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "15-20",
        notes: "Light band, squeeze shoulder blades. Do DAILY. Best shoulder prehab exercise.",
        evidence_level: "high"
      },
      {
        exercise: "Face Pulls",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "15-20",
        notes: "High cable, pull to face, externally rotate at end. Opens up chest, strengthens rear delts.",
        evidence_level: "high"
      },
      {
        exercise: "External Rotation (side-lying)",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "15 each side",
        notes: "Light weight or band. Elbow at 90°, rotate forearm up. Strengthens infraspinatus.",
        evidence_level: "high"
      },
      // RECOMMENDED
      {
        exercise: "YTWL Raises",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "8 each position",
        notes: "Prone or incline bench. Light weight. Hits all rotator cuff angles.",
        evidence_level: "high"
      },
      {
        exercise: "Scapular Push-ups",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "12-15",
        notes: "Push-up position, only protract/retract scapulae. Serratus activation.",
        evidence_level: "moderate"
      },
      {
        exercise: "Wall Slides",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "10-12",
        notes: "Back against wall, arms in 'goal post'. Slide up maintaining contact. Tests mobility.",
        evidence_level: "moderate"
      },
      {
        exercise: "Landmine Press",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "10-12 each arm",
        notes: "Shoulder-friendly pressing. Arc path follows scapular plane.",
        evidence_level: "moderate"
      },
      // OPTIONAL
      {
        exercise: "Turkish Get-up (light)",
        category: "main",
        priority: "optional",
        sets: 2,
        reps: "3 each side",
        notes: "Full shoulder stability through all ranges. Start very light.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Pain at rest (inflammation - reduce all overhead work)",
      "Night pain preventing sleep",
      "Weakness when lifting arm",
      "Clicking with pain (labrum issue)",
      "Sudden loss of strength (rotator cuff tear - see doctor)"
    ],
    when_to_progress: "Pain-free external rotation and overhead reach. Can add load to pressing gradually.",
    when_to_regress: "Any return of impingement symptoms. Avoid overhead work, focus on scapular stability."
  },

  // ═══════════════════════════════════════════════════════════
  // HIP PAIN PROTOCOL
  // ═══════════════════════════════════════════════════════════
  {
    issue: "hip_pain",
    display_name: "Hip Pain / Hip Flexor Issues",
    exercises_to_avoid: [
      { exercise: "Deep Squats (if impingement)", reason: "Hip impingement at depth" },
      { exercise: "Sit-ups / Leg Raises", reason: "Hip flexor overuse" },
      { exercise: "Running Sprints", reason: "Repetitive hip flexion impact" },
      { exercise: "High-Step Lunges", reason: "Excessive hip flexion" },
    ],
    safe_alternatives: [
      { avoid: "Deep Squat", use_instead: "Box Squat to Parallel", reason: "Controlled depth" },
      { avoid: "Leg Raises", use_instead: "Reverse Crunch", reason: "Less hip flexor involvement" },
      { avoid: "Sprints", use_instead: "Cycling", reason: "Hip movement without impact" },
    ],
    rehab_exercises: [
      {
        exercise: "90/90 Hip Stretch",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "60 sec each side",
        notes: "Seated, one leg in front (90°), one behind (90°). Lean forward gently.",
        evidence_level: "high"
      },
      {
        exercise: "Couch Stretch / Rectus Femoris Stretch",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "60 sec each side",
        notes: "Knee against wall, opposite foot forward. Opens hip flexors.",
        evidence_level: "high"
      },
      {
        exercise: "Glute Bridge (single leg)",
        category: "main",
        priority: "essential",
        sets: 3,
        reps: "10 each leg",
        notes: "Strengthens glutes without hip flexor involvement.",
        evidence_level: "high"
      },
      {
        exercise: "Clamshells",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "15 each side",
        notes: "Side-lying, knees bent, open top knee. Glute med activation.",
        evidence_level: "moderate"
      },
      {
        exercise: "Fire Hydrants",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "12 each side",
        notes: "All fours, lift knee to side. Hip mobility + glute med.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Catching or locking sensation",
      "Groin pain with activity",
      "Pain sitting for long periods",
      "Clicking with pain"
    ],
    when_to_progress: "Full ROM without pain. Can add load to hip hinge patterns.",
    when_to_regress: "Return of impingement symptoms. Focus on mobility work."
  },

  // ═══════════════════════════════════════════════════════════
  // WRIST PAIN PROTOCOL
  // ═══════════════════════════════════════════════════════════
  {
    issue: "wrist_pain",
    display_name: "Wrist Pain / Carpal Tunnel",
    exercises_to_avoid: [
      { exercise: "Front Squat (clean grip)", reason: "Extreme wrist extension under load" },
      { exercise: "Push-ups (flat hand)", reason: "Wrist extension under body weight" },
      { exercise: "Barbell Curl (straight bar)", reason: "Forced supination" },
    ],
    safe_alternatives: [
      { avoid: "Front Squat", use_instead: "Front Squat (cross-arm grip) or Safety Bar Squat", reason: "Reduces wrist strain" },
      { avoid: "Push-ups", use_instead: "Push-ups on Dumbbells or Push-up Handles", reason: "Neutral wrist position" },
      { avoid: "Straight Bar Curl", use_instead: "EZ-Bar Curl or Dumbbell Curl", reason: "Natural wrist angle" },
    ],
    rehab_exercises: [
      {
        exercise: "Wrist Circles",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "10 each direction",
        notes: "Gentle circles, both directions. Warms up joint.",
        evidence_level: "moderate"
      },
      {
        exercise: "Wrist Flexor Stretch",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "30 sec each",
        notes: "Arm extended, pull fingers back gently.",
        evidence_level: "moderate"
      },
      {
        exercise: "Wrist Curls (light)",
        category: "main",
        priority: "recommended",
        sets: 2,
        reps: "15-20",
        notes: "Very light weight. Build forearm strength gradually.",
        evidence_level: "moderate"
      },
      {
        exercise: "Reverse Wrist Curls",
        category: "main",
        priority: "recommended",
        sets: 2,
        reps: "15-20",
        notes: "Strengthens wrist extensors. Balance with flexors.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Numbness or tingling in fingers",
      "Weakness gripping objects",
      "Pain that wakes you at night"
    ],
    when_to_progress: "Pain-free grip strength. Can gradually return to loaded exercises.",
    when_to_regress: "Return of numbness or weakness. See doctor if persistent."
  },

  // ═══════════════════════════════════════════════════════════
  // ANKLE PAIN PROTOCOL
  // ═══════════════════════════════════════════════════════════
  {
    issue: "ankle_pain",
    display_name: "Ankle Pain / Ankle Instability",
    exercises_to_avoid: [
      { exercise: "Box Jumps", reason: "High-impact landing" },
      { exercise: "Jump Rope (high volume)", reason: "Repetitive impact" },
      { exercise: "Running on Uneven Surfaces", reason: "Ankle stability challenge" },
      { exercise: "Single-Leg Hops", reason: "High ankle stress" },
    ],
    safe_alternatives: [
      { avoid: "Box Jumps", use_instead: "Step-ups", reason: "No impact" },
      { avoid: "Jump Rope", use_instead: "Cycling", reason: "Zero ankle impact" },
      { avoid: "Running", use_instead: "Swimming or Rowing", reason: "Non-weight bearing cardio" },
    ],
    rehab_exercises: [
      {
        exercise: "Ankle Circles",
        category: "warmup",
        priority: "essential",
        sets: 2,
        reps: "10 each direction, each ankle",
        notes: "Gentle circles through full ROM.",
        evidence_level: "moderate"
      },
      {
        exercise: "Calf Raises (slow eccentric)",
        category: "main",
        priority: "essential",
        sets: 3,
        reps: "15 (3 sec down)",
        notes: "Build calf and Achilles strength. Control the lowering.",
        evidence_level: "high"
      },
      {
        exercise: "Single-Leg Balance",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "30 sec each leg",
        notes: "Progress to eyes closed, then unstable surface.",
        evidence_level: "high"
      },
      {
        exercise: "Ankle Alphabet",
        category: "warmup",
        priority: "recommended",
        sets: 1,
        reps: "A-Z each ankle",
        notes: "Draw letters with toe. Builds ankle mobility.",
        evidence_level: "moderate"
      },
      {
        exercise: "Banded Ankle Dorsiflexion",
        category: "warmup",
        priority: "recommended",
        sets: 2,
        reps: "15 each ankle",
        notes: "Band around forefoot, pull toes toward shin.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Significant swelling",
      "Unable to bear weight",
      "Bruising",
      "Repeated 'giving way'"
    ],
    when_to_progress: "Pain-free single-leg balance for 60 seconds. Can add light impact.",
    when_to_regress: "Any instability or return of pain. Back to non-weight bearing exercises."
  },

  // ═══════════════════════════════════════════════════════════
  // ELBOW PAIN PROTOCOL (Tennis/Golfer's Elbow)
  // ═══════════════════════════════════════════════════════════
  {
    issue: "elbow_pain",
    display_name: "Elbow Pain / Tennis or Golfer's Elbow",
    exercises_to_avoid: [
      { exercise: "Chin-ups (supinated grip)", reason: "High bicep tendon stress" },
      { exercise: "Barbell Curl (heavy)", reason: "Loaded elbow flexion" },
      { exercise: "Skull Crushers", reason: "Tricep tendon stress" },
      { exercise: "Wrist Curls (heavy)", reason: "Forearm tendon overload" },
    ],
    safe_alternatives: [
      { avoid: "Chin-ups", use_instead: "Neutral-Grip Pull-ups", reason: "Reduced bicep tendon stress" },
      { avoid: "Barbell Curl", use_instead: "Hammer Curl", reason: "Neutral grip reduces tendon strain" },
      { avoid: "Skull Crushers", use_instead: "Cable Pushdown", reason: "Constant tension, less stress at extension" },
    ],
    rehab_exercises: [
      {
        exercise: "Tyler Twist (FlexBar)",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "15",
        notes: "Best evidence-based exercise for tennis elbow. Use TheraBand FlexBar.",
        evidence_level: "high"
      },
      {
        exercise: "Reverse Tyler Twist",
        category: "warmup",
        priority: "essential",
        sets: 3,
        reps: "15",
        notes: "For golfer's elbow. Opposite motion of Tyler Twist.",
        evidence_level: "high"
      },
      {
        exercise: "Eccentric Wrist Extension",
        category: "main",
        priority: "recommended",
        sets: 3,
        reps: "15 (slow lowering)",
        notes: "Light dumbbell, palm down, slow eccentric lowering.",
        evidence_level: "high"
      },
      {
        exercise: "Supination/Pronation with Hammer",
        category: "main",
        priority: "recommended",
        sets: 2,
        reps: "15 each direction",
        notes: "Hold hammer at end, rotate forearm. Builds rotator strength.",
        evidence_level: "moderate"
      },
    ],
    warning_signs: [
      "Pain gripping objects",
      "Pain extending wrist against resistance",
      "Weakness in grip",
      "Pain radiating down forearm"
    ],
    when_to_progress: "Pain-free grip and wrist extension. Can gradually add pulling exercises.",
    when_to_regress: "Return of pain with gripping. Focus on eccentric work only."
  }
];

// Map from user-facing pain point names to protocol keys
export const PAIN_POINT_MAP: Record<string, string> = {
  "Knees": "knee_pain",
  "Knee": "knee_pain",
  "Knee Pain": "knee_pain",
  "Lower Back": "lower_back_pain",
  "Back": "lower_back_pain",
  "Lower Back Pain": "lower_back_pain",
  "Shoulder": "shoulder_pain",
  "Shoulders": "shoulder_pain",
  "Shoulder Pain": "shoulder_pain",
  "Hip": "hip_pain",
  "Hips": "hip_pain",
  "Hip Pain": "hip_pain",
  "Wrist": "wrist_pain",
  "Wrists": "wrist_pain",
  "Wrist Pain": "wrist_pain",
  "Ankle": "ankle_pain",
  "Ankles": "ankle_pain",
  "Ankle Pain": "ankle_pain",
  "Elbow": "elbow_pain",
  "Elbows": "elbow_pain",
  "Tennis Elbow": "elbow_pain",
  "Golfers Elbow": "elbow_pain",
};

/**
 * Get injury protocol by pain point name (user-facing)
 */
export function getProtocolForPainPoint(painPoint: string): InjuryProtocol | null {
  const normalizedKey = PAIN_POINT_MAP[painPoint];
  if (!normalizedKey) return null;

  return INJURY_PROTOCOLS.find(p => p.issue === normalizedKey) || null;
}

/**
 * Get all protocols for a list of pain points
 */
export function getProtocolsForPainPoints(painPoints: string[]): InjuryProtocol[] {
  return painPoints
    .map(pp => getProtocolForPainPoint(pp))
    .filter((p): p is InjuryProtocol => p !== null);
}

/**
 * Build a concise prompt section for pain points
 */
export function buildPainPointPrompt(painPoints: string[]): string {
  const protocols = getProtocolsForPainPoints(painPoints);

  if (protocols.length === 0) {
    return '';
  }

  let prompt = `
**═══════════════════════════════════════════════════════════════**
**INJURY/PAIN POINT PROTOCOLS (MANDATORY)**
**═══════════════════════════════════════════════════════════════**

User has reported: ${painPoints.join(', ')}

`;

  for (const protocol of protocols) {
    prompt += `
### ${protocol.display_name.toUpperCase()}

**EXERCISES TO AVOID (ABSOLUTE):**
${protocol.exercises_to_avoid.map(e => `- ❌ ${e.exercise}: ${e.reason}`).join('\n')}

**USE INSTEAD:**
${protocol.safe_alternatives.map(a => `- ✅ Instead of ${a.avoid} → USE ${a.use_instead}`).join('\n')}

**MUST INCLUDE REHAB EXERCISES:**
${protocol.rehab_exercises.filter(e => e.priority === 'essential').map(e =>
  `- 🔥 ${e.exercise} (${e.category}) - ${e.sets}x${e.reps} - ${e.notes}`
).join('\n')}

**RECOMMENDED REHAB EXERCISES (include when possible):**
${protocol.rehab_exercises.filter(e => e.priority === 'recommended').map(e =>
  `- 💪 ${e.exercise} (${e.category}) - ${e.sets}x${e.reps}`
).join('\n')}

`;
  }

  prompt += `
**CRITICAL RULES FOR PAIN POINTS:**
1. NEVER include exercises from the "AVOID" lists
2. ALWAYS include at least 2 rehab exercises marked 🔥 in warmup
3. Substitute avoided exercises with the "USE INSTEAD" alternatives
4. If an exercise could aggravate the condition, find an alternative

`;

  return prompt;
}
