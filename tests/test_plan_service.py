"""
test_plan_service.py — real API call to Transit App plan endpoint.
Uses Durham Region coordinates for testing.
"""
import pytest
from app.services.plan_service import get_plan

# Oshawa GO Station → Durham College
FROM_LAT = 43.8971
FROM_LON = -78.8658
TO_LAT   = 43.9241
TO_LON   = -78.8963


@pytest.mark.asyncio
async def test_plan_returns_dict():
    result = await get_plan(FROM_LAT, FROM_LON, TO_LAT, TO_LON)
    assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_plan_has_required_fields():
    result = await get_plan(FROM_LAT, FROM_LON, TO_LAT, TO_LON)
    assert "from"  in result
    assert "to"    in result
    assert "plans" in result


@pytest.mark.asyncio
async def test_plan_returns_at_least_one_result():
    result = await get_plan(FROM_LAT, FROM_LON, TO_LAT, TO_LON)
    assert len(result["plans"]) > 0, "Should return at least one plan"


@pytest.mark.asyncio
async def test_plan_legs_have_correct_fields():
    result = await get_plan(FROM_LAT, FROM_LON, TO_LAT, TO_LON)
    for plan in result["plans"]:
        assert "legs"         in plan
        assert "duration_min" in plan
        for leg in plan["legs"]:
            assert "mode"          in leg
            assert "duration_min"  in leg
            assert "start_time"    in leg
            assert "end_time"      in leg
            assert "distance_m"    in leg
            assert "polyline"      in leg


# tests/test_plan_service.py — update test_plan_has_global_route_id
@pytest.mark.asyncio
async def test_plan_has_global_route_id():
    result = await get_plan(FROM_LAT, FROM_LON, TO_LAT, TO_LON)
    print("\n✅ Route IDs found:", result.get("route_ids"))
    assert len(result.get("route_ids", [])) > 0, "Should find at least one route_id"