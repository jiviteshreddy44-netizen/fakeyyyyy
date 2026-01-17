
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const BackgroundGraphics: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5),
        y: (e.clientY / window.innerHeight - 0.5)
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 opacity-[0.05] bg-grid-forensic"></div>
      
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-full h-full opacity-60" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ribbon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00FF88" stopOpacity="0" />
              <stop offset="50%" stopColor="#00FF88" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="30" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <motion.path
            d="M-200,450 Q400,100 800,450 T1800,450"
            fill="none"
            stroke="url(#ribbon-grad)"
            strokeWidth="4"
            filter="url(#glow)"
            animate={{
              d: [
                "M-200,450 Q400,100 800,450 T1800,450",
                "M-200,450 Q600,800 1000,450 T1800,450",
                "M-200,450 Q400,100 800,450 T1800,450"
              ],
              x: mousePos.x * 50,
              y: mousePos.y * 50
            }}
            transition={{
              d: { duration: 15, repeat: Infinity, ease: "easeInOut" },
              x: { type: 'spring', damping: 20 },
              y: { type: 'spring', damping: 20 }
            }}
          />
        </svg>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,5,0.7)_100%)]"></div>
    </div>
  );
};

export default BackgroundGraphics;
