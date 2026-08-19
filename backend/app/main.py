from contextlib import asynccontextmanager
import numpy as np
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from .database import engine, Base, get_db
# `models` is imported for its side effect of registering the ORM tables on
# Base.metadata, which lifespan's create_all depends on.
from . import models, schemas, crud  # noqa: F401
from .raster_parser import env_grid
from .grid import haversine_distance
from .mopbd_engine import (
    calculate_pareto_routes, calculate_routes_from_point, DSLite, PORTS, PORT_META,
    get_path_metrics, WEIGHT_PROFILES, RouteUnreachable, nearest_port_by_sea,
)

# --- Emergency Rerouting Profiles ---
# Each emergency biases the multi-objective weights toward what matters most
# for that scenario, and (for hazard-type emergencies) marks a danger zone
# around the ship's current position so the router actively routes around it,
# rather than just re-weighting the same grid.
EMERGENCY_PROFILES = {
    "cyclone":    {"safety_weight": 0.70, "fuel_weight": 0.15, "time_weight": 0.15},
    "piracy":     {"safety_weight": 0.80, "fuel_weight": 0.10, "time_weight": 0.10},
    "medical":    {"safety_weight": 0.10, "fuel_weight": 0.10, "time_weight": 0.80},
    "mechanical": {"safety_weight": 0.55, "fuel_weight": 0.15, "time_weight": 0.30},
}

EMERGENCY_META = {
    "cyclone": {
        "label": "Cyclone / Severe Weather",
        "hazard_radius_km": 300.0,
        "recommendation": "Diverting to the nearest port reachable by sea, weighted for safety and steering clear of the storm cell around the vessel. Ports inside the storm are skipped.",
    },
    "piracy": {
        "label": "Piracy / Man-Made Threat",
        "hazard_radius_km": 250.0,
        "recommendation": "Diverting to the nearest port reachable by sea, maximising safety margin and keeping clear of the reported threat zone. Ports inside the threat zone are skipped.",
    },
    "medical": {
        "label": "Medical Emergency (Crew Health)",
        "hazard_radius_km": 0.0,
        "recommendation": "Diverting to the port reachable fastest by sea for medical evacuation.",
    },
    "mechanical": {
        "label": "Mechanical Failure / Engine Fault",
        "hazard_radius_km": 0.0,
        "recommendation": "Diverting to the nearest port reachable by sea, favouring calmer water at moderate speed to limit strain while the fault is contained.",
    },
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema and tables exist on startup
    Base.metadata.create_all(bind=engine)

    # Seed default ships if the database is empty
    db = next(get_db())
    try:
        if db.query(models.Ship).count() == 0:
            default_ships = [
                models.Ship(
                    name="MV Bharat", imo="IMO9876543",
                    displacement=55000.0, frontal_area=1200.0,
                    engine_efficiency=0.45, sfoc=170.0,
                    risk_index=15.0,
                    maintenance_schedule="Next maintenance: 2026-12-15",
                    parts_replacement_log="Filter replacement (2026-06-01)"
                ),
                models.Ship(
                    name="Sagar Shakti", imo="IMO9812345",
                    displacement=82000.0, frontal_area=1450.0,
                    engine_efficiency=0.42, sfoc=175.0,
                    risk_index=12.0,
                    maintenance_schedule="Next maintenance: 2027-03-10",
                    parts_replacement_log="Turbocharger overhaul (2026-08-01)"
                ),
                models.Ship(
                    name="INS Vikrant", imo="IMO9900001",
                    displacement=120000.0, frontal_area=1800.0,
                    engine_efficiency=0.40, sfoc=185.0,
                    risk_index=8.0,
                    maintenance_schedule="Next maintenance: 2027-01-20",
                    parts_replacement_log="Propeller inspection (2026-07-15)"
                ),
            ]
            db.add_all(default_ships)
            db.commit()
            print(f"[Aegir] Seeded {len(default_ships)} default ship profiles into the database.")
    finally:
        db.close()

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
        return calculate_pareto_routes(
            origin=request.origin,
            destination=request.destination,
            ship_profile=ship_profile,
            custom_weights=custom_w
        )
    except RouteUnreachable as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/routes/reroute")
def reroute_from_position(request: schemas.RerouteRequest, db: Session = Depends(get_db)):
    """
    Recompute the Pareto front from the position the operator dragged the vessel
    to. The sailed leg is discarded: the drop point becomes the new departure, so
    every route in the response starts there.
    """
    db_ship = crud.get_ship(db, ship_id=request.ship_id)
    if not db_ship:
        raise HTTPException(status_code=404, detail="Selected ship profile not found")

    ship_profile = {
        "displacement": db_ship.displacement,
        "frontal_area": db_ship.frontal_area,
        "engine_efficiency": db_ship.engine_efficiency,
        "sfoc": db_ship.sfoc
    }

    try:
        return calculate_routes_from_point(
            resume_coord=(request.resume_lat, request.resume_lon),
            destination=request.destination,
            ship_profile=ship_profile,
            custom_weights={
                "safety_weight": request.weights.safety_weight,
                "fuel_weight": request.weights.fuel_weight,
                "time_weight": request.weights.time_weight
            }
        )
    except RouteUnreachable as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
    weight_profiles = dict(WEIGHT_PROFILES)
    weight_profiles["balanced"] = {
        "safety_weight": request.weights.safety_weight,
        "fuel_weight": request.weights.fuel_weight,
        "time_weight": request.weights.time_weight
    }

    if request.origin not in PORTS or request.destination not in PORTS:
        raise HTTPException(status_code=400, detail="Unknown origin or destination port.")

    results = {}
    origin_coord = PORTS[request.origin]
    goal_coord = PORTS[request.destination]

    try:
        for key, weights in weight_profiles.items():
            # Instantiate DSLite, run initial build
            ds = DSLite(origin_coord, goal_coord, ship_profile, weights)
            ds.initialize()
            ds.compute_shortest_path()

            # Apply the weather shift and repair the path incrementally
            ds.replan_after_weather_shift(current_coord, changed_cells)

            repaired_path = ds.get_path()

            # Prepend the already traveled path prefix to show the full voyage
            traveled_prefix = [tuple(p) for p in request.path_nodes[:curr_idx]]
            full_path = traveled_prefix + repaired_path

            results[key] = {
                "weights": weights,
                **get_path_metrics(full_path, ship_profile)
            }
    except RouteUnreachable as e:
        raise HTTPException(status_code=422, detail=str(e))

    return results

@app.get("/api/ports")
def list_ports():
    """
    The port registry the router accepts, with the display name and grouping the
    UI renders. Served so the frontend does not keep a second copy of the
    coordinates that could drift out of step with the engine's.
    """
    return [
        {
            "key": key,
            "name": meta["name"],
            "lat": meta["lat"],
            "lon": meta["lon"],
            "country": meta["country"],
            "region": meta["region"],
        }
        for key, meta in PORT_META.items()
    ]


@app.post("/api/routes/emergency")
def emergency_reroute(request: schemas.EmergencyRequest, db: Session = Depends(get_db)):
    """
    Emergency diversion: abandon the planned destination and make for the
    nearest port reachable by sea from the vessel's current position, under the
    priorities of the declared emergency.

    The origin and destination stay eligible as diversion targets -- if the port
    the vessel just left is genuinely the closest refuge, that is the right
    answer. What the vessel must not do is divert into the hazard it is fleeing,
    so for cyclone and piracy every port inside the marked zone is excluded.
    """
    if request.emergency_type not in EMERGENCY_PROFILES:
        raise HTTPException(status_code=400, detail="Unknown emergency type")
    if request.origin not in PORTS or request.destination not in PORTS:
        raise HTTPException(status_code=400, detail="Unknown origin or destination port.")

    db_ship = crud.get_ship(db, ship_id=request.ship_id)
    if not db_ship:
        raise HTTPException(status_code=404, detail="Ship not found")

    ship_profile = {
        "displacement": db_ship.displacement,
        "frontal_area": db_ship.frontal_area,
        "engine_efficiency": db_ship.engine_efficiency,
        "sfoc": db_ship.sfoc
    }

    weights = EMERGENCY_PROFILES[request.emergency_type]
    meta = EMERGENCY_META[request.emergency_type]
    current_coord = (request.current_lat, request.current_lon)

    # Mark a danger zone at the vessel's position for hazard-type emergencies
    # so the router actively diverts around it, not just re-weights the grid.
    hazard_zone = None
    radius_km = meta["hazard_radius_km"]
    if request.emergency_type == "cyclone":
        env_grid.inject_storm(
            center_lat=request.current_lat, center_lon=request.current_lon,
            radius_deg=radius_km / 111.0, severity=1.6
        )
        hazard_zone = {"lat": request.current_lat, "lon": request.current_lon, "radius_km": radius_km}
    elif request.emergency_type == "piracy":
        env_grid.inject_piracy_threat(
            center_lat=request.current_lat, center_lon=request.current_lon,
            radius_deg=radius_km / 111.0, severity=1.0
        )
        hazard_zone = {"lat": request.current_lat, "lon": request.current_lon, "radius_km": radius_km}

    # Ports swallowed by the hazard are no refuge. Straight-line distance is the
    # right test here: the zone is a circle drawn on the map, not a sailing leg.
    excluded = []
    if radius_km > 0.0:
        radius_nm = radius_km / 1.852
        excluded = sorted(
            name for name, (plat, plon) in PORTS.items()
            if haversine_distance(request.current_lat, request.current_lon, plat, plon) <= radius_nm
        )

    hazard_fallback = False
    try:
        diversion = nearest_port_by_sea(current_coord, ship_profile, weights, excluded=excluded)
    except RouteUnreachable as e:
        if not excluded:
            raise HTTPException(status_code=422, detail=str(e))
        # Everything clear of the hazard was unreachable. Surfacing the port
        # inside the zone with a flag beats returning nothing in an emergency.
        hazard_fallback = True
        try:
            diversion = nearest_port_by_sea(current_coord, ship_profile, weights)
        except RouteUnreachable as inner:
            raise HTTPException(status_code=422, detail=str(inner))

    port_key = diversion["port"]
    port_meta = PORT_META[port_key]
    metrics = get_path_metrics(diversion["path"], ship_profile)

    return {
        "emergency_type": request.emergency_type,
        "label": meta["label"],
        "recommendation": meta["recommendation"],
        "weights": weights,
        "hazard_zone": hazard_zone,
        "diverted": True,
        "origin": request.origin,
        "destination": request.destination,
        "divert_port": {
            "key": port_key,
            "name": port_meta["name"],
            "country": port_meta["country"],
            "lat": port_meta["lat"],
            "lon": port_meta["lon"],
            "distance_nm": diversion["distance_nm"],
            "is_origin": port_key == request.origin,
            "is_destination": port_key == request.destination,
        },
        "excluded_ports": excluded,
        "hazard_fallback": hazard_fallback,
        # Retained under its old name so the existing dock keeps rendering until
        # the emergency panel is rebuilt around divert_port.
        "nearest_port": {"name": port_meta["name"], "distance_nm": diversion["distance_nm"]},
        "current_position": {"lat": request.current_lat, "lon": request.current_lon},
        **metrics
    }

from .environmental_service import env_service, OPEN_METEO_ATTRIBUTION, ENVIRONMENTAL_DISCLAIMER

# --- Environmental Endpoints (Open-Meteo Integration) ---

@app.get("/api/environment")
def get_environment_telemetry(lat: Optional[float] = None, lon: Optional[float] = None, port: Optional[str] = None):
    """
    Returns live normalized Open-Meteo environmental telemetry for a vessel coordinate or named port.
    Includes CC BY 4.0 attribution and prototype decision-support disclaimer.
    """
    target_lat = lat
    target_lon = lon

    if port and port in PORTS:
        target_lat, target_lon = PORTS[port]
    elif target_lat is None or target_lon is None:
        # Default to JNPT / Central Arabian Sea
        target_lat, target_lon = 18.95, 72.95

    return env_service.get_point_environment(target_lat, target_lon)

@app.post("/api/environment/sync")
def sync_environment_with_open_meteo(stride: int = 20):
    """
    Triggers a live Open-Meteo weather and marine forecast sync across the Indian Ocean basin.
    Updates the active EnvironmentalGrid and recalculates D* Lite cost matrices.
    """
    return env_service.sync_basin_grid(env_grid, stride=stride)

@app.get("/api/weather/layers")
def get_weather_layers(cell_deg: float = 1.0):
    """
    Grid representation of wind speeds, wave heights, ocean currents, piracy risk,
    and coastal buffer for tactical map overlays.
    """
    stride = max(1, int(round(cell_deg / env_grid.cell_deg)))

    def reduce_layer(arr):
        rows = arr.shape[0] // stride * stride
        cols = arr.shape[1] // stride * stride
        trimmed = arr[:rows, :cols]
        blocks = trimmed.reshape(rows // stride, stride, cols // stride, stride)
        return np.round(blocks.max(axis=(1, 3)), 2).tolist()

    def reduce_mean_layer(arr):
        rows = arr.shape[0] // stride * stride
        cols = arr.shape[1] // stride * stride
        trimmed = arr[:rows, :cols]
        blocks = trimmed.reshape(rows // stride, stride, cols // stride, stride)
        return np.round(blocks.mean(axis=(1, 3)), 2).tolist()

    out_rows = env_grid.height // stride
    out_cols = env_grid.width // stride
    out_cell = env_grid.cell_deg * stride

    # Current speed magnitude array
    current_magnitude = np.sqrt(env_grid.currents_u ** 2 + env_grid.currents_v ** 2)

    coastal_buffer_field = np.where(
        env_grid.land, 0.0, np.clip(env_grid.STANDOFF_CELLS - env_grid.dist_to_land, 0.0, env_grid.STANDOFF_CELLS)
    ).astype(np.float32)

    return {
        "bounds": {
            "west": env_grid.west,
            "east": env_grid.west + out_cols * out_cell,
            "south": env_grid.north - out_rows * out_cell,
            "north": env_grid.north,
            "rows": out_rows,
            "cols": out_cols,
            "cell_deg": out_cell
        },
        "winds": reduce_layer(env_grid.winds),
        "waves": reduce_layer(env_grid.waves),
        "currents": reduce_layer(current_magnitude),
        "currents_u": reduce_mean_layer(env_grid.currents_u),
        "currents_v": reduce_mean_layer(env_grid.currents_v),
        "piracy": reduce_layer(env_grid.piracy),
        "coastal_buffer": reduce_layer(coastal_buffer_field),
        "attribution": OPEN_METEO_ATTRIBUTION,
        "disclaimer": ENVIRONMENTAL_DISCLAIMER,
        "last_sync": env_service.last_sync_timestamp,
        "data_source": env_service.last_sync_source
    }
