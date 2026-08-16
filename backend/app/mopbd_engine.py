import math
import heapq
import numpy as np
from typing import List, Dict, Tuple, Any
from .raster_parser import env_grid

# Geographical bounds (Indian Ocean)
WEST = 40.0
EAST = 110.0
SOUTH = -25.0
NORTH = 25.0
WIDTH = 70
HEIGHT = 50

# Ports mapping (lat, lon)
PORTS = {
    "JNPT": (18.95, 72.95),
    "Colombo": (6.94, 79.86),
    "Singapore": (1.35, 103.82),
    "Aden": (12.80, 45.00),
    "Port Louis": (-20.16, 57.50)
}

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates earth distance in Nautical Miles (NM)."""
    R = 3440.065  # Radius of earth in NM
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def grid_to_coord(row: int, col: int) -> Tuple[float, float]:
    lat = NORTH - row * ((NORTH - SOUTH) / HEIGHT)
    lon = WEST + col * ((EAST - WEST) / WIDTH)
    return lat, lon

def coord_to_grid(lat: float, lon: float) -> Tuple[int, int]:
    col = int((lon - WEST) / (EAST - WEST) * (WIDTH - 1))
    row = int((NORTH - lat) / (NORTH - SOUTH) * (HEIGHT - 1))
    col = max(0, min(WIDTH - 1, col))
    row = max(0, min(HEIGHT - 1, row))
    return row, col

def calculate_edge_vector(u: Tuple[int, int], v: Tuple[int, int], ship_profile: Dict[str, Any]) -> Tuple[float, float, float]:
    """
    Computes the multi-objective cost vector [Time (hrs), Fuel (gals), Risk]
    for traversing from node u (grid row, col) to node v.
    """
    lat_u, lon_u = grid_to_coord(u[0], u[1])
    lat_v, lon_v = grid_to_coord(v[0], v[1])
    
    dist = haversine_distance(lat_u, lon_u, lat_v, lon_v)
    if dist == 0:
        return 0.0, 0.0, 0.0

    # Get environmental data at destination v
    env = env_grid.get_metrics(lat_v, lon_v)
    wind = env["wind"]
    wave = env["wave"]
    curr_u = env["current_u"]
    curr_v = env["current_v"]
    piracy = env["piracy"]

    # Determine vessel properties
    v_base = 15.0  # default base speed (knots)
    if "displacement" in ship_profile:
        # A rough heuristic for vessel speed based on configuration
        disp = ship_profile["displacement"]
        if disp > 100000:  # Tanker
            v_base = 13.0
        elif disp > 70000:  # Bulk carrier
            v_base = 12.0
        else:               # Container ship
            v_base = 20.0

    # Speed impact: wind headwind component, waves, currents dot product
    # Direction unit vector from u to v
    d_lat = lat_v - lat_u
    d_lon = lon_v - lon_u
    d_mag = math.sqrt(d_lat**2 + d_lon**2)
    if d_mag > 0:
        dx, dy = d_lon / d_mag, d_lat / d_mag
    else:
        dx, dy = 0.0, 0.0

    # Current assist (knots)
    current_assist = curr_u * dx + curr_v * dy

    # Speed degradation from wind and waves
    speed_loss = 0.04 * wind + 0.6 * wave
    
    v_eff = v_base - speed_loss + current_assist
    v_eff = max(2.5, v_eff)  # Prevent stationary or backward ships

    # 1. Travel Time (Hours)
    time_hrs = dist / v_eff

    # 2. Fuel Consumption (Gallons)
    # Fuel rate scales with the cube of speed (propeller physics) plus environmental resistance
    disp = ship_profile.get("displacement", 50000.0)
    frontal = ship_profile.get("frontal_area", 1000.0)
    sfoc = ship_profile.get("sfoc", 170.0)  # g/kWh
    eff = ship_profile.get("engine_efficiency", 0.45)

    # Simplified power calculation (kW)
    # Power is proportional to displacement^(2/3) * speed^3
    base_power = 0.005 * (disp ** 0.66) * (v_eff ** 3) * 0.001
    
    # Wind drag power (frontal area * air density * speed * relative wind squared)
    wind_power = 0.001 * frontal * 1.2 * v_eff * (max(0.0, wind)**2) * 1e-4
    
    # Wave added resistance power
    wave_power = 0.05 * (disp ** 0.33) * (wave ** 2) * v_eff
    
    total_power = (base_power + wind_power + wave_power) / eff
    total_power = max(1000.0, total_power)  # Baseline auxiliary power

    # Specific Fuel Oil Consumption in g/kWh -> convert to gallons
    # Diesel fuel density ~ 3200 g/gallon
    fuel_gals = (sfoc * total_power * time_hrs) / 3200.0

    # 3. Safety/Risk Score
    # Risk factor per mile
    # Piracy is heavily penalised; waves over 4m are extreme hazards
    wave_risk = wave ** 2.2
    piracy_risk = piracy * 2.5
    wind_risk = wind * 0.2
    
    risk_cell = 1.0 + wave_risk + wind_risk + piracy_risk
    total_risk = dist * risk_cell

    return time_hrs, fuel_gals, total_risk

# --- D* Lite Implementation ---

class DSLite:
    def __init__(self, start_coord: Tuple[float, float], goal_coord: Tuple[float, float], ship_profile: Dict[str, Any], weights: Dict[str, float]):
        self.ship_profile = ship_profile
        self.weights = weights
        
        self.s_start = coord_to_grid(start_coord[0], start_coord[1])
        self.s_goal = coord_to_grid(goal_coord[0], goal_coord[1])
        
        self.g = {}
        self.rhs = {}
        self.U = []  # Priority queue using heapq: list of (key, node)
        self.km = 0.0
        
        self.initialized = False

    def cost(self, u: Tuple[int, int], v: Tuple[int, int]) -> float:
        t, f, r = calculate_edge_vector(u, v, self.ship_profile)
        # Scalarize using weight sliders
        w_t = self.weights.get("time_weight", 0.33)
        w_f = self.weights.get("fuel_weight", 0.33)
        w_s = self.weights.get("safety_weight", 0.34)
        
        # Scaling factor to align magnitude of Time (~100-300), Fuel (~5000-20000), Risk (~500-2000)
        cost_val = w_t * t + w_f * (f / 80.0) + w_s * (r / 8.0)
        return cost_val

    def heuristic(self, s1: Tuple[int, int], s2: Tuple[int, int]) -> float:
        lat1, lon1 = grid_to_coord(s1[0], s1[1])
        lat2, lon2 = grid_to_coord(s2[0], s2[1])
        # Heuristic distance scalarized
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        # Estimate using baseline speed
        est_time = dist / 15.0
        est_fuel = est_time * 250.0 / 80.0
        est_risk = dist * 1.5 / 8.0
        
        w_t = self.weights.get("time_weight", 0.33)
        w_f = self.weights.get("fuel_weight", 0.33)
        w_s = self.weights.get("safety_weight", 0.34)
        
        return w_t * est_time + w_f * est_fuel + w_s * est_risk

    def calculate_key(self, s: Tuple[int, int]) -> Tuple[float, float]:
        min_val = min(self.g.get(s, float('inf')), self.rhs.get(s, float('inf')))
        h = self.heuristic(s, self.s_start)
        return (min_val + h + self.km, min_val)

    def get_successors(self, u: Tuple[int, int]) -> List[Tuple[int, int]]:
        r, c = u
        succs = []
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < HEIGHT and 0 <= nc < WIDTH:
                    succs.append((nr, nc))
        return succs

    def update_vertex(self, u: Tuple[int, int]):
        if u != self.s_goal:
            # rhs(u) = min_{s' in Succ(u)} (c(u, s') + g(s'))
            min_val = float('inf')
            for s_prime in self.get_successors(u):
                val = self.cost(u, s_prime) + self.g.get(s_prime, float('inf'))
                if val < min_val:
                    min_val = val
            self.rhs[u] = min_val

        # Remove u from queue if it exists
        self.U = [item for item in self.U if item[1] != u]
        heapq.heapify(self.U)

        if self.g.get(u, float('inf')) != self.rhs.get(u, float('inf')):
            key = self.calculate_key(u)
            heapq.heappush(self.U, (key, u))

    def initialize(self):
        self.g = {}
        self.rhs = {}
        self.U = []
        self.km = 0.0
        
        # We initialize dynamically to save memory (g/rhs behave as inf by default)
        self.rhs[self.s_goal] = 0.0
        heapq.heappush(self.U, (self.calculate_key(self.s_goal), self.s_goal))
        self.initialized = True

    def compute_shortest_path(self):
        if not self.initialized:
            self.initialize()

        count = 0
        while len(self.U) > 0 and (self.U[0][0] < self.calculate_key(self.s_start) or self.rhs.get(self.s_start, float('inf')) != self.g.get(self.s_start, float('inf'))):
            count += 1
            if count > 8000:  # Fail-safe to avoid loops
                break
            
            k_old, u = heapq.heappop(self.U)
            k_new = self.calculate_key(u)
            
            if k_old < k_new:
                heapq.heappush(self.U, (k_new, u))
            elif self.g.get(u, float('inf')) > self.rhs.get(u, float('inf')):
                self.g[u] = self.rhs[u]
                for s in self.get_successors(u):
                    self.update_vertex(s)
            else:
                self.g[u] = float('inf')
                for s in self.get_successors(u) + [u]:
                    self.update_vertex(s)

    def replan_after_weather_shift(self, current_vessel_coord: Tuple[float, float], changed_cells: List[Tuple[int, int]]):
        """
        Dynamically adjusts D* Lite for weather shifts.
        Updates s_start to the ship's current position and propagates changes incrementally.
        """
        # 1. Update start position to current ship location
        s_last = self.s_start
        self.s_start = coord_to_grid(current_vessel_coord[0], current_vessel_coord[1])
        
        # 2. Update km key modifier
        self.km += self.heuristic(s_last, self.s_start)
        
        # 3. Update all nodes near changed cells
        # Since edge cost is computed dynamically using env_grid, we update vertex of changed cells and their neighbors
        vertices_to_update = set()
        for cell in changed_cells:
            vertices_to_update.add(cell)
            for succ in self.get_successors(cell):
                vertices_to_update.add(succ)

        for u in vertices_to_update:
            self.update_vertex(u)
            
        # 4. Recompute shortest path incrementally
        self.compute_shortest_path()

    def get_path(self) -> List[Tuple[float, float]]:
        """Extracts current optimal route from start to goal."""
        path = [self.s_start]
        curr = self.s_start
        visited = {curr}
        
        loop_guard = 0
        while curr != self.s_goal:
            loop_guard += 1
            if loop_guard > 200:
                break
            
            min_val = float('inf')
            best_succ = None
            
            for s_prime in self.get_successors(curr):
                if s_prime in visited:
                    continue
                # cost from curr to s_prime + g(s_prime)
                val = self.cost(curr, s_prime) + self.g.get(s_prime, float('inf'))
                if val < min_val:
                    min_val = val
                    best_succ = s_prime
            
            if best_succ is None:
                # If stuck, head directly to goal index step-by-step
                dr = np.sign(self.s_goal[0] - curr[0])
                dc = np.sign(self.s_goal[1] - curr[1])
                best_succ = (curr[0] + dr, curr[1] + dc)
            
            curr = best_succ
            path.append(curr)
            visited.add(curr)

        # Convert back to lat/lon coordinates
        coords_path = [grid_to_coord(r, c) for r, c in path]
        return coords_path

# --- Pareto Optimization Front Generator ---

def calculate_pareto_routes(origin: str, destination: str, ship_profile: Dict[str, Any], custom_weights: Dict[str, float]) -> Dict[str, Any]:
    """
    Computes a set of Pareto-optimal routes:
    1. Fastest (Time weighted: 0.95, Fuel: 0.025, Safety: 0.025)
    2. Fuel-Optimized (Fuel weighted: 0.95, Time: 0.025, Safety: 0.025)
    3. Safest (Safety weighted: 0.95, Time: 0.025, Fuel: 0.025)
    4. Balanced (Custom weights from UI sliders)
    """
    start_coord = PORTS.get(origin)
    goal_coord = PORTS.get(destination)
    if not start_coord or not goal_coord:
        raise ValueError(f"Origin '{origin}' or Destination '{destination}' not found in ports database.")

    weight_profiles = {
        "fastest": {"time_weight": 0.90, "fuel_weight": 0.05, "safety_weight": 0.05},
        "fuel_optimized": {"time_weight": 0.05, "fuel_weight": 0.90, "safety_weight": 0.05},
        "safest": {"time_weight": 0.05, "fuel_weight": 0.05, "safety_weight": 0.90},
        "balanced": custom_weights
    }

    results = {}
    
    # Helper to calculate full metrics along a computed lat/lon coordinate path
    def get_path_metrics(path: List[Tuple[float, float]]) -> Dict[str, Any]:
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

    for key, weights in weight_profiles.items():
        # Setup and run D* Lite for each weighting scheme
        ds = DSLite(start_coord, goal_coord, ship_profile, weights)
        ds.initialize()
        ds.compute_shortest_path()
        path_coords = ds.get_path()
        metrics = get_path_metrics(path_coords)
        results[key] = {
            "weights": weights,
            **metrics
        }

    return results
