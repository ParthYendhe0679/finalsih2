from sqlalchemy.orm import Session
from . import models, schemas

def get_ship(db: Session, ship_id: int):
    return db.query(models.Ship).filter(models.Ship.id == ship_id).first()

def get_ship_by_imo(db: Session, imo: str):
    return db.query(models.Ship).filter(models.Ship.imo == imo).first()

def get_ships(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Ship).offset(skip).limit(limit).all()

def create_ship(db: Session, ship: schemas.ShipCreate):
    db_ship = models.Ship(
        name=ship.name,
        imo=ship.imo,
        vessel_type=ship.vessel_type or "Container Carrier",
        length=ship.length if ship.length is not None else 300.0,
        beam=ship.beam if ship.beam is not None else 45.0,
        draft=ship.draft if ship.draft is not None else 14.0,
        dwt=ship.dwt if ship.dwt is not None else 80000.0,
        displacement=ship.displacement,
        frontal_area=ship.frontal_area,
        engine_efficiency=ship.engine_efficiency,
        sfoc=ship.sfoc,
        risk_index=ship.risk_index if ship.risk_index is not None else 15.0,
        maintenance_schedule=ship.maintenance_schedule or "Next maintenance: 2026-12-15",
        parts_replacement_log=ship.parts_replacement_log or "Filter replacement (2026-06-01)"
    )
    db.add(db_ship)
    db.commit()
    db.refresh(db_ship)
    return db_ship

def update_ship(db: Session, ship_id: int, ship_update: schemas.ShipUpdate):
    db_ship = get_ship(db, ship_id)
    if not db_ship:
        return None
    
    update_data = ship_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ship, key, value)
    
    db.commit()
    db.refresh(db_ship)
    return db_ship

def delete_ship(db: Session, ship_id: int):
    db_ship = get_ship(db, ship_id)
    if not db_ship:
        return None
    db.delete(db_ship)
    db.commit()
    return db_ship
