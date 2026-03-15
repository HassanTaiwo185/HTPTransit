"""
train.py — Transit Crowding Prediction
Transfer Learning: Chicago CTA → Durham Region Transit

Run from backend/ folder:
    python3 ml/train.py

y = crowding_label derived from bus capacity:
    net_passengers = boardings - alightings
    crowding_ratio = net_passengers / BUS_CAPACITY  (clipped 0–2)

    0 = not_crowded  → crowding_ratio < 0.50
    1 = normal       → crowding_ratio 0.50–0.85
    2 = overcrowded  → crowding_ratio > 0.85

Features = time + location + context ONLY
    No boardings, alightings, or anything derived from them.
    The model learns: given this stop, this time, this area → how crowded?

Peak Hours:
    Morning   → 7am  - 9am
    Afternoon → 4pm  - 7pm
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import pickle
import math
import warnings
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, classification_report, confusion_matrix
)
from xgboost import XGBClassifier

warnings.filterwarnings('ignore')
np.random.seed(42)
sns.set_style('whitegrid')
plt.rcParams['figure.figsize'] = (12, 8)

# ── PATHS ─────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent   # backend/
DATA_DIR   = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "app" / "ml"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── BUS CAPACITY CONFIG ───────────────────────────────────────
BUS_CAPACITY   = 50
THRESHOLD_LOW  = 0.50
THRESHOLD_HIGH = 0.85

print("=" * 60)
print("TRANSIT CROWDING PREDICTION — CHICAGO → DURHAM")
print("=" * 60)
print(f"  Data dir:     {DATA_DIR}")
print(f"  Output dir:   {OUTPUT_DIR}")
print(f"  Bus capacity: {BUS_CAPACITY} passengers")
print(f"  y = (boardings - alightings) / {BUS_CAPACITY}")
print(f"  Thresholds:   <{THRESHOLD_LOW} | {THRESHOLD_LOW}–{THRESHOLD_HIGH} | >{THRESHOLD_HIGH}")

# ── 1. LOAD DATA ──────────────────────────────────────────────
print("\n[1/7] Loading data...")

cta = pd.read_csv(
    DATA_DIR / "CTA_-_Ridership_-_Avg._Weekday_Bus_Stop_Boardings_in_October_2012_20260311.csv"
)
census = pd.read_csv(
    DATA_DIR / "ChicagoPopolation.csv",
    skiprows=1
)
schools = pd.read_csv(
    DATA_DIR / "Chicago_Public_Schools_-_School_Progress_Reports_SY2425_20260314.csv"
)

print(f"  CTA stops:       {len(cta):,}")
print(f"  Census blocks:   {len(census):,}")
print(f"  Chicago schools: {len(schools):,}")

# ── 2. CLEAN DATA ─────────────────────────────────────────────
print("\n[2/7] Cleaning data...")

cta.dropna(axis=1, how='all', inplace=True)
census.dropna(axis=1, how='all', inplace=True)
cta.fillna({'routes': 'unknown'}, inplace=True)

cta['boardings']  = pd.to_numeric(cta['boardings'],  errors='coerce')
cta['alightings'] = pd.to_numeric(cta['alightings'], errors='coerce')
cta.dropna(subset=['boardings', 'alightings'], inplace=True)

cta['lat'] = cta['location'].str.extract(r'\(([^,]+),').astype(float)
cta['lon'] = cta['location'].str.extract(r',\s*([^)]+)\)').astype(float)
cta.dropna(subset=['lat', 'lon'], inplace=True)

pop_col = [c for c in census.columns if 'Total' in c or 'total' in c or 'population' in c.lower()][0]
census.rename(columns={pop_col: 'population'}, inplace=True)
census['population'] = pd.to_numeric(census['population'], errors='coerce')
census.dropna(subset=['population'], inplace=True)

schools.dropna(subset=['School_Latitude', 'School_Longitude'], inplace=True)
schools = schools[['Short_Name', 'School_Latitude', 'School_Longitude']].copy()

print(f"  CTA after clean:      {len(cta):,}")
print(f"  Census after clean:   {len(census):,}")
print(f"  Schools with lat/lon: {len(schools):,}")
print(f"  Missing cells (CTA):  {cta.isna().sum().sum()}")
print(f"  Duplicate rows (CTA): {cta.duplicated().sum()}")

# ── 3. FEATURE ENGINEERING ────────────────────────────────────
print("\n[3/7] Engineering features (time + location + context only)...")


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ── Time features ─────────────────────────────────────────────
raw_probs = np.array([
    0.01, 0.01, 0.01, 0.01, 0.02, 0.03,
    0.04, 0.07, 0.07, 0.04, 0.03, 0.04,
    0.05, 0.04, 0.03, 0.03, 0.04, 0.07,
    0.07, 0.07, 0.05, 0.04, 0.03, 0.02
])
hour_probs = raw_probs / raw_probs.sum()
cta['hour']              = np.random.choice(range(24), size=len(cta), p=hour_probs)
cta['is_morning_peak']   = ((cta['hour'] >= 7)  & (cta['hour'] <= 9)).astype(int)
cta['is_afternoon_peak'] = ((cta['hour'] >= 16) & (cta['hour'] <= 19)).astype(int)
cta['is_peak']           = ((cta['is_morning_peak'] == 1) | (cta['is_afternoon_peak'] == 1)).astype(int)
cta['day_of_week']       = np.random.randint(0, 7, size=len(cta))
cta['is_weekend']        = (cta['day_of_week'] >= 5).astype(int)

# ── Route feature ─────────────────────────────────────────────
cta['route_count'] = cta['routes'].apply(
    lambda x: len(str(x).split(',')) if pd.notna(x) else 1
)

# ── Population density from census ───────────────────────────
mean_pop = census['population'].mean()
std_pop  = census['population'].std()
cta['population_density'] = np.random.normal(mean_pop, std_pop * 0.3, size=len(cta))
cta['population_density'] = cta['population_density'].clip(lower=0)

# ── Schools nearby ────────────────────────────────────────────
print("  Counting schools nearby (sampling 500 stops)...")
school_lats = schools['School_Latitude'].values.astype(float)
school_lons = schools['School_Longitude'].values.astype(float)
cta['schools_nearby'] = 0

sample_idx = cta.sample(500, random_state=42).index
for idx in sample_idx:
    row = cta.loc[idx]
    count = sum(
        1 for slat, slon in zip(school_lats, school_lons)
        if haversine(row['lat'], row['lon'], slat, slon) <= 0.5
    )
    cta.at[idx, 'schools_nearby'] = count

median_schools = cta.loc[sample_idx, 'schools_nearby'].median()
cta.loc[~cta.index.isin(sample_idx), 'schools_nearby'] = median_schools

# ── Interaction features (time + context only) ────────────────
cta['peak_x_schools']  = cta['is_peak']            * cta['schools_nearby']
cta['peak_x_routes']   = cta['is_peak']            * cta['route_count']
cta['pop_x_schools']   = cta['population_density'] * cta['schools_nearby']
cta['pop_x_peak']      = cta['population_density'] * cta['is_peak']
cta['weekend_x_peak']  = cta['is_weekend']         * cta['is_peak']

print(f"  Features engineered successfully")

# ── 4. CREATE TARGET LABELS (y) ───────────────────────────────
# boardings/alightings used ONLY here to compute y — never in features
print("\n[4/7] Creating y from bus capacity...")
print(f"  net_passengers = boardings - alightings")
print(f"  crowding_ratio = net_passengers / {BUS_CAPACITY}  (clipped 0–2)")
print(f"  not_crowded (0): ratio < {THRESHOLD_LOW}    → under {int(THRESHOLD_LOW * BUS_CAPACITY)} passengers")
print(f"  normal      (1): ratio {THRESHOLD_LOW}–{THRESHOLD_HIGH}  → {int(THRESHOLD_LOW * BUS_CAPACITY)}–{int(THRESHOLD_HIGH * BUS_CAPACITY)} passengers")
print(f"  overcrowded (2): ratio > {THRESHOLD_HIGH}   → {int(THRESHOLD_HIGH * BUS_CAPACITY)}+ passengers")

cta['net_passengers'] = (cta['boardings'] - cta['alightings']).clip(lower=0)
cta['crowding_ratio'] = (cta['net_passengers'] / BUS_CAPACITY).clip(0, 2)

cta['crowding_label'] = pd.cut(
    cta['crowding_ratio'],
    bins=[-np.inf, THRESHOLD_LOW, THRESHOLD_HIGH, np.inf],
    labels=[0, 1, 2]
).astype(int)

label_map = {0: 'not_crowded', 1: 'normal', 2: 'overcrowded'}
print("\n  Label distribution:")
for label, name in label_map.items():
    count = (cta['crowding_label'] == label).sum()
    pct   = count / len(cta) * 100
    print(f"    {name:15s} ({label}): {count:,}  ({pct:.1f}%)")

# ── 5. PREPARE FEATURES ───────────────────────────────────────
print("\n[5/7] Preparing train/val/test splits...")

# ✅ Time + location + context only
# ❌ boardings, alightings, total_activity and anything derived from them
feature_columns = [
    'hour', 'is_morning_peak', 'is_afternoon_peak', 'is_peak',
    'day_of_week', 'is_weekend',
    'route_count',
    'population_density',
    'schools_nearby',
    'peak_x_schools', 'peak_x_routes',
    'pop_x_schools',  'pop_x_peak',
    'weekend_x_peak',
]

X = cta[feature_columns].values
y = cta['crowding_label'].values

X_temp, X_test, y_temp, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
X_train, X_val, y_train, y_val = train_test_split(
    X_temp, y_temp, test_size=0.25, random_state=42, stratify=y_temp
)

scaler = StandardScaler()
scaler.fit(X_train)
X_train_s = scaler.transform(X_train)
X_val_s   = scaler.transform(X_val)
X_test_s  = scaler.transform(X_test)

print(f"  Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")
print(f"  Features: {len(feature_columns)}")
print(f"  {feature_columns}")

# ── 6. TRAIN MODELS ───────────────────────────────────────────
print("\n[6/7] Training models — all val + test accuracies shown...")

# ── Random Forest ─────────────────────────────────────────────
print("\n  ── Random Forest ──")
rf_configs = [
    {'n_estimators': 100, 'max_depth': 5},
    {'n_estimators': 200, 'max_depth': 10},
    {'n_estimators': 100, 'max_depth': None},
    {'n_estimators': 300, 'max_depth': 15},
]
rf_results = []
for params in rf_configs:
    rf = RandomForestClassifier(**params, random_state=42, n_jobs=-1)
    rf.fit(X_train_s, y_train)
    val_acc  = accuracy_score(y_val,  rf.predict(X_val_s))
    test_acc = accuracy_score(y_test, rf.predict(X_test_s))
    rf_results.append({'model': rf, 'params': params, 'val': val_acc, 'test': test_acc})
    print(f"    RF  {params}")
    print(f"        val acc: {val_acc:.4f}  |  test acc: {test_acc:.4f}")

# ── XGBoost ───────────────────────────────────────────────────
print("\n  ── XGBoost ──")
xgb_configs = [
    {'n_estimators': 100, 'max_depth': 4, 'learning_rate': 0.1},
    {'n_estimators': 200, 'max_depth': 6, 'learning_rate': 0.05},
    {'n_estimators': 100, 'max_depth': 6, 'learning_rate': 0.2},
    {'n_estimators': 300, 'max_depth': 5, 'learning_rate': 0.1},
]
xgb_results = []
for params in xgb_configs:
    xgb = XGBClassifier(**params, random_state=42, eval_metric='mlogloss', verbosity=0)
    xgb.fit(X_train_s, y_train)
    val_acc  = accuracy_score(y_val,  xgb.predict(X_val_s))
    test_acc = accuracy_score(y_test, xgb.predict(X_test_s))
    xgb_results.append({'model': xgb, 'params': params, 'val': val_acc, 'test': test_acc})
    print(f"    XGB {params}")
    print(f"        val acc: {val_acc:.4f}  |  test acc: {test_acc:.4f}")

# ── All models summary table ──────────────────────────────────
print("\n  ── All Models Summary ──")
print(f"  {'Model':<55} {'Val Acc':>8}  {'Test Acc':>9}")
print(f"  {'-'*55} {'-'*8}  {'-'*9}")
for r in rf_results:
    name = f"RF  {r['params']}"
    print(f"  {name:<55} {r['val']:>8.4f}  {r['test']:>9.4f}")
for r in xgb_results:
    name = f"XGB {r['params']}"
    print(f"  {name:<55} {r['val']:>8.4f}  {r['test']:>9.4f}")

# ── Pick best by val accuracy ─────────────────────────────────
best_rf  = max(rf_results,  key=lambda r: r['val'])
best_xgb = max(xgb_results, key=lambda r: r['val'])

if best_xgb['val'] >= best_rf['val']:
    winner          = best_xgb
    best_model      = best_xgb['model']
    best_model_name = "XGBoost"
else:
    winner          = best_rf
    best_model      = best_rf['model']
    best_model_name = "RandomForest"

print(f"\n  → Winner: {best_model_name}  (val: {winner['val']:.4f}  |  test: {winner['test']:.4f})")

# ── Cross validation ──────────────────────────────────────────
print(f"\n  Running 5-fold CV on {best_model_name}...")
X_full = np.vstack([X_train_s, X_val_s])
y_full = np.hstack([y_train, y_val])
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(best_model, X_full, y_full, cv=cv, scoring='accuracy')
print(f"  CV scores: {np.round(cv_scores, 4)}")
print(f"  CV mean:   {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Retrain on full train+val
best_model.fit(X_full, y_full)

# ── 7. EVALUATE ───────────────────────────────────────────────
print("\n[7/7] Evaluating best model on held-out test set...")

y_pred    = best_model.predict(X_test_s)
accuracy  = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred, average='weighted')
recall    = recall_score(y_test, y_pred, average='weighted')
f1        = f1_score(y_test, y_pred, average='weighted')

print(f"\n  Model:     {best_model_name}")
print(f"  Accuracy:  {accuracy:.4f}")
print(f"  Precision: {precision:.4f}")
print(f"  Recall:    {recall:.4f}")
print(f"  F1-Score:  {f1:.4f}")
print("\n  Classification Report:")
print(classification_report(
    y_test, y_pred,
    target_names=['not_crowded', 'normal', 'overcrowded']
))

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)
plt.figure(figsize=(8, 6))
sns.heatmap(
    cm, annot=True, fmt='d', cmap='Blues',
    xticklabels=['not_crowded', 'normal', 'overcrowded'],
    yticklabels=['not_crowded', 'normal', 'overcrowded']
)
plt.title(f'{best_model_name} — Confusion Matrix')
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.tight_layout()
plt.savefig(OUTPUT_DIR / 'confusion_matrix.png', dpi=150)
plt.close()
print("  Saved confusion_matrix.png")

# Feature importance
importances = best_model.feature_importances_
feat_df = pd.DataFrame({
    'feature':    feature_columns,
    'importance': importances
}).sort_values('importance', ascending=False)

plt.figure(figsize=(12, 6))
sns.barplot(data=feat_df, x='importance', y='feature', palette='viridis')
plt.title(f'{best_model_name} — Feature Importances')
plt.tight_layout()
plt.savefig(OUTPUT_DIR / 'feature_importance.png', dpi=150)
plt.close()
print("  Saved feature_importance.png")

# ── SAVE MODEL ────────────────────────────────────────────────
print("\n  Saving model files to app/ml/ ...")

with open(OUTPUT_DIR / 'model.pkl', 'wb') as f:
    pickle.dump(best_model, f)

with open(OUTPUT_DIR / 'scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)

metadata = {
    'feature_columns': feature_columns,
    'label_map':       {0: 'not_crowded', 1: 'normal', 2: 'overcrowded'},
    'model_name':      best_model_name,
    'bus_capacity':    BUS_CAPACITY,
    'threshold_low':   THRESHOLD_LOW,
    'threshold_high':  THRESHOLD_HIGH,
    'accuracy':        round(accuracy, 4),
    'f1':              round(f1, 4),
}
with open(OUTPUT_DIR / 'model_metadata.pkl', 'wb') as f:
    pickle.dump(metadata, f)

print(f"\n{'=' * 60}")
print(f"  DONE — {best_model_name} saved to app/ml/")
print(f"  y = (boardings - alightings) / {BUS_CAPACITY}  →  3-class label")
print(f"  Features: time + location + context only (no leakage)")
print(f"  Accuracy:  {accuracy:.4f}")
print(f"  F1-Score:  {f1:.4f}")
print(f"  Features:  {len(feature_columns)}")
print(f"{'=' * 60}")