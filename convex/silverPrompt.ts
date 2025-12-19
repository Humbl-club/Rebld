/**
 * SILVER PROMPT - Structured JSON-based Plan Generation
 *
 * Philosophy:
 * - Every onboarding choice maps to a specific prompt segment
 * - JSON in → JSON out = reliable parsing
 * - Pain points trigger BOTH avoidance AND rehabilitation
 * - Two-phase: Fast generation → Background enrichment
 * - EXPERT PERSONAS: LLM acts as world-class expert in user's specific sport/goal
 *
 * This replaces the massive prose prompts with structured data.
 */

import { INJURY_PROTOCOLS } from "./rehab/injuryProtocolsData";

// ═══════════════════════════════════════════════════════════════════════════
// EXPERT KNOWLEDGE BASE - Top 5 Books per Sport/Goal
// ═══════════════════════════════════════════════════════════════════════════

export interface ExpertPersona {
  title: string;
  expertise: string;
  authorityBooks: string[];
  keyPrinciples: string[];
  periodizationApproach: string;
  priorityExercises: string[];
}

const EXPERT_PERSONAS: Record<string, ExpertPersona> = {
  // ─────────────────────────────────────────────────────────────────────────
  // COMPETITION SPORTS
  // ─────────────────────────────────────────────────────────────────────────
  hyrox: {
    title: 'Elite Hyrox Performance Coach',
    expertise: 'Hybrid fitness racing, functional fitness competition, running + functional fitness integration',
    authorityBooks: [
      'Tactical Barbell I & II by K. Black (concurrent training)',
      'The Hybrid Athlete by Alex Viada (endurance + strength)',
      'Training for the Uphill Athlete by Kílian Jornet & Steve House',
      'Endure by Alex Hutchinson (limits of human performance)',
      'Science and Application of High-Intensity Interval Training by Laursen & Buchheit',
    ],
    keyPrinciples: [
      'Race simulation: 8km running + 8 functional stations',
      'Concurrent training: Build running base WITHOUT sacrificing strength',
      'Station-specific prep: Sled push/pull, SkiErg, rowing, burpee broad jumps, wall balls, farmers carry, lunges',
      'Pacing strategy: Negative split running, consistent station times',
      'Grip endurance: Critical for sled, farmers, and SkiErg',
      'Lactate threshold work: Sustain 85-90% effort for 60-90 minutes',
    ],
    periodizationApproach: 'BASE: Aerobic foundation + strength maintenance → BUILD: Race-pace intervals + station drills → PEAK: Full race simulations → TAPER: Volume reduction, intensity maintenance',
    priorityExercises: ['Sled Push', 'Sled Pull', 'SkiErg', 'Rowing', 'Wall Balls', 'Burpee Broad Jumps', 'Farmers Carry', 'Weighted Lunges', 'Running Intervals'],
  },

  powerlifting: {
    title: 'Elite Powerlifting Coach',
    expertise: 'Competition powerlifting, maximal strength development, peaking protocols',
    authorityBooks: [
      'Scientific Principles of Strength Training by Mike Israetel, James Hoffmann, Chad Wesley Smith',
      'Supertraining by Mel Siff (biomechanics & periodization)',
      'The Sheiko Method by Boris Sheiko',
      'Westside Barbell Book of Methods by Louie Simmons',
      'Starting Strength by Mark Rippetoe (foundational)',
    ],
    keyPrinciples: [
      'Competition lifts: Squat, Bench Press, Deadlift (SBD)',
      'Specificity: Train the competition lifts with competition technique',
      'Progressive overload with strategic deloads every 4th week',
      'Accessory work: Address weak points in main lifts',
      'Meet prep: Opener selection, attempt strategy, weight cuts',
      'RPE-based training: Autoregulate based on daily readiness',
    ],
    periodizationApproach: 'HYPERTROPHY: Higher volume, moderate intensity → STRENGTH: Moderate volume, high intensity → PEAKING: Low volume, maximal intensity → MEET WEEK: Openers only, recovery focus',
    priorityExercises: ['Back Squat', 'Bench Press', 'Deadlift', 'Pause Squat', 'Close-Grip Bench', 'Deficit Deadlift', 'Romanian Deadlift', 'Barbell Row'],
  },

  marathon: {
    title: 'Elite Marathon Running Coach',
    expertise: 'Distance running, marathon preparation, endurance periodization',
    authorityBooks: [
      'Daniels\' Running Formula by Jack Daniels (VDOT training)',
      'Advanced Marathoning by Pete Pfitzinger',
      '80/20 Running by Matt Fitzgerald',
      'Run Faster from the 5K to the Marathon by Brad Hudson',
      'The Science of Running by Steve Magness',
    ],
    keyPrinciples: [
      'Polarized training: 80% easy, 20% hard (no junk miles)',
      'Long runs: Build to 20-22 miles, practice race nutrition',
      'Tempo runs: Lactate threshold development at marathon pace + 10-15s/mi',
      'VO2max intervals: 1000m-1600m repeats at 3K-5K pace',
      'Taper: 2-3 weeks, reduce volume 40-60%, maintain intensity',
      'Strength: Running-specific, injury prevention focus',
    ],
    periodizationApproach: 'BASE: Build mileage + aerobic base → BUILD: Introduce tempo + intervals → PEAK: Race-specific workouts, goal pace → TAPER: Volume reduction, sharpening workouts',
    priorityExercises: ['Easy Runs', 'Long Runs', 'Tempo Runs', 'Interval Training', 'Hill Repeats', 'Single-Leg Squats', 'Hip Stability Work', 'Core Anti-Rotation'],
  },

  triathlon: {
    title: 'Elite Triathlon Coach',
    expertise: 'Multi-sport endurance, swim-bike-run integration, transition training',
    authorityBooks: [
      'The Triathlete\'s Training Bible by Joe Friel',
      'Total Triathlon Training by Michael Saunders',
      '80/20 Triathlon by Matt Fitzgerald',
      'Triathlon Science by Joe Friel & Jim Vance',
      'Swim Speed Secrets by Sheila Taormina',
    ],
    keyPrinciples: [
      'Sport-specific periodization: Swim, Bike, Run balance',
      'Brick workouts: Bike-to-run transitions',
      'Aerobic base: 80% Zone 2 across all disciplines',
      'Open water skills: Sighting, drafting, mass starts',
      'Nutrition strategy: Practice race-day fueling',
      'Recovery management: High training volume requires smart recovery',
    ],
    periodizationApproach: 'BASE: Build volume in each discipline → BUILD: Sport-specific intensity + bricks → PEAK: Race simulation, taper swim/bike before run → TAPER: Proportional reduction, maintain sharpness',
    priorityExercises: ['Swimming Drills', 'Bike Intervals', 'Running Intervals', 'Brick Workouts', 'Core Stability', 'Hip Mobility', 'Shoulder Stability'],
  },

  crossfit: {
    title: 'Elite CrossFit Coach',
    expertise: 'Functional fitness, GPP, competition CrossFit',
    authorityBooks: [
      'Becoming a Supple Leopard by Kelly Starrett',
      'Freestyle by Carl Paoli (gymnastics for CrossFit)',
      'Olympic Weightlifting by Greg Everett',
      'Power Speed Endurance by Brian MacKenzie',
      'Unbroken by Ben Bergeron',
    ],
    keyPrinciples: [
      '10 general physical skills: Cardiovascular, stamina, strength, flexibility, power, speed, coordination, agility, balance, accuracy',
      'Constantly varied, functional movements, high intensity',
      'Olympic lifting proficiency: Snatch, Clean & Jerk',
      'Gymnastics skills: Pull-ups, muscle-ups, handstands',
      'Engine building: MetCons, interval work',
      'Competition prep: Practice unknown workouts',
    ],
    periodizationApproach: 'STRENGTH: Focus on compound lifts → SKILL: Gymnastics and Olympic lifting → CONDITIONING: MetCon capacity → COMPETITION: Sport-specific prep',
    priorityExercises: ['Back Squat', 'Deadlift', 'Clean & Jerk', 'Snatch', 'Pull-ups', 'Muscle-ups', 'Thrusters', 'Box Jumps', 'Rowing', 'Double-unders'],
  },

  boxing: {
    title: 'Elite Boxing Strength & Conditioning Coach',
    expertise: 'Combat sports conditioning, power development, fight preparation',
    authorityBooks: [
      'Complete Conditioning for Martial Arts by Sean Cochran',
      'Training for Warriors by Martin Rooney',
      'Ultimate MMA Conditioning by Joel Jamieson',
      'Championship Fighting by Jack Dempsey',
      'The Science of Martial Arts Training by Charles Staley',
    ],
    keyPrinciples: [
      'Rotational power: Core-driven punching power',
      'Alactic capacity: Explosive combinations without fatigue',
      'Aerobic base: Sustain output over 12 rounds',
      'Footwork conditioning: Lateral movement, pivot drills',
      'Neck & shoulder stability: Punch absorption',
      'Weight management: Maintain strength during cuts',
    ],
    periodizationApproach: 'GPP: General conditioning + strength base → SPP: Fight-specific conditioning + sparring → PEAKING: Reduce volume, maximize sharpness → FIGHT WEEK: Technical work only, weight management',
    priorityExercises: ['Medicine Ball Throws', 'Rotational Core Work', 'Shadow Boxing', 'Heavy Bag Work', 'Jump Rope', 'Sled Pushes', 'Battle Ropes', 'Neck Harness Work'],
  },

  bodybuilding: {
    title: 'Elite Bodybuilding Coach',
    expertise: 'Hypertrophy training, contest prep, physique development',
    authorityBooks: [
      'Scientific Principles of Hypertrophy Training by Mike Israetel',
      'The Muscle and Strength Pyramid by Eric Helms',
      'Bodybuilding: The Complete Contest Preparation Handbook by Peter Fitschen',
      'Encyclopedia of Bodybuilding by Robert Kennedy',
      'Renaissance Periodization Hypertrophy Guide by Mike Israetel',
    ],
    keyPrinciples: [
      'Volume landmarks: MEV → MAV → MRV progression',
      'Mind-muscle connection: Quality contractions > heavy weight',
      'Progressive overload: Add sets, reps, or weight weekly',
      'Weak point prioritization: Train lagging parts first',
      'Deload every 4-6 weeks: Allow adaptation',
      'Contest prep: Gradual caloric deficit, maintain muscle',
    ],
    periodizationApproach: 'ACCUMULATION: Build volume, add sets weekly → INTENSIFICATION: Increase intensity techniques → DELOAD: Reduce to MEV → REPEAT or PEAK for contest',
    priorityExercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Pull-ups', 'Barbell Rows', 'Squats', 'Romanian Deadlift', 'Lateral Raises', 'Bicep Curls', 'Tricep Extensions'],
  },

  mma: {
    title: 'Elite MMA Strength & Conditioning Coach',
    expertise: 'Mixed martial arts conditioning, fight preparation, multi-discipline combat sports',
    authorityBooks: [
      'Ultimate MMA Conditioning by Joel Jamieson',
      'Training for Warriors by Martin Rooney',
      'Conditioning for Combat Sports by Stéfane Beloni Correa Dielle Dias',
      'Complete Conditioning for Martial Arts by Sean Cochran',
      'Periodization Training for Sports by Tudor Bompa',
    ],
    keyPrinciples: [
      'Energy system development: Alactic, lactic, aerobic all critical',
      'Multi-planar power: Rotational, linear, vertical explosiveness',
      'Grip endurance: Critical for grappling exchanges',
      'Neck conditioning: Whiplash prevention, takedown defense',
      'Weight management: Maintain strength during cuts',
      'Recovery optimization: High training volume requires smart programming',
    ],
    periodizationApproach: 'GPP: Build aerobic base + strength foundation → SPP: Sport-specific conditioning + sparring intensity → PEAKING: Reduce volume, maximize power output → FIGHT WEEK: Technical work only, weight management, recovery',
    priorityExercises: ['Turkish Get-ups', 'Kettlebell Swings', 'Medicine Ball Slams', 'Pull-ups', 'Hip Escapes', 'Battle Ropes', 'Sprawl Drills', 'Neck Harness Work', 'Sled Drags'],
  },

  soccer: {
    title: 'Elite Football (Soccer) Performance Coach',
    expertise: 'Football conditioning, match fitness, injury prevention, European football methodology',
    authorityBooks: [
      'Periodization in Football by Raymond Verheijen',
      'Football Conditioning by Jens Bangsbo',
      'Soccer Science by Tony Strudwick',
      'Athletic Development by Vern Gambetta',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
    ],
    keyPrinciples: [
      'High-intensity intermittent endurance: Match-specific 90+ minute capacity',
      'Change of direction: Cutting, turning, deceleration mechanics',
      'Sprint repeated ability: Recover between maximal efforts',
      'Single-leg strength: Unilateral power for kicking, jumping',
      'Hamstring protection: Nordic curls, eccentric loading essential',
      'In-season load management: Balance training with match recovery',
    ],
    periodizationApproach: 'PRE-SEASON: Build aerobic base + strength foundation → EARLY SEASON: Maintain fitness, reduce volume → IN-SEASON: Match-day -2/+2 principles, tactical periodization → OFF-SEASON: Active recovery, address weaknesses',
    priorityExercises: ['Nordic Curls', 'Single-Leg Squats', 'Box Jumps', 'Shuttle Runs', 'Copenhagen Adductors', 'Sled Pushes', 'Romanian Deadlifts', 'Core Anti-Rotation'],
  },

  basketball: {
    title: 'Elite Basketball Performance Coach',
    expertise: 'Basketball conditioning, vertical jump development, court speed, injury prevention',
    authorityBooks: [
      'Vertical Jump Training by Kelly Baggett',
      'Athletic Development by Vern Gambetta',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
      'Complete Conditioning for Basketball by Bill Foran & Robin Pound',
      'Science and Practice of Strength Training by Vladimir Zatsiorsky',
    ],
    keyPrinciples: [
      'Vertical power: Jump training, reactive strength',
      'Lateral quickness: Defensive slides, change of direction',
      'Landing mechanics: ACL prevention, absorption training',
      'Upper body durability: Contact absorption, rebounding',
      'Repeat sprint ability: Fast break recovery',
      'Ankle stability: Critical for court movement',
    ],
    periodizationApproach: 'OFF-SEASON: Max strength + power development → PRE-SEASON: Convert to court speed + game conditioning → IN-SEASON: Maintain strength, manage fatigue → PLAYOFFS: Reduce volume, peak performance',
    priorityExercises: ['Trap Bar Deadlift', 'Box Jumps', 'Depth Jumps', 'Lateral Bounds', 'Single-Leg RDL', 'Core Rotations', 'Band Resisted Shuffles', 'Pull-ups'],
  },

  handball: {
    title: 'Elite Handball Performance Coach',
    expertise: 'Team handball conditioning, throwing power, contact preparation, European handball methodology',
    authorityBooks: [
      'Handball: Steps to Success by Frantisek Táborský',
      'Periodization Training for Sports by Tudor Bompa',
      'Athletic Development by Vern Gambetta',
      'Strength Training for Team Handball by DOSB (German Olympic Sports Confederation)',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
    ],
    keyPrinciples: [
      'Throwing velocity: Rotational power, shoulder stability',
      'Contact tolerance: Body preparation for physical play',
      'Repeat sprint ability: Court coverage, fast breaks',
      'Jump height: Shot blocking, elevated throws',
      'Landing mechanics: Knee protection during jumps',
      'Grip strength: Ball control, opponent manipulation',
    ],
    periodizationApproach: 'OFF-SEASON: Max strength + power base → PRE-SEASON: Convert to throwing power + game fitness → IN-SEASON: Maintain, manage Bundesliga schedule → PLAYOFFS: Peak for tournament performance',
    priorityExercises: ['Medicine Ball Rotational Throws', 'Landmine Press', 'Pull-ups', 'Box Jumps', 'Single-Leg Squats', 'Face Pulls', 'Farmers Carry', 'Hip Throws'],
  },

  tennis: {
    title: 'Elite Tennis Performance Coach',
    expertise: 'Tennis conditioning, rotational power, movement efficiency, tournament preparation',
    authorityBooks: [
      'Complete Conditioning for Tennis by Paul Roetert & Todd Ellenbecker',
      'Tennis Science by Elliott Machar & Bruce Elliott',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
      'Periodization Training for Sports by Tudor Bompa',
      'Athletic Development by Vern Gambetta',
    ],
    keyPrinciples: [
      'Rotational power: Core-driven strokes, hip-shoulder separation',
      'First-step quickness: Split step, explosive court coverage',
      'Shoulder health: Rotator cuff balance, serve durability',
      'Repeat effort capacity: 3-5 set match fitness',
      'Lateral movement: Side-to-side efficiency',
      'Recovery between points: Phosphocreatine replenishment',
    ],
    periodizationApproach: 'OFF-SEASON: Build strength base + address weaknesses → PRE-SEASON: Convert to court speed + match fitness → TOURNAMENT: Maintain, manage recovery between matches → RECOVERY: Active rest between tournament blocks',
    priorityExercises: ['Medicine Ball Rotational Throws', 'Cable Rotations', 'Lateral Bounds', 'Split Squats', 'Face Pulls', 'Wrist Curls', 'Agility Ladder', 'Single-Leg RDL'],
  },

  swimming: {
    title: 'Elite Swimming Performance Coach',
    expertise: 'Competitive swimming, dryland training, stroke efficiency, taper protocols',
    authorityBooks: [
      'Swimming Science by G. John Mullen',
      'Dryland Training for Swimmers by ASCA',
      'Science of Swimming Faster by Scott Riewald & Scott Rodeo',
      'The Swim Coaching Bible by Dick Hannula',
      'Periodization Training for Sports by Tudor Bompa',
    ],
    keyPrinciples: [
      'Shoulder stability: Rotator cuff endurance, scapular control',
      'Core connection: Transfer power from kick to pull',
      'Lat strength: Primary pulling muscles for all strokes',
      'Ankle flexibility: Effective kick propulsion',
      'Streamline position: Core stability in extension',
      'Taper science: Peak performance at championships',
    ],
    periodizationApproach: 'BASE: Build aerobic capacity + dryland strength → BUILD: Increase intensity, race-pace work → TAPER: 2-3 week volume reduction → COMPETITION: Sharp, race-ready',
    priorityExercises: ['Pull-ups', 'Lat Pulldowns', 'Medicine Ball Throws', 'Core Stability Work', 'Resistance Band Pull-Aparts', 'Ankle Mobility', 'Streamline Holds', 'Vertical Kicking'],
  },

  cycling: {
    title: 'Elite Cycling Performance Coach',
    expertise: 'Road cycling, time trial preparation, power development, European cycling methodology',
    authorityBooks: [
      'Training and Racing with a Power Meter by Hunter Allen & Andrew Coggan',
      'The Cyclist\'s Training Bible by Joe Friel',
      'Fast After 50 by Joe Friel',
      'Periodization Training for Sports by Tudor Bompa',
      'Racing Tactics for Cyclists by Thomas Prehn',
    ],
    keyPrinciples: [
      'FTP development: Functional threshold power progression',
      'VO2max intervals: High-intensity capacity',
      'Pedaling efficiency: Smooth, powerful cadence',
      'Core stability: Power transfer, aero position',
      'Heat/altitude adaptation: Race environment preparation',
      'Taper for events: Peak at key races (La Vuelta, Tour, etc.)',
    ],
    periodizationApproach: 'BASE: Build aerobic foundation + leg strength → BUILD: Increase intensity, threshold work → PEAK: Race-specific intervals → TAPER: Volume reduction, sharpening → RACE: Execute strategy',
    priorityExercises: ['Single-Leg Press', 'Step-ups', 'Core Planks', 'Hip Flexor Work', 'Leg Curls', 'Calf Raises', 'Foam Rolling', 'Stretching'],
  },

  climbing: {
    title: 'Elite Climbing & Bouldering Coach',
    expertise: 'Rock climbing, bouldering, finger strength, movement efficiency',
    authorityBooks: [
      'Training for Climbing by Eric Hörst',
      'The Self-Coached Climber by Dan Hague & Douglas Hunter',
      '9 Out of 10 Climbers Make the Same Mistakes by Dave MacLeod',
      'Rock Climbing Technique by John Kettle',
      'Make or Break by Dave MacLeod (injury prevention)',
    ],
    keyPrinciples: [
      'Finger strength: Hangboard training, crimp/open hand',
      'Pull strength: Lock-off ability, one-arm progression',
      'Core tension: Body positioning, overhang performance',
      'Antagonist training: Push muscles for balance',
      'Flexibility: Hip mobility, high steps',
      'Injury prevention: Pulley protection, elbow health',
    ],
    periodizationApproach: 'BASE: Build general strength + technique → STRENGTH: Max hangs, campus training → POWER: Dynamic movements, limit bouldering → ENDURANCE: Route climbing, pump tolerance → PERFORMANCE: Peak for projects/competitions',
    priorityExercises: ['Hangboard Training', 'Pull-ups', 'Lock-offs', 'Core Compression', 'Push-ups', 'Shoulder Press', 'Hip Mobility', 'Wrist Curls'],
  },

  golf: {
    title: 'Elite Golf Performance Coach',
    expertise: 'Golf fitness, rotational power, mobility, injury prevention',
    authorityBooks: [
      'Golf Anatomy by Craig Davies & Vince DiSaia',
      'Fit for Golf by Mike Carroll',
      'The Golfer\'s Guide to Fitness by Kai Fusser',
      'Golf Fitness by Karen Palacios-Jansen',
      'Periodization Training for Sports by Tudor Bompa',
    ],
    keyPrinciples: [
      'Hip-shoulder separation: X-factor for power',
      'Thoracic rotation: Full backswing capacity',
      'Glute activation: Ground force production',
      'Core stability: Protect spine during rotation',
      'Single-leg balance: Weight transfer efficiency',
      'Wrist/forearm strength: Club control',
    ],
    periodizationApproach: 'OFF-SEASON: Build strength + address mobility limitations → PRE-SEASON: Convert to power + on-course practice → IN-SEASON: Maintain fitness, manage tournament schedule → POST-SEASON: Recovery, correct imbalances',
    priorityExercises: ['Cable Rotations', 'Medicine Ball Throws', 'Single-Leg RDL', 'Hip Mobility Work', 'Thoracic Spine Rotation', 'Pallof Press', 'Glute Bridges', 'Wrist Curls'],
  },

  rugby: {
    title: 'Elite Rugby Performance Coach',
    expertise: 'Rugby union/league conditioning, contact preparation, position-specific training',
    authorityBooks: [
      'The Rugby Fitness Handbook by Rhodri Bown',
      'Complete Conditioning for Rugby by Dan Luger',
      'Rugby: Steps to Success by Tony Biscombe',
      'Periodization Training for Sports by Tudor Bompa',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
    ],
    keyPrinciples: [
      'Contact tolerance: Tackle preparation, collision absorption',
      'Power endurance: Repeated high-intensity efforts',
      'Acceleration: First 10m explosion',
      'Neck strength: Scrum safety, tackle protection',
      'Upper body power: Tackle breaking, ball carrying',
      'Position-specific: Forwards vs backs different demands',
    ],
    periodizationApproach: 'OFF-SEASON: Max strength + hypertrophy → PRE-SEASON: Convert to power + game fitness → IN-SEASON: Maintain, manage match recovery → KNOCKOUT: Peak for finals',
    priorityExercises: ['Power Cleans', 'Trap Bar Deadlift', 'Bench Press', 'Neck Harness Work', 'Sled Pushes', 'Prowler Sprints', 'Farmers Carry', 'Box Jumps'],
  },

  volleyball: {
    title: 'Elite Volleyball Performance Coach',
    expertise: 'Volleyball conditioning, vertical jump, lateral movement, shoulder health',
    authorityBooks: [
      'Complete Conditioning for Volleyball by Steve Fleck & Tom Comyns',
      'Vertical Jump Training by Kelly Baggett',
      'Volleyball: Steps to Success by Barbara Viera',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
      'Athletic Development by Vern Gambetta',
    ],
    keyPrinciples: [
      'Vertical power: Approach jump, block jump differentiation',
      'Landing mechanics: Knee and ankle protection',
      'Shoulder durability: Spiking volume management',
      'Lateral quickness: Defensive positioning',
      'Core stability: Mid-air body control',
      'Repeat jump ability: Set-to-set recovery',
    ],
    periodizationApproach: 'OFF-SEASON: Max strength + jump training → PRE-SEASON: Convert to court explosiveness → IN-SEASON: Maintain, manage match volume → PLAYOFFS: Peak vertical power',
    priorityExercises: ['Trap Bar Deadlift', 'Box Jumps', 'Depth Jumps', 'Single-Leg Squats', 'Lateral Bounds', 'Face Pulls', 'Core Anti-Rotation', 'Rotator Cuff Work'],
  },

  icehockey: {
    title: 'Elite Ice Hockey Performance Coach',
    expertise: 'Hockey conditioning, skating power, contact preparation, DEL/NHL methodology',
    authorityBooks: [
      'Ultimate Hockey Training by Kevin Neeld',
      'Complete Conditioning for Ice Hockey by Peter Twist',
      'Athletic Development by Vern Gambetta',
      'Periodization Training for Sports by Tudor Bompa',
      'High-Performance Training for Sports by David Joyce & Daniel Lewindon',
    ],
    keyPrinciples: [
      'Hip mobility: Skating stride efficiency',
      'Single-leg power: Push-off strength',
      'Core rotational strength: Shot power, checking',
      'Grip strength: Stick control, battles',
      'Contact tolerance: Physical play preparation',
      'Shift recovery: 45-second high-intensity repeated',
    ],
    periodizationApproach: 'OFF-SEASON: Build strength + address skating weaknesses → PRE-SEASON: Convert to ice-specific power → IN-SEASON: Maintain, manage game schedule → PLAYOFFS: Peak for postseason',
    priorityExercises: ['Single-Leg Squats', 'Lateral Lunges', 'Hip Mobility Work', 'Rotational Medicine Ball', 'Sled Pushes', 'Pull-ups', 'Core Anti-Rotation', 'Neck Work'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GENERAL FITNESS GOALS
  // ─────────────────────────────────────────────────────────────────────────
  muscle: {
    title: 'Hypertrophy & Muscle Building Specialist',
    expertise: 'Natural muscle building, hypertrophy optimization, body recomposition',
    authorityBooks: [
      'Scientific Principles of Hypertrophy Training by Mike Israetel',
      'The Muscle and Strength Pyramid by Eric Helms',
      'Strength Training Anatomy by Frédéric Delavier',
      'Bigger Leaner Stronger by Michael Matthews',
      'The New Encyclopedia of Modern Bodybuilding by Arnold Schwarzenegger',
    ],
    keyPrinciples: [
      'Progressive overload: Add weight, reps, or sets over time',
      'Volume: 10-20 hard sets per muscle group per week',
      'Frequency: Each muscle 2x per week minimum',
      'Time under tension: 40-60 seconds per set',
      'Recovery: Sleep, nutrition, deload weeks',
      'Compound focus: Big lifts drive most growth',
    ],
    periodizationApproach: 'VOLUME: Start at MEV, progress to MAV → OVERREACH: Push to MRV → DELOAD: Recover → REPEAT with higher baseline',
    priorityExercises: ['Bench Press', 'Overhead Press', 'Barbell Row', 'Pull-ups', 'Squats', 'Romanian Deadlift', 'Lunges', 'Dumbbell Work'],
  },

  strength: {
    title: 'Strength & Performance Coach',
    expertise: 'Maximal strength development, neural adaptations, general strength',
    authorityBooks: [
      'Starting Strength by Mark Rippetoe',
      'Practical Programming for Strength Training by Mark Rippetoe & Andy Baker',
      '5/3/1 Forever by Jim Wendler',
      'The Juggernaut Method by Chad Wesley Smith',
      'Easy Strength by Dan John & Pavel Tsatsouline',
    ],
    keyPrinciples: [
      'Compound movements: Squat, Hinge, Push, Pull, Carry',
      'Lower rep ranges: 1-5 reps for strength, 6-12 for hypertrophy support',
      'Progressive overload: Add weight systematically',
      'Rest adequately: 3-5 minutes between heavy sets',
      'Deload every 4th week: Prevent overtraining',
      'Technique first: Perfect form before adding weight',
    ],
    periodizationApproach: 'LINEAR: Add weight each session (beginners) → WEEKLY: Progress weekly (intermediate) → BLOCK: Volume → Intensity → Peaking (advanced)',
    priorityExercises: ['Back Squat', 'Deadlift', 'Bench Press', 'Overhead Press', 'Barbell Row', 'Pull-ups', 'Farmers Carry'],
  },

  fat_loss: {
    title: 'Body Transformation & Fat Loss Specialist',
    expertise: 'Fat loss, metabolic conditioning, body recomposition',
    authorityBooks: [
      'The Renaissance Diet 2.0 by Mike Israetel',
      'Burn the Fat, Feed the Muscle by Tom Venuto',
      'The Rapid Fat Loss Handbook by Lyle McDonald',
      'Metabolic Conditioning by Josh Bryant',
      'The New Rules of Lifting by Lou Schuler',
    ],
    keyPrinciples: [
      'Caloric deficit: 500-750 kcal below maintenance',
      'Protein priority: 1g per pound bodyweight to preserve muscle',
      'Resistance training: Maintain muscle mass during deficit',
      'NEAT: Non-exercise activity for additional calorie burn',
      'Cardio: Strategic, not excessive (preserve muscle)',
      'Sleep & stress: Cortisol management for fat loss',
    ],
    periodizationApproach: 'PHASE 1: Establish deficit, begin training → PHASE 2: Progressive overload despite deficit → DIET BREAK: Maintenance calories every 6-8 weeks → REPEAT until goal',
    priorityExercises: ['Compound Lifts', 'Supersets', 'Circuit Training', 'HIIT', 'Walking', 'Metabolic Finishers'],
  },

  wellness: {
    title: 'Health & Wellness Coach',
    expertise: 'General health, longevity, sustainable fitness',
    authorityBooks: [
      'Outlive by Peter Attia (longevity medicine)',
      'Built to Move by Kelly Starrett',
      'Atomic Habits by James Clear (behavior change)',
      'Lifespan by David Sinclair (aging science)',
      'The 4-Hour Body by Tim Ferriss (minimum effective dose)',
    ],
    keyPrinciples: [
      'Zone 2 cardio: 150-180 minutes per week for metabolic health',
      'Strength training: 2-3x per week for muscle mass preservation',
      'Mobility: Daily movement practice for joint health',
      'Balance & stability: Fall prevention, functional capacity',
      'Consistency > intensity: Sustainable long-term habits',
      'Sleep, nutrition, stress: Holistic approach',
    ],
    periodizationApproach: 'No aggressive periodization. Focus on CONSISTENCY: Regular movement → VARIETY: Rotate activities → PROGRESSION: Gradual improvement over months/years',
    priorityExercises: ['Walking', 'Zone 2 Cardio', 'Goblet Squats', 'Push-ups', 'Rows', 'Planks', 'Hip Hinges', 'Stretching', 'Balance Work'],
  },

  // NEW: Athletic/Power Persona - For explosive, hybrid athletes
  athletic: {
    title: 'Elite Athletic Performance Coach',
    expertise: 'Explosive power, speed development, athletic transfer, hybrid training',
    authorityBooks: [
      'Triphasic Training by Cal Dietz (eccentric/isometric/concentric phases)',
      'Triphasic Training II by Cal Dietz (14 advanced methods, 2024)',
      'Westside Barbell Book of Methods by Louie Simmons (conjugate system)',
      'Strength Training and Coordination by Frans Bosch (transfer training)',
      'Running: Biomechanics and Exercise Physiology by Frans Bosch',
      'Easy Strength by Dan John & Pavel Tsatsouline',
    ],
    keyPrinciples: [
      'Triphasic phases: Train eccentric → isometric → concentric separately for max power',
      'Conjugate rotation: Max effort (1RM) + Dynamic effort (speed) in same week',
      'French Contrast: Heavy lift → plyometric → speed movement for potentiation',
      'Transfer: Strength is coordination against resistance - train movement patterns, not muscles',
      'Rate of force development: How FAST you produce force matters more than max force',
      'Accommodating resistance: Bands and chains teach acceleration through full ROM',
      'Velocity-based intent: Move submaximal loads (50-85%) as FAST as possible',
      'Special exercises: Variations that target weak points and prevent accommodation',
    ],
    periodizationApproach: 'CONJUGATE: Rotate max effort exercises weekly to prevent accommodation. 3-week waves for dynamic effort (increase band/chain tension). Block: Accumulation (volume) → Transmutation (intensity) → Realization (peaking). Cal Dietz phases: Eccentric block → Isometric block → Concentric/reactive block.',
    priorityExercises: [
      'Box Squats (with bands/chains)', 'Trap Bar Deadlift', 'Safety Bar Squat',
      'Speed Pulls', 'Dynamic Effort Bench', 'Box Jumps', 'Broad Jumps',
      'Med Ball Throws', 'Sled Drags (heavy)', 'Prowler Sprints',
      'Reverse Hypers', 'GHR/Nordic Curls', 'Power Cleans', 'Hang Snatches',
      'Depth Jumps', 'Bounding', 'Single-Leg RDL', 'Split Squats'
    ],
  },

  // NEW: Curves/Glute-Focused Persona - Evidence-based lower body aesthetics
  curves: {
    title: 'Glute & Lower Body Specialist',
    expertise: 'Glute hypertrophy, hip mechanics, lower body aesthetics, evidence-based training',
    authorityBooks: [
      'Glute Lab by Bret Contreras (the definitive glute training guide)',
      'Strong Curves by Bret Contreras & Kellie Davis',
      'Science and Development of Muscle Hypertrophy by Brad Schoenfeld',
      'The Glute Guy research papers (hip thrust EMG studies)',
      'Renaissance Periodization Women\'s Book by Mike Israetel',
    ],
    keyPrinciples: [
      'Hip thrust is king: Highest glute EMG activation at lockout (posterior pelvic tilt)',
      'Stretched-position training: Lunges, RDLs, Bulgarian splits for muscle lengthening stimulus',
      'Glute-mind connection: Squeeze hard at lockout, feel the muscle working',
      'Horizontal + vertical loading: Hip thrusts (horizontal) AND squats/lunges (vertical)',
      'High frequency: Glutes recover fast - train 3-4x per week',
      'Progressive overload: Add weight to hip thrust systematically',
      'Variety of hip angles: Abduction, external rotation, extension all matter',
      'Don\'t neglect hamstrings: RDLs, Nordic curls, leg curls for complete posterior chain',
    ],
    periodizationApproach: 'GLUTE-FOCUSED: 3-4 glute sessions per week. Day 1: Heavy hip thrusts + compounds. Day 2: Pump work, high reps, bands. Day 3: Unilateral focus (lunges, step-ups). Day 4: Stretch-focused (RDLs, Bulgarians). Deload every 4-6 weeks.',
    priorityExercises: [
      'Barbell Hip Thrust', 'B-Stance Hip Thrust', 'Frog Pumps',
      'Romanian Deadlift', 'Sumo Deadlift', 'Cable Pull-Throughs',
      'Bulgarian Split Squat', 'Walking Lunges', 'Reverse Lunges',
      'Goblet Squat (wide stance)', 'Sumo Squat', 'Leg Press (feet high)',
      'Glute Bridges', 'Single-Leg Glute Bridge', 'Banded Clamshells',
      'Hip Abduction Machine', 'Cable Kickbacks', 'Step-Ups',
      'Back Extensions (glute focus)', 'Reverse Hyper', 'Nordic Curls'
    ],
  },
};

/**
 * Get expert persona for a given sport or goal
 */
function getExpertPersona(sport?: string, goal?: string): ExpertPersona {
  // Sport name aliases (handle variations)
  const sportAliases: Record<string, string> = {
    // Football/Soccer variations
    'football': 'soccer',
    'fussball': 'soccer',
    'fußball': 'soccer',
    'futbol': 'soccer',
    // Ice Hockey variations
    'hockey': 'icehockey',
    'eishockey': 'icehockey',
    // Combat sports
    'mixedmartialarts': 'mma',
    'ufc': 'mma',
    'kickboxing': 'mma',
    'muaythai': 'mma',
    'bjj': 'mma',
    'jiujitsu': 'mma',
    // Climbing variations
    'rockclimbing': 'climbing',
    'bouldering': 'climbing',
    'klettern': 'climbing',
    // Running variations
    'running': 'marathon',
    'laufen': 'marathon',
    'halfmarathon': 'marathon',
    '10k': 'marathon',
    '5k': 'marathon',
    // Triathlon variations
    'ironman': 'triathlon',
    // German sport names
    'radfahren': 'cycling',
    'schwimmen': 'swimming',
    'turnen': 'crossfit',
    'ringen': 'mma',
    'gewichtheben': 'powerlifting',
  };

  // First try sport-specific persona
  if (sport) {
    const sportKey = sport.toLowerCase().replace(/[^a-z]/g, '');
    const mappedSport = sportAliases[sportKey] || sportKey;
    if (EXPERT_PERSONAS[mappedSport]) {
      return EXPERT_PERSONAS[mappedSport];
    }
  }

  // Then try goal-based persona
  if (goal) {
    const goalKey = goal.toLowerCase().replace(/[^a-z_]/g, '');
    // Map common goal names to personas
    const goalMap: Record<string, string> = {
      // New onboarding goals
      'aestheticphysique': 'muscle',
      'strengthpower': 'strength',
      'healthlongevity': 'wellness',
      'athleticperformance': 'athletic',  // NEW: maps to athletic persona
      'fatlossdefinition': 'fat_loss',
      'generalfitness': 'wellness',
      // Direct persona mappings
      'athletic': 'athletic',
      'curves': 'curves',
      'shredded': 'fat_loss',
      'balanced': 'wellness',
      'strong': 'strength',
      'aesthetic': 'muscle',
    };
    const mappedKey = goalMap[goalKey] || goalKey;
    if (EXPERT_PERSONAS[mappedKey]) {
      return EXPERT_PERSONAS[mappedKey];
    }
  }

  // Default to general strength coach
  return EXPERT_PERSONAS.strength;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface OnboardingData {
  // Identity
  userId?: string;
  firstName?: string;
  age?: number;
  sex?: 'male' | 'female' | 'other';

  // Goal Path
  path: 'competition' | 'general';

  // Competition-specific
  sport?: string;           // 'hyrox', 'powerlifting', 'marathon', etc.
  eventName?: string;       // 'Cologne Hyrox 2026'
  eventDate?: string;       // '2026-04-12'

  // General-specific (expanded with new personas)
  generalGoal?: 'muscle' | 'strength' | 'fat_loss' | 'wellness' | 'athletic' | 'curves';

  // Training Config
  experience: 'beginner' | 'intermediate' | 'advanced';
  trainingDays: number[];   // [0,1,2,3,4,5,6] = Mon-Sun
  sessionLength: number;    // 30, 45, 60, 75, 90 (strength session)
  sessionsPerDay: '1' | '2';

  // Cardio Config (for 2x daily)
  cardioTypes?: string[];   // ['running', 'cycling', 'rowing']
  cardioDuration?: number;  // 20, 30, 45, 60

  // Physical State
  painPoints: string[];     // ['lower_back', 'knees', 'shoulders']
  currentStrength?: {
    bench_kg?: number;
    squat_kg?: number;
    deadlift_kg?: number;
  };

  // Personalization
  additionalNotes?: string; // Free text from user
}

export interface SilverPromptOutput {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: object;
  rehabExercises: RehabExercise[];
  avoidExercises: string[];
}

export interface RehabExercise {
  exercise: string;
  category: string;
  reason: string;
  sets: number;
  reps: string;
  frequency: string;  // 'every_session', 'twice_weekly', etc.
}

// ═══════════════════════════════════════════════════════════════════════════
// PAIN POINT → REHAB MAPPING
// ═══════════════════════════════════════════════════════════════════════════

function getRehabProtocol(painPoint: string): {
  avoid: string[];
  rehab: RehabExercise[];
  alternatives: { avoid: string; useInstead: string }[];
} {
  // Map common pain point names to protocol keys
  const painPointMap: Record<string, string> = {
    'lower_back': 'lower_back',
    'back': 'lower_back',
    'knees': 'knee_pain',
    'knee': 'knee_pain',
    'shoulders': 'shoulder_impingement',
    'shoulder': 'shoulder_impingement',
    'wrists': 'wrist_pain',
    'wrist': 'wrist_pain',
    'neck': 'neck_pain',
    'hips': 'hip_pain',
    'hip': 'hip_pain',
    'ankles': 'ankle_instability',
    'ankle': 'ankle_instability',
  };

  const protocolKey = painPointMap[painPoint.toLowerCase()] || painPoint.toLowerCase();
  const protocol = INJURY_PROTOCOLS.find(p =>
    p.issue.toLowerCase().includes(protocolKey) ||
    protocolKey.includes(p.issue.toLowerCase().split(' ')[0])
  );

  if (!protocol) {
    return { avoid: [], rehab: [], alternatives: [] };
  }

  return {
    avoid: protocol.exercises_to_avoid.map(e => e.exercise),
    rehab: protocol.rehab_exercises.map(e => ({
      exercise: e.exercise,
      category: e.category,
      reason: `Rehab for ${painPoint}`,
      sets: e.sets,
      reps: e.reps,
      frequency: e.priority === 'essential' ? 'every_session' : 'twice_weekly',
    })),
    alternatives: protocol.safe_alternatives.map(a => ({
      avoid: a.avoid,
      useInstead: a.use_instead,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERIODIZATION CALCULATOR (No AI needed)
// ═══════════════════════════════════════════════════════════════════════════

interface PeriodizationPlan {
  totalWeeks: number;
  currentWeek: number;
  phases: { name: string; weeks: number; focus: string }[];
  currentPhase: string;
  isDeloadWeek: boolean;
}

function calculatePeriodization(data: OnboardingData): PeriodizationPlan {
  const now = new Date();

  if (data.path === 'competition' && data.eventDate) {
    // Competition: Calculate weeks until event
    const eventDate = new Date(data.eventDate);
    const weeksUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));

    if (weeksUntilEvent <= 4) {
      return {
        totalWeeks: weeksUntilEvent,
        currentWeek: 1,
        phases: [{ name: 'PEAK', weeks: weeksUntilEvent, focus: 'Competition prep, sport-specific work' }],
        currentPhase: 'PEAK',
        isDeloadWeek: false,
      };
    }

    // Standard periodization for longer prep
    const taperWeeks = Math.min(2, Math.floor(weeksUntilEvent * 0.1));
    const peakWeeks = Math.min(3, Math.floor(weeksUntilEvent * 0.2));
    const buildWeeks = Math.floor((weeksUntilEvent - taperWeeks - peakWeeks) * 0.5);
    const baseWeeks = weeksUntilEvent - taperWeeks - peakWeeks - buildWeeks;

    return {
      totalWeeks: weeksUntilEvent,
      currentWeek: 1,
      phases: [
        { name: 'BASE', weeks: baseWeeks, focus: 'Build aerobic base, technical work, volume' },
        { name: 'BUILD', weeks: buildWeeks, focus: 'Increase intensity, sport-specific conditioning' },
        { name: 'PEAK', weeks: peakWeeks, focus: 'Race-pace work, competition simulation' },
        { name: 'TAPER', weeks: taperWeeks, focus: 'Reduce volume, maintain intensity, recovery' },
      ],
      currentPhase: 'BASE',
      isDeloadWeek: false,
    };
  }

  // General fitness: Rolling 12-week cycles
  return {
    totalWeeks: 12,
    currentWeek: 1,
    phases: [
      { name: 'ACCUMULATION', weeks: 4, focus: 'Build volume, technique refinement' },
      { name: 'INTENSIFICATION', weeks: 4, focus: 'Increase intensity, reduce volume' },
      { name: 'REALIZATION', weeks: 3, focus: 'Peak performance, test maxes' },
      { name: 'DELOAD', weeks: 1, focus: 'Active recovery, reduce load 50%' },
    ],
    currentPhase: 'ACCUMULATION',
    isDeloadWeek: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HYROX REQUIREMENTS BY EXPERIENCE (Progressive)
// ═══════════════════════════════════════════════════════════════════════════

interface HyroxVolumes {
  weeklyRunning: { min: number; target: number };
  weeklySkiErg: { min: number; target: number };
  stationsPerWeek: number;
  notes: string;
}

function getHyroxVolumesByExperience(
  experience: 'beginner' | 'intermediate' | 'advanced',
  phase: string
): HyroxVolumes {
  // Base volumes by experience (in km for running, m for SkiErg)
  const experienceMultiplier = {
    beginner: 0.5,      // Start at 50% of advanced
    intermediate: 0.75, // Start at 75% of advanced
    advanced: 1.0,      // Full volume
  };

  // Phase adjustments (BASE = building, BUILD = peak volume, PEAK = maintain, TAPER = reduce)
  const phaseMultiplier: Record<string, number> = {
    'BASE': 0.7,         // Building up - don't start at max
    'BUILD': 1.0,        // Peak volume phase
    'PEAK': 0.85,        // Maintain fitness, add intensity
    'TAPER': 0.5,        // Reduce volume significantly
    'ACCUMULATION': 0.8, // General fitness equivalent
    'INTENSIFICATION': 1.0,
    'REALIZATION': 0.7,
    'DELOAD': 0.4,
  };

  const expMult = experienceMultiplier[experience];
  const phaseMult = phaseMultiplier[phase] || 0.8;

  // Advanced race-ready volumes (target to build towards)
  const advancedTargets = {
    weeklyRunning: 18,   // km
    weeklySkiErg: 3000,  // m
  };

  const runningTarget = Math.round(advancedTargets.weeklyRunning * expMult * phaseMult);
  const skiErgTarget = Math.round(advancedTargets.weeklySkiErg * expMult * phaseMult / 100) * 100;

  // Minimum is 60% of target (allows for bad weeks)
  const runningMin = Math.round(runningTarget * 0.6);
  const skiErgMin = Math.round(skiErgTarget * 0.6 / 100) * 100;

  // Stations per week based on experience
  const stationsPerWeek = experience === 'beginner' ? 4 : experience === 'intermediate' ? 6 : 8;

  const notes = experience === 'beginner'
    ? 'Focus on learning technique. Not all stations every week - rotate through them.'
    : experience === 'intermediate'
    ? 'Build volume progressively. Include most stations weekly.'
    : 'Race-ready volume. All 8 stations weekly with race-pace sessions.';

  return {
    weeklyRunning: { min: runningMin, target: runningTarget },
    weeklySkiErg: { min: skiErgMin, target: skiErgTarget },
    stationsPerWeek,
    notes,
  };
}

function getHyroxRequirements(
  experience: 'beginner' | 'intermediate' | 'advanced',
  phase: string
): string {
  const volumes = getHyroxVolumesByExperience(experience, phase);

  return `
- STATIONS: Include ${volumes.stationsPerWeek} of 8 Hyrox stations this week (SkiErg, Sled Push, Sled Pull, Rowing, Farmers Carry, Sandbag Lunges, Wall Balls, Burpee Broad Jumps)
- WEEKLY RUNNING: ${volumes.weeklyRunning.min}-${volumes.weeklyRunning.target}km (Zone 2 base + tempo/intervals)
- WEEKLY SKIERG: ${volumes.weeklySkiErg.min}-${volumes.weeklySkiErg.target}m (varied intensities)
- Sled work: Include push AND pull patterns at least once
- ${volumes.notes}

PROGRESSIVE OVERLOAD (CRITICAL):
- This plan is Week 1 of training. Each subsequent week should INCREASE volume by 5-10% until reaching target.
- ${experience === 'beginner' ? 'Beginner: Focus on form first. Volume increases slowly over 8-12 weeks to prevent injury.' : ''}
- ${experience === 'intermediate' ? 'Intermediate: Can progress faster. Target race volumes in 4-6 weeks.' : ''}
- ${experience === 'advanced' ? 'Advanced: Maintain high volume. Focus on intensity and race simulation.' : ''}
- Every 4th week: DELOAD (reduce volume 40-50%, maintain intensity)`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAINING SPLIT CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

function getTrainingSplit(daysPerWeek: number, sessionsPerDay: '1' | '2'): string[] {
  const splits: Record<number, string[]> = {
    2: ['Full Body', 'Full Body'],
    3: ['Full Body', 'Full Body', 'Full Body'],
    4: ['Upper', 'Lower', 'Upper', 'Lower'],
    5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
    6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
    7: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Active Recovery'],
  };

  const baseSplit = splits[daysPerWeek] || splits[4];

  if (sessionsPerDay === '2') {
    // 2-a-day: AM = Strength focus, PM = Conditioning/Sport-specific
    return baseSplit.map(focus => `${focus} (AM: Strength / PM: Conditioning)`);
  }

  return baseSplit;
}

// ═══════════════════════════════════════════════════════════════════════════
// SILVER PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildSilverPrompt(data: OnboardingData): SilverPromptOutput {
  // 1. Gather all rehab/avoidance data from pain points
  const allRehabExercises: RehabExercise[] = [];
  const allAvoidExercises: string[] = [];
  const allAlternatives: { avoid: string; useInstead: string }[] = [];

  for (const painPoint of data.painPoints) {
    const protocol = getRehabProtocol(painPoint);
    allRehabExercises.push(...protocol.rehab);
    allAvoidExercises.push(...protocol.avoid);
    allAlternatives.push(...protocol.alternatives);
  }

  // 2. Calculate periodization
  const periodization = calculatePeriodization(data);

  // 3. Get training split
  const trainingSplit = getTrainingSplit(data.trainingDays.length, data.sessionsPerDay);

  // 4. Build the structured prompt
  const structuredInput = {
    user: {
      age: data.age || 'not specified',
      sex: data.sex || 'not specified',
      experience: data.experience,
      firstName: data.firstName,
    },
    goal: {
      type: data.path,
      primary: data.path === 'competition'
        ? `${data.sport} competition: ${data.eventName || 'Event'}`
        : data.generalGoal,
      ...(data.eventDate && { targetDate: data.eventDate }),
    },
    training: {
      daysPerWeek: data.trainingDays.length,
      activeDays: data.trainingDays.map(d => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]),
      strengthSessionLength: data.sessionLength,
      sessionsPerDay: data.sessionsPerDay,
      split: trainingSplit,
      // Cardio config (for 2x daily)
      ...(data.sessionsPerDay === '2' && {
        cardio: {
          types: data.cardioTypes || ['running'],
          durationMinutes: data.cardioDuration || 30,
        },
      }),
    },
    periodization: {
      currentPhase: periodization.currentPhase,
      phaseFocus: periodization.phases.find(p => p.name === periodization.currentPhase)?.focus,
      weeksInProgram: periodization.totalWeeks,
      currentWeek: periodization.currentWeek,
      isDeloadWeek: periodization.isDeloadWeek,
    },
    constraints: {
      painPoints: data.painPoints,
      avoidExercises: [...new Set(allAvoidExercises)],
      substituteWith: allAlternatives,
      currentStrength: data.currentStrength,
    },
    rehabilitation: {
      required: allRehabExercises.length > 0,
      exercises: allRehabExercises,
      instruction: allRehabExercises.length > 0
        ? 'MUST include these rehab exercises in warmup or cooldown of EVERY session'
        : null,
    },
    personalization: {
      additionalNotes: data.additionalNotes || null,
      instruction: data.additionalNotes
        ? 'User has specific requests - prioritize these over defaults'
        : null,
    },
  };

  // 5. Get expert persona based on sport/goal
  const expert = getExpertPersona(data.sport, data.path === 'competition' ? data.sport : data.generalGoal);

  // 6. Create the system prompt (concise, structured) with EXPERT PERSONA
  const systemPrompt = `You are a ${expert.title} with deep expertise in ${expert.expertise}.

YOUR KNOWLEDGE BASE (apply this expertise):
${expert.authorityBooks.map((book, i) => `${i + 1}. ${book}`).join('\n')}

KEY PRINCIPLES YOU APPLY:
${expert.keyPrinciples.map(p => `• ${p}`).join('\n')}

PERIODIZATION APPROACH:
${expert.periodizationApproach}

PRIORITY EXERCISES (use these when appropriate):
${expert.priorityExercises.join(', ')}

CRITICAL RULES:
1. Pain points trigger BOTH avoidance AND rehabilitation exercises
2. User's additional notes are HIGHEST priority - honor their specific requests
3. Every exercise needs: exercise_name, category, metrics_template
4. Rest days have focus: "Rest" and empty blocks: []
5. Apply your expert knowledge to create a plan that would impress any coach in this field

OUTPUT: Valid JSON only. No markdown, no explanation.`;

  // 7. Create the user prompt (structured JSON input)
  const isTwoADay = data.sessionsPerDay === '2';
  const cardioTypesStr = (data.cardioTypes && data.cardioTypes.length > 0)
    ? data.cardioTypes.join(', ')
    : 'running';
  const cardioDurationMin = data.cardioDuration || 30;

  // Different output schema for 1x vs 2x daily
  const outputSchemaExample = isTwoADay
    ? `{
  "name": "Personalized Plan for ${data.firstName || 'User'}",
  "weeklyPlan": [
    {
      "day_of_week": 1,
      "focus": "Upper Body + Cardio",
      "sessions": [
        {
          "session_name": "AM Strength",
          "time_of_day": "morning",
          "estimated_duration": ${data.sessionLength},
          "blocks": [
            {
              "type": "single",
              "exercises": [
                {
                  "exercise_name": "Cat-Cow Stretch",
                  "category": "warmup",
                  "metrics_template": { "type": "sets_reps_weight", "target_sets": 2, "target_reps": "10" }
                }
              ]
            },
            {
              "type": "single",
              "exercises": [
                {
                  "exercise_name": "Bench Press",
                  "category": "main",
                  "rpe": "7-8",
                  "metrics_template": { "type": "sets_reps_weight", "target_sets": 4, "target_reps": "8-10", "rest_period_s": 90, "target_weight_kg": 60 }
                }
              ]
            }
          ]
        },
        {
          "session_name": "PM Cardio",
          "time_of_day": "evening",
          "estimated_duration": ${cardioDurationMin},
          "blocks": [
            {
              "type": "single",
              "exercises": [
                {
                  "exercise_name": "Easy Run",
                  "category": "main",
                  "metrics_template": { "type": "distance_time", "target_distance_km": 5, "target_duration_minutes": ${cardioDurationMin} }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "day_of_week": 2,
      "focus": "Rest",
      "sessions": []
    }
  ]
}`
    : `{
  "name": "Personalized Plan for ${data.firstName || 'User'}",
  "weeklyPlan": [
    {
      "day_of_week": 1,
      "focus": "Upper Body",
      "estimated_duration": ${data.sessionLength},
      "blocks": [
        {
          "type": "single",
          "exercises": [
            {
              "exercise_name": "Cat-Cow Stretch",
              "category": "warmup",
              "metrics_template": { "type": "sets_reps_weight", "target_sets": 2, "target_reps": "10" }
            }
          ]
        },
        {
          "type": "single",
          "exercises": [
            {
              "exercise_name": "Bench Press",
              "category": "main",
              "rpe": "7-8",
              "metrics_template": { "type": "sets_reps_weight", "target_sets": 4, "target_reps": "8-10", "rest_period_s": 90 }
            }
          ]
        }
      ]
    },
    {
      "day_of_week": 2,
      "focus": "Rest",
      "estimated_duration": 0,
      "blocks": []
    }
  ]
}`;

  const userPrompt = `Generate workout plan for this user:

${JSON.stringify(structuredInput, null, 2)}

Required JSON output structure:
${outputSchemaExample}

CRITICAL BLOCK FORMAT - EVERY exercise must be wrapped like this:
{
  "type": "single",
  "exercises": [{ ... exercise object ... }]
}

Exercise object format:
{
  "exercise_name": "Name",
  "category": "warmup|main|cooldown",
  "rpe": "7-8",
  "metrics_template": {
    "type": "sets_reps_weight",
    "target_sets": 4,
    "target_reps": "8-10",
    "rest_period_s": 90
  }
}

${allRehabExercises.length > 0 ? `
MANDATORY REHAB (include in warmup/cooldown):
${allRehabExercises.map(r => `- ${r.exercise}: ${r.sets}×${r.reps} (${r.reason})`).join('\n')}
` : ''}

${data.additionalNotes ? `
USER'S SPECIFIC REQUESTS (HIGHEST PRIORITY):
"${data.additionalNotes}"
` : ''}

PROGRAMMING RULES (MUST FOLLOW):
1. EXACT DAY COUNT: Generate exactly ${data.trainingDays.length} training days + ${7 - data.trainingDays.length} rest days = 7 total days
2. EVERY strength exercise MUST have "target_weight_kg" specified (calculate from user's strength levels)
3. EVERY training day MUST end with a cooldown block (stretches, foam rolling, or rehab exercises)
4. Block type MUST be: "single", "superset", "circuit", "amrap", or "emom" (NOT "warmup", "strength", etc.)
5. Category MUST be: "warmup", "main", or "cooldown" (NOT "strength", "conditioning", "cardio", etc.)
6. For cardio/distance exercises use: "distance_time" (NOT "time_distance")
${isTwoADay ? `
**2X DAILY SESSIONS (CRITICAL - THIS USER HAS AM/PM SPLIT):**
- Each training day MUST have "sessions" array with 2 sessions
- AM session: "time_of_day": "morning", strength focus, duration: ${data.sessionLength} min
- PM session: "time_of_day": "evening", cardio focus, duration: ${cardioDurationMin} min
- PM cardio MUST use ONLY these types: ${cardioTypesStr}
- Rest days have "sessions": [] (empty array)
- DO NOT use "blocks" at day level - use "sessions" array with blocks inside each session
` : ''}
${data.sport?.toLowerCase() === 'hyrox' ? `
HYROX-SPECIFIC REQUIREMENTS (scaled to ${data.experience} level):
${getHyroxRequirements(data.experience, periodization.currentPhase)}
` : ''}
${data.currentStrength ? `
LOAD CALCULATION (use these as reference):
- User's squat: ${data.currentStrength.squat_kg}kg → Goblet squat should be ~${Math.round((data.currentStrength.squat_kg || 100) * 0.4)}-${Math.round((data.currentStrength.squat_kg || 100) * 0.5)}kg
- User's bench: ${data.currentStrength.bench_kg}kg → DB press should be ~${Math.round((data.currentStrength.bench_kg || 80) * 0.35)}-${Math.round((data.currentStrength.bench_kg || 80) * 0.45)}kg each
- User's deadlift: ${data.currentStrength.deadlift_kg}kg → Trap bar DL should be ~${Math.round((data.currentStrength.deadlift_kg || 120) * 0.7)}-${Math.round((data.currentStrength.deadlift_kg || 120) * 0.85)}kg
` : ''}

Generate the complete 7-day plan now.`;

  // 8. Define expected output schema (for validation)
  const outputSchema = {
    name: 'string',
    weeklyPlan: [{
      day_of_week: 'number (1-7)',
      focus: 'string',
      estimated_duration: 'number',
      blocks: [{
        type: 'single|superset|circuit',
        exercises: [{
          exercise_name: 'string (required)',
          category: 'warmup|main|cooldown (required)',
          metrics_template: {
            type: 'sets_reps_weight|duration_only|sets_duration|distance_time',
            target_sets: 'number',
            target_reps: 'string|number',
            rest_period_s: 'number',
          },
          rpe: 'string (optional)',
          notes: 'string (optional)',
        }],
      }],
    }],
  };

  return {
    systemPrompt,
    userPrompt,
    outputSchema,
    rehabExercises: allRehabExercises,
    avoidExercises: [...new Set(allAvoidExercises)],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS FOR PHASE 2 (Background Processing)
// ═══════════════════════════════════════════════════════════════════════════

export {
  calculatePeriodization,
  getTrainingSplit,
  getRehabProtocol,
  getExpertPersona,
  EXPERT_PERSONAS,
};
