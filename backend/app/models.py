from sqlalchemy import Column, Integer, String, Float
from .database import Base

class Ship(Base):
    __tablename__ = "ships"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    imo = Column(String, unique=True, index=True, nullable=False)
    vessel_type = Column(String, default="Container Carrier")  # e.g. Container Carrier, Bulk Carrier, Crude Oil Tanker, LNG Carrier
    length = Column(Float, default=300.0)  # Length Overall (LOA) in meters
    beam = Column(Float, default=45.0)  # Beam / Width in meters
    draft = Column(Float, default=14.0)  # Max Draft in meters
    dwt = Column(Float, default=80000.0)  # Deadweight Tonnage (DWT) in Metric Tons
    displacement = Column(Float, nullable=False)  # Displacement in Metric Tons
    frontal_area = Column(Float, nullable=False)  # in m^2
    engine_efficiency = Column(Float, nullable=False)  # e.g., 0.45 (45%)
    sfoc = Column(Float, nullable=False)  # Specific Fuel Oil Consumption in g/kWh
    risk_index = Column(Float, default=15.0)  # Circular barometer health tracking (0-100)
    maintenance_schedule = Column(String, default="Next maintenance: 2026-12-15")
    parts_replacement_log = Column(String, default="Filter replacement (2026-06-01)")
