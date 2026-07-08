# Cover art prompts (AI illustration → hub WebP)

Stable-style covers: polished 3D cartoon mobile game art, 4:3, no text/logos, full-bleed.

## water-sort

**File:** `assets/covers/water_sort.png` → `public/water_sort.webp`

**Prompt:**
> Mobile game store cover art for "Water Sort" puzzle game. Center composition: five glass laboratory test tubes in a row, each filled with vibrant layered colored liquids (cyan, magenta, lime green, orange, purple) being sorted/poured — one tube mid-pour with a glossy liquid stream. Glossy 3D cartoon style matching casual iOS/Android game icons, soft studio lighting, subtle reflections on glass. Background: rich teal-to-deep-blue gradient (#2aa9d6 to #13627e) with soft bokeh light particles and faint water ripple texture. Clean, premium, playful brain-puzzle mood. No text, no logos, no watermarks. Full-bleed illustration suitable for a 4:3 game card thumbnail.

**Catalog:** `accent: #2aa9d6`, `thumb: ['#2aa9d6', '#13627e']`

**Import:**
```bash
node scripts/import-cover.mjs assets/covers/water_sort.png water-sort
```

---

## Workflow for new games

1. Read `accent` + `thumb` from `catalog.ts` for the game id.
2. Generate 4:3 illustration (Cursor image gen or external tool) — use genre + mechanic in the prompt; match thumb gradient in the background.
3. Save source PNG to `assets/covers/<slug>.png`.
4. Run `node scripts/import-cover.mjs assets/covers/<slug>.png <game-id>`.
5. Confirm `COVERS` in `catalog.ts` maps to `<slug>.webp` (already set for Phase 3 games).
6. `npm run build` — hub card picks up `/water_sort.webp` automatically.

**Fallback:** `npm run covers:generate` produces gradient placeholders (no illustration).
