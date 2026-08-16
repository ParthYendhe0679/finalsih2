import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Edit3, Save, X, Calendar, Wrench, ShieldAlert } from 'lucide-react';

export default function FleetRegistry() {
  const { ships, fetchShips, setSelectedShipId } = useApp();
  
  const [editingShipId, setEditingShipId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [imo, setImo] = useState('');
  const [displacement, setDisplacement] = useState(60000);
  const [frontalArea, setFrontalArea] = useState(1300);
  const [engineEfficiency, setEngineEfficiency] = useState(0.44);
  const [sfoc, setSfoc] = useState(170);
  const [riskIndex, setRiskIndex] = useState(15.0);
  const [maintenance, setMaintenance] = useState('Next maintenance: 2026-11-20');
  const [replacement, setReplacement] = useState('Oil filter replaced (2026-04-10)');

  // Form submission: Add Ship
  const handleAddShip = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/ships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          imo,
          displacement,
          frontal_area: frontalArea,
          engine_efficiency: engineEfficiency,
          sfoc,
          risk_index: riskIndex,
          maintenance_schedule: maintenance,
          parts_replacement_log: replacement
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        fetchShips();
        // Reset form
        setName(''); setImo(''); setDisplacement(60000); setFrontalArea(1300);
        setEngineEfficiency(0.44); setSfoc(170); setRiskIndex(15.0);
      } else {
        const err = await res.json();
        alert(err.detail || "Error adding ship.");
      }
    } catch (err) {
      console.error("Error creating ship:", err);
    }
  };

  // Form submission: Edit Ship
  const handleEditShip = async (ship) => {
    setEditingShipId(ship.id);
    setName(ship.name);
    setImo(ship.imo);
    setDisplacement(ship.displacement);
    setFrontalArea(ship.frontal_area);
    setEngineEfficiency(ship.engine_efficiency);
    setSfoc(ship.sfoc);
    setRiskIndex(ship.risk_index);
    setMaintenance(ship.maintenance_schedule);
    setReplacement(ship.parts_replacement_log);
  };

  const handleSaveEdit = async (shipId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ships/${shipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          imo,
          displacement,
          frontal_area: frontalArea,
          engine_efficiency: engineEfficiency,
          sfoc,
          risk_index: riskIndex,
          maintenance_schedule: maintenance,
          parts_replacement_log: replacement
        })
      });
      if (res.ok) {
        setEditingShipId(null);
        fetchShips();
      } else {
        const err = await res.json();
        alert(err.detail || "Error saving edits.");
      }
    } catch (err) {
      console.error("Error editing ship:", err);
    }
  };

  // Delete Ship
  const handleDeleteShip = async (shipId) => {
    if (!window.confirm("Are you sure you want to decommission this ship profile from Aegir Registry?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ships/${shipId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchShips();
      }
    } catch (err) {
      console.error("Error deleting ship:", err);
    }
  };

  // Circular progress stroke calculation
  const renderCircularBarometer = (val) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(100, Math.max(0, val)) / 100) * circumference;
    
    let color = "stroke-brand-safety";
    if (val > 50) color = "stroke-brand-time";
    else if (val > 25) color = "stroke-orange-400";

    return (
      <div className="relative flex items-center justify-center h-12 w-12 shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} className="stroke-brand-border fill-transparent" strokeWidth="3" />
          <circle cx="24" cy="24" r={radius} className={`${color} fill-transparent transition-all duration-500`} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[9px] font-mono font-bold text-gray-200">{Math.round(val)}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Vessel Registry Database</h3>
          <p className="text-xs text-gray-400">Configure hull geometries and power constants for exact routing computations.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1.5 bg-brand-glow/10 hover:bg-brand-glow/20 border border-brand-glow/30 hover:border-brand-glow text-brand-glow text-xs py-1.5 px-3 rounded transition font-mono"
        >
          {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span>{showAddForm ? "Cancel Registration" : "Register Vessel"}</span>
        </button>
      </div>

      {/* Add Ship Form */}
      {showAddForm && (
        <form onSubmit={handleAddShip} className="bg-brand-card border border-brand-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Vessel Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">IMO Number</label>
              <input type="text" value={imo} onChange={(e) => setImo(e.target.value)} required placeholder="IMOXXXXXXX" className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Disp. (Tons)</label>
                <input type="number" value={displacement} onChange={(e) => setDisplacement(parseFloat(e.target.value))} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Frontal (m²)</label>
                <input type="number" value={frontalArea} onChange={(e) => setFrontalArea(parseFloat(e.target.value))} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Engine Eff.</label>
                <input type="number" step="0.01" value={engineEfficiency} onChange={(e) => setEngineEfficiency(parseFloat(e.target.value))} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">SFOC (g/kWh)</label>
                <input type="number" value={sfoc} onChange={(e) => setSfoc(parseFloat(e.target.value))} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
              </div>
            </div>
          </div>
          <div className="space-y-3 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Risk Rating (0-100)</label>
                <input type="number" value={riskIndex} onChange={(e) => setRiskIndex(parseFloat(e.target.value))} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Maintenance Date</label>
                <input type="text" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} required className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white outline-none" />
              </div>
            </div>
            <button type="submit" className="w-full bg-brand-glow text-brand-bg font-bold font-mono py-2 rounded border border-brand-glow hover:bg-transparent hover:text-brand-glow transition">
              SAVE REGISTRY ENTRY
            </button>
          </div>
        </form>
      )}

      {/* Ship Registry Table & Cards */}
      <div className="space-y-4">
        {ships.map((ship) => (
          <div key={ship.id} className="bg-brand-card/40 border border-brand-border rounded-lg p-4 flex flex-col lg:flex-row items-center justify-between gap-6 hover:border-brand-border/100 transition">
            
            {/* Circular Gauge and Name */}
            <div className="flex items-center space-x-4 w-full lg:w-1/4">
              {renderCircularBarometer(ship.risk_index)}
              <div>
                <h4 className="text-sm font-bold text-white tracking-wide">{ship.name}</h4>
                <p className="text-[10px] text-gray-400 font-mono">{ship.imo}</p>
                <div className="flex items-center space-x-1.5 text-[9px] text-red-400 mt-1 font-mono">
                  <ShieldAlert className="h-3 w-3 shrink-0" />
                  <span>Hull Risk: {ship.risk_index > 50 ? "High" : ship.risk_index > 25 ? "Caution" : "Nominal"}</span>
                </div>
              </div>
            </div>

            {/* Vessel Specifications parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-1/2 text-xs font-mono text-gray-300">
              {editingShipId === ship.id ? (
                <>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Displacement</span>
                    <input type="number" value={displacement} onChange={(e) => setDisplacement(parseFloat(e.target.value))} className="w-full bg-brand-bg border border-brand-border rounded px-1.5 py-0.5 text-white" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Frontal Area</span>
                    <input type="number" value={frontalArea} onChange={(e) => setFrontalArea(parseFloat(e.target.value))} className="w-full bg-brand-bg border border-brand-border rounded px-1.5 py-0.5 text-white" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Engine Eff.</span>
                    <input type="number" step="0.01" value={engineEfficiency} onChange={(e) => setEngineEfficiency(parseFloat(e.target.value))} className="w-full bg-brand-bg border border-brand-border rounded px-1.5 py-0.5 text-white" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">SFOC</span>
                    <input type="number" value={sfoc} onChange={(e) => setSfoc(parseFloat(e.target.value))} className="w-full bg-brand-bg border border-brand-border rounded px-1.5 py-0.5 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Displacement</span>
                    <span className="font-bold text-gray-200">{ship.displacement.toLocaleString()} Tons</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Frontal Area</span>
                    <span className="font-bold text-gray-200">{ship.frontal_area.toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Engine Eff.</span>
                    <span className="font-bold text-gray-200">{(ship.engine_efficiency * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">SFOC Engine</span>
                    <span className="font-bold text-gray-200">{ship.sfoc} g/kWh</span>
                  </div>
                </>
              )}
            </div>

            {/* Health Logs & Maintenance */}
            <div className="flex flex-col space-y-1.5 w-full lg:w-1/5 text-[10px] font-mono text-gray-400 border-t lg:border-t-0 lg:border-l border-brand-border/60 pt-3 lg:pt-0 lg:pl-4">
              {editingShipId === ship.id ? (
                <>
                  <input type="text" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} className="bg-brand-bg border border-brand-border rounded px-1 py-0.5 text-white mb-1" />
                  <input type="text" value={replacement} onChange={(e) => setReplacement(e.target.value)} className="bg-brand-bg border border-brand-border rounded px-1 py-0.5 text-white" />
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="h-3.5 w-3.5 text-brand-glow shrink-0" />
                    <span>{ship.maintenance_schedule}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Wrench className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                    <span>{ship.parts_replacement_log}</span>
                  </div>
                </>
              )}
            </div>

            {/* CRUD Actions */}
            <div className="flex items-center space-x-2">
              {editingShipId === ship.id ? (
                <>
                  <button onClick={() => handleSaveEdit(ship.id)} className="p-1.5 bg-brand-safety/10 hover:bg-brand-safety/20 border border-brand-safety/30 text-brand-safety rounded transition">
                    <Save className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingShipId(null)} className="p-1.5 bg-brand-border hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleEditShip(ship)} className="p-1.5 bg-brand-border hover:bg-brand-glow/20 border border-brand-border hover:border-brand-glow/40 text-gray-300 hover:text-brand-glow rounded transition">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteShip(ship.id)} className="p-1.5 bg-brand-border hover:bg-red-500/25 border border-brand-border hover:border-red-500/40 text-gray-400 hover:text-red-400 rounded transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
