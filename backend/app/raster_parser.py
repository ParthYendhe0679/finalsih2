import os
import numpy as np

from . import grid

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

LAYERS = ("winds", "waves", "currents_u", "currents_v", "piracy", "land")


class EnvironmentalGrid:
    """
    Holds the met-ocean layers plus the land/navigability mask.

    Grid geometry is owned by :mod:`app.grid`; this class validates that the
    rasters on disk match it and regenerates them when they do not, so a stale
    coarse raster can never be silently paired with the finer routing grid.
    """

    def __init__(self):
        self.west = grid.WEST
        self.east = grid.EAST
        self.south = grid.SOUTH
        self.north = grid.NORTH
        self.width = grid.WIDTH
        self.height = grid.HEIGHT
        self.cell_deg = grid.CELL_DEG

        self.winds = None
        self.waves = None
        self.currents_u = None
        self.currents_v = None
        self.piracy = None
        self.land = None          # bool array: True where not navigable
        self.dist_to_land = None  # cells to nearest land, capped

        self.load_data()

    # ------------------------------------------------------------------ load

    def load_data(self):
        if not self._try_load():
            print("Raster layers missing or stale for the current grid. Regenerating...")
            from .generator import generate_rasters

            generate_rasters()
            if not self._try_load():
                raise RuntimeError(
                    "Unable to load environmental rasters after regeneration. "
                    f"Expected {self.height}x{self.width} layers in {DATA_DIR}."
                )
        self._precompute()

    def _try_load(self) -> bool:
        for loader, label in ((self._load_tiffs, "Rasterio"), (self._load_npys, "NumPy")):
            try:
                data = loader()
            except Exception as e:
                print(f"{label} loader unavailable: {e}")
                continue
            if data is None:
                continue
            if not self._shapes_ok(data):
                print(f"{label} layers do not match the {self.height}x{self.width} routing grid.")
                continue
            self._assign(data)
            print(f"Loaded raster layers via {label} ({self.height}x{self.width}).")
            return True
        return False

    def _load_tiffs(self):
        import rasterio  # noqa: F401  (import guarded by caller)

        paths = {name: os.path.join(DATA_DIR, f"{name}.tif") for name in LAYERS}
        if not all(os.path.exists(p) for p in paths.values()):
            return None
        return {name: self._read_tiff(p) for name, p in paths.items()}

    def _load_npys(self):
        paths = {name: os.path.join(DATA_DIR, f"{name}.npy") for name in LAYERS}
        if not all(os.path.exists(p) for p in paths.values()):
            return None
        return {name: np.load(p) for name, p in paths.items()}

    @staticmethod
    def _read_tiff(filepath):
        import rasterio

        with rasterio.open(filepath) as src:
            return src.read(1)

    def _shapes_ok(self, data) -> bool:
        expected = (self.height, self.width)
        return all(np.asarray(arr).shape == expected for arr in data.values())

    def _assign(self, data):
        self.winds = np.asarray(data["winds"], dtype=np.float32)
        self.waves = np.asarray(data["waves"], dtype=np.float32)
        self.currents_u = np.asarray(data["currents_u"], dtype=np.float32)
        self.currents_v = np.asarray(data["currents_v"], dtype=np.float32)
        self.piracy = np.asarray(data["piracy"], dtype=np.float32)
        self.land = np.asarray(data["land"]) > 0.5

    # ----------------------------------------------------------- precompute

    # Routes should keep clearance off a coast rather than scraping along it.
    # This is a soft risk penalty, not a hard block: a hard buffer would wall
    # off every port, since ports are on the coast by definition.
    STANDOFF_CELLS = 3.0
    STANDOFF_PENALTY = 6.0

    def _precompute(self):
        self._precompute_static()
        self._precompute_derived()

    def _precompute_static(self):
        """Geometry-only arrays. Unaffected by weather changes."""
        from .generator import coast_distance

        self.dist_to_land = coast_distance(self.land)
        # Navigable == water. Kept as its own array so callers never have to
        # remember the polarity of `land`.
        self.navigable = ~self.land
        self.ocean = self._largest_water_component()
        # Plain nested Python lists for the routing inner loop. Indexing a numpy
        # array with scalars allocates a numpy scalar each time and is roughly an
        # order of magnitude slower than native list access, which matters when
        # the search touches hundreds of thousands of cells.
        self.land_l = self.land.tolist()

    def _precompute_derived(self):
        """
        Per-cell terms the routing cost function reads on every edge.

        Hoisting these out of the inner loop is what makes the finer grid
        affordable: each edge evaluation becomes a few array lookups instead of
        recomputing powers and a metrics dict.
        """
        self.speed_loss = (0.04 * self.winds + 0.6 * self.waves).astype(np.float32)
        self.wind_sq = np.maximum(0.0, self.winds) ** 2
        self.wave_sq = self.waves ** 2

        standoff = self.STANDOFF_PENALTY * np.clip(
            1.0 - self.dist_to_land / self.STANDOFF_CELLS, 0.0, 1.0
        )
        # Risk density per nautical mile. Minimum is 1.0, which the routing
        # heuristic relies on as its admissible lower bound.
        self.risk_cell = (
            1.0
            + np.power(np.maximum(0.0, self.waves), 2.2)
            + 0.2 * self.winds
            + 2.5 * self.piracy
            + standoff
        ).astype(np.float32)

        # Global extrema over navigable water. The search heuristic uses these as
        # its admissible lower bounds. Deriving them from the data instead of
        # hardcoding optimistic constants is what keeps the heuristic both
        # admissible and informative: the true risk floor here is ~3.1 per NM, so
        # assuming 1.0 would understate remaining cost threefold and collapse the
        # search into a near-exhaustive sweep of the basin.
        ocean = self.ocean
        self.risk_min = float(self.risk_cell[ocean].min())
        self.speed_loss_min = float(self.speed_loss[ocean].min())
        self.current_max = float(
            np.sqrt(self.currents_u ** 2 + self.currents_v ** 2)[ocean].max()
        )

        # Native-list mirrors for the cost function's hot path (see land_l).
        self.speed_loss_l = self.speed_loss.tolist()
        self.risk_cell_l = self.risk_cell.tolist()
        self.wind_sq_l = self.wind_sq.tolist()
        self.wave_sq_l = self.wave_sq.tolist()
        self.currents_u_l = self.currents_u.tolist()
        self.currents_v_l = self.currents_v.tolist()

    def _largest_water_component(self) -> np.ndarray:
        """
        Boolean mask of the largest connected body of water.

        The land raster contains inland lakes and enclosed basins. Snapping a
        port into one of those would make every voyage unroutable, so ports are
        only ever placed in the open ocean component. Connectivity uses the same
        movement rule as the router (8-connected, no diagonal squeeze between
        two land cells) so the two can never disagree.
        """
        h, w = self.land.shape
        water = ~self.land
        labels = np.zeros((h, w), dtype=np.int32)
        best_label, best_size = 0, 0
        offsets = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr, dc) != (0, 0)]

        label = 0
        for start_r in range(h):
            for start_c in range(w):
                if not water[start_r, start_c] or labels[start_r, start_c]:
                    continue
                label += 1
                size = 0
                stack = [(start_r, start_c)]
                labels[start_r, start_c] = label
                while stack:
                    r, c = stack.pop()
                    size += 1
                    for dr, dc in offsets:
                        nr, nc = r + dr, c + dc
                        if not (0 <= nr < h and 0 <= nc < w):
                            continue
                        if not water[nr, nc] or labels[nr, nc]:
                            continue
                        if dr != 0 and dc != 0:
                            # A diagonal step may not clip a land corner. This
                            # must stay identical to mopbd_engine.can_traverse.
                            if self.land[r + dr, c] or self.land[r, c + dc]:
                                continue
                        labels[nr, nc] = label
                        stack.append((nr, nc))
                if size > best_size:
                    best_size, best_label = size, label

        return labels == best_label

    # ------------------------------------------------------------- accessors

    def _coord_to_idx(self, lat, lon):
        return grid.coord_to_grid(lat, lon)

    def is_land(self, lat, lon) -> bool:
        row, col = grid.coord_to_grid(lat, lon)
        return bool(self.land[row, col])

    def is_navigable_cell(self, row: int, col: int) -> bool:
        if not grid.in_bounds(row, col):
            return False
        return not bool(self.land[row, col])

    def get_metrics(self, lat, lon):
        row, col = grid.coord_to_grid(lat, lon)
        return {
            "wind": float(self.winds[row, col]),
            "wave": float(self.waves[row, col]),
            "current_u": float(self.currents_u[row, col]),
            "current_v": float(self.currents_v[row, col]),
            "piracy": float(self.piracy[row, col]),
            "land": bool(self.land[row, col]),
            "dist_to_land": float(self.dist_to_land[row, col]),
        }

    def nearest_navigable(self, lat: float, lon: float, max_radius: int = 40):
        """
        Nearest water cell to a coordinate, searched in expanding square rings.

        Ports sit on the coastline, so their exact coordinate usually falls in a
        land cell of the mask (Colombo, Singapore and Port Louis all do). Routing
        from such a cell would be impossible, so voyages start and end at the
        nearest navigable water instead. Only cells in the open-ocean component
        qualify, so a port can never be snapped into an inland lake.
        """
        def usable(r: int, c: int) -> bool:
            return grid.in_bounds(r, c) and bool(self.ocean[r, c])

        row, col = grid.coord_to_grid(lat, lon)
        if usable(row, col):
            return row, col

        for radius in range(1, max_radius + 1):
            best = None
            best_d = float("inf")
            for dr in range(-radius, radius + 1):
                for dc in range(-radius, radius + 1):
                    # Only the ring boundary; the interior was covered already
                    if max(abs(dr), abs(dc)) != radius:
                        continue
                    nr, nc = row + dr, col + dc
                    if not usable(nr, nc):
                        continue
                    clat, clon = grid.grid_to_coord(nr, nc)
                    d = grid.haversine_distance(lat, lon, clat, clon)
                    if d < best_d:
                        best_d = d
                        best = (nr, nc)
            if best is not None:
                return best
        return None

    # ----------------------------------------------------------- dynamic ops

    def inject_storm(self, center_lat, center_lon, radius_deg, severity=1.0):
        """
        Modify the in-memory wave/wind fields to simulate a weather shift.
        Returns the list of changed cells for incremental D* Lite repair.
        """
        lats, lons = grid.cell_centres()
        distance = np.sqrt((lats - center_lat) ** 2 + (lons - center_lon) ** 2)
        inside = (distance <= radius_deg) & self.navigable
        if not inside.any():
            return []

        factor = np.zeros_like(distance, dtype=np.float32)
        factor[inside] = ((radius_deg - distance[inside]) / radius_deg).astype(np.float32)

        self.winds = self.winds + 15.0 * factor * severity
        self.waves = self.waves + 4.0 * factor * severity

        # Refresh the cost-function lookup tables so the router sees the storm.
        # Only the weather-derived arrays change; the land geometry does not.
        self._precompute_derived()

        rows, cols = np.nonzero(inside)
        return [(int(r), int(c)) for r, c in zip(rows, cols)]


env_grid = EnvironmentalGrid()
