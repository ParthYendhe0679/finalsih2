import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import ParetoDock from './components/ParetoDock';
import FleetRegistry from './components/FleetRegistry';
import VoyageAnalytics from './components/VoyageAnalytics';
import { LayoutDashboard, Shield, Fuel, Clock, BarChart3, Database } from 'lucide-react';

function DashboardContent() {
  const { routes, ships } = useApp();
  const [activeDashboard, setActiveDashboard] = useState('command'); // 'command' or 'fleet'
  const [fleetSubTab, setFleetSubTab] = useState('registry'); // 'registry' or 'analytics'

  // Calculate some aggregate metrics for KPIs
  const totalBunkerFuel = routes 
    ? Math.round(routes.balanced.total_fuel * 2.8) 
    : 84200; // placeholder if not calculated
  const co2Emissions = (totalBunkerFuel * 0.0102).toFixed(1); // 10.2kg CO2 per gallon diesel

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-brand-bg text-gray-100 scanline">
      {/* Persistant Top Header Navbar */}
      <Navbar />

      {/* Main Tabbed Interface Navigation */}
      <div className="bg-brand-card/30 border-b border-brand-border px-6 flex items-center justify-between py-2 shrink-0">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveDashboard('command')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold tracking-wider uppercase border rounded-md transition cursor-pointer ${
              activeDashboard === 'command'
                ? 'bg-brand-glow/15 border-brand-glow text-brand-glow shadow-glow'
                : 'border-brand-border hover:border-brand-border/100 hover:text-white text-gray-400 bg-transparent'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>01. Operational Command Room</span>
          </button>

          <button
            onClick={() => setActiveDashboard('fleet')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold tracking-wider uppercase border rounded-md transition cursor-pointer ${
              activeDashboard === 'fleet'
                ? 'bg-brand-glow/15 border-brand-glow text-brand-glow shadow-glow'
                : 'border-brand-border hover:border-brand-border/100 hover:text-white text-gray-400 bg-transparent'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>02. Fleet Control & Analytics</span>
          </button>
        </div>
        
        <div className="text-[10px] text-gray-500 font-mono hidden sm:block">
          AEGIR MARITIME SECURE SERVER // ONLINE
        </div>
      </div>

      {/* Dashboard 1: Operational Command & Map Routing */}
      {activeDashboard === 'command' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Control Sidebar */}
            <Sidebar />

            {/* Map Canvas */}
            <MapComponent />
          </div>

          {/* Persistent Bottom Pareto Dock */}
          <ParetoDock />
        </div>
      )}

      {/* Dashboard 2: Fleet Management & Voyage Analytics */}
      {activeDashboard === 'fleet' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top Header / KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4 flex items-center space-x-4">
              <div className="p-3 bg-brand-glow/10 rounded-lg border border-brand-glow/20">
                <Database className="h-6 w-6 text-brand-glow" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Active Fleet Voyages</span>
                <span className="text-xl font-bold text-white font-mono">{ships.length} Voyages</span>
              </div>
            </div>

            <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4 flex items-center space-x-4">
              <div className="p-3 bg-brand-fuel/10 rounded-lg border border-brand-fuel/20">
                <Fuel className="h-6 w-6 text-brand-fuel" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Total Bunker Consumed</span>
                <span className="text-xl font-bold text-white font-mono">{totalBunkerFuel.toLocaleString()} Gal</span>
              </div>
            </div>

            <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4 flex items-center space-x-4">
              <div className="p-3 bg-brand-safety/10 rounded-lg border border-brand-safety/20">
                <Shield className="h-6 w-6 text-brand-safety" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Fleet Safety Index</span>
                <span className="text-xl font-bold text-white font-mono">92.4%</span>
              </div>
            </div>

            <div className="bg-brand-card/50 border border-brand-border rounded-lg p-4 flex items-center space-x-4">
              <div className="p-3 bg-brand-time/10 rounded-lg border border-brand-time/20">
                <Clock className="h-6 w-6 text-brand-time" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Cumulative CO2 Offset</span>
                <span className="text-xl font-bold text-white font-mono">{co2Emissions} Tons</span>
              </div>
            </div>

          </div>

          {/* Sub-tab Navigator */}
          <div className="bg-brand-card border border-brand-border rounded-lg p-6 space-y-6">
            <div className="flex border-b border-brand-border/60 pb-3 space-x-4">
              <button
                onClick={() => setFleetSubTab('registry')}
                className={`text-xs font-mono font-bold uppercase tracking-wider pb-1 cursor-pointer transition ${
                  fleetSubTab === 'registry' 
                    ? 'text-brand-glow border-b-2 border-brand-glow' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Fleet Registry Manager
              </button>
              <button
                onClick={() => setFleetSubTab('analytics')}
                className={`text-xs font-mono font-bold uppercase tracking-wider pb-1 cursor-pointer transition ${
                  fleetSubTab === 'analytics' 
                    ? 'text-brand-glow border-b-2 border-brand-glow' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Voyage & Weather Analytics
              </button>
            </div>

            {/* Render Fleet sub-dashboard view */}
            {fleetSubTab === 'registry' ? <FleetRegistry /> : <VoyageAnalytics />}
          </div>

        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
}
