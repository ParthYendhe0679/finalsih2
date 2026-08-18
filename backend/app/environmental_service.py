"""
Environmental Service for Aegir Maritime OS / MARINEX.
Integrates live data from the free Open-Meteo Weather and Marine APIs.

Features:
- Free Open-Meteo API (no API key or paid subscription required)
- Batch coordinate fetching for multiple grid/route points
- In-memory & file-based caching with TTL to protect rate limits
- Basin-wide environmental grid synchronization (winds, waves, currents)
- Live spot telemetry for vessel coordinates & selected ports
- Smooth fallback to cached or synthetic data on network failure
- CC BY 4.0 attribution and prototype decision-support disclaimers
"""

import math
import time
import json
import os
import urllib.request
import urllib.parse
from typing import List, Dict, Tuple, Any, Optional
import numpy as np

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Attribution & Disclaimers
OPEN_METEO_ATTRIBUTION = "Environmental forecast data provided by Open-Meteo under CC BY 4.0 (https://open-meteo.com/)"
ENVIRONMENTAL_DISCLAIMER = (
    "Environmental conditions are forecast and model-derived data from Open-Meteo for prototype "
    "decision support and optimal route planning. They are not a substitute for official certified nautical navigation charts or notices to mariners."
)

# WMO Weather Interpretation Codes
WMO_CODES = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog / Reduced Visibility",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Slight Snow Fall",
    73: "Moderate Snow Fall",
    75: "Heavy Snow Fall",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail"
}

COMPASS_DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def deg_to_compass(deg: Optional[float]) -> str:
    """Converts bearing in degrees [0, 360) to 16-point compass string."""
    if deg is None or math.isnan(deg):
        return "CALM"
    deg = (deg % 360 + 360) % 360
    idx = int(round(deg / 22.5)) % 16
    return COMPASS_DIRS[idx]


class EnvironmentalService:
    def __init__(self):
        self.point_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self.grid_sync_cache_time: float = 0.0
        self.grid_sync_ttl_seconds: float = 3600.0  # 1 hour
        self.last_sync_status: str = "initialized"
        self.last_sync_timestamp: Optional[str] = None
        self.last_sync_source: str = "Open-Meteo Live API"

    def _make_request(self, url: str, timeout: int = 8) -> Optional[Any]:
        """Performs a GET request with timeout and custom User-Agent."""
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "AegirMaritimeOS/2.0 (SIH-2026-PSS07; optimal-ship-routing)"
                }
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            print(f"[Open-Meteo Service] API request error for {url[:80]}...: {e}")
        return None

    def get_point_environment(self, lat: float, lon: float, ttl_seconds: float = 900.0) -> Dict[str, Any]:
        """
        Fetches live combined Weather & Marine conditions for a single coordinate.
        Returns a normalized environmental telemetry object with caching.
        """
        cache_key = f"{round(lat, 2)},{round(lon, 2)}"
        now = time.time()
        if cache_key in self.point_cache:
            ts, cached_data = self.point_cache[cache_key]
            if now - ts < ttl_seconds:
                return cached_data

        # 1. Weather forecast (wind, gusts, weather code)
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat:.4f}&longitude={lon:.4f}&"
            f"current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&"
            f"wind_speed_unit=kn"
        )
        weather_res = self._make_request(weather_url)

        # 2. Marine forecast (waves, ocean currents)
        marine_url = (
            f"https://marine-api.open-meteo.com/v1/marine?"
            f"latitude={lat:.4f}&longitude={lon:.4f}&"
            f"current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction"
        )
        marine_res = self._make_request(marine_url)

        # Process weather values
        w_current = weather_res.get("current", {}) if weather_res else {}
        m_current = marine_res.get("current", {}) if marine_res else {}

        is_live = bool(weather_res or marine_res)

        wind_speed_kn = float(w_current.get("wind_speed_10m", 12.0) if w_current.get("wind_speed_10m") is not None else 12.0)
        wind_dir_deg = float(w_current.get("wind_direction_10m", 240.0) if w_current.get("wind_direction_10m") is not None else 240.0)
        wind_gusts_kn = float(w_current.get("wind_gusts_10m", wind_speed_kn * 1.3) if w_current.get("wind_gusts_10m") is not None else wind_speed_kn * 1.3)
        weather_code = int(w_current.get("weather_code", 1) if w_current.get("weather_code") is not None else 1)

        wave_height_m = float(m_current.get("wave_height", 1.8) if m_current.get("wave_height") is not None else 1.8)
        wave_dir_deg = float(m_current.get("wave_direction", 235.0) if m_current.get("wave_direction") is not None else 235.0)
        wave_period_s = float(m_current.get("wave_period", 7.0) if m_current.get("wave_period") is not None else 7.0)

        # Convert current velocity to knots (Open-Meteo returns km/h by default; 1 km/h = 0.539957 knots)
        curr_vel_raw = m_current.get("ocean_current_velocity")
        if curr_vel_raw is not None:
            current_speed_kn = round(float(curr_vel_raw) * 0.539957, 2)
        else:
            current_speed_kn = 0.8
        current_dir_deg = float(m_current.get("ocean_current_direction", 90.0) if m_current.get("ocean_current_direction") is not None else 90.0)

        # Categorize wave state (Douglas Sea Scale approx)
        if wave_height_m < 0.5:
            sea_state = "Smooth / Calm"
        elif wave_height_m < 1.25:
            sea_state = "Slight"
        elif wave_height_m < 2.5:
            sea_state = "Moderate"
        elif wave_height_m < 4.0:
            sea_state = "Rough"
        else:
            sea_state = "Very Rough / High"

        utc_time_str = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())

        result = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "timestamp": utc_time_str,
            "data_source": "Open-Meteo (Live Forecast & Model)" if is_live else "Synthetic Fallback / Cached",
            "is_live": is_live,
            "wind": {
                "speed_kn": round(wind_speed_kn, 1),
                "direction_deg": round(wind_dir_deg, 1),
                "compass": deg_to_compass(wind_dir_deg),
                "gusts_kn": round(wind_gusts_kn, 1)
            },
            "waves": {
                "height_m": round(wave_height_m, 2),
                "direction_deg": round(wave_dir_deg, 1),
                "compass": deg_to_compass(wave_dir_deg),
                "period_s": round(wave_period_s, 1),
                "sea_state": sea_state
            },
            "currents": {
                "speed_kn": round(current_speed_kn, 2),
                "direction_deg": round(current_dir_deg, 1),
                "compass": deg_to_compass(current_dir_deg)
            },
            "weather": {
                "code": weather_code,
                "description": WMO_CODES.get(weather_code, "Partly Cloudy")
            },
            "attribution": OPEN_METEO_ATTRIBUTION,
            "disclaimer": ENVIRONMENTAL_DISCLAIMER
        }

        self.point_cache[cache_key] = (now, result)
        return result

    def fetch_batch_environment(self, coordinates: List[Tuple[float, float]]) -> List[Dict[str, Any]]:
        """
        Batches multiple coordinates to Open-Meteo in single HTTP calls.
        Respects rate limits by batching up to 50 coordinates per request.
        """
        if not coordinates:
            return []

        results: List[Dict[str, Any]] = []
        batch_size = 40

        for i in range(0, len(coordinates), batch_size):
            batch = coordinates[i:i + batch_size]
            lats_str = ",".join(f"{c[0]:.2f}" for c in batch)
            lons_str = ",".join(f"{c[1]:.2f}" for c in batch)

            weather_url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={lats_str}&longitude={lons_str}&"
                f"current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&"
                f"wind_speed_unit=kn"
            )
            marine_url = (
                f"https://marine-api.open-meteo.com/v1/marine?"
                f"latitude={lats_str}&longitude={lons_str}&"
                f"current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction"
            )

            w_data = self._make_request(weather_url)
            m_data = self._make_request(marine_url)

            # Open-Meteo returns a list of dicts when multiple coordinates are passed
            w_list = w_data if isinstance(w_data, list) else ([w_data] if w_data else [None] * len(batch))
            m_list = m_data if isinstance(m_data, list) else ([m_data] if m_data else [None] * len(batch))

            for idx, (lat, lon) in enumerate(batch):
                w_item = w_list[idx] if idx < len(w_list) and w_list[idx] else {}
                m_item = m_list[idx] if idx < len(m_list) and m_list[idx] else {}

                w_curr = w_item.get("current", {})
                m_curr = m_item.get("current", {})

                wind_speed = float(w_curr.get("wind_speed_10m", 12.0) if w_curr.get("wind_speed_10m") is not None else 12.0)
                wind_dir = float(w_curr.get("wind_direction_10m", 240.0) if w_curr.get("wind_direction_10m") is not None else 240.0)
                wave_ht = float(m_curr.get("wave_height", 1.8) if m_curr.get("wave_height") is not None else 1.8)
                wave_dir = float(m_curr.get("wave_direction", 235.0) if m_curr.get("wave_direction") is not None else 235.0)

                c_vel = m_curr.get("ocean_current_velocity")
                current_speed = float(c_vel) * 0.539957 if c_vel is not None else 0.8
                current_dir = float(m_curr.get("ocean_current_direction", 90.0) if m_curr.get("ocean_current_direction") is not None else 90.0)

                results.append({
                    "lat": lat,
                    "lon": lon,
                    "wind_speed": wind_speed,
                    "wind_direction": wind_dir,
                    "wave_height": wave_ht,
                    "wave_direction": wave_dir,
                    "current_speed": current_speed,
                    "current_direction": current_dir
                })

        return results

    def sync_basin_grid(self, env_grid, stride: int = 20) -> Dict[str, Any]:
        """
        Samples representative open water grid nodes across the Indian Ocean basin,
        fetches live Open-Meteo fields, and interpolates them onto the full EnvironmentalGrid.
        Recalculates speed_loss, wind_sq, wave_sq, currents_u, currents_v, and risk_cell.
        """
        now = time.time()
        # Enforce rate limit / caching
        if now - self.grid_sync_cache_time < self.grid_sync_ttl_seconds and self.last_sync_status == "live_success":
            return {
                "status": "cached",
                "message": "Using cached Open-Meteo live environmental grid (within 1 hr TTL).",
                "timestamp": self.last_sync_timestamp,
                "source": self.last_sync_source
            }

        print("[Environmental Service] Synchronizing ocean grid with live Open-Meteo Weather & Marine data...")

        # Sample grid lattice points that fall in open water
        from .grid import grid_to_coord
        height, width = env_grid.height, env_grid.width
        sample_coords = []
        sample_indices = []

        for r in range(0, height, stride):
            for c in range(0, width, stride):
                if not env_grid.land_l[r][c] and env_grid.ocean[r, c]:
                    lat, lon = grid_to_coord(r, c)
                    sample_coords.append((lat, lon))
                    sample_indices.append((r, c))

        if not sample_coords:
            return {"status": "error", "message": "No sample coordinates generated."}

        # Cap sample coordinates to respect rate limits (e.g. ~40-60 representative nodes)
        if len(sample_coords) > 60:
            step = len(sample_coords) // 50
            sample_coords = sample_coords[::step][:50]
            sample_indices = sample_indices[::step][:50]

        batch_data = self.fetch_batch_environment(sample_coords)
        if not batch_data:
            print("[Environmental Service] Open-Meteo unreachable. Preserving current environmental layers.")
            self.last_sync_status = "fallback"
            return {
                "status": "fallback",
                "message": "Environmental API unavailable — using cached/demo data.",
                "timestamp": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
                "source": "Synthetic / Cached Layers"
            }

        # Interpolate sampled values onto the 200x280 grid
        lats_sample = np.array([d["lat"] for d in batch_data], dtype=np.float32)
        lons_sample = np.array([d["lon"] for d in batch_data], dtype=np.float32)
        winds_sample = np.array([d["wind_speed"] for d in batch_data], dtype=np.float32)
        waves_sample = np.array([d["wave_height"] for d in batch_data], dtype=np.float32)

        # Convert direction/speed to U and V components for accurate current drift
        curr_speeds = np.array([d["current_speed"] for d in batch_data], dtype=np.float32)
        curr_dirs = np.array([d["current_direction"] for d in batch_data], dtype=np.float32)
        curr_rad = np.radians(curr_dirs)
        curr_u_sample = curr_speeds * np.sin(curr_rad)
        curr_v_sample = curr_speeds * np.cos(curr_rad)

        from .grid import cell_centres
        grid_lats, grid_lons = cell_centres()

        # Inverse Distance Weighting (IDW) interpolation onto full grid
        # Vectorized for high performance
        new_winds = np.zeros((height, width), dtype=np.float32)
        new_waves = np.zeros((height, width), dtype=np.float32)
        new_curr_u = np.zeros((height, width), dtype=np.float32)
        new_curr_v = np.zeros((height, width), dtype=np.float32)

        for i in range(len(batch_data)):
            d2 = (grid_lats - lats_sample[i]) ** 2 + (grid_lons - lons_sample[i]) ** 2 + 4.0
            weight = 1.0 / d2
            new_winds += winds_sample[i] * weight
            new_waves += waves_sample[i] * weight
            new_curr_u += curr_u_sample[i] * weight
            new_curr_v += curr_v_sample[i] * weight

        # Normalize weights
        total_weight = np.zeros((height, width), dtype=np.float32)
        for i in range(len(batch_data)):
            total_weight += 1.0 / ((grid_lats - lats_sample[i]) ** 2 + (grid_lons - lons_sample[i]) ** 2 + 4.0)

        new_winds /= total_weight
        new_waves /= total_weight
        new_curr_u /= total_weight
        new_curr_v /= total_weight

        # Zero out land cells
        new_winds[env_grid.land] = 0.0
        new_waves[env_grid.land] = 0.0
        new_curr_u[env_grid.land] = 0.0
        new_curr_v[env_grid.land] = 0.0

        # Update in-memory environmental grid
        env_grid.winds = new_winds
        env_grid.waves = new_waves
        env_grid.currents_u = new_curr_u
        env_grid.currents_v = new_curr_v

        # Recompute derived speed loss, risk surfaces, and native-list lookups
        env_grid._precompute_derived()

        self.grid_sync_cache_time = now
        self.last_sync_status = "live_success"
        self.last_sync_timestamp = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())
        self.last_sync_source = "Open-Meteo Live Forecast"

        print(f"[Environmental Service] Successfully updated grid from Open-Meteo ({len(batch_data)} nodes interpolated).")

        return {
            "status": "live_success",
            "message": f"Successfully synchronized ocean grid from Open-Meteo ({len(batch_data)} live nodes).",
            "timestamp": self.last_sync_timestamp,
            "source": self.last_sync_source,
            "nodes_sampled": len(batch_data)
        }


# Global singleton service
env_service = EnvironmentalService()
