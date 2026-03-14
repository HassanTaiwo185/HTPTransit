"""
test_vehicles_service.py — vehicles endpoint not available on this API tier.
Tests that service handles 404 gracefully.
"""
import pytest
from app.services.vehicles_service import get_vehicle_positions


ROUTE_ID = "DRTON:69863"


@pytest.mark.asyncio
async def test_vehicles_returns_dict():
    result = await get_vehicle_positions(ROUTE_ID)
    assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_vehicles_has_required_fields():
    result = await get_vehicle_positions(ROUTE_ID)
    assert "route_id"  in result
    assert "vehicles"  in result
    assert "available" in result


@pytest.mark.asyncio
async def test_vehicles_is_list():
    result = await get_vehicle_positions(ROUTE_ID)
    assert isinstance(result["vehicles"], list)


@pytest.mark.asyncio
async def test_vehicles_correct_route_id():
    result = await get_vehicle_positions(ROUTE_ID)
    assert result["route_id"] == ROUTE_ID


@pytest.mark.asyncio
async def test_vehicles_unavailable_handled_gracefully():
    """404 should return empty list not crash."""
    result = await get_vehicle_positions(ROUTE_ID)
    assert result["available"] == False
    assert result["vehicles"]  == []