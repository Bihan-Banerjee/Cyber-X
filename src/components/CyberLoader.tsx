interface CyberLoaderProps {
  /** Text shown beneath the spinner (default "LOADING"). A trailing "..." is animated on. */
  label?: string;
  /** Fill a large vertical space (route-level fallback) instead of a compact inline block. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Themed loading indicator: dual counter-rotating rings (cyan/red) with a
 * pulsing core and glitchy label. Replaces plain "Loading..." text so every
 * loading moment (lazy-route Suspense fallback, page data fetches) stays on the
 * cyberpunk visual theme.
 */
const CyberLoader = ({ label = "LOADING", fullScreen = false, className = "" }: CyberLoaderProps) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-5 ${
      fullScreen ? "min-h-[60vh]" : "py-16"
    } ${className}`}
  >
    <div className="relative w-16 h-16">
      {/* outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-cyber-cyan/15 border-t-cyber-cyan animate-spin [animation-duration:1.1s]" />
      {/* inner counter-rotating ring */}
      <div className="absolute inset-2 rounded-full border-2 border-cyber-red/15 border-b-cyber-red animate-spin [animation-direction:reverse] [animation-duration:1.6s]" />
      {/* pulsing core */}
      <div className="absolute inset-[38%] rounded-full bg-cyber-cyan animate-pulse shadow-[0_0_14px_rgba(0,255,255,0.85)]" />
    </div>
    <div className="text-cyber-cyan/80 text-xs font-mono tracking-[0.35em] animate-pulse">
      {label}
      <span className="animate-pulse">...</span>
    </div>
  </div>
);

export default CyberLoader;
