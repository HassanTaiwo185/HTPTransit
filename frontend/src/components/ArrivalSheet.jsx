import { useState } from 'react';
import CrowdingBadge from './CrowdingBadge';

export default function ArrivalSheet({ stop, arrivals, crowding, loading, onClose }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!stop) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-2xl px-4 pt-3 pb-8">

      {/* Handle bar */}
      <div className="flex justify-center mb-3">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900 leading-tight">
            {stop.stop_name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Stop #{stop.stop_id}
            {stop.distance_km ? ` · ${stop.distance_km}km away` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 ml-2 shrink-0"
        >×</button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-400">Loading arrivals...</span>
        </div>
      ) : arrivals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2">🚌</p>
          <p className="text-gray-400 text-sm">No upcoming arrivals</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {arrivals.map((arrival, i) => {
            const isExpanded = expandedIndex === i;

            return (
              <div
                key={i}
                className="bg-gray-50 rounded-2xl px-4 py-3 cursor-pointer active:bg-gray-100 transition-colors"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
              >
                <div className="flex items-center gap-3">

                  {/* Route chip */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: arrival.route_color || '#3b82f6' }}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{ color: arrival.route_text_color || '#ffffff' }}
                    >
                      {arrival.route_short_name || '?'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {arrival.headsign || arrival.route_long_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {arrival.stop_time}
                    </p>
                  </div>

                  {/* Arrives in + tap hint */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-600">
                      {arrival.arrives_in_min < 1
                        ? 'Now'
                        : `${arrival.arrives_in_min} min`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {isExpanded ? '▲' : '▼'}
                    </p>
                  </div>
                </div>

                {/* Expanded — show crowding prediction */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-medium mb-2">
                      Crowding Prediction
                    </p>
                    {crowding?.level ? (
                      <CrowdingBadge
                        level={crowding.level}
                        confidence={crowding.confidence}
                      />
                    ) : (
                      <p className="text-xs text-gray-400">
                        No prediction available
                      </p>
                    )}
                    <div className="mt-2 flex gap-4">
                      <div>
                        <p className="text-xs text-gray-400">Route</p>
                        <p className="text-xs font-semibold text-gray-700">
                          {arrival.route_short_name} — {arrival.route_long_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Trip</p>
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[140px]">
                          {arrival.trip_id}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}