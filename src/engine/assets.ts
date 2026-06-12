// Asset loader + preloader. Loads raster (PNG/WebP) and vector (SVG) images and
// rasterizes them once into an offscreen canvas so per-frame drawImage is cheap
// and resolution-independent. SVG sources can be a URL or an inline string,
// letting games ship authored vector art in-repo and swap in AI/sourced PNG
// sheets later without changing call sites.
//
// A "sprite" is a named sub-rectangle of a loaded sheet (atlas). Frames for
// animation are addressed by index into a row.

export interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface SheetDef {
  src: string; // URL or inline "<svg ...>...</svg>"
  frameW?: number; // when set, the sheet is sliced into a grid of frames
  frameH?: number;
  scale?: number; // rasterize at this multiple (for crisp SVG on hi-dpi)
}

interface LoadedSheet {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
}

export class AssetStore {
  private sheets = new Map<string, LoadedSheet>();

  // Load all sheets, reporting 0..1 progress. Resolves when every asset is ready.
  async load(defs: Record<string, SheetDef>, onProgress?: (p: number) => void): Promise<void> {
    const entries = Object.entries(defs);
    let done = 0;
    await Promise.all(
      entries.map(async ([name, def]) => {
        const sheet = await this.loadSheet(def);
        this.sheets.set(name, sheet);
        done++;
        onProgress?.(done / entries.length);
      }),
    );
  }

  private async loadSheet(def: SheetDef): Promise<LoadedSheet> {
    const scale = def.scale ?? 1;
    const img = await loadImage(def.src);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, w, h);
    const frameW = (def.frameW ?? img.naturalWidth) * scale;
    const frameH = (def.frameH ?? img.naturalHeight) * scale;
    return {
      canvas,
      frameW,
      frameH,
      cols: Math.max(1, Math.floor(w / frameW)),
      rows: Math.max(1, Math.floor(h / frameH)),
    };
  }

  // Draw frame `index` (row-major) of a sheet at (dx,dy) with an optional size.
  draw(
    ctx: CanvasRenderingContext2D,
    name: string,
    index: number,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
  ): void {
    const s = this.sheets.get(name);
    if (!s) return;
    const col = index % s.cols;
    const row = Math.floor(index / s.cols) % s.rows;
    ctx.drawImage(
      s.canvas,
      col * s.frameW, row * s.frameH, s.frameW, s.frameH,
      dx, dy, dw ?? s.frameW, dh ?? s.frameH,
    );
  }

  has(name: string): boolean {
    return this.sheets.has(name);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`asset load failed: ${src.slice(0, 40)}`));
    // Inline SVG markup → data URL; otherwise treat as a normal URL.
    img.src = src.trimStart().startsWith('<svg')
      ? `data:image/svg+xml;utf8,${encodeURIComponent(src)}`
      : src;
  });
}
