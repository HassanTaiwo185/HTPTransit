import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function StopMarkers({ stops, selectedStop, onStopClick }) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    // clear old markers
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
            transition: all 0.2s;
          "></div>
        `,
        className: '',
        iconSize:   [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7,  isSelected ? 10 : 7],
      });

      const marker = L.marker([stop.stop_lat, stop.stop_lon], { icon })
        .addTo(map)
        .on('click', () => onStopClick && onStopClick(stop));

      // tooltip showing stop name
      marker.bindTooltip(stop.stop_name, {
        permanent:  false,
        direction:  'top',
        className:  'stop-tooltip',
        offset:     [0, -8],
      });

      markersRef.current.push(marker);
    });

    // add tooltip styles
    if (!document.getElementById('stop-tooltip-styles')) {
      const style = document.createElement('style');
      style.id = 'stop-tooltip-styles';
      style.textContent = `
        .stop-tooltip {
          background: white;
          border: none;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 600;
          color: #1e293b;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          white-space: nowrap;
        }
        .stop-tooltip::before {
          display: none;
        }
      `;
      document.head.appendChild(style);
    }

  }, [stops, selectedStop, map, onStopClick]);

  return null;
}