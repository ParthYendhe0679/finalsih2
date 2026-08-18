import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import VoyageDetailsModal from './VoyageDetailsModal';
import { generateVoyageDossierMarkdown, downloadFile } from '../utils/voyageReportGenerator';
import { Clock, Fuel, ShieldAlert, Award, Download, FileText, CheckCircle2 } from 'lucide-react';

const ROUTE_CARDS = [
  {
    key: 'fastest',
    title: 'Fastest Path',
    iconColor: 'text-rose-500',
    activeBorder: 'border-2 border-rose-500 shadow-md ring-2 ring-rose-500/20',
  },
  {
    key: 'fuel_optimized',
    title: 'Fuel Optimized',
    iconColor: 'text-blue-500',
    activeBorder: 'border-2 border-blue-500 shadow-md ring-2 ring-blue-500/20',
  },
  {
    key: 'safest',
    title: 'Safest Path',
    iconColor: 'text-emerald-500',
    activeBorder: 'border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20',
  },
  {
    key: 'balanced',
    title: 'Balanced Path',
    iconColor: 'text-violet-600',
    activeBorder: 'border-2 border-violet-600 shadow-md ring-2 ring-violet-500/20',
  },
];

export default function ParetoDock() {
  const {
    routes,
    selectedRouteKey,
    setSelectedRouteKey,
    selectedShip,
    origin,
    destination,
    liveEnvironment,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadedKey, setDownloadedKey] = useState(null);

  if (!routes) {
    return (
      <div className="h-24 border-t border-slate-200/80 bg-white flex items-center justify-center text-xs font-medium text-slate-400 font-sans">
        No active routes calculated. Trigger "Calculate Optimal Routes" to view Pareto trade-off comparisons.
      </div>
    );
  }

  const handleQuickDownload = (e, key) => {
    e.stopPropagation();
    const routeData = routes[key];
    if (!routeData) return;
    const fileName = `Voyage_Dossier_${key.toUpperCase()}_${origin}_to_${destination}.txt`;
    const content = generateVoyageDossierMarkdown(
      key,
      routeData,
      selectedShip,
      origin,
      destination,
      liveEnvironment
    );
    downloadFile(content, fileName, 'text/plain;charset=utf-8');

    setDownloadedKey(key);
    setTimeout(() => setDownloadedKey(null), 2500);
  };

  return (
    <>
      <div className="border-t border-slate-200/80 bg-slate-50/50 p-4 space-y-3 select-none font-sans shadow-xs">
        {/* Header with Title & Action buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-0.5">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <Award className="h-4 w-4 text-blue-600" />
            <span>Multi-Objective Route Comparison — Select to Navigate</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer border border-slate-200 shadow-2xs"
              title="View full waypoint schedule, weather conditions, and fuel formulas"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>Full Dossier & Met-Ocean Breakdown</span>
            </button>

            <button
              onClick={(e) => handleQuickDownload(e, selectedRouteKey)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Download selected voyage plan to file"
            >
              {downloadedKey === selectedRouteKey ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Selected Dossier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Clean Cards matching user's layout with download action */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {ROUTE_CARDS.map((card) => {
            const routeData = routes[card.key];
            if (!routeData) return null;

            const isSelected = selectedRouteKey === card.key;
            const isJustDownloaded = downloadedKey === card.key;

            return (
              <div
                key={card.key}
                onClick={() => setSelectedRouteKey(card.key)}
                className={`bg-white rounded-2xl p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between group ${
                  isSelected
                    ? card.activeBorder
                    : 'border border-slate-200/90 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Card Top: Title on Left, Download Button on Right */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="font-bold text-slate-800 text-[13px] tracking-tight">
                      {card.title}
                    </h4>
                    {card.key === 'balanced' && (
                      <span className="text-amber-500 text-xs">⭐</span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleQuickDownload(e, card.key)}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition cursor-pointer text-[10px] font-semibold"
                    title={`Download ${card.title} dossier file`}
                  >
                    {isJustDownloaded ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-700">Saved</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>Download</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Card Bottom: 3 Columns (TIME, FUEL, RISK) with vertical dividers */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 text-center pt-1">
                  {/* Column 1: TIME */}
                  <div className="flex flex-col items-center justify-center px-1">
                    <div className="flex items-center space-x-1 mb-1">
                      <Clock className={`h-3 w-3 ${card.iconColor}`} />
                      <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">TIME</span>
                    </div>
                    <span className="text-xs sm:text-[13px] font-bold text-slate-900">
                      {routeData.total_time}h
                    </span>
                  </div>

                  {/* Column 2: FUEL */}
                  <div className="flex flex-col items-center justify-center px-1">
                    <div className="flex items-center space-x-1 mb-1">
                      <Fuel className={`h-3 w-3 ${card.iconColor}`} />
                      <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">FUEL</span>
                    </div>
                    <span className="text-xs sm:text-[13px] font-bold text-slate-900">
                      {routeData.total_fuel?.toLocaleString()}g
                    </span>
                  </div>

                  {/* Column 3: RISK */}
                  <div className="flex flex-col items-center justify-center px-1">
                    <div className="flex items-center space-x-1 mb-1">
                      <ShieldAlert className={`h-3 w-3 ${card.iconColor}`} />
                      <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">RISK</span>
                    </div>
                    <span className="text-xs sm:text-[13px] font-bold text-slate-900">
                      {routeData.total_risk}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deep Details & Export Modal */}
      <VoyageDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
