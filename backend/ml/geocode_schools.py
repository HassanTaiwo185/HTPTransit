"""
geocode_schools.py — converts Durham school postal codes to lat/lon
using Canada Post FSA (first 3 chars) lookup table.
Run once: python3 ml/geocode_schools.py
Saves: data/durham_schools_geocoded.csv
"""
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# ── FSA (Forward Sortation Area) lookup for Durham Region ────
# First 3 chars of postal code → approximate lat/lon
# Source: Canada Post FSA centroids for Durham Region Ontario
FSA_COORDS = {
    # Oshawa
    "L1G": (43.9122, -78.8474), "L1H": (43.8918, -78.8435),
    "L1J": (43.9040, -78.8844), "L1K": (43.9444, -78.8580),
    # Whitby
    "L1M": (43.9681, -78.9440), "L1N": (43.8900, -78.9400),
    "L1P": (43.8962, -78.9672), "L1R": (43.9117, -78.9382),
    # Ajax
    "L1S": (43.8462, -79.0415), "L1T": (43.8734, -79.0369),
    "L1Z": (43.8600, -79.0200),
    # Pickering
    "L1V": (43.8449, -79.1018), "L1W": (43.8158, -79.1103),
    "L1X": (43.8400, -79.0900),
    # Clarington / Bowmanville
    "L1C": (43.9100, -78.6900), "L1E": (43.9300, -78.7200),
    # Scugog / Port Perry
    "L9L": (44.1065, -79.0351),
    # Brock / Uxbridge
    "L9P": (44.1000, -79.1200),
    # Brooklin
    "L1L": (43.9630, -78.9742),
    # General Durham fallback
    "L0B": (44.0500, -78.9500),
    "L0C": (44.0800, -79.1000),
    "L0E": (44.0700, -78.8000),
    "L6P": (43.8500, -79.0000),
}


def get_coords(postal_code: str):
    """Get lat/lon from FSA prefix."""
    if not postal_code or len(postal_code) < 3:
        return None, None
    fsa = postal_code.replace(" ", "").upper()[:3]
    coords = FSA_COORDS.get(fsa)
    if coords:
        return coords
    return None, None


# ── Load Durham schools ───────────────────────────────────────
df = pd.read_csv(DATA_DIR / "DurhamSchoolData.csv", encoding='utf-8-sig')
durham = df[df['Board Name'].str.contains('Durham', case=False, na=False)].copy()
durham = durham[['School Name', 'City', 'Postal Code']].dropna(subset=['Postal Code'])
print(f"Durham schools: {len(durham)}")

# ── Geocode ───────────────────────────────────────────────────
results = []
no_match = []

for _, row in durham.iterrows():
    lat, lon = get_coords(row['Postal Code'])
    if lat and lon:
        results.append({
            "school_name": row['School Name'],
            "city":        row['City'],
            "postal_code": row['Postal Code'],
            "lat":         lat,
            "lon":         lon
        })
    else:
        no_match.append(row['Postal Code'])

print(f"Geocoded:    {len(results)}")
print(f"No match:    {len(no_match)}")
if no_match:
    print(f"Missing FSAs: {set([p[:3] for p in no_match])}")

# ── Save ──────────────────────────────────────────────────────
out = DATA_DIR / "durham_schools_geocoded.csv"
pd.DataFrame(results).to_csv(out, index=False)
print(f"\nSaved {len(results)} schools → {out}")
print("\nSample:")
print(pd.DataFrame(results).head(10))
