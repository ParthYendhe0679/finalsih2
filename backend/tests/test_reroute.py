"""
Tests for drag-to-reroute: re-solving the Pareto front from the position the
operator dragged the vessel to.

The sailed leg is deliberately discarded, so a reroute is a fresh port-free solve
anchored at the drop coordinate. These tests pin that contract down.
"""

import pytest

from app.mopbd_engine import (
    PORTS, calculate_pareto_routes, calculate_routes_from_point,
)

# tests/ has no __init__.py, so pytest puts this directory on sys.path directly
from api_client import make_client
from test_mopbd import SHIP_PROFILE, BALANCED, assert_route_at_sea

client = make_client()

WEIGHTS_PAYLOAD = {"safety_weight": 0.34, "fuel_weight": 0.33, "time_weight": 0.33}
PROFILE_KEYS = {"fastest", "fuel_optimized", "safest", "balanced"}


@pytest.fixture(scope="module")
def baseline_front():
    """Full JNPT -> Singapore front, the voyage the vessel is dragged along."""
    return calculate_pareto_routes("JNPT", "Singapore", SHIP_PROFILE, BALANCED)


@pytest.fixture(scope="module")
def drop_point(baseline_front):
    """A waypoint roughly halfway along the balanced track."""
    waypoints = baseline_front["balanced"]["waypoints"]
    return tuple(waypoints[len(waypoints) // 2])


def post_reroute(lat, lon, destination="Singapore", ship_id=1):
    return client.post("/api/routes/reroute", json={
        "destination": destination,
        "ship_id": ship_id,
        "weights": WEIGHTS_PAYLOAD,
        "resume_lat": lat,
        "resume_lon": lon,
    })


def test_reroute_starts_at_drop_point(drop_point):
    """
    Every profile must begin exactly where the ship was dropped, not at the centre
    of the grid cell it snapped into -- otherwise the vessel visibly jumps on
    release.
    """
    response = post_reroute(*drop_point)
    assert response.status_code == 200

    for key, route in response.json().items():
        assert tuple(route["waypoints"][0]) == drop_point, f"{key} does not start at the drop point"


def test_all_four_profiles_returned(drop_point):
    response = post_reroute(*drop_point)
    assert response.status_code == 200
    data = response.json()

    assert set(data) == PROFILE_KEYS
    for key, route in data.items():
        assert len(route["waypoints"]) > 1, f"{key} returned a degenerate route"
        for field in ("total_time", "total_fuel", "total_risk", "weights"):
            assert field in route, f"{key} missing {field}"


def test_reroute_ends_at_the_destination_berth(drop_point):
    response = post_reroute(*drop_point)
    assert response.status_code == 200

    for key, route in response.json().items():
        assert tuple(route["waypoints"][-1]) == PORTS["Singapore"], f"{key} does not reach the berth"


def test_reroute_shorter_than_full_voyage(baseline_front, drop_point):
    """A mid-voyage re-solve covers less ground than the whole passage."""
    response = post_reroute(*drop_point)
    assert response.status_code == 200
    data = response.json()

    for key in PROFILE_KEYS:
        assert data[key]["total_time"] < baseline_front[key]["total_time"], (
            f"{key}: rerouted leg is not shorter than the full voyage"
        )
        assert data[key]["total_time"] > 0.0


def test_reroute_stays_on_water(drop_point):
    response = post_reroute(*drop_point)
    assert response.status_code == 200

    for key, route in response.json().items():
        assert_route_at_sea(route["waypoints"], f"reroute[{key}]")


def test_reroute_from_port_matches_full_solve(baseline_front):
    """
    Handing the endpoint the origin port's own coordinate must reproduce the
    port-to-port front waypoint for waypoint -- the shared _solve_front core is
    what guarantees the two paths cannot drift apart.
    """
    response = post_reroute(*PORTS["JNPT"])
    assert response.status_code == 200
    data = response.json()

    for key in PROFILE_KEYS:
        assert data[key]["waypoints"] == baseline_front[key]["waypoints"], (
            f"{key}: reroute from the berth diverged from the port-to-port solve"
        )


def test_reroute_onto_land_snaps_to_water():
    """
    The drag is constrained to the route line so this should not arise in the UI,
    but a coordinate inside a landmass must still yield a valid sea route rather
    than a 500.
    """
    response = post_reroute(15.0, 76.0)  # interior Karnataka
    assert response.status_code == 200

    for key, route in response.json().items():
        assert_route_at_sea(route["waypoints"], f"land-drop[{key}]")


def test_reroute_rejects_unknown_destination(drop_point):
    response = post_reroute(*drop_point, destination="Atlantis")
    assert response.status_code == 400


def test_reroute_rejects_unknown_ship(drop_point):
    response = post_reroute(*drop_point, ship_id=99999)
    assert response.status_code == 404


def test_engine_helper_rejects_unknown_destination(drop_point):
    with pytest.raises(ValueError):
        calculate_routes_from_point(drop_point, "Atlantis", SHIP_PROFILE, BALANCED)
