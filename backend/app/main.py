"""
main.py — FastAPI app entry point.
Loads all GTFS data into memory on startup.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.limiter import RateLimitExceeded
from app.data.loader import load_all
from app.ml.predictor import load_model
from app.routes import arrivals, predict
from app.routes.nearby import router as nearby_router
from app.routes.plan import router as plan_router
from app.ws import live

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all()      # loads all 5 GTFS files into memory
    load_model()    # loads ML model + scaler + Durham schools
    yield


app = FastAPI(
    title="Durham Transit API",
    version="1.0.0",
    lifespan=lifespan
)

# ── middleware ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── error handlers ──
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error":   "rate_limit_exceeded",
            "message": str(exc)
        }
    )

# ── routers ──
app.include_router(arrivals.router, prefix="/api")
app.include_router(predict.router,  prefix="/api")
app.include_router(nearby_router,   prefix="/api")
app.include_router(plan_router,     prefix="/api")
app.include_router(live.router)


@app.get("/")
def health():
    return {"status": "ok", "service": " HTP TRANSIT API"}