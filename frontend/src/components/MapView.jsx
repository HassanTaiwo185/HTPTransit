import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Add this new component
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    // Increases tile buffer around viewport
    map.options.zoomSnap = 0.5;
    map.options.zoomDelta = 0.5;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    const container = map.getContainer();
    observer.observe(container);
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
        icon,
        zIndexOffset: 1000,
      }).addTo(map);
      map.setView([latitude, longitude], 15);
    }
  }, [location, map]);

  return null;
}

export default function MapView({ location }) {
  return (
    <div className="w-full h-full">
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
        
        <MapResizer />
      </MapContainer>
    </div>
  );
}