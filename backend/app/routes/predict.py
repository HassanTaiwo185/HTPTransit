from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.ml.predictor import predict

router = APIRouter(tags=["predict"])


class PredictRequest(BaseModel):
    boardings:          float
    alightings:         float
    stop_lat:           float
    stop_lon:           float
    route_count:        int   = 1
    hour:               int   = 12
    is_weekend:         int   = 0
    population_density: float = 1800.0


@router.post("/predict")
def predict_crowding(req: PredictRequest):
    if req.hour < 0 or req.hour > 23:
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "invalid_hour",
                "message": "Hour must be between 0 and 23"
            }
        )
    if req.is_weekend not in [0, 1]:
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "invalid_is_weekend",
                "message": "is_weekend must be 0 or 1"
            }
        )

    result = predict(
        boardings          = req.boardings,
        alightings         = req.alightings,
        stop_lat           = req.stop_lat,
        stop_lon           = req.stop_lon,
        route_count        = req.route_count,
        hour               = req.hour,
        is_weekend         = req.is_weekend,
        population_density = req.population_density,
    )

    if result.get("error"):
        status = 400
        if result["error"] == "outside_service_area":
            status = 422
        if result["error"] == "model_unavailable":
            status = 503
        raise HTTPException(status_code=status, detail=result)

    return result