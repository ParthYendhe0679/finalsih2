import os
import numpy as np
from .database import engine, Base, SessionLocal
from .models import Ship
from . import grid

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def create_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _mean_filter(a: np.ndarray, passes: int = 2) -> np.ndarray:
    """Dependency-free 3x3 box blur with edge clamping (scipy is not installed)."""
    out = a.astype(np.float32)
    for _ in range(passes):
        p = np.pad(out, 1, mode="edge")
        out = (
            p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:]
            + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
            + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]
        ) / 9.0
    return out


def _smooth_field(shape, lo: float, hi: float, block_deg: float, rng) -> np.ndarray:
    """
    A spatially correlated random field in [lo, hi].

    Met-ocean fields vary over hundreds of kilometres, so per-cell white noise
    (what the previous 1 deg generator produced) makes the risk surface jagged
    and meaningless once the grid is refined. We draw noise on a coarse lattice
    of ``block_deg`` cells, upsample it and blur.
    """
    height, width = shape
    bh = max(2, int(round(block_deg / grid.CELL_DEG)))
    coarse_h = int(np.ceil(height / bh)) + 1
    coarse_w = int(np.ceil(width / bh)) + 1
    coarse = rng.random((coarse_h, coarse_w)).astype(np.float32)

    # Bilinear upsample onto the full grid
    ys = np.linspace(0, coarse_h - 1, height, dtype=np.float32)
    xs = np.linspace(0, coarse_w - 1, width, dtype=np.float32)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, coarse_h - 1)
    x1 = np.minimum(x0 + 1, coarse_w - 1)
    wy = (ys - y0)[:, None]
    wx = (xs - x0)[None, :]

    top = coarse[np.ix_(y0, x0)] * (1 - wx) + coarse[np.ix_(y0, x1)] * wx
    bot = coarse[np.ix_(y1, x0)] * (1 - wx) + coarse[np.ix_(y1, x1)] * wx
    field = top * (1 - wy) + bot * wy

    field = _mean_filter(field, passes=2)
    # Renormalise to [0, 1] after blurring, then map into [lo, hi]
    fmin, fmax = float(field.min()), float(field.max())
    if fmax - fmin > 1e-9:
        field = (field - fmin) / (fmax - fmin)
    return (lo + field * (hi - lo)).astype(np.float32)


def build_land_mask(lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """
    True where a cell centre is land and therefore not navigable.

    Uses the `global_land_mask` package (a bundled 0.01 deg global raster). If it
    is unavailable we fail loudly rather than silently returning an all-water
    mask -- an all-water mask is exactly the bug this layer exists to prevent.
    """
    from global_land_mask import globe

    mask = globe.is_land(lats, lons)
    return np.asarray(mask, dtype=bool)


def coast_distance(land: np.ndarray, max_cells: int = 8) -> np.ndarray:
    """
    Distance (in cells, capped at ``max_cells``) from each water cell to the
    nearest land cell, via successive 8-connected dilations of the land set.

    Feeds a soft standoff penalty so routes keep sensible clearance off a coast
    instead of scraping along it. Land cells get distance 0.
    """
    dist = np.full(land.shape, float(max_cells), dtype=np.float32)
    dist[land] = 0.0

    frontier = land.copy()
    for d in range(1, max_cells):
        padded = np.pad(frontier, 1, mode="constant", constant_values=False)
        grown = np.zeros_like(frontier)
        for dr in (0, 1, 2):
            for dc in (0, 1, 2):
                grown |= padded[dr:dr + land.shape[0], dc:dc + land.shape[1]]
        newly = grown & ~frontier
        if not newly.any():
            break
        dist[newly] = float(d)
        frontier = grown
    return dist


def generate_rasters():
    height, width = grid.HEIGHT, grid.WIDTH
    lats, lons = grid.cell_centres()
    rng = np.random.default_rng(20260817)

    # --- Land / navigability mask -------------------------------------------
    land = build_land_mask(lats, lons)
    dist_to_land = coast_distance(land)

    # --- Wind speed (knots) -------------------------------------------------
    winds = _smooth_field((height, width), 4.0, 16.0, block_deg=6.0, rng=rng)
    # Southwest monsoon belt over the Arabian Sea / central basin. Expressed in
    # lat/lon so it stays put if the grid resolution changes -- the previous
    # version hardcoded array slices tuned to the 1 deg grid.
    monsoon = np.exp(-(((lats - 8.0) / 9.0) ** 2 + ((lons - 65.0) / 14.0) ** 2))
    winds = winds + 14.0 * monsoon

    # --- Wave height (metres) ----------------------------------------------
    waves = _smooth_field((height, width), 0.6, 2.0, block_deg=6.0, rng=rng)
    waves = waves + 3.0 * monsoon
    # Swell decays in sheltered near-shore water
    shelter = np.clip(dist_to_land / 4.0, 0.25, 1.0)
    waves = waves * shelter

    # --- Surface currents (knots) ------------------------------------------
    currents_u = _smooth_field((height, width), -0.4, 0.4, block_deg=8.0, rng=rng)
    currents_v = _smooth_field((height, width), -0.3, 0.3, block_deg=8.0, rng=rng)
    # Westward equatorial drift, strongest on the equator
    equatorial = np.exp(-((lats / 3.5) ** 2))
    currents_u = currents_u - 0.8 * equatorial

    # --- Piracy risk index (0-100) -----------------------------------------
    dist_aden = np.sqrt((lats - 12.0) ** 2 + (lons - 45.0) ** 2)
    dist_somali = np.sqrt((lats - 5.0) ** 2 + (lons - 50.0) ** 2)
    piracy = _smooth_field((height, width), 0.0, 4.0, block_deg=8.0, rng=rng)
    piracy = np.where(dist_aden < 7.0, np.maximum(10.0, (7.0 - dist_aden) * 12.0), piracy)
    piracy = np.where(
        (dist_aden >= 7.0) & (dist_somali < 9.0),
        np.maximum(5.0, (9.0 - dist_somali) * 8.0),
        piracy,
    )

    # Land cells carry neutral values. They are unroutable via the mask, but
    # leaving ocean-like values there previously made the Indian peninsula look
    # like unusually calm sea to the cost function.
    for arr in (winds, waves, currents_u, currents_v, piracy):
        arr[land] = 0.0

    winds = winds.astype(np.float32)
    waves = waves.astype(np.float32)
    currents_u = currents_u.astype(np.float32)
    currents_v = currents_v.astype(np.float32)
    piracy = piracy.astype(np.float32)
    land_f = land.astype(np.float32)

    create_data_dir()

    datasets = {
        "winds": winds,
        "waves": waves,
        "currents_u": currents_u,
        "currents_v": currents_v,
        "piracy": piracy,
        "land": land_f,
    }

    # Export as GeoTIFF when rasterio is available
    try:
        import rasterio
        from rasterio.transform import from_bounds

        transform = from_bounds(grid.WEST, grid.SOUTH, grid.EAST, grid.NORTH, width, height)
        crs = "+proj=longlat +datum=WGS84 +no_defs"

        for name, data in datasets.items():
            with rasterio.open(
                os.path.join(DATA_DIR, f"{name}.tif"),
                "w",
                driver="GTiff",
                height=height,
                width=width,
                count=1,
                dtype=data.dtype,
                crs=crs,
                transform=transform,
            ) as dst:
                dst.write(data, 1)

        print(f"GeoTIFF layers written at {grid.CELL_DEG} deg ({height}x{width}).")
    except Exception as e:
        print(f"Rasterio export failed: {e}. NumPy .npy exports still written.")

    # Always write the .npy fallbacks so the loader has a guaranteed path
    for name, data in datasets.items():
        np.save(os.path.join(DATA_DIR, f"{name}.npy"), data)

    meta = {
        "west": grid.WEST,
        "east": grid.EAST,
        "south": grid.SOUTH,
        "north": grid.NORTH,
        "width": width,
        "height": height,
        "cell_deg": grid.CELL_DEG,
    }
    np.save(os.path.join(DATA_DIR, "metadata.npy"), meta)

    water_pct = 100.0 * (1.0 - land.mean())
    print(f"NumPy layers written. Navigable water: {water_pct:.1f}% of {height * width} cells.")


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if ships are already seeded
        if db.query(Ship).count() == 0:
            ships = [
                Ship(
                    name="Aegir Container",
                    imo="IMO9123456",
                    displacement=55000.0,
                    frontal_area=1200.0,
                    engine_efficiency=0.45,
                    sfoc=165.0,
                    risk_index=12.0,
                    maintenance_schedule="Routine inspection: 2026-10-10",
                    parts_replacement_log="Alternator replaced (2026-05-15)"
                ),
                Ship(
                    name="Aegir Tanker",
                    imo="IMO9234567",
                    displacement=110000.0,
                    frontal_area=1600.0,
                    engine_efficiency=0.40,
                    sfoc=178.0,
                    risk_index=22.0,
                    maintenance_schedule="Drydock overhaul: 2026-12-05",
                    parts_replacement_log="Propeller polishing (2026-02-10)"
                ),
                Ship(
                    name="Aegir Carrier",
                    imo="IMO9345678",
                    displacement=75000.0,
                    frontal_area=1400.0,
                    engine_efficiency=0.42,
                    sfoc=170.0,
                    risk_index=15.0,
                    maintenance_schedule="Hull cleaning: 2026-11-20",
                    parts_replacement_log="Water pump replaced (2026-07-02)"
                )
            ]
            db.add_all(ships)
            db.commit()
            print("Database seeded with default ships.")
        else:
            print("Database already has ships. Seeding skipped.")
    finally:
        db.close()


if __name__ == "__main__":
    generate_rasters()
    seed_database()
