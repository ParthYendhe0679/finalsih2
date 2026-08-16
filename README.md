# Aegir Maritime OS ⚓

**Aegir Maritime OS** is a production-ready, full-stack maritime routing and fleet command center. The platform computes Pareto-optimal shipping voyages using a **Multi-Objective Path-Based D* Lite (MOPBD*)** algorithm. It balances competing real-world constraints—Travel Time (Hours), Bunker Fuel Consumption (Gallons), and Navigation Risk (Waves, Winds, Piracy heatmaps)—to output a front of voyage choices instead of a single static path.

Additionally, it provides a dynamic weather simulator showing **D* Lite incremental course correction** around radar-reported storm coordinates, alongside active vessel telemetry monitoring, and a full CRUD vessel profiles registry database.

---

## 🚀 Key Features

### 1. Multi-Objective Route Planner (Pareto Front)
- **Time Optimization ($T$):** Adapts vessel base speeds for headwind air drag, wave delays, and vector-aligned ocean current assists.
- **Bunker Fuel Minimization ($F$):** Models fuel rates relative to the speed cube relation $\text{Power} \propto \text{Displacement}^{2/3} \cdot V^3$ coupled with engine efficiency configurations.
- **Risk Mitigation ($R$):** Dynamically scales risk factors for waves, monsoon winds, and historical piracy activity in the Gulf of Aden / Somali Basin.
- Renders **Fastest**, **Safest**, **Fuel-Optimized**, and custom **Balanced** paths side-by-side.

### 2. D* Lite Incremental Replanning
- Simulates real-time radar weather shift notifications.
- Dynamically injects storm vectors and updates affected grid cells in the environmental grid.
- Runs an incremental D* Lite tree repair search from the ship's current voyage coordinate, avoiding full A*/Dijkstra re-planning from scratch.

### 3. Fleet Registry & CRUD Manager
- Active databases storing vessel constants: Name, IMO, Displacement, Frontal Area, Engine Efficiency, and SFOC.
- Instantaneous synchronization of CRUD entries to the main map dashboard dropdowns.
- Circular SVG progress indicators tracking hull risk indices and maintenance date logs.

### 4. Telemetry Simulation & Rescue Locator
- An active playback slider simulating the voyage leg by leg.
- Dynamically updates ETA counters, remaining Nautical Miles, and proximity alerts to storm radars.
- **Emergency Assistance Locator:** Automatically calculates and displays live distances to closest coastal SAR stations, navy escorts, and fleet support ships based on the vessel's current GPS position.

---

## 🛠️ Technology Stack

- **Frontend:** React.js, Vite, Tailwind CSS v3, Leaflet, Recharts, Lucide React.
- **Backend:** Python FastAPI, Uvicorn, SQLite, SQLAlchemy, Pydantic, NumPy, Rasterio.
- **Data layers:** Geographic raster files (GeoTIFF) and backup NumPy grids.

---

## 📂 Project Directory Structure

```
SIH/
├── backend/
│   ├── app/
│   │   ├── database.py       # SQLite connection session
│   │   ├── models.py         # SQLAlchemy Ship database model
│   │   ├── schemas.py        # Pydantic validation schemas
│   │   ├── crud.py           # Database CRUD utility methods
│   │   ├── main.py           # FastAPI routes & endpoints
│   │   ├── mopbd_engine.py   # DSLite & Pareto calculations engine
│   │   ├── raster_parser.py  # GeoTIFF raster queries (with numpy fallback)
│   │   └── generator.py      # Seeds database & writes mock raster files
│   ├── tests/
│   │   └── test_mopbd.py     # PyTest testing suite
│   ├── run.py                # Server startup script
│   └── requirements.txt      # Python dependencies manifest
├── frontend/
│   ├── src/
│   │   ├── components/       # UI widgets (Map, Sidebar, Analytics, CRUD)
│   │   ├── context/          # AppContext global state manager
│   │   ├── index.css         # Tailwind directives & leaflet custom dark css
│   │   └── App.jsx           # Main routing tab wrapper
│   ├── tailwind.config.js    # Design system tokens and custom colors
│   └── package.json          # Node dependencies manifest
└── README.md
```

---

## 🔧 Installation & Local Setup

### Prerequisite Checklist
Ensure you have the following installed:
- Node.js (v18+)
- Python (v3.10+)

---

### Step 1: Set up the Python Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install required libraries:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the data generator to seed default ships and compile the geographical grids:
   ```bash
   python3 -m app.generator
   ```
5. Launch the FastAPI server:
   ```bash
   python3 run.py
   ```
   *The server starts at **`http://127.0.0.1:8000`**.*

---

### Step 2: Set up the React Frontend

1. Open a new terminal tab and navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *Vite starts the dashboard locally at **`http://localhost:5173/`**.*

---

## 🧪 Running Automated Tests

To verify that the routing math, database queries, and D* Lite API are functioning correctly, run the pytest suite:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Run pytest with the PYTHONPATH configured:
   ```bash
   PYTHONPATH=. venv/bin/pytest
   ```
