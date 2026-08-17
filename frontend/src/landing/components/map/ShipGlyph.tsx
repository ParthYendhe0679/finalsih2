/**
 * Top-down vessel, drawn bow-up so a heading can be applied as a plain
 * rotation. Hand-built rather than a stock icon: the hull carries a real
 * sheer line, a container bay grid and an aft superstructure block.
 */
export function ShipGlyph({ scale = 1, tone = 'ink' }: { scale?: number; tone?: 'ink' | 'sea' | 'signal' }) {
  const hull =
    tone === 'sea' ? 'var(--sea-700)' : tone === 'signal' ? 'var(--signal)' : 'var(--ink)';

  return (
    <g transform={`scale(${scale})`}>
      {/* subtle boat shadow */}
      <ellipse cx="0" cy="1" rx="6" ry="14" fill="#0a2540" opacity="0.18" />
      {/* hull */}
      <path
        d="M0,-13 C3.5,-7.2 5.1,-1.8 5.1,3.4 L5.1,9.6 C5.1,11.1 4.2,12 2.8,12 L-2.8,12 C-4.2,12 -5.1,11.1 -5.1,9.6 L-5.1,3.4 C-5.1,-1.8 -3.5,-7.2 0,-13 Z"
        fill={hull}
        stroke="#ffffff"
        strokeWidth="0.8"
      />
      {/* container bays */}
      <g fill="#ffffff" opacity="0.9">
        <rect x="-3.1" y="-5.4" width="6.2" height="2" rx="0.4" />
        <rect x="-3.5" y="-2.5" width="7" height="2" rx="0.4" />
        <rect x="-3.5" y="0.4" width="7" height="2" rx="0.4" />
        <rect x="-3.5" y="3.3" width="7" height="2" rx="0.4" />
      </g>
      {/* aft superstructure */}
      <rect x="-2.6" y="7" width="5.2" height="3.1" rx="0.6" fill="#ffffff" opacity="0.95" />
    </g>
  );
}
