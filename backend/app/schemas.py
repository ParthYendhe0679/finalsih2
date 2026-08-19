from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List

class ShipBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "MV Ever Given"})
    imo: str = Field(..., json_schema_extra={"example": "IMO9811000"})
    vessel_type: Optional[str] = Field("Container Carrier", json_schema_extra={"example": "Ultra Large Container Vessel (20,124 TEU)"})
    length: Optional[float] = Field(399.9, json_schema_extra={"example": 399.9})
    beam: Optional[float] = Field(58.8, json_schema_extra={"example": 58.8})
    draft: Optional[float] = Field(14.5, json_schema_extra={"example": 14.5})
    dwt: Optional[float] = Field(199692.0, json_schema_extra={"example": 199692.0})
    displacement: float = Field(..., json_schema_extra={"example": 219000.0})
    frontal_area: float = Field(..., json_schema_extra={"example": 2200.0})
    engine_efficiency: float = Field(..., json_schema_extra={"example": 0.48})
    sfoc: float = Field(..., json_schema_extra={"example": 162.0})
    risk_index: Optional[float] = 10.0
    maintenance_schedule: Optional[str] = "Next maintenance: 2026-12-15"
    parts_replacement_log: Optional[str] = "Filter replacement (2026-06-01)"

class ShipCreate(ShipBase):
    pass

class ShipUpdate(BaseModel):
    name: Optional[str] = None
    imo: Optional[str] = None
    vessel_type: Optional[str] = None
    length: Optional[float] = None
    beam: Optional[float] = None
    draft: Optional[float] = None
    dwt: Optional[float] = None
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

class EmergencyRequest(BaseModel):
    origin: str
    destination: str
    ship_id: int
    emergency_type: str  # "cyclone" | "piracy" | "medical" | "mechanical"
    current_lat: float  # ship's live position (GPS / telemetry), voyage re-plans from here
    current_lon: float
