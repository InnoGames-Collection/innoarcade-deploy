# Memory Match — Icon Style Guide

Premium collectible card icons for the GoPlay Memory Match tournament game.
All six icons must read as one family while preserving official brand recognizability.

**Reference quality bar:** Candy Crush, Royal Match, Coin Master, Clash Royale, Monopoly GO.

**Style anchor:** Ethio Telecom “e” logo (glossy 3D plastic/glass, soft top-left highlights).

---

## Export spec (required)

| Property | Value |
|----------|-------|
| Canvas | 1024 × 1024 px |
| Format | PNG-24 with alpha |
| Background | Fully transparent |
| Subject fill | 85–90% of canvas (trimmed bounding box) |
| File size | Target &lt; 400 KB per icon |

**Never include:** white circle, square, badge, plate, halo, watermark, or text.

Validate with:

```bash
npm run icons:validate
npm run icons:validate -- assets/memory-match/final/
```

---

## Shared visual language

### Material & lighting

- **Look:** Glossy casual-game collectible — polished plastic or glass.
- **Light source:** Top-left (~10 o’clock), consistent across all six icons.
- **Highlights:** Soft white specular streaks on upper curves (not harsh flat white).
- **Shadows:** Single soft drop shadow baked into the icon (diffuse, low opacity).
- **Edges:** Crisp anti-aliased silhouettes; no jagged matte fringe.
- **Shapes:** Rounded, chunky, friendly — avoid sharp corporate flatness except where the official logo geometry demands it.

### Gradients

- Use smooth multi-stop gradients for volume — never flat fills on new icons (Nexsus, Teleconnect).
- Official logos (Telebirr, Ethio “e”) may keep brand-flat areas but should gain subtle gloss on top.

---

## Color palette

Extracted from Ethio Telecom, Telebirr, znexus telecloud, and teleConnect references.

### Ethio Telecom family (Ethio “e”, Nexsus, Teleconnect)

| Role | Hex | Usage |
|------|-----|-------|
| Lime highlight | `#A8E063` | Top faces, specular-adjacent areas |
| Apple green | `#6BCB2E` | Primary green body |
| Forest green | `#3D8F14` | Green shadows, depth edges |
| Sky blue | `#4FC3F7` | Blue highlights |
| Azure | `#1F9FE8` | Primary blue body |
| Deep blue | `#1565C0` | Blue shadows, depth edges |
| Glow green | `#7ED321` @ 40% opacity | Soft outer glow on network icons |
| Glow blue | `#29B6F6` @ 40% opacity | Soft outer glow on network icons |

### Telebirr (official blue only)

| Role | Hex | Usage |
|------|-----|-------|
| Telebirr blue | `#0066CC` | Primary mark fill |
| Telebirr dark | `#004C99` | Outline, depth, shadow side |
| Telebirr mid | `#1A7AD9` | Gradient mid-tone for gloss pass |

**Do not** introduce green into the Telebirr mark.

### Mesob & Jebena

Keep existing colors exactly. Do not remap to the palette above.

---

## Per-icon brief

### 1. Telebirr (`telebirr.png`)

- **Source:** Official Telebirr logo (spiral + fins + bar).
- **Keep:** Exact logo geometry and official blue colors.
- **Remove:** White background, circle, square, badge, halo.
- **Enhance:** Light glossy pass + edge crispness to match the Ethio “e” family.
- **Do not:** Redesign, simplify, or recolor the mark.

### 2. Ethio Telecom (`ethio-telecom.png`)

- **Source:** Official 3D “e” logo.
- **Keep:** Recognizable “e” shape, green/blue split, glossy treatment.
- **Remove:** White circle, square, badge, background plate.
- **Enhance:** Polish only if needed after background removal.

### 3. Mesob (`mesob.png`)

- **Source:** Current in-game `injera.png` — copy verbatim.
- **Do not:** Redesign, recolor, simplify, or regenerate.
- **Allowed:** Copy to new filename only; optional transparent-edge trim if a white plate is visible in-game.

### 4. Jebena (`jebena.png`)

- **Source:** Current in-game `coffee.png` — copy verbatim.
- **Do not:** Redesign, recolor, simplify, or regenerate.
- **Allowed:** Copy to new filename only; optional transparent-edge trim if a white plate is visible in-game.

### 5. Nexsus (`nexsus.png`) — replaces WiFi

- **Replaces:** `phone.png` (generic WiFi symbol).
- **Inspired by:** znexus telecloud logo — the **cloud outline** shape and green/blue brand split.
- **Motifs:** Thick glossy blue cloud border; lime-green upper glow and blue lower glow inside (where the wordmark sits in the official logo).
- **Must not include:** Text, letters, WiFi arcs, network hub nodes, or decorations outside the cloud.

### 6. Teleconnect (`teleconnect.png`) — replaces Birr

- **Replaces:** `cash.png` (ETB banknotes).
- **Inspired by:** teleConnect logo symbol — **interlocking C-links** (blue left, green right with speech-bubble tail) plus small blue sparkle star.
- **Must not include:** Text, “teleConnect” wordmark, currency, or birr notes.

---

## File naming & locations

| File | Runtime path (after integration) |
|------|--------------------------------|
| `telebirr.png` | `src/games/memory-match/icons/telebirr.png` |
| `ethio-telecom.png` | `src/games/memory-match/icons/ethio-telecom.png` |
| `mesob.png` | `src/games/memory-match/icons/mesob.png` |
| `jebena.png` | `src/games/memory-match/icons/jebena.png` |
| `nexsus.png` | `src/games/memory-match/icons/nexsus.png` |
| `teleconnect.png` | `src/games/memory-match/icons/teleconnect.png` |

**Workflow:** Produce masters in `assets/memory-match/` (or `assets/memory-match/final/`), validate, then copy into `src/games/memory-match/icons/`.

---

## QA review sizes

Always review at these sizes before sign-off:

| Size | Purpose |
|------|---------|
| 1024 px | Full detail, export check |
| 128 px | Mid preview |
| 64 px | In-game card size (primary QA) |
| On green `#4F9E16` | Card-back contrast — no white halo |

Place approved icons side-by-side at 64 px. All six should feel equal in visual weight and fill.

---

## Reference images

Brand references are stored outside this repo (chat attachments). Key sources:

1. Telebirr — flat official blue mark
2. Ethio Telecom “e” — glossy 3D (style anchor)
3. znexus telecloud — Nexsus color/motif reference
4. teleConnect — Teleconnect link motif reference
5. Mesob / Jebena — current `injera.png` and `coffee.png` in `src/games/memory-match/icons/`
