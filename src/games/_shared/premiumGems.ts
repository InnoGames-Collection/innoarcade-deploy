/** Map game palette hex values to illustrated gem variant classes. */

export const GEM_IDS = [
  'sapphire', 'emerald', 'amber', 'ruby', 'amethyst', 'aquamarine', 'coral', 'violet',
] as const;

export type GemId = (typeof GEM_IDS)[number];

const HEX_TO_GEM: Record<string, GemId> = {
  '#4361ee': 'sapphire',
  '#5b8cff': 'sapphire',
  '#3498db': 'sapphire',
  '#0984e3': 'sapphire',
  '#74b9ff': 'sapphire',
  '#2ecc71': 'emerald',
  '#1abc9c': 'aquamarine',
  '#55efc4': 'emerald',
  '#00b894': 'emerald',
  '#f39c12': 'amber',
  '#fdcb6e': 'amber',
  '#ffeaa7': 'amber',
  '#e67e22': 'coral',
  '#e17055': 'coral',
  '#e74c3c': 'ruby',
  '#ff6b8a': 'ruby',
  '#c0392b': 'ruby',
  '#9b59b6': 'amethyst',
  '#6c5ce7': 'violet',
  '#a29bfe': 'amethyst',
};

export type GemVariant = 'block' | 'hex' | 'sphere' | 'liquid';

export function gemIdFromHex(hex: string): GemId {
  const key = hex.toLowerCase();
  if (HEX_TO_GEM[key]) return HEX_TO_GEM[key];
  const idx = Math.abs(hashHex(key)) % GEM_IDS.length;
  return GEM_IDS[idx];
}

export function gemIdFromIndex(index: number): GemId {
  return GEM_IDS[((index % GEM_IDS.length) + GEM_IDS.length) % GEM_IDS.length];
}

export function gemClasses(color: string, variant: GemVariant = 'block'): string {
  const id = gemIdFromHex(color);
  return `pgem pgem--${id} pgem--${variant}`;
}

export function gemClassesByIndex(index: number, variant: GemVariant = 'block'): string {
  const id = gemIdFromIndex(index);
  return `pgem pgem--${id} pgem--${variant}`;
}

function hashHex(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
