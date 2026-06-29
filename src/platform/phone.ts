/** Mask a phone for public display: +2519****12345 (last 5 digits visible). */
export function maskPhone(phone: string): string {
  const d = String(phone ?? '').replace(/\D/g, '');
  const n = d.startsWith('251') ? d : d.startsWith('0') ? `251${d.slice(1)}` : `251${d}`;
  return `+2519****${n.slice(-5).padStart(5, '0')}`;
}
