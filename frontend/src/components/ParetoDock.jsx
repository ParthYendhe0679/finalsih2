import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Fuel, ShieldAlert, Award } from 'lucide-react';

export default function ParetoDock() {
  const { routes, selectedRouteKey, setSelectedRouteKey } = useApp();

  if (!routes) {
    return (
      <div className="h-28 border-t border-brand-border bg-brand-card/90 flex items-center justify-center text-xs font-mono text-gray-400">
        No active routes calculated. Trigger "Calculate Optimal Routes" to view Pareto trade-off comparisons.
      </div>
    );
  }

  const routeItems = [
    {
      key: 'fastest',
      label: 'Fastest Path',
      color: 'border-red-500/30 hover:border-red-500',
      activeColor: 'ring-2 ring-red-500 border-red-500 bg-red-950/20',
      badge: 'bg-red-500/10 text-red-400 border-red-500/30',
      iconColor: 'text-red-400'
    },
    {
      key: 'fuel_optimized',
      label: 'Fuel Optimized',
      color: 'border-blue-500/30 hover:border-blue-500',
      activeColor: 'ring-2 ring-blue-500 border-blue-500 bg-blue-950/20',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    {
      key: 'safest',
      label: 'Safest Path',
      color: 'border-emerald-500/30 hover:border-emerald-500',
      activeColor: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/20',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      iconColor: 'text-emerald-400'
    },
    {
      key: 'balanced',
      label: 'Balanced Path',
      color: 'border-purple-500/30 hover:border-purple-500',
      activeColor: 'ring-2 ring-purple-500 border-purple-500 bg-purple-950/20',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      iconColor: 'text-purple-400'
    }
  ];

  return (
    <div className="border-t border-brand-border bg-brand-card/90 p-4 space-y-3 select-none">
      <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
        <Award className="h-3.5 w-3.5 text-brand-glow" />
        <span>Pareto Optimization Trade-off Matrix (Select path to visualize)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {routeItems.map((item) => {
          const routeData = routes[item.key];
          if (!routeData) return null;

          const isSelected = selectedRouteKey === item.key;
          
          return (
            <div
              key={item.key}
              onClick={() => setSelectedRouteKey(item.key)}
              className={`p-3.5 rounded-lg border bg-brand-bg/40 cursor-pointer transition flex flex-col justify-between h-28 ${
                isSelected ? item.activeColor : `${item.color} border-brand-border`
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white tracking-wide">{item.label}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${item.badge}`}>
                  {item.key === 'balanced' ? 'Weighted' : 'Extreme'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <Clock className={`h-3 w-3 ${item.iconColor}`} />
                    <span className="text-[9px] text-gray-400 uppercase font-mono">Time</span>
                  </div>
                  <span className="text-xs font-mono text-gray-200 font-bold">{routeData.total_time}h</span>
                </div>

                <div className="flex flex-col items-center border-x border-brand-border/85">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <Fuel className={`h-3 w-3 ${item.iconColor}`} />
                    <span className="text-[9px] text-gray-400 uppercase font-mono">Fuel</span>
                  </div>
                  <span className="text-xs font-mono text-gray-200 font-bold">{routeData.total_fuel.toLocaleString()}g</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <ShieldAlert className={`h-3 w-3 ${item.iconColor}`} />
                    <span className="text-[9px] text-gray-400 uppercase font-mono">Risk</span>
                  </div>
                  <span className="text-xs font-mono text-gray-200 font-bold">{routeData.total_risk}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
