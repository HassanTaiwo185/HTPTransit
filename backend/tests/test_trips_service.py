"""
test_trips_service.py — real API call to Transit App nearby_routes endpoint.
"""
import pytest
from app.data.loader import load_all
from app.data import store
from app.services.trips_service import get_trip_updates


@pytest.fixture(autouse=True)
def load_data():
    load_all()


@pytest.mark.asyncio
async def test_trips_returns_dict():
    stop_id = next(iter(store.stop_info))
    result = await get_trip_updates(stop_id)
    assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_trips_invalid_stop_returns_error():
    result = await get_trip_updates("INVALID_999")
    assert "error" in result


@pytest.mark.asyncio
async def test_trips_has_required_fields():
    stop_id = next(iter(store.stop_info))
    result = await get_trip_updates(stop_id)
    assert "stop_id"   in result
    assert "stop_name" in result
    assert "routes"    in result


@pytest.mark.asyncio
async def test_trips_routes_is_list():
    stop_id = next(iter(store.stop_info))
    result = await get_trip_updates(stop_id)
    assert isinstance(result["routes"], list)


@pytest.mark.asyncio
async def test_trips_correct_stop_id():
    stop_id = next(iter(store.stop_info))
    result = await get_trip_updates(stop_id)
    assert result["stop_id"] == stop_id