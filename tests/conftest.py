
import pytest
from app.core.limiter import transit_limiter

# force all test files to share the SAME limiter instance
# so call count carries over between files
@pytest.fixture(scope="session", autouse=True)
def shared_limiter():
    """One limiter for the entire test session."""
    yield transit_limiter