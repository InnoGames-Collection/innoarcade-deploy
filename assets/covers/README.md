# Hub cover art (AI illustrations)

All **26 new catalog games** have custom 4:3 key art in `public/*.webp`. Source PNGs are archived in this folder.

## Regenerate all WebP from latest PNGs

After updating PNGs in the Cursor assets folder or here:

```bash
npm run covers:import-all
```

Or point at a custom folder:

```bash
node scripts/import-all-covers.mjs /path/to/png/folder
```

## Single game

```bash
npm run covers:import -- assets/covers/water_sort.png water-sort
```

## Style guide

- **4:3** aspect ratio, 800×600 WebP @ quality 88
- Premium mobile key art (App Store / Play feature quality)
- Catalog `thumb` gradient colors in background
- **No text, logos, or UI** on the artwork
- Match stable covers (`bubble_pop.webp`, `sudoku.webp`) in polish level

## Games with custom art

water-sort, parking-jam, laser-puzzle, piano-tiles, stack-tower, crossy-road, block-blast, tile-connect, hexa-block, knife-hit, helix-jump, hill-climb, tower-defense, draw-bridge, ball-sort, jewel-match, reflex-tap, doodle-jump, zigzag, color-switch, rope-rescue, pipe-connect, ball-maze, arrow-shot, slide-puzzle, race-car

**Fallback:** `npm run covers:generate` creates gradient placeholders (overwrites WebP — re-run `covers:import-all` after).
