from sqlalchemy import Column, Integer, String, Float
from .database import Base

class Ship(Base):
    __tablename__ = "ships"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    imo = Column(String, unique=True, index=True, nullable=False)
    displacement = Column(Float, nullable=False)  # in Metric Tons
    frontal_area = Column(Float, nullable=False)  # in m^2
    engine_efficiency = Column(Float, nullable=False)  # e.g., 0.45 (45%)
    sfoc = Column(Float, nullable=False)  # Specific Fuel Oil Consumption in g/kWh
    risk_index = Column(Float, default=15.0)  # Circular barometer health tracking (0-100)
    maintenance_schedule = Column(String, default="Next maintenance: 2026-12-15")
    parts_replacement_log = Column(String, default="Filter replacement (2026-06-01)")
