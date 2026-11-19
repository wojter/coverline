// Tailwind needs whole class names, so domain colour classes are spelled out here.
import type { Bleeding } from '../domain/types';

export const BLEED_BG: Record<Bleeding, string> = {
  staining: 'bg-bleed-staining',
  spotting: 'bg-bleed-spotting',
  light: 'bg-bleed-light',
  medium: 'bg-bleed-medium',
  heavy: 'bg-bleed-heavy',
};

export const BLEED_FILL: Record<Bleeding, string> = {
  staining: 'fill-bleed-staining',
  spotting: 'fill-bleed-spotting',
  light: 'fill-bleed-light',
  medium: 'fill-bleed-medium',
  heavy: 'fill-bleed-heavy',
};

export const BLEED_STROKE: Record<Bleeding, string> = {
  staining: 'stroke-bleed-staining',
  spotting: 'stroke-bleed-spotting',
  light: 'stroke-bleed-light',
  medium: 'stroke-bleed-medium',
  heavy: 'stroke-bleed-heavy',
};

// The six swatches. None of them clashes with a domain colour.
export const SOURCE_SWATCHES = ['#2563eb', '#d97706', '#7c3aed', '#334155', '#0891b2', '#65a30d'];
