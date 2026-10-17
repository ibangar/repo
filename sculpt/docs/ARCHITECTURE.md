# Sculpt – architecture brief

Personal workout + progress PWA. React 19 + Vite 8 + TypeScript, Dexie (IndexedDB), Recharts, `motion` (framer-motion v14 API: `import { motion, AnimatePresence } from 'motion/react'`), react-router v7.
Mobile-first for a 390 px iPhone, dark mode only, large tap targets (≥ 44 px). NO backend, NO network calls, NO analytics. All data (incl. photos) lives in IndexedDB.

## Owner's goals (drive copy + defaults)
- Upper body size: upper chest, side delts, arms.
- Glutes: fuller, rounder, "bubble" shape with definition. **This is the hero goal – celebrate glute work everywhere.**
- Legs stronger but NOT bigger: heavy, low reps, no quad volume.
- Stay lean, eat at maintenance (recomp). Fasted training; Meal 1 ≈ 15:45, Meal 2 ≈ 18:30, half a bar of Tony's Chocolonely after dinner is PART OF THE PLAN (never a cheat).

## Folder map
```
src/
  db/types.ts        all domain types (READ THIS FIRST). Weights stored in KG, lengths in CM.
  db/schema.ts       Dexie db: settings, program, sessions, exerciseStates, prs, bodyWeights, measurements, photos, nutrition
  db/defaults.ts     DEFAULT_SETTINGS
  db/repo.ts         getSettings/updateSettings/getProgram/saveProgram/getStates/startSession/saveSession/completeSession/resetCalibration
  data/exercises.ts  EXERCISES, EXERCISE_MAP, getExercise(id), swapCandidates(id), MUSCLE_LABELS, VOLUME_GROUP_LABELS, EQUIPMENT_LABELS
  data/program.ts    DEFAULT_PROGRAM (7 days), WARMUP_CHECKLIST
  engine/            pure functions (unit tested): units, epley, increments, progression, prescription, schedule, trends, nutrition, prs
  hooks/useSettings  useSettings(), useProgram(), updateSettings()
  hooks/useToday     useTodayDate(), useSchedule()
  lib/               ids (uid), format (fmtDate, fmtDuration…), haptics (haptic.tap/success/done), sound (sound.restDone/pr/complete, primeAudio)
  components/ui      Button, Card, Pill, PageHeader, Segmented, Toggle, ToggleRow, Stepper, Field, Input, Sheet, Empty, AnimatedNumber, Ring
  components/ui/Icons.tsx  stroke icons (IconHome, IconDumbbell, IconCamera, …)
  components/Nav.tsx bottom nav (hidden on /workout, /onboarding, /photos/capture)
  components/anatomy ExerciseAnimation, BodyMap (+ the procedural figure rig)
  components/NutritionChecklist.tsx
  screens/           one file per route (see App.tsx)
  styles/global.css  design tokens + utility classes (.card .btn .pill .seg .stepper .sheet .stagger .rise .pop …)
```

## Design language
- Tokens in `styles/global.css`. Background `--bg #08080d`, surfaces `--surface/--surface-2/--surface-3`, text `--text/--text-2/--muted`.
- Accent **pink `--accent #ff4d7d`** = glutes / primary actions. **Violet `--accent-2 #8b6cff`** = upper body. Gold = PRs/power. Green = good/rest.
- Gradients: `--grad-glutes`, `--grad-upper`, `--grad-power`, `--grad-rest`.
- Typography: system font, heavy weights (`.title-xl .title-lg .title .subtitle .body .small .eyebrow .num`).
- Motion is a feature: use `.stagger`, `.rise`, `.pop`, `.btn--pulse`, and `motion/react` for layout/spring/gesture animations. Every list should stagger in, every number should animate, every completed set should celebrate. Respect `prefers-reduced-motion` (global.css already does for CSS animations).
- Use `haptic.*` on taps/completions and `sound.*` for timer/PR events.
- Classnames over inline styles where a utility exists. Inline style objects are fine for one-offs.

## Rules for every module
1. Do NOT edit: `App.tsx`, `styles/global.css`, `components/ui/*`, `components/Nav.tsx`, `engine/*`, `db/types.ts`, `db/schema.ts`, `data/*` – unless the brief for your module says so. Need something new? Create it inside your own folder.
2. Keep the exported default component names/paths that `App.tsx` already imports.
3. Everything must pass `npx tsc -p tsconfig.app.json --noEmit` and `npx vitest run` and `npm run build`.
4. Visual check: run `npx vite --port <your port>` in the background and screenshot with `node <scratchpad>/shot.mjs http://localhost:<port>/<route> out.png` (Playwright + Chromium are installed; viewport is 390×844). Look at your screenshots and fix what looks wrong. Seed data through `page.evaluate` or by using the app's own UI if needed. Kill your dev server when done.
5. Settings may be `undefined` while loading – render nothing (or a skeleton) until defined.
6. All user-visible numbers go through `formatLoad(kg, units)` / `toDisplay` / `fromDisplay` from `engine/units.ts`.
7. Dates are local `YYYY-MM-DD` strings (`isoDate()` in engine/schedule.ts).
