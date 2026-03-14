"""
test_limiter.py — verify rate limiter blocks on 6th call.
"""
import pytest
from app.core.limiter import TransitAPILimiter, RateLimitExceeded


@pytest.mark.asyncio
async def test_allows_5_calls():
    """Should allow exactly 5 calls without raising."""
    limiter = TransitAPILimiter(max_calls=5, period=60)
    for _ in range(5):
        await limiter.acquire()   # should not raise


@pytest.mark.asyncio
async def test_blocks_6th_call():
    """Should raise RateLimitExceeded on the 6th call."""
    limiter = TransitAPILimiter(max_calls=5, period=60)
    for _ in range(5):
        await limiter.acquire()

    with pytest.raises(RateLimitExceeded):
        await limiter.acquire()   # 6th call — should raise


@pytest.mark.asyncio
async def test_error_message_contains_wait_time():
    """Error message should tell user how long to wait."""
    limiter = TransitAPILimiter(max_calls=5, period=60)
    for _ in range(5):
        await limiter.acquire()

    with pytest.raises(RateLimitExceeded) as exc_info:
        await limiter.acquire()

    assert "seconds" in str(exc_info.value)


@pytest.mark.asyncio
async def test_fresh_limiter_always_allows():
    """A brand new limiter should always allow the first call."""
    limiter = TransitAPILimiter(max_calls=5, period=60)
    await limiter.acquire()   # should never raise