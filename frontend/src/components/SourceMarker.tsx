import type { Marker } from '../domain/types';

// Shape plus colour, so a source is never told apart by colour alone.
export function SourceMarker({ marker, color, hollow = false, size = 16 }: { marker: Marker; color: string; hollow?: boolean; size?: number }) {
  const fill = hollow ? 'none' : color;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="shrink-0">
      {marker === 'circle' && <circle cx="8" cy="8" r="5.5" fill={fill} stroke={color} stroke-width="2" />}
      {marker === 'square' && <rect x="2.5" y="2.5" width="11" height="11" fill={fill} stroke={color} stroke-width="2" />}
      {marker === 'triangle' && <path d="M8 2.2 L14 13.5 L2 13.5 Z" fill={fill} stroke={color} stroke-width="2" stroke-linejoin="round" />}
      {marker === 'diamond' && <path d="M8 1.8 L14.2 8 L8 14.2 L1.8 8 Z" fill={fill} stroke={color} stroke-width="2" stroke-linejoin="round" />}
    </svg>
  );
}
