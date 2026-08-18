from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List

class ShipBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Aegir Pride"})
    imo: str = Field(..., json_schema_extra={"example": "IMO9876543"})
    displacement: float = Field(..., json_schema_extra={"example": 55000.0})
    frontal_area: float = Field(..., json_schema_extra={"example": 1200.0})
    engine_efficiency: float = Field(..., json_schema_extra={"example": 0.45})
    sfoc: float = Field(..., json_schema_extra={"example": 170.0})
    risk_index: Optional[float] = 15.0
    maintenance_schedule: Optional[str] = "Next maintenance: 2026-12-15"
    parts_replacement_log: Optional[str] = "Filter replacement (2026-06-01)"

class ShipCreate(ShipBase):
    pass

class ShipUpdate(BaseModel):
    name: Optional[str] = None
    imo: Optional[str] = None
    displacement: Optional[float] = None
    frontal_area: Optional[float] = None
    engine_efficiency: Optional[float] = None
    sfoc: Optional[float] = None
    risk_index: Optional[float] = None
    maintenance_schedule: Optional[str] = None
    parts_replacement_log: Optional[str] = None

class Ship(ShipBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class WeightSliders(BaseModel):
    safety_weight: float = Field(..., ge=0.0, le=1.0)
    fuel_weight: float = Field(..., ge=0.0, le=1.0)
    time_weight: float = Field(..., ge=0.0, le=1.0)

class RouteRequest(BaseModel):
    origin: str  # Name of port, e.g. "JNPT"
    destination: str  # Name of port, e.g. "Colombo"
    ship_id: int
    weights: WeightSliders

class RerouteRequest(BaseModel):
    """
    Re-solve the front from the vessel's present position after the operator has
    dragged it along its track. The sailed leg is discarded, so only the drop
    coordinate is needed -- the snapping itself happens client-side.
    """
    destination: str
    ship_id: int
    weights: WeightSliders
    resume_lat: float = Field(..., ge=-90.0, le=90.0)
    resume_lon: float = Field(..., ge=-180.0, le=180.0)

class ReplanRequest(BaseModel):
    origin: str
    destination: str
    ship_id: int
    weights: WeightSliders
    current_idx: int  # index of ship on current path
    path_nodes: List[List[float]]  # List of [lat, lon]
    storm_lat: float
    storm_lon: float
    storm_radius: float  # in km
