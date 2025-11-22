import { useEffect, useState } from "react";

const CyberpunkCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    window.addEventListener("mousemove", updatePosition);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      className="fixed pointer-events-none z-[9999] mix-blend-difference"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Crosshair */}
      <div className={`relative ${isClicking ? "scale-90" : ""} transition-transform`}>
        <div className="absolute w-6 h-0.5 bg-cyber-red -left-3 top-0" style={{ boxShadow: "0 0 10px rgba(255, 43, 69, 0.8)" }} />
        <div className="absolute w-6 h-0.5 bg-cyber-red -left-3 top-0 rotate-90" style={{ boxShadow: "0 0 10px rgba(255, 43, 69, 0.8)" }} />
        <div className="absolute w-2 h-2 border border-cyber-red rounded-full -left-1 -top-1" style={{ boxShadow: "0 0 10px rgba(255, 43, 69, 0.6)" }} />
      </div>
    </div>
  );
};

export default CyberpunkCursor;
