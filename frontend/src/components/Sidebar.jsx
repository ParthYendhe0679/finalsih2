import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sliders, Anchor, Ship, Navigation, Play, Pause, RotateCcw, CloudLightning, ShieldAlert, HeartPulse, Wrench, TriangleAlert, X } from 'lucide-react';

const EMERGENCY_ICONS = { CloudLightning, ShieldAlert, HeartPulse, Wrench };

// 25 ports is too many for a flat list, so group the selector by region. Falls
// back to a plain list before the registry has loaded.
function renderPortOptions(ports, portsList, disabledKey) {
  if (!ports || !ports.length) {
    return portsList.map((port) => (
      <option key={port} value={port} disabled={port === disabledKey}>{port}</option>
    ));
  }
  const byRegion = [];
  ports.forEach((p) => {
    const bucket = byRegion.find((b) => b.region === p.region);
    if (bucket) bucket.items.push(p);
    else byRegion.push({ region: p.region, items: [p] });
  });
  return byRegion.map((b) => (
    <optgroup key={b.region} label={b.region}>
      {b.items.map((p) => (
        <option key={p.key} value={p.key} disabled={p.key === disabledKey}>{p.name}</option>
      ))}
    </optgroup>
  ));
}

export default function Sidebar() {
  const {
    ships,
    selectedShipId,
    setSelectedShipId,
    selectedShip,
    setSelectedShip,
    origin,
    setOrigin,
    destination,
    setDestination,
    safetyWeight,
    fuelWeight,
    timeWeight,
    handleWeightChange,
    loading,
    errorMsg,
    calculateRoutes,
    triggerWeatherShiftAndReplan,
    portsList,
    ports,
    emergencyGate,
    routes,
    emergencyTypes,
    emergencyType,
    emergencyLoading,
    emergencyError,
    triggerEmergency,
    clearEmergency,
    isPlayingTelemetry,
    setIsPlayingTelemetry,
    currentVesselIndex,
    setCurrentVesselIndex,
  } = useApp();

  const [showOverride, setShowOverride] = useState(false);

  // Validate weight sum
  const weightSum = parseFloat((safetyWeight + fuelWeight + timeWeight).toFixed(2));
  const isWeightsValid = Math.abs(weightSum - 1.0) < 0.001;

  const handleOverrideChange = (field, val) => {
    if (!selectedShip) return;
    const updated = { ...selectedShip, [field]: parseFloat(val) || 0.0 };
    setSelectedShip(updated);
  };

  return (
    <aside className="w-full lg:w-[30%] bg-white border-r border-slate-200/80 flex flex-col overflow-y-auto p-5 space-y-6 select-none shrink-0 shadow-xs">
      {/* Section A: Voyage Ports Setup */}
      <section className="space-y-3">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
          <Navigation className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-sans">Voyage & Port Setup</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">Departure Port</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:border-blue-500 focus:bg-white outline-none cursor-pointer shadow-2xs"
            >
              {renderPortOptions(ports, portsList)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">Destination Port</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:border-blue-500 focus:bg-white outline-none cursor-pointer shadow-2xs"
            >
              {renderPortOptions(ports, portsList, origin)}
            </select>
          </div>
        </div>
      </section>

      {/* Section B: Ship Profile Loader */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <Ship className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-sans">Vessel Selection</h2>
          </div>
          <button
            onClick={() => setShowOverride(!showOverride)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
          >
            {showOverride ? "[Hide Specs]" : "[Override Specs]"}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">Active Ship Profile</label>
            <select
              value={selectedShipId}
              onChange={(e) => setSelectedShipId(e.target.value)}
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:border-blue-500 focus:bg-white outline-none cursor-pointer shadow-2xs"
            >
              {ships.map((ship) => (
                <option key={ship.id} value={ship.id.toString()}>{ship.name} ({ship.imo})</option>
              ))}
            </select>
          </div>

          {selectedShip && showOverride && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold">Displacement (tons)</label>
                  <input
                    type="number"
                    value={selectedShip.displacement}
                    onChange={(e) => handleOverrideChange('displacement', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold">Frontal Area (m²)</label>
                  <input
                    type="number"
                    value={selectedShip.frontal_area}
                    onChange={(e) => handleOverrideChange('frontal_area', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold">Engine Eff (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedShip.engine_efficiency}
                    onChange={(e) => handleOverrideChange('engine_efficiency', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold">SFOC (g/kWh)</label>
                  <input
                    type="number"
                    value={selectedShip.sfoc}
                    onChange={(e) => handleOverrideChange('sfoc', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section C: Multi-Objective Weight Sliders */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
          <Sliders className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-sans">Pareto Priority Weights</h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-medium">
              <span className="text-emerald-700 uppercase font-bold">Safety Priority</span>
              <span className="text-slate-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{safetyWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={safetyWeight}
              onChange={(e) => handleWeightChange('safety', e.target.value)}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-medium">
              <span className="text-blue-700 uppercase font-bold">Fuel efficiency</span>
              <span className="text-slate-800 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">{fuelWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={fuelWeight}
              onChange={(e) => handleWeightChange('fuel', e.target.value)}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-medium">
              <span className="text-rose-700 uppercase font-bold">Speed & Time</span>
              <span className="text-slate-800 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">{timeWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={timeWeight}
              onChange={(e) => handleWeightChange('time', e.target.value)}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
            />
          </div>

          {/* Sum Check Validation UI */}
          <div className="flex justify-between items-center text-xs font-medium border border-slate-200 rounded-xl p-3 bg-slate-50">
            <span className="text-slate-500">Total Sum (Required: 1.0)</span>
            <span className={`font-bold ${isWeightsValid ? 'text-emerald-600' : 'text-rose-600'}`}>
              {weightSum.toFixed(2)}
            </span>
          </div>
          {!isWeightsValid && (
            <p className="text-[11px] text-rose-600 font-medium text-center">
              ⚠️ Weights must sum to exactly 1.00 for valid Pareto extraction.
            </p>
          )}
        </div>
      </section>

      {/* Section D: Actions Hub */}
      <section className="space-y-3 pt-4 border-t border-slate-100 mt-auto">
        <button
          onClick={calculateRoutes}
          disabled={loading || !isWeightsValid}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-sm py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>Calculate Optimal Routes</span>
        </button>

        <button
          onClick={triggerWeatherShiftAndReplan}
          disabled={loading || !routes}
          className="w-full flex items-center justify-center space-x-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-rose-600 font-semibold text-xs py-2 rounded-xl transition cursor-pointer"
        >
          <CloudLightning className="h-3.5 w-3.5" />
          <span>Simulate Weather Shift & Replan</span>
        </button>

        {/* Voyage Simulation Controls */}
        {routes && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPlayingTelemetry(!isPlayingTelemetry)}
              className={`flex-1 flex items-center justify-center space-x-2 font-semibold text-xs py-2 rounded-xl border transition cursor-pointer ${
                isPlayingTelemetry
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {isPlayingTelemetry ? (
                <><Pause className="h-3.5 w-3.5" /><span>Pause Voyage</span></>
              ) : (
                <><Play className="h-3.5 w-3.5" /><span>Start Voyage Sim</span></>
              )}
            </button>
            <button
              onClick={() => { setCurrentVesselIndex(0); setIsPlayingTelemetry(false); }}
              disabled={currentVesselIndex === 0}
              className="flex items-center justify-center p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
              title="Reset voyage to start"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-rose-600 font-medium text-center bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
            Error: {errorMsg}
          </p>
        )}
      </section>

      {/* Section E: Emergency Response Protocol (Step 2 -> triggers Step 3 result panel) */}
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <TriangleAlert className="h-4 w-4 text-rose-600" />
            <h2 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-sans">Emergency Response</h2>
          </div>
          {emergencyType && (
            <button
              onClick={clearEmergency}
              className="flex items-center space-x-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition"
            >
              <X className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {!emergencyGate.enabled && (
          <p className="text-[11px] text-slate-500 font-medium bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            {emergencyGate.reason}
          </p>
        )}

        {routes && (
          <div className="grid grid-cols-2 gap-2">
            {emergencyTypes.map((et) => {
              const Icon = EMERGENCY_ICONS[et.icon] || TriangleAlert;
              const isActive = emergencyType === et.key;
              return (
                <button
                  key={et.key}
                  onClick={() => triggerEmergency(et.key)}
                  disabled={emergencyLoading || !emergencyGate.enabled}
                  className={`flex flex-col items-center justify-center space-y-1 text-center py-2.5 px-2 rounded-xl border text-[11px] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                      : 'bg-rose-50/60 border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  {emergencyLoading && isActive ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-current"></div>
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="leading-tight">{et.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {emergencyError && (
          <p className="text-xs text-rose-600 font-medium text-center bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
            Error: {emergencyError}
          </p>
        )}
      </section>
    </aside>
  );
}
