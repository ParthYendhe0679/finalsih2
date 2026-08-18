import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import ParetoDock from './components/ParetoDock';
import EmergencyDock from './components/EmergencyDock';
import FleetRegistry from './components/FleetRegistry';
import VoyageAnalytics from './components/VoyageAnalytics';
import LandingPage from './landing/LandingPage';
import { LayoutDashboard, Shield, Fuel, Clock, BarChart3, Database, Wallet, TrendingUp } from 'lucide-react';

function DashboardContent({ onBackToLanding }) {
  const { routes, ships } = useApp();
  const [activeDashboard, setActiveDashboard] = useState('command'); // 'command' or 'fleet'
  const [fleetSubTab, setFleetSubTab] = useState('registry'); // 'registry' or 'analytics'

  // Calculate aggregate metrics for KPIs
  const totalBunkerFuel = routes 
    ? Math.round(routes.balanced.total_fuel * 2.8) 
    : 84200; // placeholder if not calculated
  const co2Emissions = (totalBunkerFuel * 0.0102).toFixed(1); // 10.2kg CO2 per gallon diesel

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F7F9FC] text-slate-800 font-sans">
      {/* Persistent Top Header Navbar with Back to Landing */}
      <Navbar onBackToLanding={onBackToLanding} />

      {/* Main Tabbed Interface Navigation */}
      <div className="bg-white border-b border-slate-200/80 px-6 flex items-center justify-between py-2.5 shrink-0 shadow-xs">
        <div className="flex space-x-3">
          <button
            onClick={() => setActiveDashboard('command')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
              activeDashboard === 'command'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-transparent'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>01. Operational Command Room</span>
          </button>

          <button
            onClick={() => setActiveDashboard('fleet')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
              activeDashboard === 'fleet'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-transparent'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>02. Fleet Control & Analytics</span>
          </button>
        </div>
        
        <div className="text-xs text-slate-400 font-medium hidden sm:block">
          SAGAR SETU SECURE SERVER <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1"></span> ONLINE
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

          {/* Emergency Optimal Route Result (Step 3) */}
          <EmergencyDock />
        </div>
      )}

      {/* Dashboard 2: Fleet Management & Voyage Analytics */}
      {activeDashboard === 'fleet' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top Summary KPI Cards - Styled strictly matching the reference image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Active Fleet Voyages */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-4 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Wallet className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-400">Active Fleet Voyages</span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{ships.length} Voyages</span>
              </div>
            </div>

            {/* Card 2: Total Bunker Consumed */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-4 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Fuel className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-400">Total Bunker Consumed</span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalBunkerFuel.toLocaleString()} Gal</span>
              </div>
            </div>

            {/* Card 3: Fleet Safety Index */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-4 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Shield className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-400">Fleet Safety Index</span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">92.4%</span>
              </div>
            </div>

            {/* Card 4: Cumulative CO2 Offset */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-4 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-400">Cumulative CO2 Offset</span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{co2Emissions} Tons</span>
              </div>
            </div>

          </div>

          {/* Sub-tab Navigator Container */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex border-b border-slate-100 pb-3 space-x-6">
              <button
                onClick={() => setFleetSubTab('registry')}
                className={`text-xs font-semibold uppercase tracking-wider pb-2 cursor-pointer transition ${
                  fleetSubTab === 'registry' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-bold' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Fleet Registry Manager
              </button>
              <button
                onClick={() => setFleetSubTab('analytics')}
                className={`text-xs font-semibold uppercase tracking-wider pb-2 cursor-pointer transition ${
                  fleetSubTab === 'analytics' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-bold' 
                    : 'text-slate-400 hover:text-slate-600'
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
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#dashboard') {
      return 'dashboard';
    }
    return 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#dashboard') {
        setCurrentView('dashboard');
      } else if (!window.location.hash || window.location.hash === '#top' || window.location.hash.startsWith('#intelligence') || window.location.hash.startsWith('#approach') || window.location.hash.startsWith('#routes') || window.location.hash.startsWith('#adaptive')) {
        setCurrentView('landing');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLaunchDashboard = () => {
    setCurrentView('dashboard');
    window.location.hash = '#dashboard';
    window.scrollTo(0, 0);
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '';
    window.scrollTo(0, 0);
  };

  return (
    <AppProvider>
      {currentView === 'landing' ? (
        <LandingPage onLaunchDashboard={handleLaunchDashboard} />
      ) : (
        <DashboardContent onBackToLanding={handleBackToLanding} />
      )}
    </AppProvider>
  );
}

