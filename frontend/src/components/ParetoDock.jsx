import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Fuel, ShieldAlert, Award } from 'lucide-react';

export default function ParetoDock() {
  const { routes, selectedRouteKey, setSelectedRouteKey } = useApp();

  if (!routes) {
    return (
      <div className="h-24 border-t border-slate-200/80 bg-white flex items-center justify-center text-xs font-medium text-slate-400 font-sans">
        No active routes calculated. Trigger "Calculate Optimal Routes" to view Pareto trade-off comparisons.
      </div>
    );
  }

  const routeItems = [
    {
      key: 'fastest',
      label: 'Fastest Path',
      color: 'border-rose-200 hover:border-rose-400',
      activeColor: 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/50 shadow-xs',
      badge: 'bg-rose-50 text-rose-600 border-rose-200',
      iconColor: 'text-rose-500'
    },
    {
      key: 'fuel_optimized',
      label: 'Fuel Optimized',
      color: 'border-blue-200 hover:border-blue-400',
      activeColor: 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/50 shadow-xs',
      badge: 'bg-blue-50 text-blue-600 border-blue-200',
      iconColor: 'text-blue-500'
    },
    {
      key: 'safest',
      label: 'Safest Path',
      color: 'border-emerald-200 hover:border-emerald-400',
      activeColor: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50 shadow-xs',
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      iconColor: 'text-emerald-500'
    },
    {
      key: 'balanced',
      label: 'Balanced Path',
      color: 'border-indigo-200 hover:border-indigo-400',
      activeColor: 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50 shadow-xs',
      badge: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      iconColor: 'text-indigo-500'
    }
  ];

  return (
    <div className="border-t border-slate-200/80 bg-white p-4 space-y-3 select-none font-sans shadow-xs">
      <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Award className="h-4 w-4 text-blue-600" />
        <span>Pareto Optimization Trade-off Matrix (Select path to visualize)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {routeItems.map((item) => {
          const routeData = routes[item.key];
          if (!routeData) return null;

          const isSelected = selectedRouteKey === item.key;
          
          return (
            <div
              key={item.key}
              onClick={() => setSelectedRouteKey(item.key)}
              className={`p-3.5 rounded-2xl border bg-slate-50/60 cursor-pointer transition flex flex-col justify-between h-28 ${
                isSelected ? item.activeColor : `${item.color} border-slate-200`
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 tracking-tight">{item.label}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${item.badge}`}>
                  {item.key === 'balanced' ? 'Weighted' : 'Extreme'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <Clock className={`h-3 w-3 ${item.iconColor}`} />
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Time</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{routeData.total_time}h</span>
                </div>

                <div className="flex flex-col items-center border-x border-slate-200">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <Fuel className={`h-3 w-3 ${item.iconColor}`} />
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Fuel</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{routeData.total_fuel.toLocaleString()}g</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <ShieldAlert className={`h-3 w-3 ${item.iconColor}`} />
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Risk</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{routeData.total_risk}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
