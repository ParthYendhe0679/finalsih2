"""
Canonical grid geometry for the Indian Ocean routing domain.

Every module that converts between lat/lon and raster indices imports from here.
Previously ``mopbd_engine`` and ``raster_parser`` each carried their own copy of
the bounds plus a slightly different transform (one scaled by WIDTH, the other by
WIDTH - 1), so environmental lookups were sampled from the wrong cell and
round-tripping a coordinate drifted.

Convention: a cell index (row, col) refers to the cell *centre*, which makes
``coord_to_grid(grid_to_coord(r, c)) == (r, c)`` exact for every valid index.
Row 0 is the northern edge, column 0 the western edge.
"""

import math
from typing import Tuple

# Geographical bounds of the modelled basin
WEST = 40.0
EAST = 110.0
SOUTH = -25.0
NORTH = 25.0

# Cell size in degrees. 0.25 deg ~ 27 km, fine enough to resolve the Indian
# west coast, the Gulf of Mannar and the Malacca approaches. At the previous
# 1 deg resolution a land mask could not represent those at all.
CELL_DEG = 0.25

WIDTH = int(round((EAST - WEST) / CELL_DEG))    # 280 columns
HEIGHT = int(round((NORTH - SOUTH) / CELL_DEG))  # 200 rows


def grid_to_coord(row: int, col: int) -> Tuple[float, float]:
    """Centre coordinate of cell (row, col)."""
    lat = NORTH - (row + 0.5) * CELL_DEG
    lon = WEST + (col + 0.5) * CELL_DEG
    return lat, lon


def coord_to_grid(lat: float, lon: float) -> Tuple[int, int]:
    """Index of the cell containing (lat, lon), clamped to the domain."""
    col = int(math.floor((lon - WEST) / CELL_DEG))
    row = int(math.floor((NORTH - lat) / CELL_DEG))
    col = max(0, min(WIDTH - 1, col))
    row = max(0, min(HEIGHT - 1, row))
    return row, col


def in_bounds(row: int, col: int) -> bool:
    return 0 <= row < HEIGHT and 0 <= col < WIDTH


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in nautical miles."""
    R = 3440.065  # Earth radius in NM
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def cell_centres():
    """Return (lats, lons) 2-D arrays of every cell centre, shape (HEIGHT, WIDTH)."""
    import numpy as np

    rows = np.arange(HEIGHT)
    cols = np.arange(WIDTH)
    lats = NORTH - (rows + 0.5) * CELL_DEG
    lons = WEST + (cols + 0.5) * CELL_DEG
    return np.meshgrid(lats, lons, indexing="ij")
