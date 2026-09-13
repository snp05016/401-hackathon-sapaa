/**
 * Cute glossy 3D-style ghost (rounded dome, flared arms, drippy scalloped
 * hem, wide oval eyes, surprised "o" mouth) — matches the reference ghost
 * emoji look, built as an SVG so it stays crisp at any size.
 */
export function GhostFigure({ size = 18, className }: { size?: number; className?: string }) {
  const gradientId = "ghost-figure-gradient";
  const shineId = "ghost-figure-shine";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="20" y1="8" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f1edfb" />
          <stop offset="100%" stopColor="#cdd3f5" />
        </linearGradient>
        <radialGradient id={shineId} cx="35%" cy="28%" r="35%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M18,40 A32,32 0 1 1 82,40 C88,50 88,62 82,72 q -8,14 -16,0 q -8,14 -16,0 q -8,14 -16,0 q -8,14 -16,0 C12,62 12,50 18,40 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M18,40 A32,32 0 1 1 82,40 C88,50 88,62 82,72 q -8,14 -16,0 q -8,14 -16,0 q -8,14 -16,0 q -8,14 -16,0 C12,62 12,50 18,40 Z"
        fill={`url(#${shineId})`}
      />
      <ellipse cx="37" cy="40" rx="6" ry="8" fill="#22213a" />
      <ellipse cx="63" cy="40" rx="6" ry="8" fill="#22213a" />
      <ellipse cx="50" cy="57" rx="5.5" ry="7" fill="#2b2242" />
    </svg>
  );
}
