import math
import heapq
from typing import List, Dict, Tuple, Any, Optional

# Grid geometry lives in app.grid. WEST/EAST/SOUTH are re-exported unused here
# because they were part of this module's public surface before the split.
from .grid import (  # noqa: F401
    WEST, EAST, SOUTH, NORTH, CELL_DEG, WIDTH, HEIGHT,
    grid_to_coord, coord_to_grid, in_bounds, haversine_distance,
)
from .raster_parser import env_grid

# Ports mapping (lat, lon)
PORTS = {
    "JNPT": (18.95, 72.95),
    "Colombo": (6.94, 79.86),
    "Singapore": (1.35, 103.82),
    "Aden": (12.80, 45.00),
    "Port Louis": (-20.16, 57.50)
}

# Neighbour offsets. Tables below are indexed by _off_idx(dr, dc) so a lookup is
# a list index rather than a tuple hash.
_OFFSETS = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr, dc) != (0, 0)]


def _off_idx(dr: int, dc: int) -> int:
    return (dr + 1) * 3 + (dc + 1)


# Unit direction vector per offset. The grid is uniform in degrees, so the
# heading of a step depends only on (dr, dc) and is resolved once here.
_DIRECTION: List[Optional[Tuple[float, float]]] = [None] * 9
for _dr, _dc in _OFFSETS:
    _mag = math.sqrt(_dr * _dr + _dc * _dc)
    # d_lat = -dr * CELL_DEG, d_lon = +dc * CELL_DEG
    _DIRECTION[_off_idx(_dr, _dc)] = (_dc / _mag, -_dr / _mag)  # (dx, dy)

# Step length in NM depends only on the source row and the offset, so the whole
# table is 200 x 9 entries rather than a haversine call per edge evaluation.
_STEP_NM: List[List[float]] = []
for _row in range(HEIGHT):
    _lat = NORTH - (_row + 0.5) * CELL_DEG
    _row_table = [0.0] * 9
    for _dr, _dc in _OFFSETS:
        _row_table[_off_idx(_dr, _dc)] = haversine_distance(
            _lat, 0.0, _lat - _dr * CELL_DEG, _dc * CELL_DEG
        )
    _STEP_NM.append(_row_table)


def is_navigable(row: int, col: int) -> bool:
    """True when a cell is open water inside the domain."""
    return in_bounds(row, col) and not env_grid.land_l[row][col]


def can_traverse(u: Tuple[int, int], v: Tuple[int, int]) -> bool:
    """
    Whether a single grid step from u to v is a legal ship movement.

    Both endpoints must be water, and a diagonal step may not clip the corner
    where two landmasses meet -- without that check a route can slip diagonally
    between two land cells, which is how a "sea" route ends up ashore.

    Must stay in step with EnvironmentalGrid._largest_water_component, which
    labels the open-ocean component using this same rule.
    """
    if not is_navigable(*u) or not is_navigable(*v):
        return False
    dr = v[0] - u[0]
    dc = v[1] - u[1]
    if dr != 0 and dc != 0:
        if not is_navigable(u[0] + dr, u[1]) or not is_navigable(u[0], u[1] + dc):
            return False
    return True


# Adjacency is a pure function of the land mask, which is fixed at runtime, so
# the legal-move table is built once and shared by every request and every
# weight profile. This turns successor lookup into a single list index instead
# of eight can_traverse() calls with their mask probes.
_SUCC: Optional[List[Tuple[Tuple[int, int], ...]]] = None

# Flat navigability lookup, 1 = open water. Indexed row * WIDTH + col.
_NAV = bytearray(
    0 if env_grid.land_l[r][c] else 1
    for r in range(HEIGHT) for c in range(WIDTH)
)


def successor_table() -> List[Tuple[Tuple[int, int], ...]]:
    global _SUCC
    if _SUCC is None:
        table = [()] * (HEIGHT * WIDTH)
        land = env_grid.land_l
        for r in range(HEIGHT):
            row_land = land[r]
            for c in range(WIDTH):
                if row_land[c]:
                    continue
                succs = []
                for dr, dc in _OFFSETS:
                    nr, nc = r + dr, c + dc
                    if nr < 0 or nr >= HEIGHT or nc < 0 or nc >= WIDTH:
                        continue
                    if land[nr][nc]:
                        continue
                    # A diagonal step may not clip a land corner
                    if dr != 0 and dc != 0 and (land[nr][c] or row_land[nc]):
                        continue
                    succs.append((nr, nc))
                table[r * WIDTH + c] = tuple(succs)
        _SUCC = table
    return _SUCC


def resolve_profile(ship_profile: Dict[str, Any]) -> Dict[str, float]:
    """Resolve the vessel constants once per voyage rather than per edge."""
    disp = float(ship_profile.get("displacement", 50000.0))
    if disp > 100000:      # Tanker
        v_base = 13.0
    elif disp > 70000:     # Bulk carrier
        v_base = 12.0
    else:                  # Container ship
        v_base = 20.0
    return {
        "v_base": v_base,
        "displacement": disp,
        "frontal_area": float(ship_profile.get("frontal_area", 1000.0)),
        "sfoc": float(ship_profile.get("sfoc", 170.0)),
        "engine_efficiency": float(ship_profile.get("engine_efficiency", 0.45)),
        "disp_p66": disp ** 0.66,
        "disp_p33": disp ** 0.33,
    }


def _edge_physics(dist: float, dx: float, dy: float, r: int, c: int,
                  prof: Dict[str, float]) -> Tuple[float, float, float]:
    """
    The vessel model for one leg: time (hrs), fuel (gals) and risk, given the
    leg length, its heading, and the destination cell (r, c) whose environmental
    conditions apply.

    Single implementation, shared by the validating public entry point and the
    search's hot path, so the two can never drift apart.
    """
    # Speed over ground: base speed, less wind/wave degradation, plus the
    # along-track component of the surface current.
    current_assist = env_grid.currents_u_l[r][c] * dx + env_grid.currents_v_l[r][c] * dy
    v_eff = prof["v_base"] - env_grid.speed_loss_l[r][c] + current_assist
    if v_eff < 2.5:
        v_eff = 2.5  # Prevent stationary or backward ships

    # 1. Travel time (hours)
    time_hrs = dist / v_eff

    # 2. Fuel consumption (gallons)
    # Power scales with displacement^(2/3) and the cube of speed, plus wind and
    # wave added resistance.
    base_power = 0.005 * prof["disp_p66"] * (v_eff ** 3) * 0.001
    wind_power = 0.001 * prof["frontal_area"] * 1.2 * v_eff * env_grid.wind_sq_l[r][c] * 1e-4
    wave_power = 0.05 * prof["disp_p33"] * env_grid.wave_sq_l[r][c] * v_eff

    total_power = (base_power + wind_power + wave_power) / prof["engine_efficiency"]
    if total_power < 1000.0:
        total_power = 1000.0  # Baseline auxiliary load

    # SFOC is g/kWh; diesel is ~3200 g/gallon
    fuel_gals = (prof["sfoc"] * total_power * time_hrs) / 3200.0

    # 3. Safety / risk. Per-cell risk density is precomputed (waves, wind,
    # piracy and coastal standoff) in the environmental grid.
    total_risk = dist * env_grid.risk_cell_l[r][c]

    return time_hrs, fuel_gals, total_risk


def _edge_vector_step(u: Tuple[int, int], v: Tuple[int, int],
                      prof: Dict[str, float]) -> Tuple[float, float, float]:
    """
    Cost vector for a single adjacent grid step.

    The caller must have obtained v from the successor table, which is what
    guarantees the step is legal (both cells water, no diagonal corner clip).
    The two flat navigability probes below are a cheap backstop against a caller
    that did not; the corner rule itself is the successor table's job.
    """
    r, c = v
    nav = _NAV
    if not nav[u[0] * WIDTH + u[1]] or not nav[r * WIDTH + c]:
        return float("inf"), float("inf"), float("inf")

    idx = _off_idx(v[0] - u[0], v[1] - u[1])
    dx, dy = _DIRECTION[idx]
    return _edge_physics(_STEP_NM[u[0]][idx], dx, dy, r, c, prof)


def calculate_edge_vector(
    u: Tuple[int, int],
    v: Tuple[int, int],
    ship_profile: Dict[str, Any],
    prof: Optional[Dict[str, float]] = None,
) -> Tuple[float, float, float]:
    """
    Multi-objective cost vector [Time (hrs), Fuel (gals), Risk] for the step
    u -> v, both given as (row, col) grid indices.

    Fully validating entry point, for callers scoring an arbitrary path. Returns
    +inf on every component for a step that is not navigable, which is what
    keeps routes off land.
    """
    if u == v:
        return 0.0, 0.0, 0.0

    if prof is None:
        prof = resolve_profile(ship_profile)

    dr = v[0] - u[0]
    dc = v[1] - u[1]

    if abs(dr) <= 1 and abs(dc) <= 1:
        if not can_traverse(u, v):
            return float("inf"), float("inf"), float("inf")
        return _edge_vector_step(u, v, prof)

    # Non-adjacent pairs occur when scoring an externally supplied path (e.g. the
    # already-travelled prefix of a voyage being replanned).
    if not is_navigable(*u) or not is_navigable(*v):
        return float("inf"), float("inf"), float("inf")

    lat_u, lon_u = grid_to_coord(u[0], u[1])
    lat_v, lon_v = grid_to_coord(v[0], v[1])
    dist = haversine_distance(lat_u, lon_u, lat_v, lon_v)
    if dist <= 0.0:
        return 0.0, 0.0, 0.0

    d_lat = lat_v - lat_u
    d_lon = lon_v - lon_u
    d_mag = math.sqrt(d_lat ** 2 + d_lon ** 2)
    dx, dy = (d_lon / d_mag, d_lat / d_mag) if d_mag > 0 else (0.0, 0.0)

    return _edge_physics(dist, dx, dy, v[0], v[1], prof)


# --- D* Lite Implementation ---

class RouteUnreachable(Exception):
    """Raised when no navigable path exists between the requested endpoints."""


class DSLite:
    """
    D* Lite (Koenig & Likhachev) over the navigable-water grid.

    The scalarised edge cost is +inf across land, so land is pruned both by
    ``get_successors`` and by the cost function itself.
    """

    def __init__(self, start_coord: Tuple[float, float], goal_coord: Tuple[float, float],
                 ship_profile: Dict[str, Any], weights: Dict[str, float]):
        self.ship_profile = ship_profile
        self.prof = resolve_profile(ship_profile)
        self.weights = weights

        self.w_t = float(weights.get("time_weight", 0.33))
        self.w_f = float(weights.get("fuel_weight", 0.33))
        self.w_s = float(weights.get("safety_weight", 0.34))

        # Remember the true port coordinates so the rendered voyage terminates at
        # the berth rather than at the centre of the nearest water cell.
        self.start_coord = start_coord
        self.goal_coord = goal_coord

        # Fastest speed over ground the vessel model can attain anywhere on the
        # grid, and the lowest risk density present. Both feed the heuristic.
        self.v_eff_max = max(
            2.5, self.prof["v_base"] - env_grid.speed_loss_min + env_grid.current_max
        )
        self.risk_min = env_grid.risk_min

        self._succ = successor_table()

        self.s_start = self._snap(start_coord, "origin")
        self.s_goal = self._snap(goal_coord, "destination")

        # h(s, s_start) is fixed while s_start is, and is evaluated several times
        # per expansion, so it is memoised rather than recomputing a haversine.
        self._h_cache: Dict[Tuple[int, int], float] = {}

        self.g: Dict[Tuple[int, int], float] = {}
        self.rhs: Dict[Tuple[int, int], float] = {}
        self.U: List[Tuple[Tuple[float, float], Tuple[int, int]]] = []
        self.in_queue: Dict[Tuple[int, int], Tuple[float, float]] = {}
        self.km = 0.0

        self.initialized = False

    # ------------------------------------------------------------- endpoints

    @staticmethod
    def _snap(coord: Tuple[float, float], label: str) -> Tuple[int, int]:
        cell = env_grid.nearest_navigable(coord[0], coord[1])
        if cell is None:
            raise RouteUnreachable(
                f"No navigable water found near the {label} at "
                f"{coord[0]:.2f}, {coord[1]:.2f}."
            )
        return cell

    # ----------------------------------------------------------------- costs

    def cost(self, u: Tuple[int, int], v: Tuple[int, int]) -> float:
        """
        Scalarised edge cost. v must be a successor of u (or equal to it), which
        every call site guarantees by drawing v from the successor table.
        """
        if u == v:
            return 0.0
        t, f, r = _edge_vector_step(u, v, self.prof)
        if t == float("inf"):
            return float("inf")
        # Scale so Time (~100-300 hrs), Fuel (~5000-20000 gal) and Risk
        # (~500-2000) contribute at comparable magnitudes.
        return self.w_t * t + self.w_f * (f / 80.0) + self.w_s * (r / 8.0)

    def heuristic(self, s1: Tuple[int, int], s2: Tuple[int, int]) -> float:
        """
        Admissible lower bound on the scalarised cost between two cells.

        Every term is a genuine lower bound taken from the loaded fields: the
        fastest speed over ground attainable anywhere, the auxiliary-only fuel
        floor, and the lowest risk density on the grid. The previous version
        divided by a 15 kt nominal speed, which overestimates the time for a
        20 kt container ship and so made the heuristic inadmissible.
        """
        lat1, lon1 = grid_to_coord(s1[0], s1[1])
        lat2, lon2 = grid_to_coord(s2[0], s2[1])
        dist = haversine_distance(lat1, lon1, lat2, lon2)

        min_time = dist / self.v_eff_max
        # total_power is floored at 1000 kW by the cost function
        min_fuel = (self.prof["sfoc"] * 1000.0 * min_time) / 3200.0
        min_risk = dist * self.risk_min

        return self.w_t * min_time + self.w_f * (min_fuel / 80.0) + self.w_s * (min_risk / 8.0)

    def _h_to_start(self, s: Tuple[int, int]) -> float:
        h = self._h_cache.get(s)
        if h is None:
            h = self.heuristic(s, self.s_start)
            self._h_cache[s] = h
        return h

    def calculate_key(self, s: Tuple[int, int]) -> Tuple[float, float]:
        min_val = min(self.g.get(s, float('inf')), self.rhs.get(s, float('inf')))
        return (min_val + self._h_to_start(s) + self.km, min_val)

    def get_successors(self, u: Tuple[int, int]) -> Tuple[Tuple[int, int], ...]:
        """Navigable neighbours of u. Land is never a successor."""
        return self._succ[u[0] * WIDTH + u[1]]

    # The movement model is symmetric (can_traverse(u, v) == can_traverse(v, u)),
    # so predecessors and successors are the same set. Edge *costs* still differ
    # by direction, because the current assist depends on heading.
    get_predecessors = get_successors

    # ------------------------------------------------------- priority queue
    # Lazy deletion. The previous implementation rebuilt and re-heapified the
    # whole queue on every vertex update, which is O(|U|) per call and does not
    # survive the move to a finer grid.

    def _queue_insert(self, s: Tuple[int, int], key: Tuple[float, float]):
        self.in_queue[s] = key
        heapq.heappush(self.U, (key, s))

    def _queue_remove(self, s: Tuple[int, int]):
        self.in_queue.pop(s, None)

    def _queue_prune(self) -> bool:
        """Discard stale heap entries. True if a live entry is on top."""
        while self.U:
            key, s = self.U[0]
            if self.in_queue.get(s) == key:
                return True
            heapq.heappop(self.U)
        return False

    def _queue_top_key(self) -> Optional[Tuple[float, float]]:
        return self.U[0][0] if self._queue_prune() else None

    def _queue_pop(self) -> Tuple[Tuple[float, float], Tuple[int, int]]:
        self._queue_prune()
        key, s = heapq.heappop(self.U)
        self.in_queue.pop(s, None)
        return key, s

    # ------------------------------------------------------------ D* Lite core

    def update_vertex(self, u: Tuple[int, int]):
        if u != self.s_goal:
            min_val = float('inf')
            for s_prime in self.get_successors(u):
                val = self.cost(u, s_prime) + self.g.get(s_prime, float('inf'))
                if val < min_val:
                    min_val = val
            self.rhs[u] = min_val

        self._queue_remove(u)
        if self.g.get(u, float('inf')) != self.rhs.get(u, float('inf')):
            self._queue_insert(u, self.calculate_key(u))

    def _requeue(self, u: Tuple[int, int]):
        """Re-evaluate only u's queue membership; rhs(u) is already current."""
        self._queue_remove(u)
        if self.g.get(u, float('inf')) != self.rhs.get(u, float('inf')):
            self._queue_insert(u, self.calculate_key(u))

    def initialize(self):
        self.g = {}
        self.rhs = {}
        self.U = []
        self.in_queue = {}
        self.km = 0.0

        # g/rhs default to infinity, so only the goal needs seeding
        self.rhs[self.s_goal] = 0.0
        self._queue_insert(self.s_goal, self.calculate_key(self.s_goal))
        self.initialized = True

    def compute_shortest_path(self):
        if not self.initialized:
            self.initialize()

        max_expansions = 40 * WIDTH * HEIGHT
        count = 0

        while True:
            top = self._queue_top_key()
            if top is None:
                break
            start_key = self.calculate_key(self.s_start)
            start_consistent = (
                self.rhs.get(self.s_start, float('inf')) == self.g.get(self.s_start, float('inf'))
            )
            if not (top < start_key or not start_consistent):
                break

            count += 1
            if count > max_expansions:
                break

            k_old, u = self._queue_pop()
            k_new = self.calculate_key(u)

            if k_old < k_new:
                self._queue_insert(u, k_new)
            elif self.g.get(u, float('inf')) > self.rhs.get(u, float('inf')):
                # Overconsistent: u's cost improved. Predecessors only need
                # their rhs relaxed against the new g(u), not a full 8-way
                # recomputation -- that is an 8x saving on the hot path.
                g_u = self.rhs[u]
                self.g[u] = g_u
                for s in self.get_predecessors(u):
                    if s != self.s_goal:
                        c = self.cost(s, u)
                        if c != float('inf'):
                            candidate = c + g_u
                            if candidate < self.rhs.get(s, float('inf')):
                                self.rhs[s] = candidate
                    self._requeue(s)
            else:
                # Underconsistent: u's cost worsened, so affected vertices need
                # a full recomputation.
                g_old = self.g.get(u, float('inf'))
                self.g[u] = float('inf')
                # get_predecessors returns a tuple from the successor table, so
                # build the list explicitly rather than concatenating onto it.
                affected = list(self.get_predecessors(u))
                affected.append(u)
                for s in affected:
                    if s == u or self.rhs.get(s, float('inf')) == self.cost(s, u) + g_old:
                        self.update_vertex(s)
                    else:
                        self._requeue(s)

    def replan_after_weather_shift(self, current_vessel_coord: Tuple[float, float],
                                   changed_cells: List[Tuple[int, int]]):
        """
        Incrementally repair the plan after a weather shift, re-rooting the
        search at the vessel's current position.
        """
        # 1. Move the start to the vessel's present location (nearest water)
        s_last = self.s_start
        self.s_start = self._snap(current_vessel_coord, "vessel position")

        # 2. Update the key modifier. The memoised heuristic is relative to
        #    s_start, so it is now stale and must be dropped.
        self.km += self.heuristic(s_last, self.s_start)
        self._h_cache.clear()

        # 3. Edge costs are read live from env_grid, so it is enough to
        #    re-evaluate the changed cells and everything adjacent to them.
        vertices_to_update = set()
        for cell in changed_cells:
            if not is_navigable(*cell):
                continue
            vertices_to_update.add(cell)
            for succ in self.get_successors(cell):
                vertices_to_update.add(succ)

        for u in vertices_to_update:
            self.update_vertex(u)

        # 4. Recompute incrementally
        self.compute_shortest_path()

    # ----------------------------------------------------------- extraction

    def get_path(self) -> List[Tuple[float, float]]:
        """
        Extract the current optimal route as a list of (lat, lon) points,
        beginning at the true origin coordinate and ending at the true
        destination coordinate.

        Raises RouteUnreachable when no navigable route exists, instead of the
        old behaviour of stepping blindly toward the goal -- that fallback
        ignored both cost and the coastline.
        """
        if self.g.get(self.s_start, float('inf')) == float('inf') and self.s_start != self.s_goal:
            raise RouteUnreachable(
                "No navigable route between the selected ports on the current grid."
            )

        cells = [self.s_start]
        curr = self.s_start
        visited = {curr}
        max_steps = 4 * (WIDTH + HEIGHT)

        steps = 0
        while curr != self.s_goal:
            steps += 1
            if steps > max_steps:
                raise RouteUnreachable(
                    "Route extraction exceeded the maximum path length; the plan did not converge."
                )

            min_val = float('inf')
            best_succ = None
            for s_prime in self.get_successors(curr):
                if s_prime in visited:
                    continue
                c = self.cost(curr, s_prime)
                if c == float('inf'):
                    continue
                val = c + self.g.get(s_prime, float('inf'))
                if val < min_val:
                    min_val = val
                    best_succ = s_prime

            if best_succ is None or min_val == float('inf'):
                raise RouteUnreachable(
                    "Route extraction stalled: no navigable successor with a finite cost."
                )

            curr = best_succ
            cells.append(curr)
            visited.add(curr)

        coords = [grid_to_coord(r, c) for r, c in cells]

        # Anchor the ends at the real berths
        if coords[0] != self.start_coord:
            coords.insert(0, self.start_coord)
        if coords[-1] != self.goal_coord:
            coords.append(self.goal_coord)
        return coords


# --- Pareto Optimization Front Generator ---

WEIGHT_PROFILES = {
    "fastest": {"time_weight": 0.90, "fuel_weight": 0.05, "safety_weight": 0.05},
    "fuel_optimized": {"time_weight": 0.05, "fuel_weight": 0.90, "safety_weight": 0.05},
    "safest": {"time_weight": 0.05, "fuel_weight": 0.05, "safety_weight": 0.90},
}


def get_path_metrics(path: List[Tuple[float, float]], ship_profile: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate time / fuel / risk along a lat-lon path."""
    prof = resolve_profile(ship_profile)
    total_time = 0.0
    total_fuel = 0.0
    total_risk = 0.0
    waypoints = []

    for idx in range(len(path)):
        lat, lon = path[idx]
        waypoints.append([lat, lon])
        if idx < len(path) - 1:
            u = coord_to_grid(lat, lon)
            v = coord_to_grid(path[idx + 1][0], path[idx + 1][1])
            if u == v:
                continue
            t, f, r = calculate_edge_vector(u, v, ship_profile, prof)
            # The first and last hops run from a berth into open water and may
            # legitimately touch a land cell; skip rather than poison the totals.
            if t == float('inf'):
                continue
            total_time += t
            total_fuel += f
            total_risk += r

    return {
        "waypoints": waypoints,
        "total_time": round(total_time, 1),
        "total_fuel": round(total_fuel, 0),
        "total_risk": round(total_risk, 1)
    }


def _solve_front(start_coord: Tuple[float, float], goal_coord: Tuple[float, float],
                 ship_profile: Dict[str, Any],
                 custom_weights: Dict[str, float]) -> Dict[str, Any]:
    """
    Pareto front between two coordinates: fastest, fuel-optimized, safest and the
    operator's balanced weighting.

    Shared by the port-to-port solve and the mid-voyage re-solve, so the two can
    never disagree about how a front is built.
    """
    weight_profiles = dict(WEIGHT_PROFILES)
    weight_profiles["balanced"] = custom_weights

    results = {}
    for key, weights in weight_profiles.items():
        ds = DSLite(start_coord, goal_coord, ship_profile, weights)
        ds.initialize()
        ds.compute_shortest_path()
        path_coords = ds.get_path()
        results[key] = {
            "weights": weights,
            **get_path_metrics(path_coords, ship_profile)
        }

    return results


def calculate_pareto_routes(origin: str, destination: str, ship_profile: Dict[str, Any],
                            custom_weights: Dict[str, float]) -> Dict[str, Any]:
    """
    Computes a set of Pareto-optimal routes:
    1. Fastest, 2. Fuel-optimized, 3. Safest, 4. Balanced (UI slider weights).
    """
    start_coord = PORTS.get(origin)
    goal_coord = PORTS.get(destination)
    if not start_coord or not goal_coord:
        raise ValueError(f"Origin '{origin}' or Destination '{destination}' not found in ports database.")

    return _solve_front(start_coord, goal_coord, ship_profile, custom_weights)


def calculate_routes_from_point(resume_coord: Tuple[float, float], destination: str,
                                ship_profile: Dict[str, Any],
                                custom_weights: Dict[str, float]) -> Dict[str, Any]:
    """
    Re-solve the front from the vessel's current position onward.

    The already-sailed leg is not part of the result: the drop point is treated as
    the new departure, so every returned route begins exactly there. A drop that
    lands on land is snapped to the nearest open-ocean cell by DSLite.
    """
    goal_coord = PORTS.get(destination)
    if not goal_coord:
        raise ValueError(f"Destination '{destination}' not found in ports database.")

    return _solve_front(tuple(resume_coord), goal_coord, ship_profile, custom_weights)
