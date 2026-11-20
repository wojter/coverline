// Tailwind needs whole class names, so domain colour classes are spelled out here.
import type { Bleeding } from '../domain/types';

export const BLEED_BG: Record<Bleeding, string> = {
  bleeding: 'bg-bleed-bleeding',
  staining: 'bg-bleed-staining',
  spotting: 'bg-bleed-spotting',
};

export const BLEED_STROKE: Record<Bleeding, string> = {
  bleeding: 'stroke-bleed-bleeding',
  staining: 'stroke-bleed-staining',
  spotting: 'stroke-bleed-spotting',
};

// The six swatches. None of them clashes with a domain colour.
export const SOURCE_SWATCHES = ['#2563eb', '#d97706', '#7c3aed', '#334155', '#0891b2', '#65a30d'];
