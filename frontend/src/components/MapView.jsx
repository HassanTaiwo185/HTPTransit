import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import polyline from '@mapbox/polyline';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

const CROWD_COLORS = {
  low:     '#22c55e',
  medium:  '#f59e0b',
  high:    '#ef4444',
  unknown: '#3b82f6',
};

const OCCUPANCY_COLORS = {
  EMPTY:                    '#22c55e',
  MANY_SEATS_AVAILABLE:     '#22c55e',
  FEW_SEATS_AVAILABLE:      '#f59e0b',
  STANDING_ROOM_ONLY:       '#f59e0b',
  CRUSHED_STANDING_ROOM:    '#ef4444',
  FULL:                     '#ef4444',
  NOT_ACCEPTING_PASSENGERS: '#6b7280',
};

function decodePolyline(encoded) {
  if (!encoded) return [];
  try { return polyline.decode(encoded); }
  catch { return []; }
}

function MapResizer({ selectedLeg, walkLeg, plans }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize({ animate: true }), 350);
    return () => clearTimeout(t);
  }, [selectedLeg, walkLeg, plans, map]);
  return null;
}

function UserLocationMarker({ location }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location;

    if (!document.getElementById('map-styles')) {
      const style = document.createElement('style');
      style.id = 'map-styles';
      style.textContent = `
        .leaflet-tile-container { will-change: transform; }
        .leaflet-container { display: block !important; outline: none; }
        .user-ring {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(59,130,246,0.15);
          display: flex; align-items: center; justify-content: center;
          animation: userpulse 2s ease-out infinite;
        }
        .user-core {
          width: 16px; height: 16px; border-radius: 50%;
          background: #3b82f6; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(59,130,246,0.6);
        }
        @keyframes userpulse {
          0%   { box-shadow: 0 0 0 0   rgba(59,130,246,0.4); }
          70%  { box-shadow: 0 0 0 14px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0   rgba(59,130,246,0); }
        }
      `;
      document.head.appendChild(style);
    }

    const icon = L.divIcon({
      html: `<div class="user-ring"><div class="user-core"></div></div>`,
      className: '', iconSize: [44, 44], iconAnchor: [22, 22],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      markerRef.current = L.marker([latitude, longitude], { icon, zIndexOffset: 1000 }).addTo(map);
      map.setView([latitude, longitude], 15);
    }
  }, [location, map]);

  return null;
}

function RouteLines({ plans, selectedPlanIndex, selectedLeg, walkLeg, userLocation }) {
  const map = useMap();
  const linesRef = useRef([]);
  const hasFittedRef = useRef(null);

  useEffect(() => {
    linesRef.current.forEach(l => l.remove());
    linesRef.current = [];

    if (selectedLeg || walkLeg || !plans || plans.length === 0) {
      if (!selectedLeg && !walkLeg) hasFittedRef.current = null;
      return;
    }

    const plan = plans[selectedPlanIndex ?? 0];
    if (!plan?.legs) return;

    const decodedLegs = plan.legs.map(leg => ({
      ...leg, points: decodePolyline(leg.polyline),
    }));

    let lastPoint = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : null;

    decodedLegs.forEach((leg) => {
      const isWalk = leg.mode === 'walk';
      const pts    = leg.points;
      if (!pts || pts.length < 2) return;

      const firstPt = pts[0];

      if (lastPoint) {
        const gap = Math.abs(lastPoint[0] - firstPt[0]) + Math.abs(lastPoint[1] - firstPt[1]);
        if (gap > 0.00005) {
          const bridge = L.polyline([lastPoint, firstPt], {
            color: '#9ca3af', weight: 3, dashArray: '6 8', opacity: 0.5,
          }).addTo(map);
          linesRef.current.push(bridge);
        }
      }

      const line = L.polyline(pts, isWalk ? {
        color: '#6b7280', weight: 4, dashArray: '4 7', opacity: 0.85,
      } : {
        color:   CROWD_COLORS[leg.crowd_level] ?? CROWD_COLORS.unknown,
        weight:  6,
        opacity: 0.9,
      }).addTo(map);

      linesRef.current.push(line);
      lastPoint = pts[pts.length - 1];
    });

    const planId = JSON.stringify(plan.legs[0]?.start_time);
    if (linesRef.current.length > 0 && hasFittedRef.current !== planId) {
      const group = L.featureGroup(linesRef.current);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
      hasFittedRef.current = planId;
    }
  }, [plans, selectedPlanIndex, selectedLeg, walkLeg, userLocation, map]);

  return null;
}

function SelectedLegLine({ leg, tripStops }) {
  const map = useMap();
  const lineRef = useRef(null);
  const lastTripId = useRef(null);

  useEffect(() => {
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
    if (!leg) return;

    const coords = tripStops
      ?.filter(s => s.stop_lat && s.stop_lon)
      .map(s => [s.stop_lat, s.stop_lon]);

    if (!coords || coords.length < 2) return;

    lineRef.current = L.polyline(coords, {
      color:   CROWD_COLORS[leg.crowd_level] ?? CROWD_COLORS.unknown,
      weight:  6,
      opacity: 1,
    }).addTo(map);

    if (lastTripId.current !== leg.trip_id) {
      map.fitBounds(lineRef.current.getBounds(), {
        paddingTopLeft:     [24, 24],
        paddingBottomRight: [24, 380],
      });
      lastTripId.current = leg.trip_id;
    }

    return () => { if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; } };
  }, [tripStops, leg, map]);

  return null;
}

function WalkLine({ leg }) {
  const map = useMap();
  const lineRef = useRef(null);
  const lastStart = useRef(null);

  useEffect(() => {
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
    if (!leg?.polyline) return;

    const coords = decodePolyline(leg.polyline);
    if (coords.length < 2) return;

    lineRef.current = L.polyline(coords, {
      color: '#374151', weight: 5, opacity: 0.9, dashArray: '10 8',
    }).addTo(map);

    if (lastStart.current !== leg.start_time) {
      map.fitBounds(lineRef.current.getBounds(), {
        paddingTopLeft: [40, 40], paddingBottomRight: [40, 420],
      });
      lastStart.current = leg.start_time;
    }

    return () => { if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; } };
  }, [leg, map]);

  return null;
}

function StopMarkersOnMap({ stops, selectedStop, onStopClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (!stops) return;

    stops.forEach((stop) => {
      const isSelected = selectedStop?.stop_id === stop.stop_id;
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${isSelected ? '#3b82f6' : '#60a5fa'};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
        className: '', iconSize: [12, 12], iconAnchor: [6, 6],
      });
      const marker = L.marker([stop.stop_lat, stop.stop_lon], { icon })
        .addTo(map)
        .on('click', () => onStopClick?.(stop));
      markersRef.current.push(marker);
    });
  }, [stops, selectedStop, map, onStopClick]);

  return null;
}

function VehicleMarkers({ vehicles }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!vehicles || vehicles.length === 0) return;

    vehicles.forEach((v) => {
      if (!v.latitude || !v.longitude) return;

      const color = OCCUPANCY_COLORS[v.occupancy_status] ?? '#3b82f6';

      const icon = L.divIcon({
        html: `
          <div style="
            width:38px; height:38px; border-radius:10px;
            background:${color}; border:3px solid white;
            box-shadow:0 3px 10px rgba(0,0,0,0.25);
            display:flex; align-items:center; justify-content:center;
            position:relative;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="5" width="22" height="13" rx="3" fill="white" opacity="0.95"/>
              <rect x="3" y="7" width="7.5" height="5" rx="1" fill="${color}" opacity="0.8"/>
              <rect x="13.5" y="7" width="7.5" height="5" rx="1" fill="${color}" opacity="0.8"/>
              <circle cx="5.5" cy="18.5" r="2.2" fill="white" stroke="${color}" stroke-width="1.5"/>
              <circle cx="18.5" cy="18.5" r="2.2" fill="white" stroke="${color}" stroke-width="1.5"/>
            </svg>
            ${v.label ? `
            <div style="
              position:absolute; bottom:-16px; left:50%;
              transform:translateX(-50%);
              background:${color}; color:white;
              font-size:9px; font-weight:700;
              padding:1px 5px; border-radius:4px;
              white-space:nowrap;
              box-shadow:0 1px 4px rgba(0,0,0,0.2);
              font-family:system-ui,sans-serif;
            ">${v.label}</div>` : ''}
          </div>
        `,
        className:  '',
        iconSize:   [38, 38],
        iconAnchor: [19, 19],
      });

      const occupancyLabel = (v.occupancy_status ?? 'Unknown')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

      const marker = L.marker([v.latitude, v.longitude], { icon, zIndexOffset: 500 })
        .addTo(map);

      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.7;min-width:130px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:2px;">
            Bus ${v.label ?? v.vehicle_id ?? ''}
          </div>
          <div style="color:#6b7280;font-size:11px;">
            ${occupancyLabel}
          </div>
          ${v.wheelchair_accessible
            ? `<div style="color:#3b82f6;font-size:11px;margin-top:2px;">Wheelchair accessible</div>`
            : ''}
        </div>
      `, { closeButton: false, offset: [0, -22] });

      markersRef.current.push(marker);
    });
  }, [vehicles, map]);

  return null;
}

export default function MapView({
  location, stops, selectedStop, onStopClick,
  plans, selectedPlanIndex, selectedLeg, tripStops,
  walkLeg, vehicles,
}) {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <MapContainer
        center={[43.8971, -78.8658]}
        zoom={13}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="© OpenStreetMap © CARTO"
        />
        <UserLocationMarker location={location} />
        <StopMarkersOnMap stops={stops} selectedStop={selectedStop} onStopClick={onStopClick} />
        <RouteLines
          plans={plans}
          selectedPlanIndex={selectedPlanIndex}
          selectedLeg={selectedLeg}
          walkLeg={walkLeg}
          userLocation={location}
        />
        <SelectedLegLine leg={selectedLeg} tripStops={tripStops} />
        <WalkLine leg={walkLeg} />
        <VehicleMarkers vehicles={vehicles} />
        <MapResizer selectedLeg={selectedLeg} walkLeg={walkLeg} plans={plans} />
      </MapContainer>
    </div>
  );
}