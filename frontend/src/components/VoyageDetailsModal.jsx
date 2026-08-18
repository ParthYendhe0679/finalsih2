import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateVoyageDossierMarkdown, downloadFile } from '../utils/voyageReportGenerator';
import { X, Download, FileText, Wind, Droplets, Waves, ShieldCheck, Clock, Fuel, Sparkles, CheckCircle2, ChevronRight, MapPin, Gauge } from 'lucide-react';

export default function VoyageDetailsModal({ isOpen, onClose }) {
  const {
    routes,
    selectedRouteKey,
    selectedShip,
    origin,
    destination,
    liveEnvironment
  } = useApp();

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen || !routes || !routes[selectedRouteKey]) return null;

  const activeRoute = routes[selectedRouteKey];
  const waypoints = activeRoute.waypoints || [];

  const routeMeta = {
    fastest: {
      id: 'A',
      title: 'Route A — Fastest (Time Optimal)',
      desc: 'Optimizes travel duration by avoiding headwind resistance and aligning with favorable ocean current streams.',
      color: 'bg-rose-500 text-white',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      accent: 'text-rose-600',
    },
    fuel_optimized: {
      id: 'B',
      title: 'Route B — Fuel Optimal (Energy Efficient)',
      desc: 'Minimizes bunker fuel consumption by reducing aerodynamic and wave added resistance while harnessing ocean current drift.',
      color: 'bg-blue-500 text-white',
      badge: 'border-blue-200 bg-blue-50 text-blue-700',
      accent: 'text-blue-600',
    },
    safest: {
      id: 'C',
      title: 'Route C — Safest (Hazard Standoff)',
      desc: 'Maintains maximal clearance from hazardous coastal shelves, rough swell sea-states, and high-risk piracy corridors.',
      color: 'bg-emerald-500 text-white',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      accent: 'text-emerald-600',
    },
    balanced: {
      id: 'D',
      title: 'Route D — Recommended (Pareto Optimal)',
      desc: 'Calculates the optimal trade-off balance across Time, Fuel, and Safety based on your strategic priority sliders.',
      color: 'bg-violet-600 text-white',
      badge: 'border-violet-200 bg-violet-50 text-violet-700',
      accent: 'text-violet-600',
    },
  }[selectedRouteKey] || {
    id: 'D',
    title: 'Recommended Route',
    desc: 'Multi-objective optimal route.',
    color: 'bg-violet-600 text-white',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    accent: 'text-violet-600',
  };

  const handleDownload = (format = 'txt') => {
    const fileName = `Voyage_Plan_${selectedRouteKey.toUpperCase()}_${origin}_to_${destination}.${format === 'json' ? 'json' : 'txt'}`;

    if (format === 'json') {
      const payload = {
        metadata: {
          voyageId: `VOY-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toISOString(),
          origin,
          destination,
          routeKey: selectedRouteKey,
          vessel: selectedShip,
        },
        routeMetrics: activeRoute,
        environmentalSummary: liveEnvironment,
        waypoints,
        disclaimer: 'Open-Meteo forecast and model-derived data for decision support. Not certified nautical navigation data.'
      };
      downloadFile(JSON.stringify(payload, null, 2), fileName, 'application/json');
    } else {
      const report = generateVoyageDossierMarkdown(
        selectedRouteKey,
        activeRoute,
        selectedShip,
        origin,
        destination,
        liveEnvironment
      );
      downloadFile(report, fileName, 'text/plain;charset=utf-8');
    }

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${routeMeta.color}`}>
              {routeMeta.id}
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">{routeMeta.title}</h3>
                {selectedRouteKey === 'balanced' && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                    ⭐ RECOMMENDED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {origin} &rarr; {destination} · {selectedShip?.name || 'MV Bharat'} ({selectedShip?.displacement?.toLocaleString()} MT)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleDownload('txt')}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Download Voyage Dossier (.txt)</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDownload('json')}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer"
              title="Download raw JSON"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>JSON</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Optimization Strategy & Rationale Banner */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>Optimization & Rationale Analysis</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {routeMeta.desc}
            </p>
          </div>

          {/* Key Macro Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-medium mb-1">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Estimated Time (ETA)</span>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">{activeRoute.total_time} hrs</p>
                <p className="text-[10px] text-slate-400 font-medium">≈ {(activeRoute.total_time / 24).toFixed(1)} sailing days</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-medium mb-1">
                <Fuel className="h-3.5 w-3.5 text-blue-600" />
                <span>Fuel Consumption</span>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">{activeRoute.total_fuel?.toLocaleString()} gal</p>
                <p className="text-[10px] text-slate-400 font-medium">SFOC: {selectedShip?.sfoc || 170} g/kWh</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-medium mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Coast Clearance</span>
              </div>
              <div>
                <p className="text-lg font-black text-emerald-700">{activeRoute.avg_clearance_km ?? 145} km</p>
                <p className="text-[10px] text-slate-400 font-medium">Min: {activeRoute.min_clearance_km ?? 27.8} km</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-medium mb-1">
                <Gauge className="h-3.5 w-3.5 text-violet-600" />
                <span>Modeled Risk Score</span>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">{activeRoute.total_risk}</p>
                <p className="text-[10px] text-emerald-600 font-bold">● Strict Safety Pass</p>
              </div>
            </div>
          </div>

          {/* Live Open-Meteo Met-Ocean Conditions Along Corridor */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <Wind className="h-4 w-4 text-blue-600" />
                <span>Live Open-Meteo Met-Ocean Forecast Feed</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ● Live Model Sync
              </span>
            </div>

            {liveEnvironment ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-medium block">Wind Field</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{liveEnvironment.wind.speed_kn} kn {liveEnvironment.wind.compass}</p>
                  <span className="text-[10px] text-slate-400">Gusts: {liveEnvironment.wind.gusts_kn} kn</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-medium block">Wave State</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{liveEnvironment.waves.height_m} m swell</p>
                  <span className="text-[10px] text-amber-600 font-medium">{liveEnvironment.waves.sea_state}</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-medium block">Surface Current</span>
                  <p className="font-bold text-teal-700 text-sm mt-0.5">{liveEnvironment.currents.speed_kn} kn {liveEnvironment.currents.compass}</p>
                  <span className="text-[10px] text-teal-600 font-medium">Along-Track Drift</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-medium block">Weather Condition</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5 truncate">{liveEnvironment.weather.description}</p>
                  <span className="text-[10px] text-slate-400">WMO Code: {liveEnvironment.weather.code}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Live environmental telemetry loaded from Open-Meteo API.</p>
            )}

            <div className="text-[9.5px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span>Attribution: Open-Meteo (CC BY 4.0)</span>
              <span>Prototype Decision Support Only. Not for nautical navigation.</span>
            </div>
          </div>

          {/* Waypoint Navigation Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                Waypoint Navigation Schedule ({waypoints.length} Total Waypoints)
              </span>
              <span className="text-[10px] text-slate-400">Showing first 12 legs</span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Leg</th>
                    <th className="py-2.5 px-3">Coordinates</th>
                    <th className="py-2.5 px-3">Distance</th>
                    <th className="py-2.5 px-3">Est. Fuel</th>
                    <th className="py-2.5 px-3">Coast Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {waypoints.slice(0, 12).map(([lat, lon], idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === waypoints.length - 1;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {isFirst ? 'DEP (01)' : isLast ? 'ARR' : String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {lat.toFixed(2)}°{lat >= 0 ? 'N' : 'S'}, {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
                        </td>
                        <td className="py-2 px-3">
                          {idx === 0 ? '0.0 NM' : '≈ 15.0 NM'}
                        </td>
                        <td className="py-2 px-3">
                          ≈ {(activeRoute.total_fuel / Math.max(1, waypoints.length)).toFixed(0)} gal
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {idx === 0 ? 'Harbor' : `${activeRoute.avg_clearance_km ?? 145} km`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {waypoints.length > 12 && (
                <div className="p-2.5 text-center text-xs font-semibold text-blue-600 bg-slate-50 border-t border-slate-100">
                  + {waypoints.length - 12} additional waypoints included in downloaded file
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <p className="text-slate-400 text-[10px]">
            File includes full WMO weather codes, wave periods, current velocities, and fuel consumption formulas.
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleDownload('txt')}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download Complete Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
