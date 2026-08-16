# Implementation Plan - Aegir Maritime OS

Aegir Maritime OS is a production-ready, full-stack maritime routing and fleet management platform. The system uses a Multi-Objective Path-Based D* Lite (MOPBD*) routing engine to compute Pareto-optimal voyages balancing travel time, fuel consumption, and risk (weather, waves, currents, piracy). It provides a sleek command-center dashboard with an interactive map, dynamic weather shift simulation, real-time telemetry, and fleet database CRUD manager.

## User Review Required

We want to align on the following decisions and tech stack details before commencing execution:

> [!IMPORTANT]
> **1. Tailwind CSS Version**
> We propose using **Tailwind CSS v3** (specifically `v3.4.x`) as it has mature, highly-compatible packages for standard dark-mode, transitions, and layout components. Please let us know if you prefer Tailwind v4 instead.

> [!IMPORTANT]
> **2. Map Engine Choice**
> We propose using **Leaflet.js** (via `react-leaflet`) styled with **CartoDB Dark Matter** tiles. This styling matches the dark command-center aesthetic perfectly, handles dynamic route lines/icons efficiently, and runs out-of-the-box without requiring a Mapbox API token. If you prefer Mapbox GL, we can use it, but you will need to provide a Mapbox Access Token.

> [!NOTE]
> **3. Database Setup**
> We will use **SQLite** (via SQLAlchemy) inside the Python backend. This provides a self-contained relational database matching the schema requirements for the Fleet Registry (Ship Name, IMO, Displacement, Frontal Area, Engine Efficiencies, SFOC) and allows instant synchronization.

> [!NOTE]
> **4. Rasterio Dependency Fallback**
> If `rasterio` fails to install due to underlying GDAL library requirements on macOS, we will implement a transparent fallback using a native `numpy`-based grid parser that reads grid files (`.npy`). This ensures a 100% reliable local setup while keeping the interface identical.

## Open Questions

1. **Do you have a Mapbox API Token you want to use?**
   - *Recommendation:* Let's stick with Leaflet + CartoDB Dark Matter, which looks highly premium, glowing, and works immediately.
2. **Should we use Tailwind CSS v3 or v4?**
   - *Recommendation:* Tailwind v3 is recommended for maximum plugin compatibility.

---

## Proposed Changes

### Backend (Python FastAPI)

We will build a clean modular FastAPI backend to serve the routing engine, environmental grids, and Ship CRUD API.

#### [NEW] [mopbd_engine.py](file:///Users/zainab/SIH/backend/app/mopbd_engine.py)
This module implements the Multi-Objective Pathfinding and D* Lite algorithm.
- Grid representation of the Indian Ocean (covering latitudes $10^\circ \text{S}$ to $25^\circ \text{N}$ and longitudes $40^\circ \text{E}$ to $110^\circ \text{E}$).
- Cost vectors for grid edges: $[T(e), F(e), R(e)]$ (Time, Fuel, Risk).
- Scalarization for D* Lite: $Cost(e) = w_T \cdot T(e) + w_F \cdot F(e) + w_S \cdot R(e)$.
- D* Lite implementation: stores `g` and `rhs` values, processes inconsistencies incrementally using a priority queue when weather shifts occur, avoiding search from scratch.
- Pareto Front Generator: computes paths for multiple weight configurations (Fastest, Fuel-Optimized, Safest, Balanced) to construct the Pareto-optimal front.

#### [NEW] [raster_parser.py](file:///Users/zainab/SIH/backend/app/raster_parser.py)
Reads geographic grid matrices for winds, waves, currents, and piracy risk.
- Utilizes `rasterio` to parse GeoTIFF files.
- Provides fallback to binary `numpy` arrays if GDAL headers are missing.
- Maps lat/lon queries to raster coordinates.

#### [NEW] [generator.py](file:///Users/zainab/SIH/backend/app/generator.py)
A database and raster builder script to initialize sample raster files for the Indian Ocean and seed standard ship data.

#### [NEW] [models.py](file:///Users/zainab/SIH/backend/app/models.py)
SQLAlchemy models:
- `Ship`: ID, Name, IMO, Displacement, Frontal Area, Engine Efficiency, SFOC, Maintenance Logs.
- `Voyage`: ID, Ship ID, Start Port, End Port, Current Lat/Lon, Weather Sim State.

#### [NEW] [main.py](file:///Users/zainab/SIH/backend/app/main.py)
FastAPI endpoints:
- `POST /api/routes/calculate`: Computes Pareto-optimal routes using weight sliders and vessel profile.
- `POST /api/routes/replan`: Simulates weather shift, applies costs, and runs D* Lite incremental replanning.
- `GET /api/ships`, `POST /api/ships`, `PUT /api/ships/{id}`, `DELETE /api/ships/{id}`: Ship registry CRUD.
- `GET /api/weather/layers`: Returns active weather overlay matrices.

---

### Frontend (React + Tailwind CSS)

We will build a React frontend with a polished command-center UI, Recharts analytics, and Leaflet map layers.

#### [NEW] [AppContext.jsx](file:///Users/zainab/SIH/frontend/src/context/AppContext.jsx)
React Context to manage global state:
- Loaded ship profiles and selected active vessel.
- Weight sliders ($w_S, w_F, w_T$) with strict sum validation ($1.0$).
- Calculated Pareto routes, selected active path, and simulated storm coordinates.
- Selected origin and destination ports (JNPT, Colombo, Singapore, Aden, Port Louis).

#### [NEW] [Navbar.jsx](file:///Users/zainab/SIH/frontend/src/components/Navbar.jsx)
Top Header featuring:
- Brand label: "Aegir Maritime OS".
- Live API Sync Status badge (Green pulsing indicator).
- Global Weather Alert banner (pulsating alert ticker for active storms).

#### [NEW] [Sidebar.jsx](file:///Users/zainab/SIH/frontend/src/components/Sidebar.jsx)
Left Sidebar controls:
- **Voyage & Port Setup:** Origin/Destination port selectors (auto-suggesting major Indian Ocean hubs).
- **Ship Profile Loader:** Dropdown to select a vessel from the registry, showing main specs and manual override fields.
- **Multi-Objective Weight Sliders:** Safety, Fuel, and Time sliders. Validates sum = 1.0. Shows error state if invalid.
- **Action & Trigger Hub:** "Calculate Optimal Routes" (spinner animation) and "[Simulate Weather Shift & Replan]".

#### [NEW] [MapComponent.jsx](file:///Users/zainab/SIH/frontend/src/components/MapComponent.jsx)
Leaflet map engine centered on the Indian Ocean.
- Dark theme tile styling (CartoDB Dark Matter).
- Environmental overlay checkboxes (Winds, Waves, Currents, Piracy Heatmaps).
- Color-coded route path drawings (Green = Safest, Blue = Fuel-Optimized, Red = Fastest, Purple = Balanced).
- Dynamic weather shift overlay (visual representation of the storm zone).
- Interactive port markers and voyage progress markers.

#### [NEW] [ParetoDock.jsx](file:///Users/zainab/SIH/frontend/src/components/ParetoDock.jsx)
Bottom persistent deck displaying summary cards comparing active Pareto alternatives:
- Total Time (Hours)
- Fuel Used (Gallons)
- Risk Score (1-100 index)
- Highlighted badges for "Fastest", "Safest", "Fuel-Optimized", and "Balanced".

#### [NEW] [FleetRegistry.jsx](file:///Users/zainab/SIH/frontend/src/components/FleetRegistry.jsx)
Dashboard 2 Tab 1: Database CRUD View.
- Editable datagrid table for ships.
- Circular SVG progress health barometers for each ship tracking risk indices and maintenance logs.

#### [NEW] [VoyageAnalytics.jsx](file:///Users/zainab/SIH/frontend/src/components/VoyageAnalytics.jsx)
Dashboard 2 Tab 2: Analytical charts.
- Side-by-side Recharts comparing selected paths against Risk, Fuel, and Time.
- **Mid-Voyage Telemetry Panel:** Details vessel progress (elapsed time, remaining distance, ETA updates).
- **Nearby Assistance Locator:** Card showing closest safe-havens, rescue services, and company fleet ships.

---

## Verification Plan

### Automated Tests
- We will write a test suite `backend/tests/test_mopbd.py` verifying:
  - D* Lite incremental updates return correct paths matching Dijkstra search on modified grids.
  - Weight validation function returns error when sum is not equal to 1.0.
  - API endpoints respond correctly to route planning and ship CRUD.
- Run tests: `pytest backend/tests/`

### Manual Verification
- Verify responsiveness of the split-screen layouts.
- Interact with sliders and ensure validation messages trigger properly.
- Trigger weather shift, and observe real-time Leaflet route adaptation and Telemetry updates.
- Perform CRUD operations (create/update/delete) in the Fleet Registry and confirm instantaneous updates in the voyage planning sidebar profile dropdown.
