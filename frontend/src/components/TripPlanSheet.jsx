import { useState } from 'react';

export default function TripPlanSheet({
  plans,
  loading,
  error,
  onClose,
  onPlanSelect,
  onLegSelect,
  onWalkLegSelect,
  selectedWalkLeg,
  selectedPlanIndex,
}) {
  // Start with all plans collapsed — user taps to expand any of them
  const [expandedSet, setExpandedSet] = useState(new Set([0]));

  if (!plans && !loading) return null;

  const formatTime = (ts) =>
    ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const formatDur = (min) => {
    if (!min) return '';
    const m = Math.round(min);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const minsUntil = (ts) =>
    ts ? Math.max(0, Math.round((ts * 1000 - Date.now()) / 60000)) : null;

  // Single handler — selects the plan AND toggles its expansion
  const handlePlanClick = (i) => {
    onPlanSelect?.(i);
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);   // collapse if already open
      } else {
        next.add(i);      // expand if closed
      }
      return next;
    });
  };

  const WalkIcon = ({ active }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : '#3b82f6'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5" fill={active ? 'white' : '#3b82f6'} stroke="none" />
      <path d="M12 6.5l-2.5 4.5h5M9.5 11L8 19M14.5 11L16 19" />
    </svg>
  );

  const sheetHeight = selectedWalkLeg ? '28vh' : '58vh';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[1000] flex flex-col bg-white rounded-t-2xl shadow-2xl transition-all duration-300"
      style={{ height: sheetHeight }}
    >
      {/* Handle */}
      <div
        className="flex justify-center pt-2.5 pb-1 shrink-0 cursor-pointer"
        onClick={() => { if (selectedWalkLeg) onWalkLegSelect?.(selectedWalkLeg); }}
      >
        <div className="w-8 h-1 rounded-full bg-blue-200" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-blue-50 shrink-0">
        <span className="text-[15px] font-bold text-gray-900">Trip Options</span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 text-xs font-bold hover:bg-blue-100 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Walk leg summary pill */}
      {selectedWalkLeg && (
        <div className="px-3 pt-2 pb-1 shrink-0">
          <div className="flex items-center gap-2 bg-blue-600 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <WalkIcon active />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[12px] font-bold">
                Walk {Math.round(selectedWalkLeg.distance_m)}m shown on map
              </p>
              <p className="text-blue-200 text-[10px]">
                {formatTime(selectedWalkLeg.start_time)} – {formatTime(selectedWalkLeg.end_time)}
                {' · '}{formatDur(selectedWalkLeg.duration_min)}
              </p>
            </div>
            <button
              onClick={() => onWalkLegSelect?.(selectedWalkLeg)}
              className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              ✕
            </button>
          </div>
          <p className="text-[10px] text-blue-300 text-center mt-1.5">Scroll up to see all trip options</p>
        </div>
      )}

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 px-3 py-2 space-y-2 pb-6">

        {loading && (
          <div className="flex items-center justify-center py-10 gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-400 font-medium">Finding routes…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && plans?.map((plan, i) => {
          const isSelected = selectedPlanIndex === i;
          const isExpanded = expandedSet.has(i);

          return (
            <div
              key={i}
              className={`rounded-2xl overflow-hidden border transition-all ${
                isSelected ? 'border-blue-300 shadow-md shadow-blue-100' : 'border-blue-100 shadow-sm'
              }`}
            >
              {/* Plan header — single tap selects + toggles */}
              <button
                type="button"
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isSelected ? 'bg-blue-600' : 'bg-white hover:bg-blue-50'
                }`}
                onClick={() => handlePlanClick(i)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[14px] font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {formatTime(plan.start_time)} – {formatTime(plan.end_time)}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-blue-500 text-blue-100' : 'bg-blue-50 text-blue-500'
                    }`}>
                      {formatDur(plan.duration_min)}
                    </span>
                  </div>
                  {/* Chevron — clearly shows expanded/collapsed state */}
                  <span className={`text-xs font-bold transition-transform ${
                    isSelected ? 'text-blue-300' : 'text-blue-200'
                  }`}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Leg pills */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {plan.legs?.map((leg, j) => (
                    <span key={j} className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                      leg.mode === 'transit'
                        ? (isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white')
                        : (isSelected ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-500')
                    }`}>
                      {leg.mode === 'transit' ? leg.route : `${Math.round(leg.distance_m)}m walk`}
                    </span>
                  ))}
                </div>
              </button>

              {/* Expanded legs */}
              {isExpanded && (
                <div className="border-t border-blue-50 space-y-1.5 p-2 bg-blue-50/30">
                  {plan.legs?.map((leg, j) => {
                    if (leg.mode === 'transit') {
                      const isLive = !!leg.is_real_time;
                      const mins   = minsUntil(leg.start_time);

                      return (
                        <button
                          key={j}
                          type="button"
                          className="w-full text-left flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-blue-100 hover:border-blue-400 hover:shadow-md active:bg-blue-50 transition-all cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); onLegSelect?.(leg); }}
                        >
                          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                            <span className="text-white text-xs font-bold leading-none">{leg.route}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            {isLive ? (
                              <span className="text-[10px] font-bold text-green-500 flex items-center gap-1 mb-0.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping inline-block" />
                                Live
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-blue-300 block mb-0.5">
                                Scheduled
                              </span>
                            )}

                            {isLive ? (
                              <p className="text-[13px] font-bold text-gray-900">
                                {mins} min
                                <span className="text-[11px] font-normal text-gray-400 ml-1">
                                  · {formatTime(leg.start_time)}
                                </span>
                              </p>
                            ) : (
                              <p className="text-[13px] font-semibold text-gray-800">
                                {formatTime(leg.start_time)}
                              </p>
                            )}

                            {leg.headsign && (
                              <p className="text-[11px] text-gray-400 truncate">{leg.headsign}</p>
                            )}
                            <p className="text-[10px] text-blue-500 font-semibold mt-0.5">
                              View stops →
                            </p>
                          </div>

                          <span className="text-[13px] font-bold text-blue-600 shrink-0">
                            {formatDur(leg.duration_min)}
                          </span>
                        </button>
                      );
                    }

                    // Walk leg
                    const isWalkActive = selectedWalkLeg?.start_time === leg.start_time;
                    return (
                      <button
                        key={j}
                        type="button"
                        className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all cursor-pointer ${
                          isWalkActive
                            ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200'
                            : 'bg-white border-blue-100 hover:border-blue-300'
                        }`}
                        onClick={(e) => { e.stopPropagation(); onWalkLegSelect?.(leg); }}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isWalkActive ? 'bg-white/20' : 'bg-blue-50'
                        }`}>
                          <WalkIcon active={isWalkActive} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-semibold ${isWalkActive ? 'text-white' : 'text-gray-800'}`}>
                            Walk {Math.round(leg.distance_m)}m
                          </p>
                          <p className={`text-[11px] ${isWalkActive ? 'text-blue-200' : 'text-blue-400'}`}>
                            {formatTime(leg.start_time)} – {formatTime(leg.end_time)}
                          </p>
                          {!isWalkActive && (
                            <p className="text-[10px] text-blue-400 font-medium mt-0.5">Tap to show on map</p>
                          )}
                        </div>
                        <span className={`text-[13px] font-bold shrink-0 ${isWalkActive ? 'text-white' : 'text-blue-600'}`}>
                          {formatDur(leg.duration_min)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}