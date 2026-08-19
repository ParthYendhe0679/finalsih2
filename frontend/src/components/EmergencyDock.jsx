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
        <span>Finding the nearest port reachable by sea from the vessel's live position...</span>
      </div>
    );
  }

  if (!emergencyRoute) return null;

  const port = emergencyRoute.divert_port;

  return (
    <div className="border-t border-rose-200 bg-rose-50/40 p-4 space-y-3 select-none font-sans shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
          <TriangleAlert className="h-4 w-4" />
          <span>Emergency Diversion &mdash; {emergencyRoute.label}</span>
        </div>
      </div>

      {port && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-rose-600 text-white rounded-xl px-4 py-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <Anchor className="h-5 w-5 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-rose-100">
                Diverting to nearest port by sea
              </p>
              <p className="text-sm font-bold">
                {port.name}
                <span className="font-medium text-rose-100"> &middot; {port.country}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose-100 font-semibold">Distance</p>
              <p className="text-sm font-bold">{port.distance_nm} nm</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose-100 font-semibold">ETA</p>
              <p className="text-sm font-bold">{emergencyRoute.total_time} h</p>
            </div>
          </div>
        </div>
      )}

      {port && (port.is_origin || port.is_destination) && (
        <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          The nearest refuge is the voyage&rsquo;s {port.is_origin ? 'departure' : 'destination'} port, so the vessel is being turned back to it.
        </p>
      )}

      {emergencyRoute.excluded_ports && emergencyRoute.excluded_ports.length > 0 && (
        <p className="text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
          Skipped inside the hazard zone: <span className="font-semibold text-slate-800">{emergencyRoute.excluded_ports.join(', ')}</span>
        </p>
      )}

      {emergencyRoute.hazard_fallback && (
        <p className="text-[11px] font-semibold text-rose-700 bg-rose-100 border border-rose-300 rounded-xl px-3 py-2">
          Warning: every port outside the hazard zone was unreachable. The diversion target lies inside the zone.
        </p>
      )}

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
