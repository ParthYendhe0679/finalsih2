# MARINEX — Dynamic Maritime Voyage Intelligence
## Technical Documentation · SIH 2026 · PSS07

> **Scope**: Every claim is verified against actual source code. Nothing is assumed or invented.
> Where a feature is simulated, static, or partially implemented it is explicitly labelled.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Folder Structure](#2-project-folder-structure)
3. [System Architecture](#3-system-architecture)
4. [User Journey](#4-user-journey)
5. [Routing Algorithm](#5-routing-algorithm)
6. [D* Lite Data Flow](#6-d-lite-data-flow)
7. [Four Routes Explained](#7-four-routes-explained)
8. [Environmental Data](#8-environmental-data)
9. [Dynamic Rerouting](#9-dynamic-rerouting)
10. [Ship Model](#10-ship-model)
11. [Cost Model](#11-cost-model)
12. [Map System](#12-map-system)
13. [Coastal Clearance](#13-coastal-clearance)
14. [API Reference](#14-api-reference)
15. [Database & Storage](#15-database--storage)
16. [Testing](#16-testing)
17. [End-to-End Example](#17-end-to-end-example)
18. [Real vs Simulated](#18-real-vs-simulated)
19. [2-Minute Judge Pitch](#19-2-minute-judge-pitch)
20. [Judge Q&A](#20-judge-qa)

---

## 1. Technology Stack

### Frontend

| # | Technology | Version | Where Used | Role |
|---|---|---|---|---|
| 1 | **React** | 19 | All `.jsx` components | SPA — Landing, Dashboard, Sidebar, Map, Docks |
| 2 | **Leaflet + React-Leaflet** | 1.9.4 / 5 | `MapComponent.jsx` | Interactive map, polylines, ship marker, overlays |
| 3 | **TailwindCSS** | 3 | All `.jsx` files | Utility-class styling |
| 4 | **Lucide-React** | latest | Sidebar, Navbar, Docks | UI icons |
| 5 | **Recharts** | 3 | `VoyageAnalytics.jsx` | Fleet analytics charts |
| 6 | **Vite** | 8 | Build & dev server | HMR, ES module bundler |
| 7 | **TypeScript / TSX** | — | `landing/` folder only | Marketing landing page |

### Backend

| # | Technology | Version | Where Used | Role |
|---|---|---|---|---|
| 8 | **FastAPI** | ≥ 0.100 | `main.py` | All 8+ REST API endpoints |
| 9 | **Uvicorn** | — | `run.py` | ASGI server |
| 10 | **SQLAlchemy** | 2 | `database.py`, `crud.py` | SQLite ORM |
| 11 | **Pydantic** | 2 | `schemas.py` | Request / response validation |

### Algorithm & Data

| # | Technology | Where Used | Role |
|---|---|---|---|
| 12 | **SQLite** | `aegir.db` | Persistent ship registry |
| 13 | **NumPy** | `raster_parser.py`, `generator.py`, `environmental_service.py` | Grid arrays, vectorized env ops |
| 14 | **rasterio** | `raster_parser.py`, `generator.py` | GeoTIFF read/write |
| 15 | **global-land-mask** | `generator.py` | Real 0.01° land/sea geography |
| 16 | **scipy** | `generator.py` `coast_distance()` | Euclidean Distance Transform for dist-to-land |
| 17 | **heapq** (stdlib) | `mopbd_engine.py` | D* Lite priority queue with lazy deletion |
| 18 | **D* Lite Algorithm** | `mopbd_engine.py` `DSLite` class | Core incremental path planner |
| 19 | **Open-Meteo Weather API** | `environmental_service.py` | Live wind/gusts/weather — free, no API key |
| 20 | **Open-Meteo Marine API** | `environmental_service.py` | Live waves/currents — free, no API key |
| 21 | **CartoDB Voyager tiles** | `MapComponent.jsx` | Background ocean/land basemap |

### Dev Tools

| # | Technology | Role |
|---|---|---|
| 22 | **pytest** | Backend test runner (27 tests) |
| 23 | **httpx** | HTTP test client in `tests/api_client.py` |
| 24 | **oxlint** | JS/JSX linter |
| 25 | **pandas** | Listed in requirements; not actively called in routing code |

---

## 2. Project Folder Structure

```
finalsih2/
├── backend/
│   ├── app/
│   │   ├── grid.py                  ← Grid constants: WEST/EAST/SOUTH/NORTH, CELL_DEG=0.25°
│   │   │                               coord↔grid transforms, haversine_distance
│   │   ├── generator.py             ← Builds synthetic env rasters (.npy/.tif) from scratch
│   │   │                               Uses global_land_mask + spatially-correlated random fields
│   │   ├── raster_parser.py         ← Loads rasters → EnvironmentalGrid singleton (env_grid)
│   │   │                               Precomputes speed_loss, risk_cell, dist_to_land
│   │   ├── mopbd_engine.py          ← DSLite class + cost model + 4-route Pareto front
│   │   │                               764 lines — the routing engine
│   │   ├── environmental_service.py ← Open-Meteo API client + IDW grid interpolation
│   │   ├── main.py                  ← FastAPI app + all API endpoints
│   │   ├── database.py              ← SQLite engine + session factory
│   │   ├── models.py                ← Ship SQLAlchemy ORM model
│   │   ├── schemas.py               ← Pydantic request/response schemas
│   │   └── crud.py                  ← get / create / update / delete ship
│   │
│   ├── data/
│   │   ├── winds.npy / .tif         ← Wind speed layer (200×280)
│   │   ├── waves.npy / .tif         ← Wave height layer
│   │   ├── currents_u.npy / .tif    ← Eastward current component
│   │   ├── currents_v.npy / .tif    ← Northward current component
│   │   ├── piracy.npy / .tif        ← Piracy risk index
│   │   ├── land.npy / .tif          ← Land/sea binary mask
│   │   └── metadata.npy             ← Grid bounds and resolution record
│   │
│   ├── tests/
│   │   ├── api_client.py            ← httpx TestClient factory
│   │   ├── test_mopbd.py            ← 18 tests: routing, land mask, D* Lite, replan
│   │   └── test_reroute.py          ← 9 tests: drag-to-reroute API
│   │
│   ├── aegir.db                     ← SQLite database file
│   ├── requirements.txt
│   └── run.py                       ← Launches uvicorn
│
└── frontend/
    └── src/
        ├── main.jsx                 ← React entry point
        ├── App.jsx                  ← Root: switches landing ↔ dashboard
        ├── context/
        │   └── AppContext.jsx       ← ALL global state + ALL API call functions
        ├── components/
        │   ├── Sidebar.jsx          ← Ship/port/weight controls + emergency buttons
        │   ├── MapComponent.jsx     ← Leaflet map, 4 polylines, ship marker, overlays
        │   ├── ParetoDock.jsx       ← 4 route cards (time/fuel/risk) + download
        │   ├── EmergencyDock.jsx    ← Emergency result banner
        │   ├── FleetRegistry.jsx    ← Ship CRUD UI
        │   ├── VoyageAnalytics.jsx  ← Fleet analytics charts
        │   └── VoyageDetailsModal.jsx ← Full dossier modal
        ├── landing/                 ← Marketing landing page (TypeScript)
        │   └── components/          ← Hero, Nav, RouteIntelligence, DynamicRerouting…
        └── utils/
            └── voyageReportGenerator.js ← Generates downloadable voyage dossier text
```

### Communication Rule

> `AppContext.jsx` owns **all** API calls. No component ever calls `fetch()` directly —
> they invoke functions exposed by `useApp()`.

### Key File Roles

| File | Inputs | Outputs | Consumed By |
|---|---|---|---|
| `grid.py` | — | Coord↔grid transforms, haversine | All backend modules |
| `generator.py` | `global_land_mask` | `.npy` + `.tif` files | `raster_parser.py` (on-demand) |
| `raster_parser.py` | `.npy`/`.tif` | `env_grid` singleton | `mopbd_engine.py`, `main.py` |
| `mopbd_engine.py` | `env_grid`, ship profile, weights | Route waypoints + metrics | `main.py` endpoints |
| `environmental_service.py` | Open-Meteo HTTP | Updated `env_grid` arrays | `main.py` endpoints |
| `main.py` | HTTP requests | JSON responses | Frontend fetch calls |
| `AppContext.jsx` | User interactions | React state updates | All React components |
