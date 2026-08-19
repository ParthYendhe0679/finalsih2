"""
Emergency diversion: the vessel abandons its destination and makes for the
nearest port reachable *by sea*, under the declared emergency's priorities.
"""

import pytest

from app.mopbd_engine import (
    PORTS, PORT_META, nearest_port_by_sea, can_traverse, RouteUnreachable,
)
from app.grid import coord_to_grid, haversine_distance
from app.raster_parser import env_grid

from api_client import make_client

client = make_client()

SHIP_PROFILE = {
    "displacement": 55000.0,
    "frontal_area": 1200.0,
    "engine_efficiency": 0.45,
    "sfoc": 170.0,
}
MEDICAL = {"safety_weight": 0.10, "fuel_weight": 0.10, "time_weight": 0.80}

# A vessel well out in the Arabian Sea, clear of every port zone.
AT_SEA = (13.0, 73.5)


@pytest.fixture
def pristine_environment():
    """
    A cyclone or piracy declaration mutates the process-wide environmental grid,
    so anything that declares one has to put the fields back.
    """
    winds = env_grid.winds.copy()
    waves = env_grid.waves.copy()
    piracy = env_grid.piracy.copy()
    yield
    env_grid.winds = winds
    env_grid.waves = waves
    env_grid.piracy = piracy
    env_grid._precompute_derived()


def declare(kind, lat, lon, origin="JNPT", destination="Colombo", ship_id=1):
    return client.post("/api/routes/emergency", json={
        "origin": origin, "destination": destination, "ship_id": ship_id,
        "emergency_type": kind, "current_lat": lat, "current_lon": lon,
    })


def assert_at_sea(waypoints, label=""):
    """Same invariant the router is held to: only the endpoints may be berths."""
    interior = [tuple(w) for w in waypoints[1:-1]]
    ashore = [w for w in interior if env_grid.is_land(*w)]
    assert not ashore, f"{label}: {len(ashore)} interior waypoint(s) on land"

    cells = [coord_to_grid(*w) for w in interior]
    illegal = [(u, v) for u, v in zip(cells, cells[1:]) if u != v and not can_traverse(u, v)]
    assert not illegal, f"{label}: {len(illegal)} illegal leg(s)"


# --- port registry -----------------------------------------------------------

def test_ports_endpoint_serves_the_whole_registry():
    response = client.get("/api/ports")
    assert response.status_code == 200
    ports = response.json()

    assert len(ports) == len(PORTS)
    assert {p["key"] for p in ports} == set(PORTS)
    for p in ports:
        assert {"key", "name", "lat", "lon", "country", "region"} <= set(p)
        # The served coordinate must be the one the router actually uses.
        assert (p["lat"], p["lon"]) == PORTS[p["key"]]


# --- nearest port by sea -----------------------------------------------------

def test_nearest_port_prefers_sea_distance_over_straight_line():
    """
    The reason this is a graph search and not a haversine scan: off the Somali
    coast the closest port on a straight line is Aden, but that line crosses the
    Horn of Africa. By sea Salalah is nearer, and Salalah is the answer.
    """
    vessel = (5.0, 52.0)
    by_sea = nearest_port_by_sea(vessel, SHIP_PROFILE, MEDICAL)["port"]
    by_line = min(PORTS, key=lambda p: haversine_distance(*vessel, *PORTS[p]))

    assert by_line == "Aden", "fixture drifted; this leg no longer exercises the difference"
    assert by_sea == "Salalah"


def test_nearest_port_route_is_navigable_and_ends_at_the_berth():
    result = nearest_port_by_sea(AT_SEA, SHIP_PROFILE, MEDICAL)
    assert_at_sea(result["path"], "nearest-port route")
    assert result["path"][0] == AT_SEA
    assert result["path"][-1] == PORTS[result["port"]]
    assert result["distance_nm"] > 0


def test_excluding_ports_yields_progressively_further_targets():
    first = nearest_port_by_sea(AT_SEA, SHIP_PROFILE, MEDICAL)
    second = nearest_port_by_sea(AT_SEA, SHIP_PROFILE, MEDICAL, excluded={first["port"]})
    third = nearest_port_by_sea(
        AT_SEA, SHIP_PROFILE, MEDICAL, excluded={first["port"], second["port"]}
    )

    assert len({first["port"], second["port"], third["port"]}) == 3
    assert first["cost"] <= second["cost"] <= third["cost"]


def test_excluding_every_port_raises_rather_than_guessing():
    with pytest.raises(RouteUnreachable):
        nearest_port_by_sea(AT_SEA, SHIP_PROFILE, MEDICAL, excluded=set(PORTS))


def test_ports_sharing_a_grid_cell_are_both_selectable():
    """
    Mumbai and JNPT are 0.11 deg apart and land in the same 0.25 deg cell, so the
    cell -> port mapping has to be one-to-many or one of them becomes unreachable.
    """
    assert coord_to_grid(*PORTS["Mumbai"]) == coord_to_grid(*PORTS["JNPT"])

    near_mumbai = (19.3, 71.2)
    first = nearest_port_by_sea(near_mumbai, SHIP_PROFILE, MEDICAL)
    assert first["port"] in ("Mumbai", "JNPT")

    second = nearest_port_by_sea(near_mumbai, SHIP_PROFILE, MEDICAL, excluded={first["port"]})
    assert second["port"] in ("Mumbai", "JNPT") and second["port"] != first["port"]


# --- the endpoint ------------------------------------------------------------

@pytest.mark.parametrize("kind", ["medical", "mechanical", "cyclone", "piracy"])
def test_every_emergency_type_diverts_to_a_reachable_port(kind, pristine_environment):
    response = declare(kind, *AT_SEA)
    assert response.status_code == 200, response.text
    data = response.json()

    port = data["divert_port"]
    assert data["diverted"] is True
    assert port["key"] in PORTS
    assert port["name"] == PORT_META[port["key"]]["name"]
    assert data["weights"] == data["weights"]  # profile echoed back for the UI

    assert_at_sea(data["waypoints"], kind)
    assert tuple(data["waypoints"][-1]) == PORTS[port["key"]]
    assert data["total_time"] > 0


def test_hazard_zone_excludes_the_ports_it_swallows(pristine_environment):
    """
    A cyclone centred on the vessel must not send it to a port inside the storm.
    Sitting ~100 km off Mumbai puts Mumbai and JNPT inside the 300 km radius.
    """
    vessel = (19.3, 71.2)

    calm = declare("medical", *vessel).json()
    assert calm["divert_port"]["key"] in ("Mumbai", "JNPT")
    assert calm["excluded_ports"] == []

    storm = declare("cyclone", *vessel).json()
    assert set(storm["excluded_ports"]) >= {"Mumbai", "JNPT"}
    assert storm["divert_port"]["key"] not in storm["excluded_ports"]
    assert storm["divert_port"]["key"] != calm["divert_port"]["key"]
    assert storm["hazard_fallback"] is False
    assert storm["hazard_zone"]["radius_km"] == 300.0
    assert_at_sea(storm["waypoints"], "cyclone diversion")


def test_medical_emergency_marks_no_hazard_zone(pristine_environment):
    data = declare("medical", *AT_SEA).json()
    assert data["hazard_zone"] is None
    assert data["excluded_ports"] == []


def test_destination_port_stays_eligible_as_a_refuge(pristine_environment):
    """
    The button is gated client-side near the berths, but if the destination is
    genuinely the nearest refuge from open water it is still the right answer --
    the backend must not exclude it.
    """
    lat, lon = PORTS["Colombo"]
    data = declare("medical", lat + 0.6, lon - 0.6, destination="Colombo").json()

    assert data["divert_port"]["key"] == "Colombo"
    assert data["divert_port"]["is_destination"] is True
    assert data["divert_port"]["is_origin"] is False


def test_emergency_rejects_bad_input():
    assert declare("nonsense", *AT_SEA).status_code == 400
    assert declare("medical", *AT_SEA, origin="Atlantis").status_code == 400
    assert declare("medical", *AT_SEA, destination="Atlantis").status_code == 400
    assert declare("medical", *AT_SEA, ship_id=9999).status_code == 404


# --- charted shipping lanes --------------------------------------------------

def test_malacca_strait_is_navigable():
    """
    The Singapore Strait is narrower than a 0.25 deg cell, so the raw land mask
    closed it and every eastbound voyage rounded Sumatra instead -- JNPT to
    Singapore came out at 1963 NM against a real ~2450 NM via the strait, by way
    of a detour that no vessel sails. generator.carve_channels reopens the lane.
    """
    from app.mopbd_engine import successor_table, WIDTH

    succ = successor_table()
    start = env_grid.nearest_navigable(5.8, 95.5)     # Andaman Sea approach
    goal = env_grid.nearest_navigable(*PORTS["Singapore"])

    # Confine the walk to the strait so a route round Sumatra cannot pass for one
    # through it.
    lo_r, _ = coord_to_grid(8.0, 100.0)
    hi_r, _ = coord_to_grid(-1.0, 100.0)
    _, lo_c = coord_to_grid(0.0, 94.0)
    _, hi_c = coord_to_grid(0.0, 106.0)

    seen, stack = {start}, [start]
    while stack:
        u = stack.pop()
        if u == goal:
            break
        for v in succ[u[0] * WIDTH + u[1]]:
            if v in seen or not (lo_r <= v[0] <= hi_r and lo_c <= v[1] <= hi_c):
                continue
            seen.add(v)
            stack.append(v)

    assert goal in seen, "the Malacca Strait is closed; eastbound voyages will round Sumatra"
