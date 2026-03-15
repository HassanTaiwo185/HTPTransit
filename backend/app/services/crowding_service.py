"""
crowding_service.py — ML crowding prediction only.
Labels: not_crowded | normal | overcrowded

Loads Stats Canada DA shapefile + OntarioCensus.csv once at startup.
Provides real population density per stop via get_predicted_crowding().
"""
import os
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

from app.ml.predictor import predict

logger   = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parents[2] / "data"

# ── Shapefile state (loaded once at startup) ──────────────────
_census_gdf = None


def load_population_data() -> None:
    """
    Call once at startup (from loader.py → load_all).
    Joins canada_polyline/lda_000a21a_e.shp with OntarioCensus.csv
    so every DA polygon carries a real pop_density value.
    """
    global _census_gdf

    os.environ["SHAPE_RESTORE_SHX"] = "YES"

    shp_path    = DATA_DIR / "canada_polyline" / "lda_000a21a_e.shp"
    census_path = DATA_DIR / "OntarioCensus.csv"

    if not shp_path.exists():
        logger.warning(
            "Shapefile not found at %s — population_density will use fallback 400.0",
            shp_path,
        )
        return

    try:
        logger.info("Loading DA shapefile: %s", shp_path)
        gdf = gpd.read_file(shp_path)

        if census_path.exists():
            logger.info("Loading census CSV: %s", census_path)
            census = pd.read_csv(census_path)

            density_col = "Population and dwelling counts (5): Population density per square kilometre, 2021 [5]"

            census = census[["DGUID", density_col]].copy()
            census.columns = ["DGUID", "pop_density"]
            census["pop_density"] = pd.to_numeric(census["pop_density"], errors="coerce")

            gdf = gdf.merge(census, on="DGUID", how="left")
            gdf["pop_density"] = gdf["pop_density"].fillna(400.0)
            logger.info("  → census joined on DGUID")
        else:
            logger.warning("OntarioCensus.csv not found — using fallback density 400.0")
            gdf["pop_density"] = 400.0

        # Reproject to WGS84 (lat/lon) if needed
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            logger.info("  → reprojecting from %s to WGS84", gdf.crs)
            gdf = gdf.to_crs(epsg=4326)

        _census_gdf = gdf
        logger.info("  → %d dissemination areas ready", len(_census_gdf))

    except Exception as e:
        logger.error("Failed to load population data: %s", e)


def _get_population_density(lat: float, lon: float) -> float:
    """Spatial point-in-polygon lookup — which DA contains this stop?"""
    if _census_gdf is None or lat is None or lon is None:
        return 400.0

    try:
        point = Point(lon, lat)  # shapely uses (lon, lat)
        match = _census_gdf[_census_gdf.geometry.contains(point)]
        if not match.empty:
            return float(match.iloc[0]["pop_density"])
    except Exception as e:
        logger.warning("Population density lookup failed: %s", e)

    return 400.0


# ── Main prediction entry point ───────────────────────────────

def get_predicted_crowding(
    stop_lat:     float,
    stop_lon:     float,
    departure_ts: int,
    route_count:  int = 1,
) -> dict:
    """
    Predict crowding for a Durham Transit stop.
    population_density is looked up from the Stats Canada shapefile automatically.
    """
    import pytz
    tz          = pytz.timezone("America/Toronto")
    dt          = datetime.fromtimestamp(departure_ts, tz=tz)
    hour        = dt.hour
    day_of_week = dt.weekday()
    is_weekend  = int(day_of_week >= 5)

    # Real population density from Stats Canada DA shapefile
    population_density = _get_population_density(stop_lat, stop_lon)

    result = predict(
        stop_lat           = stop_lat,
        stop_lon           = stop_lon,
        hour               = hour,
        is_weekend         = is_weekend,
        day_of_week        = day_of_week,
        route_count        = route_count,
        population_density = population_density,
    )

    return {
        **result,
        "source":             "ml_prediction",
        "predicted_for":      dt.isoformat(),
        "population_density": round(population_density, 1),
    }