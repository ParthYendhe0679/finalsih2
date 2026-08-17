from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from .database import engine, Base, get_db
from . import models, schemas, crud
from .raster_parser import env_grid
from .mopbd_engine import calculate_pareto_routes, DSLite, coord_to_grid, PORTS, calculate_edge_vector

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema and tables exist on startup
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Aegir Maritime OS Routing API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Ship CRUD Endpoints ---

@app.get("/api/ships", response_model=List[schemas.Ship])
def read_ships(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_ships(db, skip=skip, limit=limit)

@app.get("/api/ships/{ship_id}", response_model=schemas.Ship)
def read_ship(ship_id: int, db: Session = Depends(get_db)):
    db_ship = crud.get_ship(db, ship_id=ship_id)
    if db_ship is None:
        raise HTTPException(status_code=404, detail="Ship not found")
    return db_ship

@app.post("/api/ships", response_model=schemas.Ship, status_code=status.HTTP_201_CREATED)
def create_ship(ship: schemas.ShipCreate, db: Session = Depends(get_db)):
    db_ship = crud.get_ship_by_imo(db, imo=ship.imo)
    if db_ship:
        raise HTTPException(status_code=400, detail="IMO already registered")
    return crud.create_ship(db=db, ship=ship)

@app.put("/api/ships/{ship_id}", response_model=schemas.Ship)
def update_ship(ship_id: int, ship_update: schemas.ShipUpdate, db: Session = Depends(get_db)):
    db_ship = crud.update_ship(db=db, ship_id=ship_id, ship_update=ship_update)
    if db_ship is None:
        raise HTTPException(status_code=404, detail="Ship not found")
    return db_ship

@app.delete("/api/ships/{ship_id}", response_model=schemas.Ship)
def delete_ship(ship_id: int, db: Session = Depends(get_db)):
    db_ship = crud.delete_ship(db=db, ship_id=ship_id)
    if db_ship is None:
        raise HTTPException(status_code=404, detail="Ship not found")
    return db_ship

# --- Routing Endpoints ---

@app.post("/api/routes/calculate")
def calculate_routes(request: schemas.RouteRequest, db: Session = Depends(get_db)):
    # Retrieve ship specifications
    db_ship = crud.get_ship(db, ship_id=request.ship_id)
    if not db_ship:
        raise HTTPException(status_code=404, detail="Selected ship profile not found")
    
    ship_profile = {
        "displacement": db_ship.displacement,
        "frontal_area": db_ship.frontal_area,
        "engine_efficiency": db_ship.engine_efficiency,
        "sfoc": db_ship.sfoc
    }

    custom_w = {
        "safety_weight": request.weights.safety_weight,
        "fuel_weight": request.weights.fuel_weight,
        "time_weight": request.weights.time_weight
    }

    try:
        routes = calculate_pareto_routes(
            origin=request.origin,
            destination=request.destination,
            ship_profile=ship_profile,
            custom_weights=custom_w
        )
        return routes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/routes/replan")
def replan_routes(request: schemas.ReplanRequest, db: Session = Depends(get_db)):
    # 1. Retrieve ship details
    db_ship = crud.get_ship(db, ship_id=request.ship_id)
    if not db_ship:
        raise HTTPException(status_code=404, detail="Ship not found")

    ship_profile = {
        "displacement": db_ship.displacement,
        "frontal_area": db_ship.frontal_area,
        "engine_efficiency": db_ship.engine_efficiency,
        "sfoc": db_ship.sfoc
    }

    # 2. Inject the storm into grid
    # Degrees approximation: 1 degree latitude ~ 111 km. So radius in km to degrees:
    radius_deg = request.storm_radius / 111.0
    changed_cells = env_grid.inject_storm(
        center_lat=request.storm_lat,
        center_lon=request.storm_lon,
        radius_deg=radius_deg,
        severity=1.5
    )

    # 3. Determine ship's current location along its voyage
    curr_idx = request.current_idx
    if curr_idx < 0 or curr_idx >= len(request.path_nodes):
        curr_idx = 0
    current_coord = tuple(request.path_nodes[curr_idx])

    # 4. Perform dynamic D* Lite repair for each weight configuration starting from current ship position
    weight_profiles = {
        "fastest": {"time_weight": 0.90, "fuel_weight": 0.05, "safety_weight": 0.05},
        "fuel_optimized": {"time_weight": 0.05, "fuel_weight": 0.90, "safety_weight": 0.05},
        "safest": {"time_weight": 0.05, "fuel_weight": 0.05, "safety_weight": 0.90},
        "balanced": {
            "safety_weight": request.weights.safety_weight,
            "fuel_weight": request.weights.fuel_weight,
            "time_weight": request.weights.time_weight
        }
    }

    def get_path_metrics(path: List[tuple]) -> Dict[str, Any]:
        total_time = 0.0
        total_fuel = 0.0
        total_risk = 0.0
        waypoints = []
        for idx in range(len(path)):
            lat, lon = path[idx]
            waypoints.append([lat, lon])
            if idx < len(path) - 1:
                u = coord_to_grid(lat, lon)
                v = coord_to_grid(path[idx+1][0], path[idx+1][1])
                t, f, r = calculate_edge_vector(u, v, ship_profile)
                total_time += t
                total_fuel += f
                total_risk += r
                
        return {
            "waypoints": waypoints,
            "total_time": round(total_time, 1),
            "total_fuel": round(total_fuel, 0),
            "total_risk": round(total_risk, 1)
        }

    results = {}
    origin_coord = PORTS[request.origin]
    goal_coord = PORTS[request.destination]

    for key, weights in weight_profiles.items():
        # Instantiate DSLite, run initial build
        ds = DSLite(origin_coord, goal_coord, ship_profile, weights)
        ds.initialize()
        ds.compute_shortest_path()
        
        # Apply the weather shift and repair the path incrementally
        ds.replan_after_weather_shift(current_coord, changed_cells)
        
        repaired_path = ds.get_path()
        
        # Prepend the already traveled path prefix to show the full voyage
        traveled_prefix = request.path_nodes[:curr_idx]
        full_path = traveled_prefix + repaired_path
        
        metrics = get_path_metrics(full_path)
        results[key] = {
            "weights": weights,
            **metrics
        }

    return results

@app.get("/api/weather/layers")
def get_weather_layers():
    """Returns grid representation of wind speeds, wave heights and piracy risk for visualization."""
    return {
        "bounds": {
            "west": env_grid.west,
            "east": env_grid.east,
            "south": env_grid.south,
            "north": env_grid.north,
            "rows": env_grid.height,
            "cols": env_grid.width
        },
        "winds": env_grid.winds.tolist(),
        "waves": env_grid.waves.tolist(),
        "piracy": env_grid.piracy.tolist()
    }
