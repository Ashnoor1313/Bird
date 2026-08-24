import React, { useState, useEffect } from 'react';
import { Sparkles, Layers, ShieldCheck } from 'lucide-react';

export const SplashScreen = ({ onFinish }) => {
  const [stage, setStage] = useState('enter'); // 'enter' | 'active' | 'exit'

  useEffect(() => {
    // Stage 1: Active display
    const activeTimer = setTimeout(() => {
      setStage('exit');
    }, 1200);

    // Stage 2: Exit and complete
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 1600);

    return () => {
      clearTimeout(activeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      onClick={() => onFinish && onFinish()}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-[#0a0f1d] to-slate-950 text-white cursor-pointer select-none transition-all duration-500 ${
        stage === 'exit' ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Soft Ambient Radial Glow */}
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none -bottom-10"></div>

      <div className="relative flex flex-col items-center text-center space-y-6 px-6 max-w-sm mx-auto">
        
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 rounded-3xl blur-md opacity-70 animate-pulse"></div>
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col items-center justify-center p-2 transform transition-transform duration-700 hover:scale-105">
            <span className="text-xl sm:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400 font-mono">
              MI2
            </span>
            <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mt-0.5">
              IMPEX
            </span>
          </div>
        </div>

        {/* Brand Text */}
        <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <h1 className="text-2xl sm:text-3xl font-black tracking-[0.2em] text-white uppercase drop-shadow-sm">
            MI2 IMPEX
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-800/90 text-slate-300 border border-slate-700/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              In-House Inventory OS
            </span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-48 h-1 bg-slate-800/80 rounded-full overflow-hidden relative shadow-inner">
          <div className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 rounded-full animate-[progress_1.3s_ease-in-out_infinite]"></div>
        </div>

        {/* Footer Subtext */}
        <p className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
          Central Godown & Store Counters
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
