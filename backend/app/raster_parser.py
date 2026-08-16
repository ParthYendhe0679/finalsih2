import os
import numpy as np

class EnvironmentalGrid:
    def __init__(self):
        self.west = 40.0
        self.east = 110.0
        self.south = -25.0
        self.north = 25.0
        self.width = 70
        self.height = 50
        
        self.winds = None
        self.waves = None
        self.currents_u = None
        self.currents_v = None
        self.piracy = None
        
        self.load_data()

    def load_data(self):
        # Prefer loading with rasterio if possible (TIFF files)
        try:
            import rasterio
            
            # Check if tiff files exist
            if os.path.exists("./data/winds.tif"):
                self.winds = self._read_tiff("./data/winds.tif")
                self.waves = self._read_tiff("./data/waves.tif")
                self.currents_u = self._read_tiff("./data/currents_u.tif")
                self.currents_v = self._read_tiff("./data/currents_v.tif")
                self.piracy = self._read_tiff("./data/piracy.tif")
                print("Loaded raster layers using Rasterio.")
                return
        except Exception as e:
            print(f"Failed to load via Rasterio: {e}. Falling back to NumPy .npy loader.")

        # Fallback: Load from NumPy binary files
        try:
            self.winds = np.load("./data/winds.npy")
            self.waves = np.load("./data/waves.npy")
            self.currents_u = np.load("./data/currents_u.npy")
            self.currents_v = np.load("./data/currents_v.npy")
            self.piracy = np.load("./data/piracy.npy")
            
            if os.path.exists("./data/metadata.npy"):
                meta = np.load("./data/metadata.npy", allow_pickle=True).item()
                self.west = meta["west"]
                self.east = meta["east"]
                self.south = meta["south"]
                self.north = meta["north"]
                self.width = meta["width"]
                self.height = meta["height"]
            print("Loaded raster layers using NumPy fallback.")
        except Exception as e:
            print(f"NumPy fallback failed to load data: {e}. Creating dummy arrays.")
            self._create_dummy_data()

    def _read_tiff(self, filepath):
        import rasterio
        with rasterio.open(filepath) as src:
            data = src.read(1)
            self.west = src.bounds.left
            self.east = src.bounds.right
            self.south = src.bounds.bottom
            self.north = src.bounds.top
            self.width = src.width
            self.height = src.height
            return data

    def _create_dummy_data(self):
        shape = (self.height, self.width)
        self.winds = np.ones(shape, dtype=np.float32) * 8.0
        self.waves = np.ones(shape, dtype=np.float32) * 1.2
        self.currents_u = np.zeros(shape, dtype=np.float32)
        self.currents_v = np.zeros(shape, dtype=np.float32)
        self.piracy = np.zeros(shape, dtype=np.float32)

    def _coord_to_idx(self, lat, lon):
        lon = max(self.west, min(self.east, lon))
        lat = max(self.south, min(self.north, lat))
        
        col = int((lon - self.west) / (self.east - self.west) * (self.width - 1))
        row = int((self.north - lat) / (self.north - self.south) * (self.height - 1))
        
        col = max(0, min(self.width - 1, col))
        row = max(0, min(self.height - 1, row))
        
        return row, col

    def get_metrics(self, lat, lon):
        row, col = self._coord_to_idx(lat, lon)
        return {
            "wind": float(self.winds[row, col]),
            "wave": float(self.waves[row, col]),
            "current_u": float(self.currents_u[row, col]),
            "current_v": float(self.currents_v[row, col]),
            "piracy": float(self.piracy[row, col])
        }

    def inject_storm(self, center_lat, center_lon, radius_deg, severity=1.0):
        """
        Dynamically modifies the active wave/wind grids in memory to simulate a weather shift.
        """
        changed_cells = []
        for r in range(self.height):
            for c in range(self.width):
                lat = self.north - r * ((self.north - self.south) / self.height)
                lon = self.west + c * ((self.east - self.west) / self.width)
                
                distance = np.sqrt((lat - center_lat)**2 + (lon - center_lon)**2)
                if distance <= radius_deg:
                    factor = (radius_deg - distance) / radius_deg
                    self.winds[r, c] += float(15.0 * factor * severity)
                    self.waves[r, c] += float(4.0 * factor * severity)
                    changed_cells.append((r, c))
        return changed_cells
                    
env_grid = EnvironmentalGrid()
