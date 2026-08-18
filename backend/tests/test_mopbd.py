import itertools

import pytest

from app.mopbd_engine import (
    DSLite, coord_to_grid, PORTS, can_traverse, is_navigable, calculate_edge_vector,
)
from app.raster_parser import env_grid

# tests/ has no __init__.py, so pytest puts this directory on sys.path directly
from api_client import make_client

client = make_client()

SHIP_PROFILE = {
    "displacement": 55000.0,
    "frontal_area": 1200.0,
    "engine_efficiency": 0.45,
    "sfoc": 165.0,
}
BALANCED = {"time_weight": 0.33, "fuel_weight": 0.33, "safety_weight": 0.34}


def assert_route_at_sea(waypoints, label=""):
    """
    A route may only touch land at its two endpoints, which are the berths
    themselves; every leg in between must be a legal open-water step.
    """
    interior = waypoints[1:-1]
    ashore = [(lat, lon) for lat, lon in interior if env_grid.is_land(lat, lon)]
    assert not ashore, f"{label}: {len(ashore)} waypoint(s) on land, e.g. {ashore[:3]}"

    cells = [coord_to_grid(lat, lon) for lat, lon in interior]
    illegal = [
        (u, v) for u, v in zip(cells, cells[1:])
        if u != v and not can_traverse(u, v)
    ]
    assert not illegal, f"{label}: {len(illegal)} illegal leg(s), e.g. {illegal[:3]}"


@pytest.fixture
def pristine_weather():
    """
    inject_storm mutates the process-wide environmental grid, so any test that
    triggers one restores the original fields afterwards.
    """
    winds = env_grid.winds.copy()
    waves = env_grid.waves.copy()
    yield
    env_grid.winds = winds
    env_grid.waves = waves
    env_grid._precompute_derived()


def test_ships_endpoints():
    response = client.get("/api/ships")
    assert response.status_code == 200
    ships = response.json()
    assert len(ships) >= 3
    assert ships[0]["name"] == "Aegir Container"


def test_routing_calculation():
    payload = {
        "origin": "JNPT",
        "destination": "Colombo",
        "ship_id": 1,
        "weights": {"safety_weight": 0.34, "fuel_weight": 0.33, "time_weight": 0.33},
    }
    response = client.post("/api/routes/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

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

    ds = DSLite(origin_coord, goal_coord, SHIP_PROFILE, BALANCED)
    ds.initialize()
    ds.compute_shortest_path()

    path = ds.get_path()
    assert len(path) > 1

    # The route is anchored at the real berths
    assert path[0] == origin_coord
    assert path[-1] == goal_coord


# --- Regression tests for the land-crossing defect ---------------------------

def test_land_mask_is_loaded_and_plausible():
    """
    An all-water mask is the exact failure mode that let routes cross India, so
    assert the mask actually marks known land and known sea.
    """
    assert env_grid.land is not None
    water_fraction = float(env_grid.navigable.mean())
    assert 0.5 < water_fraction < 0.95, f"implausible water fraction {water_fraction}"

    # Interior peninsular India must be land
    for lat, lon in [(15.0, 76.0), (13.0, 77.0), (21.0, 78.0), (11.0, 78.5)]:
        assert env_grid.is_land(lat, lon), f"({lat},{lon}) should be land"

    # Open ocean must be water
    for lat, lon in [(15.0, 65.0), (0.0, 80.0), (-15.0, 70.0), (10.0, 90.0)]:
        assert not env_grid.is_land(lat, lon), f"({lat},{lon}) should be sea"


def test_land_edges_are_infinitely_expensive():
    """Any step into a land cell must be rejected by the cost function."""
    land_cell = coord_to_grid(15.0, 76.0)   # interior Karnataka
    assert not is_navigable(*land_cell)

    neighbour = (land_cell[0], land_cell[1] - 1)
    t, f, r = calculate_edge_vector(neighbour, land_cell, SHIP_PROFILE)
    assert t == float("inf") and f == float("inf") and r == float("inf")


def test_jnpt_colombo_route_stays_at_sea():
    """
    The original defect: JNPT -> Colombo was routed straight across the Indian
    peninsula through Karnataka and Tamil Nadu.
    """
    ds = DSLite(PORTS["JNPT"], PORTS["Colombo"], SHIP_PROFILE, BALANCED)
    ds.initialize()
    ds.compute_shortest_path()
    assert_route_at_sea(ds.get_path(), "JNPT->Colombo")


@pytest.mark.parametrize("origin,destination", list(itertools.permutations(PORTS, 2)))
def test_every_port_pair_stays_at_sea(origin, destination):
    ds = DSLite(PORTS[origin], PORTS[destination], SHIP_PROFILE, BALANCED)
    ds.initialize()
    ds.compute_shortest_path()
    assert_route_at_sea(ds.get_path(), f"{origin}->{destination}")


def test_ports_snap_into_the_open_ocean():
    """
    Ports sit on the coast, so several fall in land cells of the mask. Each must
    resolve to a nearby cell in the main ocean component, not an inland lake.
    """
    for name, (lat, lon) in PORTS.items():
        cell = env_grid.nearest_navigable(lat, lon)
        assert cell is not None, f"{name} has no navigable cell"
        assert env_grid.ocean[cell], f"{name} snapped outside the open ocean"


def test_coordinate_transforms_round_trip():
    """
    coord_to_grid and grid_to_coord previously disagreed on scaling (WIDTH vs
    WIDTH - 1), so a round trip drifted.
    """
    from app import grid

    for row in range(0, grid.HEIGHT, 17):
        for col in range(0, grid.WIDTH, 23):
            lat, lon = grid.grid_to_coord(row, col)
            assert grid.coord_to_grid(lat, lon) == (row, col)


def test_diagonal_steps_cannot_clip_a_land_corner():
    """The successor table must never offer a diagonal that squeezes past land."""
    table = __import__("app.mopbd_engine", fromlist=["x"]).successor_table()
    from app import grid

    checked = 0
    for row in range(0, grid.HEIGHT, 5):
        for col in range(0, grid.WIDTH, 5):
            for v in table[row * grid.WIDTH + col]:
                assert can_traverse((row, col), v)
                checked += 1
    assert checked > 0


def test_weather_layers_endpoint_is_downsampled():
    response = client.get("/api/weather/layers")
    assert response.status_code == 200
    data = response.json()
    bounds = data["bounds"]
    assert bounds["cell_deg"] == pytest.approx(1.0)
    assert len(data["winds"]) == bounds["rows"]
    assert len(data["winds"][0]) == bounds["cols"]


def test_severe_storm_exercises_the_underconsistent_repair_branch(pristine_weather):
    """
    A storm raises edge costs, which makes previously settled vertices
    underconsistent and drives D* Lite's second repair branch. That branch
    iterates predecessors plus the vertex itself; since successors now come from
    a precomputed tuple table, concatenating a list onto them raised TypeError.
    A mild storm can terminate before reaching it, so this uses a severe one.
    """
    ds = DSLite(PORTS["JNPT"], PORTS["Colombo"], SHIP_PROFILE, BALANCED)
    ds.initialize()
    ds.compute_shortest_path()
    baseline = ds.get_path()

    midpoint = baseline[len(baseline) // 2]
    changed = env_grid.inject_storm(midpoint[0], midpoint[1], 3.0, severity=3.0)
    assert changed, "storm injection changed no cells"

    ds.replan_after_weather_shift(baseline[8], changed)
    repaired = ds.get_path()

    assert_route_at_sea(repaired, "severe-storm replan")
    assert repaired != baseline, "route did not change despite a storm on the track"


def test_replan_endpoint_repairs_around_a_storm(pristine_weather):
    calc = client.post("/api/routes/calculate", json={
        "origin": "JNPT",
        "destination": "Colombo",
        "ship_id": 1,
        "weights": {"safety_weight": 0.34, "fuel_weight": 0.33, "time_weight": 0.33},
    })
    assert calc.status_code == 200
    baseline = calc.json()["balanced"]["waypoints"]

    response = client.post("/api/routes/replan", json={
        "origin": "JNPT",
        "destination": "Colombo",
        "ship_id": 1,
        "weights": {"safety_weight": 0.34, "fuel_weight": 0.33, "time_weight": 0.33},
        "path_nodes": baseline,
        "current_idx": 5,
        "storm_lat": 12.0,
        "storm_lon": 74.0,
        "storm_radius": 300.0,
    })
    assert response.status_code == 200
    for key, route in response.json().items():
        assert_route_at_sea(route["waypoints"], f"replan[{key}]")
