export function GhostMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* Eyes are punched out so the ground shows through in every theme. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.4 21.2V10.4a7.6 7.6 0 0 1 15.2 0v10.8l-2.53-2.05-2.53 2.05-2.54-2.05-2.53 2.05-2.54-2.05-2.53 2.05ZM9.6 8.7a1.15 1.5 0 1 0 0 3 1.15 1.5 0 1 0 0-3ZM14.4 8.7a1.15 1.5 0 1 0 0 3 1.15 1.5 0 1 0 0-3Z"
        fill="currentColor"
      />
    </svg>
  );
}
