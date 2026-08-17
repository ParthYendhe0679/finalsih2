import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Search, Bell, Anchor, User } from 'lucide-react';

export default function Navbar() {
  const { weatherShift } = useApp();

  return (
    <header className="border-b border-slate-200/80 bg-white sticky top-0 z-50 h-16 flex items-center justify-between px-6 select-none shadow-sm">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex items-center justify-center shadow-xs">
          <Anchor className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 font-sans">
            Sagar Setu <span className="text-blue-600 font-semibold text-xs bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">MARITIME OS</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium tracking-tight -mt-0.5">STRATEGIC VOYAGE SCHEDULER & FLEET ANALYTICS</p>
        </div>
      </div>

      {/* Weather Storm Alert Notification Banner */}
      {weatherShift && (
        <div className="hidden md:flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-1.5 rounded-full text-xs animate-pulse font-medium shadow-xs">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <span className="tracking-wide">Active Storm Alert: Dynamic D* Lite Replanning Active</span>
        </div>
      )}

      {/* Header Right Actions (Search, Bell, User Profile as in Reference UI) */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-700">Live API Sync</span>
        </div>

        {/* Action icons from reference image header */}
        <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer" title="Search">
            <Search className="h-4.5 w-4.5" />
          </button>
          
          <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer" title="Notifications">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-blue-600 rounded-full ring-2 ring-white"></span>
          </button>

          {/* User profile avatar circle */}
          <div className="flex items-center space-x-2 pl-1 cursor-pointer">
            <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center overflow-hidden border-2 border-white shadow-xs">
              <User className="h-4.5 w-4.5 text-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
