import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Edit3, Save, X, Calendar, Wrench, ShieldAlert, Anchor, Compass } from 'lucide-react';

export default function FleetRegistry() {
  const { ships, fetchShips, setSelectedShipId } = useApp();
  
  const [editingShipId, setEditingShipId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [imo, setImo] = useState('');
  const [vesselType, setVesselType] = useState('Container Carrier');
  const [length, setLength] = useState(300);
  const [beam, setBeam] = useState(45);
  const [draft, setDraft] = useState(14);
  const [dwt, setDwt] = useState(80000);
  const [displacement, setDisplacement] = useState(95000);
  const [frontalArea, setFrontalArea] = useState(1400);
  const [engineEfficiency, setEngineEfficiency] = useState(0.46);
  const [sfoc, setSfoc] = useState(165);
  const [riskIndex, setRiskIndex] = useState(10.0);
  const [maintenance, setMaintenance] = useState('Next drydock: 2027-01-15');
  const [replacement, setReplacement] = useState('Main engine injector overhaul (2026-06-10)');

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
          vessel_type: vesselType,
          length: parseFloat(length),
          beam: parseFloat(beam),
          draft: parseFloat(draft),
          dwt: parseFloat(dwt),
          displacement: parseFloat(displacement),
          frontal_area: parseFloat(frontalArea),
          engine_efficiency: parseFloat(engineEfficiency),
          sfoc: parseFloat(sfoc),
          risk_index: parseFloat(riskIndex),
          maintenance_schedule: maintenance,
          parts_replacement_log: replacement
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        fetchShips();
        // Reset form
        setName(''); setImo(''); setVesselType('Container Carrier');
        setLength(300); setBeam(45); setDraft(14); setDwt(80000);
        setDisplacement(95000); setFrontalArea(1400);
        setEngineEfficiency(0.46); setSfoc(165); setRiskIndex(10.0);
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
    setVesselType(ship.vessel_type || 'Container Carrier');
    setLength(ship.length ?? 300);
    setBeam(ship.beam ?? 45);
    setDraft(ship.draft ?? 14);
    setDwt(ship.dwt ?? 80000);
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
          vessel_type: vesselType,
          length: parseFloat(length),
          beam: parseFloat(beam),
          draft: parseFloat(draft),
          dwt: parseFloat(dwt),
          displacement: parseFloat(displacement),
          frontal_area: parseFloat(frontalArea),
          engine_efficiency: parseFloat(engineEfficiency),
          sfoc: parseFloat(sfoc),
          risk_index: parseFloat(riskIndex),
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
    if (!window.confirm("Are you sure you want to decommission this ship profile from Sagar Setu Registry?")) return;
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
    
    let color = "stroke-emerald-500";
    if (val > 50) color = "stroke-rose-500";
    else if (val > 25) color = "stroke-amber-500";

    return (
      <div className="relative flex items-center justify-center h-12 w-12 shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} className="stroke-slate-200 fill-transparent" strokeWidth="3" />
          <circle cx="24" cy="24" r={radius} className={`${color} fill-transparent transition-all duration-500`} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[10px] font-sans font-bold text-slate-800">{Math.round(val)}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Commercial Vessel Registry Database</h3>
          <p className="text-xs text-slate-400 font-medium">Authentic carrier hull geometries, displacement ratings, and hydrodynamic parameters for exact routing computations.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 text-xs py-2 px-3.5 rounded-xl transition font-semibold shadow-2xs"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showAddForm ? "Cancel Registration" : "Register Carrier"}</span>
        </button>
      </div>

      {/* Add Ship Form */}
      {showAddForm && (
        <form onSubmit={handleAddShip} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-xs">
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Vessel Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. MV Ever Given" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">IMO Number</label>
              <input type="text" value={imo} onChange={(e) => setImo(e.target.value)} required placeholder="IMOXXXXXXX" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Vessel Type</label>
              <input type="text" value={vesselType} onChange={(e) => setVesselType(e.target.value)} required placeholder="e.g. Ultra Large Container Vessel" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Length LOA (m)</label>
                <input type="number" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Beam (m)</label>
                <input type="number" step="0.1" value={beam} onChange={(e) => setBeam(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Draft (m)</label>
                <input type="number" step="0.1" value={draft} onChange={(e) => setDraft(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">DWT (MT)</label>
                <input type="number" value={dwt} onChange={(e) => setDwt(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Disp. (MT)</label>
                <input type="number" value={displacement} onChange={(e) => setDisplacement(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Frontal (m²)</label>
                <input type="number" value={frontalArea} onChange={(e) => setFrontalArea(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Engine Eff.</label>
                <input type="number" step="0.01" value={engineEfficiency} onChange={(e) => setEngineEfficiency(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">SFOC (g/kWh)</label>
                <input type="number" value={sfoc} onChange={(e) => setSfoc(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Hull Risk Rating (0-100)</label>
                <input type="number" value={riskIndex} onChange={(e) => setRiskIndex(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Maintenance Date</label>
                <input type="text" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl border border-blue-600 hover:bg-blue-700 transition shadow-2xs">
              SAVE REGISTRY ENTRY
            </button>
          </div>
        </form>
      )}

      {/* Ship Registry Table & Cards */}
      <div className="space-y-4">
        {ships.map((ship) => (
          <div key={ship.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-6 hover:shadow-md transition shadow-xs">
            
            {/* Circular Gauge and Name */}
            <div className="flex items-center space-x-4 w-full lg:w-1/3">
              {renderCircularBarometer(ship.risk_index)}
              <div>
                <h4 className="text-sm font-bold text-slate-900 tracking-tight">{ship.name}</h4>
                <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
                  <span>{ship.imo}</span>
                  <span>•</span>
                  <span className="text-blue-600 font-semibold">{ship.vessel_type || 'Commercial Carrier'}</span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mt-1">
                  <span>LOA: {ship.length ?? 300}m</span>
                  <span>Beam: {ship.beam ?? 45}m</span>
                  <span>Draft: {ship.draft ?? 14}m</span>
                  <span>DWT: {(ship.dwt ?? 80000).toLocaleString()} MT</span>
                </div>
              </div>
            </div>

            {/* Vessel Specifications parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-5/12 text-xs text-slate-700">
              {editingShipId === ship.id ? (
                <>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Displacement</span>
                    <input type="number" value={displacement} onChange={(e) => setDisplacement(parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Frontal Area</span>
                    <input type="number" value={frontalArea} onChange={(e) => setFrontalArea(parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Engine Eff.</span>
                    <input type="number" step="0.01" value={engineEfficiency} onChange={(e) => setEngineEfficiency(parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">SFOC</span>
                    <input type="number" value={sfoc} onChange={(e) => setSfoc(parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-medium">Displacement</span>
                    <span className="font-bold text-slate-800">{ship.displacement.toLocaleString()} Tons</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-medium">Frontal Area</span>
                    <span className="font-bold text-slate-800">{ship.frontal_area.toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-medium">Engine Eff.</span>
                    <span className="font-bold text-slate-800">{(ship.engine_efficiency * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-medium">SFOC Engine</span>
                    <span className="font-bold text-slate-800">{ship.sfoc} g/kWh</span>
                  </div>
                </>
              )}
            </div>

            {/* Health Logs & Maintenance */}
            <div className="flex flex-col space-y-1.5 w-full lg:w-1/5 text-xs text-slate-500 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-4">
              {editingShipId === ship.id ? (
                <>
                  <input type="text" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 mb-1" />
                  <input type="text" value={replacement} onChange={(e) => setReplacement(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800" />
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{ship.maintenance_schedule}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Wrench className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">{ship.parts_replacement_log}</span>
                  </div>
                </>
              )}
            </div>

            {/* CRUD Actions */}
            <div className="flex items-center space-x-2">
              {editingShipId === ship.id ? (
                <>
                  <button onClick={() => handleSaveEdit(ship.id)} className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl transition cursor-pointer">
                    <Save className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingShipId(null)} className="p-2 bg-slate-100 hover:bg-rose-50 border border-slate-200 text-slate-600 hover:text-rose-600 rounded-xl transition cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleEditShip(ship)} className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-600 rounded-xl transition cursor-pointer">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteShip(ship.id)} className="p-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 rounded-xl transition cursor-pointer">
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
