import os
import numpy as np
from .database import engine, Base, SessionLocal
from .models import Ship

def create_data_dir():
    os.makedirs("./data", exist_ok=True)

def generate_rasters():
    west, east = 40.0, 110.0
    south, north = -25.0, 25.0
    width, height = 70, 50  # 1 degree resolution grid

    # Wind speed (knots)
    winds = np.random.uniform(5, 18, size=(height, width)).astype(np.float32)
    # Add a windy area representing a monsoonal breeze
    winds[20:35, 20:45] += 12.0

    # Wave height (meters)
    waves = np.random.uniform(0.5, 2.2, size=(height, width)).astype(np.float32)
    # High waves in the wind zone
    waves[20:35, 20:45] += 2.5

    # Currents (knots): U (West-East) and V (South-North)
    currents_u = np.random.uniform(-0.4, 0.4, size=(height, width)).astype(np.float32)
    # Monsoonal westward current near equator
    currents_u[22:28, :] -= 0.8
    currents_v = np.random.uniform(-0.3, 0.3, size=(height, width)).astype(np.float32)

    # Piracy risk index (0 to 100)
    # Gulf of Aden and Somali Basin have elevated risk
    piracy = np.zeros((height, width), dtype=np.float32)
    for r in range(height):
        for c in range(width):
            lat = north - r * ((north - south) / height)
            lon = west + c * ((east - west) / width)
            
            # Distance to Gulf of Aden (12N, 45E) and Somali coast (5N, 50E)
            dist_aden = np.sqrt((lat - 12)**2 + (lon - 45)**2)
            dist_somali = np.sqrt((lat - 5)**2 + (lon - 50)**2)
            
            if dist_aden < 7.0:
                piracy[r, c] = max(10.0, (7.0 - dist_aden) * 12.0)
            elif dist_somali < 9.0:
                piracy[r, c] = max(5.0, (9.0 - dist_somali) * 8.0)
            else:
                piracy[r, c] = float(np.random.uniform(0, 4.0))

    create_data_dir()

    # Try exporting as GeoTIFF using rasterio
    rasterio_success = False
    try:
        import rasterio
        from rasterio.transform import from_bounds

        transform = from_bounds(west, south, east, north, width, height)
        crs = "+proj=longlat +datum=WGS84 +no_defs"

        datasets = {
            "winds.tif": winds,
            "waves.tif": waves,
            "currents_u.tif": currents_u,
            "currents_v.tif": currents_v,
            "piracy.tif": piracy
        }

        for name, data in datasets.items():
            path = os.path.join("./data", name)
            with rasterio.open(
                path,
                'w',
                driver='GTiff',
                height=height,
                width=width,
                count=1,
                dtype=data.dtype,
                crs=crs,
                transform=transform,
            ) as dst:
                dst.write(data, 1)
        
        print("GeoTIFF files generated successfully via rasterio.")
        rasterio_success = True
    except Exception as e:
        print(f"Rasterio generation failed: {e}. Falling back to NumPy .npy array exports.")
        
    # Save as .npy arrays regardless (guarantees backup/fallback works)
    np.save("./data/winds.npy", winds)
    np.save("./data/waves.npy", waves)
    np.save("./data/currents_u.npy", currents_u)
    np.save("./data/currents_v.npy", currents_v)
    np.save("./data/piracy.npy", piracy)
    
    # Save metadata about grid geometry
    meta = {"west": west, "east": east, "south": south, "north": north, "width": width, "height": height}
    np.save("./data/metadata.npy", meta)
    print("NumPy backup files generated.")

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
