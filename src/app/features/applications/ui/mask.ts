/** Masks all but the last 4 characters (same format as the API). */
export function maskValue(value: string | null | undefined): string {
  if (!value) return '—';
  return `•••• ${value.slice(-4)}`;
}
