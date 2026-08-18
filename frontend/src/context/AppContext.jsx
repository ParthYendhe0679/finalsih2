import React, { createContext, useState, useEffect, useContext } from 'react';

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

  // Ports configurations
  const portsList = ["JNPT", "Colombo", "Singapore", "Aden", "Port Louis"];

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

  // Fetch weather layers
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

  useEffect(() => {
    fetchShips();
    fetchWeatherLayers();
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
    setCurrentVesselIndex(0);
    setIsPlayingTelemetry(false);
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
      portsList,
      fetchShips
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
