import { ReactNode } from "react";

interface CyberpunkCardProps {
  title: string;
  children?: ReactNode;
  className?: string;
  /** Tailwind max-w-* class capping the card width. Standalone tool pages keep
   *  the default readable column; dashboard/section cards pass "max-w-none" to
   *  fill their (already width-capped) page container for a symmetric layout. */
  maxWidth?: string;
}

const CyberpunkCard = ({ title, children, className = "", maxWidth = "max-w-3xl" }: CyberpunkCardProps) => {
  return (
    <div className={`relative w-full ${maxWidth} mt-12 mb-8 opacity-95 ${className}`}>
      {/* Top decorative line */}
      <div className="absolute -top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyber-red to-transparent" />
      
      {/* Main card */}
      <div className="glass-panel rounded min-h-[520px] flex flex-col">
        {/* Header with glitch effect */}
        <div className="border-b border-cyber-red/30 p-6 pb-4">
          <h2 className="text-2xl font-bold tracking-wide uppercase cyber-glow-red animate-flicker">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {children}
        </div>

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyber-red" />
        <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyber-red" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyber-red" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyber-red" />
      </div>

      {/* Bottom decorative line */}
      <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyber-red to-transparent" />
    </div>
  );
};

export default CyberpunkCard;
