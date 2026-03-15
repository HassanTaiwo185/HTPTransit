import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import polyline from '@mapbox/polyline';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    map.options.zoomSnap = 0.5;
    map.options.zoomDelta = 0.5;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function UserLocationMarker({ location }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location;

    if (!document.getElementById('user-dot-styles')) {
      const style = document.createElement('style');
      style.id = 'user-dot-styles';
      style.textContent = `
        .user-dot-ring {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(74,144,232,0.2);
          display: flex; align-items: center; justify-content: center;
          animation: pulse 2s ease-out infinite;
        }
        .user-dot-core {
          width: 18px; height: 18px; border-radius: 50%;
          background: #4a90e8;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(74,144,232,0.7);
        }
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0   rgba(74,144,232,0.5); }
          70%  { box-shadow: 0 0 0 14px rgba(74,144,232,0);  }
          100% { box-shadow: 0 0 0 0   rgba(74,144,232,0);   }
        }
        .leaflet-tile { display: block !important; }
        .leaflet-container { width: 100% !important; height: 100% !important; }
      `;
      document.head.appendChild(style);
    }

    const icon = L.divIcon({
      html: `<div class="user-dot-ring"><div class="user-dot-core"></div></div>`,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      markerRef.current = L.marker([latitude, longitude], {
        icon, zIndexOffset: 1000,
      }).addTo(map);
      map.setView([latitude, longitude], 15);
    }
  }, [location, map]);

  return null;
}

function RouteLines({ plans, selectedPlanIndex }) {
  const map = useMap();
  const linesRef = useRef([]);

  useEffect(() => {
    // clear old lines
    linesRef.current.forEach(l => l.remove());
    linesRef.current = [];

    if (!plans || plans.length === 0) return;

    const plan = plans[selectedPlanIndex ?? 0];
    if (!plan) return;

    plan.legs.forEach((leg, i) => {
      if (!leg.polyline) return;

      try {
        const coords = polyline.decode(leg.polyline);
        const color  = leg.mode === 'transit' ? '#2563eb' : '#94a3b8';
        const weight = leg.mode === 'transit' ? 5 : 3;
        const dash   = leg.mode === 'walk' ? '6, 8' : null;

        const line = L.polyline(coords, {
          color,
          weight,
          opacity:   0.85,
          dashArray: dash,
        }).addTo(map);

        linesRef.current.push(line);
      } catch (e) {
        console.warn('polyline decode error', e);
      }
    });

    // fit map to show full route
    if (linesRef.current.length > 0) {
      const group = L.featureGroup(linesRef.current);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    }

  }, [plans, selectedPlanIndex, map]);

  return null;
}

function StopMarkersOnMap({ stops, selectedStop, onStopClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!stops || stops.length === 0) return;

    stops.forEach((stop) => {
      const isSelected = selectedStop?.stop_id === stop.stop_id;

      const icon = L.divIcon({
        html: `
          <div style="
            width: ${isSelected ? '20px' : '14px'};
            height: ${isSelected ? '20px' : '14px'};
            border-radius: 50%;
            background: ${isSelected ? '#2563eb' : '#60a5fa'};
            border: 2.5px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>
        `,
        className: '',
        iconSize:   [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7,  isSelected ? 10 : 7],
      });

      const marker = L.marker([stop.stop_lat, stop.stop_lon], { icon })
        .addTo(map)
        .on('click', () => onStopClick && onStopClick(stop));

      marker.bindTooltip(stop.stop_name, {
        permanent: false,
        direction: 'top',
        offset: [0, -8],
      });

      markersRef.current.push(marker);
    });
  }, [stops, selectedStop, map, onStopClick]);

  return null;
}

export default function MapView({
  location,
  stops,
  selectedStop,
  onStopClick,
  plans,
  selectedPlanIndex,
}) {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <MapContainer
        center={[43.8971, -78.8658]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="© OpenStreetMap © CARTO"
          maxZoom={19}
          keepBuffer={4}
          updateWhenIdle={false}
          updateWhenZooming={false}
        />
        <UserLocationMarker location={location} />
        <StopMarkersOnMap
          stops={stops}
          selectedStop={selectedStop}
          onStopClick={onStopClick}
        />
        <RouteLines
          plans={plans}
          selectedPlanIndex={selectedPlanIndex}
        />
        <MapResizer />
      </MapContainer>
    </div>
  );
}