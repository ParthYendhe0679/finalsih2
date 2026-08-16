import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.mopbd_engine import DSLite, coord_to_grid, PORTS

client = TestClient(app)

def test_ships_endpoints():
    # Test GET ships list
    response = client.get("/api/ships")
    assert response.status_code == 200
    ships = response.json()
    assert len(ships) >= 3
    assert ships[0]["name"] == "Aegir Container"

def test_routing_calculation():
    # Test POST calculate routes
    payload = {
        "origin": "JNPT",
        "destination": "Colombo",
        "ship_id": 1,
        "weights": {
            "safety_weight": 0.34,
            "fuel_weight": 0.33,
            "time_weight": 0.33
        }
    }
    response = client.post("/api/routes/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Verify all four Pareto points are calculated
    for key in ["fastest", "fuel_optimized", "safest", "balanced"]:
        assert key in data
        assert "waypoints" in data[key]
        assert len(data[key]["waypoints"]) > 0
        assert "total_time" in data[key]
        assert "total_fuel" in data[key]
        assert "total_risk" in data[key]

def test_ds_lite_basic_computation():
    origin_coord = PORTS["JNPT"]
    goal_coord = PORTS["Colombo"]
    ship_profile = {
        "displacement": 55000.0,
        "frontal_area": 1200.0,
        "engine_efficiency": 0.45,
        "sfoc": 165.0
    }
    weights = {"time_weight": 0.33, "fuel_weight": 0.33, "safety_weight": 0.34}
    
    ds = DSLite(origin_coord, goal_coord, ship_profile, weights)
    ds.initialize()
    ds.compute_shortest_path()
    
    path = ds.get_path()
    assert len(path) > 1
    # Check that it starts near origin and ends near destination grid cells
    start_grid = coord_to_grid(origin_coord[0], origin_coord[1])
    end_grid = coord_to_grid(goal_coord[0], goal_coord[1])
    
    path_start_grid = coord_to_grid(path[0][0], path[0][1])
    path_end_grid = coord_to_grid(path[-1][0], path[-1][1])
    
    assert abs(path_start_grid[0] - start_grid[0]) <= 1
    assert abs(path_start_grid[1] - start_grid[1]) <= 1
    assert abs(path_end_grid[0] - end_grid[0]) <= 1
    assert abs(path_end_grid[1] - end_grid[1]) <= 1
