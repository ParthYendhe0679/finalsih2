import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Fuel, ShieldAlert, TriangleAlert, Anchor, Navigation2 } from 'lucide-react';

export default function EmergencyDock() {
  const { emergencyRoute, emergencyLoading, emergencyType } = useApp();

  if (!emergencyType) return null;

  if (emergencyLoading && !emergencyRoute) {
    return (
      <div className="border-t border-rose-200 bg-rose-50/60 p-4 flex items-center justify-center space-x-2 text-xs font-semibold text-rose-600 font-sans">
        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-rose-600"></div>
        <span>Recalculating optimal emergency route from vessel's live position...</span>
      </div>
    );
  }

  if (!emergencyRoute) return null;

  return (
    <div className="border-t border-rose-200 bg-rose-50/40 p-4 space-y-3 select-none font-sans shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
          <TriangleAlert className="h-4 w-4" />
          <span>Emergency Optimal Route &mdash; {emergencyRoute.label}</span>
        </div>
        {emergencyRoute.nearest_port && (
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
            <Anchor className="h-3 w-3 text-blue-600" />
            <span>Nearest Port: <span className="text-slate-900">{emergencyRoute.nearest_port.name}</span> ({emergencyRoute.nearest_port.distance_nm} nm)</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-600 leading-snug">{emergencyRoute.recommendation}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-4 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-1 mb-0.5">
              <Clock className="h-3 w-3 text-rose-500" />
              <span className="text-[10px] text-slate-400 uppercase font-medium">Time</span>
            </div>
            <span className="text-xs font-bold text-slate-800">{emergencyRoute.total_time}h</span>
          </div>
          <div className="flex flex-col items-center border-x border-slate-200 px-4">
            <div className="flex items-center space-x-1 mb-0.5">
              <Fuel className="h-3 w-3 text-rose-500" />
              <span className="text-[10px] text-slate-400 uppercase font-medium">Fuel</span>
            </div>
            <span className="text-xs font-bold text-slate-800">{emergencyRoute.total_fuel.toLocaleString()}g</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-1 mb-0.5">
              <ShieldAlert className="h-3 w-3 text-rose-500" />
              <span className="text-[10px] text-slate-400 uppercase font-medium">Risk</span>
            </div>
            <span className="text-xs font-bold text-slate-800">{emergencyRoute.total_risk}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-500">
          <Navigation2 className="h-3 w-3" />
          <span>
            Weight bias &mdash; Safety {Math.round(emergencyRoute.weights.safety_weight * 100)}% ·
            {' '}Fuel {Math.round(emergencyRoute.weights.fuel_weight * 100)}% ·
            {' '}Time {Math.round(emergencyRoute.weights.time_weight * 100)}%
          </span>
        </div>

        {emergencyRoute.hazard_zone && (
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-rose-600 bg-white border border-rose-200 px-2.5 py-1 rounded-full">
            <TriangleAlert className="h-3 w-3" />
            <span>Hazard zone marked: {emergencyRoute.hazard_zone.radius_km} km radius around live position</span>
          </div>
        )}
      </div>
    </div>
  );
}
