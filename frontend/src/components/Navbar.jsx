import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, RefreshCw, Anchor } from 'lucide-react';

export default function Navbar() {
  const { weatherShift } = useApp();

  return (
    <header className="border-b border-brand-border bg-brand-card/90 backdrop-blur-md sticky top-0 z-50 h-16 flex items-center justify-between px-6 select-none">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-brand-glow/15 rounded-lg border border-brand-glow/30 flex items-center justify-center">
          <Anchor className="h-6 w-6 text-brand-glow animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
            AEGIR <span className="text-brand-glow font-light text-sm bg-brand-glow/10 px-2 py-0.5 rounded border border-brand-glow/20">MARITIME OS</span>
          </h1>
          <p className="text-[10px] text-gray-400 font-mono tracking-tight -mt-0.5">V1.4.2 // STRATEGIC VOYAGE SCHEDULER</p>
        </div>
      </div>

      {weatherShift && (
        <div className="hidden md:flex items-center space-x-2 bg-red-950/40 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-xs animate-pulse">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <span className="font-mono uppercase tracking-wider font-semibold">Active Storm Alert: Dynamic D* Lite Replanning Active</span>
        </div>
      )}

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-brand-bg/80 border border-brand-border px-3 py-1.5 rounded-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-safety opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-safety"></span>
          </span>
          <span className="text-xs font-mono text-gray-300">Live API Sync</span>
        </div>
        
        <div className="text-xs font-mono text-gray-400 hidden lg:block bg-brand-bg/40 border border-brand-border/60 px-3 py-1.5 rounded-lg">
          NODE: IN-01-IO
        </div>
      </div>
    </header>
  );
}
