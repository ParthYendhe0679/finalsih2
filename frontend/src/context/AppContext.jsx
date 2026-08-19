import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { haversineNm, PORT_ZONE_NM } from '../utils/geo';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [ships, setShips] = useState([]);
  const [selectedShipId, setSelectedShipId] = useState('');
  const [selectedShip, setSelectedShip] = useState(null);
  
  const [origin, setOrigin] = useState('JNPT');
  const [destination, setDestination] = useState('Colombo');
  
  const [safetyWeight, setSafetyWeight] = useState(0.34);
  const [fuelWeight, setFuelWeight] = useState(0.33);
  const [timeWeight, setTimeWeight] = useState(0.33);
  
  const [routes, setRoutes] = useState(null);
  const [selectedRouteKey, setSelectedRouteKey] = useState('balanced');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [weatherShift, setWeatherShift] = useState(false);
  const [stormPosition, setStormPosition] = useState({ lat: 8.5, lon: 70.0, radius: 450 }); // in km

  // Drag-to-reroute state
  const [isRerouting, setIsRerouting] = useState(false);
  const [hasRerouted, setHasRerouted] = useState(false); // relabels the start marker
  // Bumped only when a brand new voyage is plotted, so the map does not re-fit
  // its bounds (and snap-zoom) every time the operator drags the vessel.
  const [fitToken, setFitToken] = useState(0);

  // Mid-Voyage Telemetry simulation state
  const [currentVesselIndex, setCurrentVesselIndex] = useState(0);
  const [isPlayingTelemetry, setIsPlayingTelemetry] = useState(false);
  
  // Weather layer raster data for Map visualization
  const [weatherLayers, setWeatherLayers] = useState(null);

  // Port registry, served by the backend so the coordinates live in one place
  // and cannot drift out of step with the router's. The fallback keeps the
  // selectors usable if the API is unreachable.
  const [ports, setPorts] = useState([]);
  const portsList = ports.length
    ? ports.map((p) => p.key)
    : ["JNPT", "Colombo", "Singapore", "Aden", "Port Louis"];

  const portByKey = useMemo(() => {
    const m = {};
    ports.forEach((p) => { m[p.key] = p; });
    return m;
  }, [ports]);

  // --- Emergency Rerouting (Step 2/3: select scenario -> optimal route from live position) ---
  const emergencyTypes = [
    { key: 'cyclone', label: 'Cyclone / Severe Weather', icon: 'CloudLightning' },
    { key: 'piracy', label: 'Piracy / Man-Made Threat', icon: 'ShieldAlert' },
    { key: 'medical', label: 'Medical Emergency', icon: 'HeartPulse' },
    { key: 'mechanical', label: 'Mechanical Failure', icon: 'Wrench' },
  ];
  const [emergencyType, setEmergencyType] = useState(null);
  const [emergencyRoute, setEmergencyRoute] = useState(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState(null);

  // Open-Meteo Live Environmental Telemetry State
  const [liveEnvironment, setLiveEnvironment] = useState(null);
  const [envSyncing, setEnvSyncing] = useState(false);

  // Fetch the port registry
  const fetchPorts = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/ports');
      if (res.ok) setPorts(await res.json());
    } catch (err) {
      console.error("Error fetching port registry:", err);
    }
  };

  // Fetch ships registry on load
  const fetchShips = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/ships');
      if (res.ok) {
        const data = await res.json();
        setShips(data);
        if (data.length > 0) {
          // Set first ship as default
          setSelectedShipId(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error("Error fetching ships registry:", err);
    }
  };

  // Fetch weather and marine layers
  const fetchWeatherLayers = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/weather/layers');
      if (res.ok) {
        const data = await res.json();
        setWeatherLayers(data);
      }
    } catch (err) {
      console.error("Error fetching weather layers:", err);
    }
  };

  // Fetch Open-Meteo live point environment
  const fetchEnvironment = async (lat, lon, port) => {
    try {
      let url = 'http://127.0.0.1:8000/api/environment';
      if (lat !== undefined && lon !== undefined) {
        url += `?lat=${lat}&lon=${lon}`;
      } else if (port) {
        url += `?port=${encodeURIComponent(port)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLiveEnvironment(data);
      }
    } catch (err) {
      console.error("Error fetching Open-Meteo environment:", err);
    }
  };

  // Trigger basin-wide Open-Meteo grid synchronization
  const syncOpenMeteo = async () => {
    setEnvSyncing(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/environment/sync', { method: 'POST' });
      if (res.ok) {
        const syncData = await res.json();
        await fetchWeatherLayers();
        await fetchEnvironment(undefined, undefined, origin);
        return syncData;
      }
    } catch (err) {
      console.error("Error synchronizing with Open-Meteo:", err);
    } finally {
      setEnvSyncing(false);
    }
  };

  useEffect(() => {
    fetchShips();
    fetchPorts();
    fetchWeatherLayers();
    fetchEnvironment(undefined, undefined, 'JNPT');
  }, []);

  // Update selected ship details when list or selectedShipId changes
  useEffect(() => {
    if (selectedShipId && ships.length > 0) {
      const ship = ships.find(s => s.id.toString() === selectedShipId);
      if (ship) setSelectedShip(ship);
    }
  }, [selectedShipId, ships]);

  // Adjust weights to ensure they sum to exactly 1.0
  const handleWeightChange = (type, val) => {
    const numericVal = parseFloat(val);
    if (type === 'safety') {
      setSafetyWeight(numericVal);
      // Adjust other weights proportionally
      const remain = 1.0 - numericVal;
      const totalOther = fuelWeight + timeWeight;
      if (totalOther > 0) {
        setFuelWeight(parseFloat(((fuelWeight / totalOther) * remain).toFixed(2)));
        setTimeWeight(parseFloat((remain - ((fuelWeight / totalOther) * remain)).toFixed(2)));
      } else {
        setFuelWeight(parseFloat((remain / 2).toFixed(2)));
        setTimeWeight(parseFloat((remain / 2).toFixed(2)));
      }
    } else if (type === 'fuel') {
      setFuelWeight(numericVal);
      const remain = 1.0 - numericVal;
      const totalOther = safetyWeight + timeWeight;
      if (totalOther > 0) {
        setSafetyWeight(parseFloat(((safetyWeight / totalOther) * remain).toFixed(2)));
        setTimeWeight(parseFloat((remain - ((safetyWeight / totalOther) * remain)).toFixed(2)));
      } else {
        setSafetyWeight(parseFloat((remain / 2).toFixed(2)));
        setTimeWeight(parseFloat((remain / 2).toFixed(2)));
      }
    } else if (type === 'time') {
      setTimeWeight(numericVal);
      const remain = 1.0 - numericVal;
      const totalOther = safetyWeight + fuelWeight;
      if (totalOther > 0) {
        setSafetyWeight(parseFloat(((safetyWeight / totalOther) * remain).toFixed(2)));
        setFuelWeight(parseFloat((remain - ((safetyWeight / totalOther) * remain)).toFixed(2)));
      } else {
        setSafetyWeight(parseFloat((remain / 2).toFixed(2)));
        setFuelWeight(parseFloat((remain / 2).toFixed(2)));
      }
    }
  };

  // Run initial Pareto calculations
  const calculateRoutes = async () => {
    if (!selectedShipId) {
      setErrorMsg("Please select a ship profile first.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setWeatherShift(false);
    setEmergencyType(null);
    setEmergencyRoute(null);
    setEmergencyError(null);
    setHasRerouted(false);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          ship_id: parseInt(selectedShipId),
          weights: {
            safety_weight: safetyWeight,
            fuel_weight: fuelWeight,
            time_weight: timeWeight
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRoutes(data);
        setFitToken((t) => t + 1); // a new voyage: frame it on the map
        fetchWeatherLayers(); // refresh active layers
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Calculations failed on backend.");
      }
    } catch (err) {
      setErrorMsg("Failed to communicate with calculation service.");
    } finally {
      setLoading(false);
    }
  };

  // Re-solve the Pareto front from the waypoint the vessel was dragged to.
  // The sailed leg is discarded: that point becomes the new departure for every
  // profile. Returns true on success so the map can revert the marker on failure.
  const rerouteFromIndex = async (idx) => {
    const activeRoute = routes?.[selectedRouteKey];
    if (!activeRoute || !selectedShipId) return false;

    const dropPoint = activeRoute.waypoints[idx];
    if (!dropPoint) return false;

    setIsRerouting(true);
    setErrorMsg(null);
    setIsPlayingTelemetry(false);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/routes/reroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          ship_id: parseInt(selectedShipId),
          weights: {
            safety_weight: safetyWeight,
            fuel_weight: fuelWeight,
            time_weight: timeWeight
          },
          resume_lat: dropPoint[0],
          resume_lon: dropPoint[1]
        })
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.detail || "Reroute from the vessel position failed.");
        return false;
      }

      setRoutes(await res.json());
      setCurrentVesselIndex(0); // the drop point is the new origin
      setHasRerouted(true);
      return true;
    } catch (err) {
      setErrorMsg("Failed to reach the routing service for the reroute.");
      return false;
    } finally {
      setIsRerouting(false);
    }
  };

  // Trigger dynamic weather shift simulation and run D* Lite repair
  const triggerWeatherShiftAndReplan = async () => {
    if (!routes || !selectedShipId) return;
    
    // Choose active route path points
    const activeRoute = routes[selectedRouteKey];
    if (!activeRoute) return;

    setLoading(true);
    setErrorMsg(null);
    setWeatherShift(true);

    try {
      // Pick a storm center directly in the path of the ship (e.g. index 3 or 4 of active path)
      const pathPts = activeRoute.waypoints;
      let targetPt = pathPts[Math.floor(pathPts.length / 2)] || [8.5, 70.0];
      
      const stormCenter = {
        lat: targetPt[0] + (Math.random() - 0.5) * 2.0,
        lon: targetPt[1] + (Math.random() - 0.5) * 2.0,
        radius: 350.0 // 350 km
      };
      setStormPosition(stormCenter);

      const res = await fetch('http://127.0.0.1:8000/api/routes/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          ship_id: parseInt(selectedShipId),
          weights: {
            safety_weight: safetyWeight,
            fuel_weight: fuelWeight,
            time_weight: timeWeight
          },
          current_idx: currentVesselIndex,
          path_nodes: pathPts,
          storm_lat: stormCenter.lat,
          storm_lon: stormCenter.lon,
          storm_radius: stormCenter.radius
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRoutes(data);
        fetchWeatherLayers(); // refresh layers visual grid
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Replanning calculation failed.");
      }
    } catch (err) {
      setErrorMsg("Failed to connect for replanning calculations.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> 3: Declare a live emergency and recompute the optimal onward
  // route from the vessel's current position (live telemetry acts as its GPS
  // fix) to the destination, under weights appropriate to that emergency.
  const triggerEmergency = async (type) => {
    if (!routes || !selectedShipId) return;

    const activeRoute = routes[selectedRouteKey];
    if (!activeRoute) return;
    const livePos = activeRoute.waypoints[currentVesselIndex] || activeRoute.waypoints[0];

    setEmergencyType(type);
    setEmergencyLoading(true);
    setEmergencyError(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/routes/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          ship_id: parseInt(selectedShipId),
          emergency_type: type,
          current_lat: livePos[0],
          current_lon: livePos[1]
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEmergencyRoute(data);
        fetchWeatherLayers();
      } else {
        const err = await res.json();
        setEmergencyError(err.detail || "Emergency reroute failed.");
      }
    } catch (err) {
      setEmergencyError("Failed to connect for emergency reroute.");
    } finally {
      setEmergencyLoading(false);
    }
  };

  const clearEmergency = () => {
    setEmergencyType(null);
    setEmergencyRoute(null);
    setEmergencyError(null);
  };

  // Whether an emergency may be declared right now.
  //
  // A vessel sitting at its berth is not mid-voyage, so there is nothing to
  // divert: the button stays disabled within PORT_ZONE_NM of either the origin
  // or the destination. Once under way it is enabled, and the nearest port may
  // legitimately turn out to be the origin or the destination itself.
  const emergencyGate = useMemo(() => {
    const active = routes && routes[selectedRouteKey];
    if (!active) {
      return { enabled: false, reason: "Calculate a voyage before declaring an emergency." };
    }

    const wps = active.waypoints || [];
    const pos = wps[Math.min(currentVesselIndex, wps.length - 1)] || wps[0];
    const o = portByKey[origin];
    const d = portByKey[destination];
    if (!pos || !o || !d) return { enabled: true, reason: null };

    const dOrigin = haversineNm(pos[0], pos[1], o.lat, o.lon);
    const dDest = haversineNm(pos[0], pos[1], d.lat, d.lon);

    if (dOrigin <= PORT_ZONE_NM) {
      return {
        enabled: false,
        reason: `Vessel is still in the ${o.name} port zone (${Math.round(dOrigin)} nm). Get under way to enable emergency diversion.`,
      };
    }
    if (dDest <= PORT_ZONE_NM) {
      return {
        enabled: false,
        reason: `Vessel is on final approach to ${d.name} (${Math.round(dDest)} nm). Emergency diversion is disabled.`,
      };
    }
    return { enabled: true, reason: null };
  }, [routes, selectedRouteKey, currentVesselIndex, origin, destination, portByKey]);

  // Simulation timer logic for Vessel Telemetry progress
  useEffect(() => {
    let timer;
    if (isPlayingTelemetry && routes && routes[selectedRouteKey]) {
      const maxLen = routes[selectedRouteKey].waypoints.length;
      // Routes are resolved on a 0.25 deg grid, so a voyage is 50-300 waypoints
      // rather than a dozen. Pace the tick so a full playback lasts about a
      // minute regardless of route length instead of scaling with it.
      const TARGET_PLAYBACK_MS = 60000;
      const stepMs = Math.min(1500, Math.max(120, TARGET_PLAYBACK_MS / Math.max(1, maxLen)));
      timer = setInterval(() => {
        setCurrentVesselIndex((prev) => {
          if (prev >= maxLen - 1) {
            setIsPlayingTelemetry(false);
            return prev;
          }
          return prev + 1;
        });
      }, stepMs);
    }
    return () => clearInterval(timer);
  }, [isPlayingTelemetry, routes, selectedRouteKey]);

  return (
    <AppContext.Provider value={{
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
      routes,
      selectedRouteKey,
      setSelectedRouteKey,
      loading,
      errorMsg,
      calculateRoutes,
      weatherShift,
      stormPosition,
      triggerWeatherShiftAndReplan,
      isRerouting,
      hasRerouted,
      fitToken,
      rerouteFromIndex,
      currentVesselIndex,
      setCurrentVesselIndex,
      isPlayingTelemetry,
      setIsPlayingTelemetry,
      weatherLayers,
      ports,
      portsList,
      portByKey,
      emergencyGate,
      fetchShips,
      emergencyTypes,
      emergencyType,
      emergencyRoute,
      emergencyLoading,
      emergencyError,
      triggerEmergency,
      clearEmergency,
      liveEnvironment,
      envSyncing,
      syncOpenMeteo,
      fetchEnvironment
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
