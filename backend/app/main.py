import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.limiter import RateLimitExceeded
from app.data.loader import load_all
from app.ml.predictor import load_model
from app.routes import arrivals, predict, nearby, plan, trips # Consolidated
from app.ws import live

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app):
    load_all()
    load_model()
    yield

app = FastAPI(title="Durham Transit API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"error": "rate_limit_exceeded", "message": str(exc)})

# Router Registration
app.include_router(arrivals.router, prefix="/api")
app.include_router(predict.router, prefix="/api")
app.include_router(nearby.router, prefix="/api")
app.include_router(plan.router, prefix="/api")
app.include_router(trips.router, prefix="/api")
app.include_router(live.router)

@app.get("/")
def health():
    return {"status": "ok", "service": "HTP TRANSIT API"}