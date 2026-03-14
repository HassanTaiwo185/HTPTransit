"""
main.py — FastAPI app entry point.
Loads all GTFS data into memory on startup.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.limiter import RateLimitExceeded
from app.core.scheduler import start_background_polling
from app.data.loader import load_all
from app.ml.predictor import load_model
from app.routes import arrivals, predict
from app.ws import live

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── runs once when server boots ──
    load_all()
    load_model()
    asyncio.create_task(start_background_polling(
        route_ids=["DRHAM:20", "DRHAM:21", "DRHAM:302"],
        stop_ids=["1042", "1055", "1078"]
    ))
    yield
    # ── runs once when server shuts down ──


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
            "error": "rate_limit_exceeded",
            "message": str(exc)
        }
    )

# ── routers ──
app.include_router(arrivals.router, prefix="/api")
app.include_router(predict.router,  prefix="/api")
app.include_router(live.router)


@app.get("/")
def health():
    return {"status": "ok", "service": "Durham Transit API"}