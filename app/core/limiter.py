"""
limiter.py — central rate limiter for all Transit API calls.
Max 5 calls per minute. Raises error if limit is exceeded.
"""
import time
import asyncio
import logging

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Raised when Transit API rate limit is hit."""
    pass


class TransitAPILimiter:
    def __init__(self, max_calls: int = 5, period: int = 60):
        self.max_calls = max_calls
        self.period = period
        self.calls = []
        self._lock = asyncio.Lock()

    async def acquire(self):
        """
        Call this before every Transit API request.
        Raises RateLimitExceeded if 5 calls already made in last 60s.
        """
        async with self._lock:
            now = time.time()

            # drop calls older than 60 seconds
            self.calls = [t for t in self.calls if now - t < self.period]

            if len(self.calls) >= self.max_calls:
                wait_time = round(self.period - (now - self.calls[0]), 1)
                logger.error(
                    "Rate limit exceeded — %d/%d calls used. Try again in %ss",
                    len(self.calls), self.max_calls, wait_time
                )
                raise RateLimitExceeded(
                    f"Too many requests. Try again in {wait_time} seconds."
                )

            self.calls.append(time.time())
            logger.info(
                "Transit API call %d/%d in current window",
                len(self.calls), self.max_calls
            )


# single instance shared across all services
transit_limiter = TransitAPILimiter(max_calls=5, period=60)