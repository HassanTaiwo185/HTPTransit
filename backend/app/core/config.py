"""
config.py — central config, reads from environment variables.
Never hardcode your API key in code.
"""
from dotenv import load_dotenv
import os

load_dotenv()

TRANSIT_API_KEY = os.getenv("TRANSIT_API_KEY", "")
TRANSIT_BASE_URL = "https://external.transitapp.com/v3/public"