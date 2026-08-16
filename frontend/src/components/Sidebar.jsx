import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sliders, Anchor, Ship, Navigation, Play, CloudLightning } from 'lucide-react';

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
    routes
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
    <aside className="w-full lg:w-[30%] bg-brand-card/90 border-r border-brand-border flex flex-col overflow-y-auto p-5 space-y-6 select-none shrink-0">
      {/* Section A: Voyage Ports Setup */}
      <section className="space-y-3">
        <div className="flex items-center space-x-2 border-b border-brand-border/40 pb-2">
          <Navigation className="h-4 w-4 text-brand-glow" />
          <h2 className="text-sm font-semibold tracking-wider text-white uppercase">Voyage & Port Setup</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase font-mono text-gray-400 mb-1">Departure Port</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-brand-bg text-sm text-gray-200 border border-brand-border rounded px-2.5 py-1.5 focus:border-brand-glow outline-none cursor-pointer"
            >
              {portsList.map((port) => (
                <option key={port} value={port}>{port}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-mono text-gray-400 mb-1">Destination Port</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-brand-bg text-sm text-gray-200 border border-brand-border rounded px-2.5 py-1.5 focus:border-brand-glow outline-none cursor-pointer"
            >
              {portsList.map((port) => (
                <option key={port} value={port} disabled={port === origin}>{port}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section B: Ship Profile Loader */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-brand-border/40 pb-2">
          <div className="flex items-center space-x-2">
            <Ship className="h-4 w-4 text-brand-glow" />
            <h2 className="text-sm font-semibold tracking-wider text-white uppercase">Vessel Selection</h2>
          </div>
          <button
            onClick={() => setShowOverride(!showOverride)}
            className="text-[10px] font-mono text-brand-glow hover:underline hover:text-blue-300"
          >
            {showOverride ? "[Hide Specs]" : "[Override Specs]"}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase font-mono text-gray-400 mb-1">Active Ship Profile</label>
            <select
              value={selectedShipId}
              onChange={(e) => setSelectedShipId(e.target.value)}
              className="w-full bg-brand-bg text-sm text-gray-200 border border-brand-border rounded px-2.5 py-1.5 focus:border-brand-glow outline-none cursor-pointer"
            >
              {ships.map((ship) => (
                <option key={ship.id} value={ship.id.toString()}>{ship.name} ({ship.imo})</option>
              ))}
            </select>
          </div>

          {selectedShip && showOverride && (
            <div className="bg-brand-bg/50 border border-brand-border/80 rounded p-3 space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase">Displacement (tons)</label>
                  <input
                    type="number"
                    value={selectedShip.displacement}
                    onChange={(e) => handleOverrideChange('displacement', e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded px-2 py-1 text-gray-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase">Frontal Area (m²)</label>
                  <input
                    type="number"
                    value={selectedShip.frontal_area}
                    onChange={(e) => handleOverrideChange('frontal_area', e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded px-2 py-1 text-gray-200 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase">Engine Eff (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedShip.engine_efficiency}
                    onChange={(e) => handleOverrideChange('engine_efficiency', e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded px-2 py-1 text-gray-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase">SFOC (g/kWh)</label>
                  <input
                    type="number"
                    value={selectedShip.sfoc}
                    onChange={(e) => handleOverrideChange('sfoc', e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded px-2 py-1 text-gray-200 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section C: Multi-Objective Weight Sliders */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-brand-border/40 pb-2">
          <Sliders className="h-4 w-4 text-brand-glow" />
          <h2 className="text-sm font-semibold tracking-wider text-white uppercase">Pareto Priority Weights</h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-mono">
              <span className="text-brand-safety uppercase">Safety Priority</span>
              <span className="text-gray-300 font-bold">{safetyWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={safetyWeight}
              onChange={(e) => handleWeightChange('safety', e.target.value)}
              className="w-full h-1 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-brand-safety"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-mono">
              <span className="text-brand-fuel uppercase">Fuel efficiency</span>
              <span className="text-gray-300 font-bold">{fuelWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={fuelWeight}
              onChange={(e) => handleWeightChange('fuel', e.target.value)}
              className="w-full h-1 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-brand-fuel"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-mono">
              <span className="text-brand-time uppercase">Speed & Time</span>
              <span className="text-gray-300 font-bold">{timeWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={timeWeight}
              onChange={(e) => handleWeightChange('time', e.target.value)}
              className="w-full h-1 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-brand-time"
            />
          </div>

          {/* Sum Check Validation UI */}
          <div className="flex justify-between items-center text-xs font-mono border border-brand-border rounded p-2.5 bg-brand-bg/30">
            <span className="text-gray-400">Total Sum (Required: 1.0)</span>
            <span className={`font-bold ${isWeightsValid ? 'text-brand-safety' : 'text-brand-time'}`}>
              {weightSum.toFixed(2)}
            </span>
          </div>
          {!isWeightsValid && (
            <p className="text-[10px] text-brand-time font-mono text-center">
              ⚠️ Weights must sum to exactly 1.00 for valid Pareto extraction.
            </p>
          )}
        </div>
      </section>

      {/* Section D: Actions Hub */}
      <section className="space-y-3 pt-4 border-t border-brand-border/40 mt-auto">
        <button
          onClick={calculateRoutes}
          disabled={loading || !isWeightsValid}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-brand-fuel hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-800 text-white font-semibold text-sm py-2.5 rounded shadow-glow hover:shadow-glow-blue transition cursor-pointer"
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
          className="w-full flex items-center justify-center space-x-2 bg-brand-bg border border-red-500/40 hover:bg-red-950/20 disabled:border-gray-800 disabled:hover:bg-transparent text-red-400 font-semibold text-xs py-2 rounded transition cursor-pointer"
        >
          <CloudLightning className="h-3.5 w-3.5" />
          <span>[Simulate Weather Shift & Replan]</span>
        </button>

        {errorMsg && (
          <p className="text-xs text-brand-time font-mono text-center bg-red-950/20 border border-red-500/30 p-2 rounded">
            Error: {errorMsg}
          </p>
        )}
      </section>
    </aside>
  );
}
