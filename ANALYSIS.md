# UI Analysis & "Editorial Noir" Implementation Plan

## 1. Design System: "Editorial Noir"
The new aesthetic revolves around high-contrast monochromatic elements, precision typography, and tangible textures. It moves away from the previous "Coral/Warm" palette to a strict "Black/White/Grey" palette.

### Color Palette
*   **Background:** Pitch Black (`#000000`) for OLED power saving and "void" aesthetic.
*   **Surface:** Dark Grey (`#0A0A0A` to `#141414`).
*   **Text Primary:** Pure White (`#FFFFFF`).
*   **Text Secondary:** Cool Grey (`#A0A0A0`).
*   **Accent:**
    *   **Primary:** White Glow (`#FFFFFF` with `box-shadow`).
    *   **Status Active:** Electric Green (Small dots/rings only).
    *   **Destructive:** Deep Crimson (Only for critical errors).
*   **Borders:** Ultra-thin White (`rgba(255,255,255,0.1)`).

### Typography
*   **Headers (The "Brutalist" Look):** `Inter` (Existing). Weight: 800/900 (Heavy/Black). Style: Uppercase, tight tracking.
*   **Body/UI:** `Inter` (Existing). Clean, legible, variable weight.
*   **Data:** `Inter` (Tabular nums) or `SF Mono`.
*   **Styling:** Large, bold, imperative headers. High-contrast.

## 2. Component Overhaul Plan

### A. Global Layout & Navigation (`Navbar.tsx`, `tokens.css`)
*   **Current:** Standard bottom tab bar.
*   **New:** "The Keeper" - Floating Glass Pill.
    *   **Position:** Fixed ~20px from bottom, centered.
    *   **Style:** Frosted glass (`backdrop-filter: blur(20px)`), `rgba(255,255,255,0.05)` background, 1px thin border.
    *   **Icons:** Refined minimalist wireframes.
    *   **States:** Active state gets a small white dot/glow. No text labels on the navbar itself.

### B. Onboarding Flow (`PersonalOnboarding.tsx`)
*   **Vibe:** From "Friendly/Conversational" to "Premium Intake".
*   **Visuals:**
    *   Remove all Emojis.
    *   Replace card backgrounds with minimalist borders or full-bleed text layouts.
    *   **Typography:** Use `Playfair Display` for "Let's build your program".
    *   **Input:** "Import Plan" text area becomes a raw terminal-like input.
*   **Interactions:** Snappy, instant transitions. Haptic feedback on every selection.

### C. Home Page (`ZenHomePage.tsx`) -> "The Hub"
*   **Header:** "AGENDA" (or personalized greeting in Serif).
*   **Calendar:** Minimal number line, current day glowing white.
*   **Hero Card:** "Today's Focus" - Large abstract B&W photo (muscle/equipment close-up) with bold overlay text.

### D. Plan Page (`PlanPage.tsx`) -> "AGENDA"
*   **Layout:** Split View.
    *   **Top (40%):** Static high-res B&W image representing the week's goal.
    *   **Bottom (60%):** Scrollable list of days.
*   **List Style:** "Architectural Schedule".
    *   Day Name (MON) in small caps.
    *   Workout Name (UPPER BODY) in bold serif.
    *   Status: Simple strike-through or checkmark.

### E. Buddies Page (`BuddiesPage.tsx`) -> "CIRCLE"
*   **Header:** "CIRCLE" in `Playfair Display`.
*   **Top Section:** "Stories" style row of avatars (Active users have a green ring).
*   **List Section:** "The Roster".
    *   Large Editorial typography for names.
    *   Tiny timestamp ("Last seen 20m ago").
    *   Action: "Scope" icon (+) for adding friends.

### F. Goals Page (`GoalTrackingPage.tsx`) -> "STATUS"
*   **Header:** "STATUS" in `Playfair Display`.
*   **Grid:** Strict 2x2 bento grid.
    *   Border-only cards (no fill).
    *   Content: Massive numbers (e.g., "315"). Label small and uppercase.
*   **Chart:** "Medical/Financial" line graph. Thin white line, dark grid, no fill.

### G. Session Tracker (`ZenSessionTracker.tsx`) -> "FOCUS"
*   **Background:** `#000000` (True Black).
*   **UI:** "Zen Mode".
    *   Remove all noise.
    *   Center screen: A single white ring (SVG) representing the set/rest.
    *   Data: "12 REPS" inside the ring.
    *   Controls: Invisible/Swipe gestures or very minimal bottom buttons.

## 3. Implementation Steps

4.  **Core Pages:**
## 3. Implementation Plan

### Phase 1: Foundation (Completed)
- [x] **Design Tokens**: Define `tokens.css` with Noir palette (Black/White/Grey) and Brutalist typography.
- [x] **Global Theme**: Update `theme.css` to map legacy variables to Noir tokens.
- [x] **Navbar**: Rebuild as "The Keeper" (Floating glass pill).

### Phase 2: Core Experience (Completed)
- [x] **Onboarding**: "Intake" Flow (Brutalist forms, no emojis).
- [x] **Zen Home**: "AGENDA" (Mission Control dashboard).
- [x] **Session Tracker**: "FOCUS" (Zen Mode / The Void).

### Phase 3: Secondary Pages (Completed)
- [x] **Buddies**: "CIRCLE" (Private Members Club).
- [x] **Plan**: "AGENDA" (Architectural Schedule).
- [x] **Goals**: "STATUS" (Financial Report / Data Analytics).
