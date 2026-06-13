// N-12 — measurement display honoring the user's units preference.

export type Units = 'metric' | 'imperial';

const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.20462;

/** "193 cm" (metric) or `6'4"` (imperial, rounded to the nearest inch). */
export function formatHeight(cm: number | null | undefined, units: Units = 'metric'): string {
  if (cm == null) return '—';
  if (units === 'metric') return `${cm} cm`;
  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

/** "88 kg" (metric) or "194 lb" (imperial, rounded to the nearest pound). */
export function formatWeight(kg: number | null | undefined, units: Units = 'metric'): string {
  if (kg == null) return '—';
  if (units === 'metric') return `${kg} kg`;
  return `${Math.round(kg * LB_PER_KG)} lb`;
}
