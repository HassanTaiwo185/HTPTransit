import { useState } from 'react';
import CrowdingBadge from './CrowdingBadge';

export default function TripPlanSheet({
  plans,
  loading,
  error,
  onClose,
  onPlanSelect,
  onLegSelect,
  selectedPlanIndex,
}) {
  const [expanded, setExpanded] = useState(0);

  if (!plans && !loading) return null;

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit',
    });
  };

  const getCrowding = (timestamp) => {
    if (!timestamp) return 'normal';
    const hour = new Date(timestamp * 1000).getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) return 'overcrowded';
    if (hour >= 10 && hour <= 15) return 'normal';
    return 'not_crowded';
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-2xl px-4 pt-3 pb-10 max-h-[92vh] overflow-y-auto">

      {/* Handle bar */}
      <div className="flex justify-center mb-3">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">🗺️ Trip Options</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
        >×</button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-400">Finding routes...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 rounded-2xl px-4 py-3 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Plans */}
      {!loading && plans?.map((plan, i) => {
        const isSelected  = selectedPlanIndex === i;
        const isExpanded  = expanded === i;
        const walkLegs    = plan.legs?.filter(l => l.mode === 'walk') || [];
        const totalWalk   = walkLegs.reduce((sum, l) => sum + l.distance_m, 0);
        const crowding    = getCrowding(plan.start_time);

        return (
          <div
            key={i}
            className={`mb-4 rounded-2xl overflow-hidden border-2 transition-all
              ${isSelected ? 'border-green-500' : 'border-gray-100'}`}
          >
            {/* Plan summary header */}
            <div
              className={`px-4 py-3 cursor-pointer
                ${isSelected ? 'bg-green-50' : 'bg-gray-50'}`}
              onClick={() => {
                onPlanSelect && onPlanSelect(i);
                setExpanded(isExpanded ? null : i);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {formatTime(plan.start_time)}
                    </span>
                    <span className="text-gray-300">→</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatTime(plan.end_time)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {Math.round(plan.duration_min)} min
                    </span>
                  </div>
                  {totalWalk > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Walk {Math.round(totalWalk)}m total
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <CrowdingBadge level={crowding} />
                  <span className="text-gray-400 text-sm">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Route chips */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {plan.legs?.map((leg, j) => (
                  <span
                    key={j}
                    className={`text-xs px-2 py-0.5 rounded-lg font-medium
                      ${leg.mode === 'transit'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-500'}`}
                  >
                    {leg.mode === 'transit'
                      ? `🚌 ${leg.route || 'Bus'}`
                      : `🚶 ${Math.round(leg.distance_m)}m`}
                  </span>
                ))}
              </div>
            </div>

            {/* Expanded legs */}
            {isExpanded && (
              <div className="bg-white border-t border-gray-100">
                {plan.legs?.map((leg, j) => (
                  leg.mode === 'transit' ? (

                    // ── Transit leg — tappable ──
                    <div
                      key={j}
                      className="flex items-start gap-3 cursor-pointer bg-green-50 mx-3 my-2 rounded-xl px-3 py-3 active:bg-green-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLegSelect && onLegSelect(leg);
                      }}
                    >
                      <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{leg.route}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {leg.is_real_time
                            ? <span className="text-xs text-green-600 font-semibold">● Live</span>
                            : <span className="text-xs text-gray-400">○ Scheduled</span>
                          }
                          <CrowdingBadge level={getCrowding(leg.start_time)} />
                        </div>
                        <p className="text-xs text-gray-700 font-medium mt-0.5">
                          Ride {leg.duration_min} min · departs {formatTime(leg.start_time)}
                        </p>
                        {leg.headsign && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            → {leg.headsign}
                          </p>
                        )}
                        <p className="text-xs text-green-500 font-medium mt-1">
                          Tap to see all stops →
                        </p>
                      </div>
                      <span className="text-xs font-bold text-gray-700 shrink-0">
                        {leg.duration_min} min
                      </span>
                    </div>

                  ) : (

                    // ── Walk leg ──
                    <div key={j} className="flex items-start gap-3 mx-3 my-2 px-3 py-2">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-sm">🚶</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-600">
                          Walk {Math.round(leg.distance_m)}m
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatTime(leg.start_time)} → {formatTime(leg.end_time)} · {leg.duration_min} min
                        </p>
                      </div>
                    </div>

                  )
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}