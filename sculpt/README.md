# Sculpt

Personal workout + progress-tracking PWA for one lifter: upper-body size, fuller glutes, strong-not-big legs, lean recomp. Installable on iPhone from Safari (Share → Add to Home Screen), works fully offline.

**Privacy:** no backend, no sync, no analytics. Every byte, photos included, lives in IndexedDB on the phone. Export a backup from Settings → Data.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # engine + db tests (vitest)
npm run build        # production build to dist/ (with service worker + manifest)
npm run preview      # serve dist/
```

To use it on your phone, host `dist/` on any static HTTPS server (camera access needs HTTPS), open it in Safari, and add it to the Home Screen.

## How the weight logic works

- **Week 1 = calibration.** Every exercise starts with no prescription; you pick a weight that leaves ~2 reps in the tank at the top of the rep range.
- The app computes an **estimated 1RM** with Epley on `reps + RIR`, so a set of 8 @ RIR 2 counts as a 10-rep max.
- **Double progression** from week 2:
  - All sets at the TOP of the range with RIR ≥ 1 → weight goes up: +2.5 kg (5 lb) for upper-body compounds, +5 kg (10 lb) for hip thrust / squat / deadlifts, smallest available jump for dumbbells and isolation work.
  - Inside the range → same weight, aim for +1 rep.
  - Below the BOTTOM of the range two sessions in a row → drop 5–10 % (default 7.5 %).
  - Box jumps / kettlebell swings → next box / next bell only when every rep felt explosive.
  - Pull-ups / dips → bodyweight ⇄ assisted ⇄ added-weight transitions handled automatically.
- Loads are always rounded to what you can actually load (plate × 2 for bars, dumbbell jumps, cable steps) in your display unit.
- **Deload** every 7th week (6–8 configurable): ~40 % fewer sets, 10 % lighter; deload sessions never change the prescription.
- Ramp-up sets (50 % × 8, 75 % × 4) are generated for the first compound lift of the day.

See `docs/ARCHITECTURE.md` for the folder map and `src/engine/__tests__` for the rules as executable specs.
