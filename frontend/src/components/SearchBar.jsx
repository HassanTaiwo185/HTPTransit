import React, { useState, useEffect, useRef } from 'react';

const OPENCAGE_API_KEY = process.env.REACT_APP_OPENCAGE_API_KEY;

async function geocode(query) {
  if (!query || query.length < 3) return [];
  if (!OPENCAGE_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5&no_annotations=1`
    );
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// Load saved places from localStorage
function loadSavedPlaces() {
  try {
    return JSON.parse(localStorage.getItem('savedPlaces')) || { home: null, work: null, school: null };
  } catch {
    return { home: null, work: null, school: null };
  }
}

// Save places to localStorage
function savePlaces(places) {
  localStorage.setItem('savedPlaces', JSON.stringify(places));
}

export default function SearchBar({ onDestinationSelect, onFromSelect }) {
  const [fromQuery, setFromQuery] = useState('My Current Location');
  const [toQuery, setToQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState(loadSavedPlaces);
  const [settingPlace, setSettingPlace] = useState(null); // 'home' | 'work' | 'school'
  const debounceRef = useRef(null);

  // Active query based on which field is focused
  const activeQuery = activeField === 'from' ? fromQuery : toQuery;

  // Autocomplete search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (
      activeQuery.length < 3 ||
      activeQuery === 'My Current Location'
    ) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await geocode(activeQuery);
      setResults(res);
      setLoading(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [activeQuery]);

  const handleSelect = (result) => {
    const loc = {
      latitude: result.geometry.lat,
      longitude: result.geometry.lng,
      label: result.formatted,
    };

    // If we're setting a saved place (home/work/school)
    if (settingPlace) {
      const updated = { ...savedPlaces, [settingPlace]: loc };
      setSavedPlaces(updated);
      savePlaces(updated);
      setSettingPlace(null);
      setResults([]);
      setToQuery('');
      return;
    }

    // Normal destination/from select
    if (activeField === 'from') {
      setFromQuery(result.formatted);
      onFromSelect && onFromSelect(loc);
    } else {
      setToQuery(result.formatted);
      onDestinationSelect && onDestinationSelect(loc);
    }
    setResults([]);
    setActiveField(null);
  };

  const handleQuickSelect = (type) => {
    const place = savedPlaces[type];
    if (place) {
      // Autopopulate destination
      setToQuery(place.label);
      onDestinationSelect && onDestinationSelect(place);
      setResults([]);
    } else {
      // No saved place — prompt to set it
      setSettingPlace(type);
      setToQuery('');
      setActiveField('to');
    }
  };

  const handleClose = () => {
    setExpanded(false);
    setActiveField(null);
    setResults([]);
    setToQuery('');
    setFromQuery('My Current Location');
    setSettingPlace(null);
  };

  const quickButtons = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'work', label: 'Work', icon: '💼' },
    { key: 'school', label: 'School', icon: '🎓' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000]">

      {!expanded ? (
        // --- Collapsed pill ---
        <div className="mx-4 mb-6">
          <div
            onClick={() => { setExpanded(true); setActiveField('to'); }}
            className="bg-white rounded-2xl shadow-2xl flex items-center px-4 h-14 gap-3 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex flex-col items-center gap-[3px]">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="w-[1.5px] h-3 bg-gray-300" />
              <div className="w-2 h-2 rounded bg-red-500" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Where to?</span>
            <div className="ml-auto bg-blue-50 rounded-xl p-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          </div>
        </div>

      ) : (
        // --- Expanded panel ---
        <div className="bg-white rounded-t-3xl shadow-2xl px-4 pt-3 pb-8">

          {/* Handle bar */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Title — changes when setting a saved place */}
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {settingPlace ? `Set your ${settingPlace} address` : 'Plan your trip'}
          </h2>

          {/* Input fields */}
          <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 mb-4">

            {/* From — hidden when setting saved place */}
            {!settingPlace && (
              <>
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 ${activeField === 'from' ? 'bg-blue-50' : ''}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <input
                    value={fromQuery}
                    onChange={e => setFromQuery(e.target.value)}
                    onFocus={() => setActiveField('from')}
                    placeholder="Starting location..."
                    className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
                  />
                  {fromQuery !== 'My Current Location' && (
                    <button
                      onClick={() => { setFromQuery('My Current Location'); onFromSelect && onFromSelect(null); }}
                      className="shrink-0 text-xs text-blue-500 font-medium bg-blue-50 px-2 py-1 rounded-lg"
                    >
                      📍 Reset
                    </button>
                  )}
                </div>

                {/* Dotted connector */}
                <div className="flex items-center px-4 py-1 gap-3">
                  <div className="flex flex-col items-center gap-[3px] ml-[1px]">
                    <div className="w-[2px] h-[3px] bg-gray-300 rounded" />
                    <div className="w-[2px] h-[3px] bg-gray-300 rounded" />
                    <div className="w-[2px] h-[3px] bg-gray-300 rounded" />
                  </div>
                </div>
              </>
            )}

            {/* To / Set saved place */}
            <div className={`flex items-center gap-3 px-4 py-3 ${activeField === 'to' ? 'bg-red-50' : ''}`}>
              <div className="w-2.5 h-2.5 rounded bg-red-500 shrink-0" />
              <input
                value={toQuery}
                onChange={e => setToQuery(e.target.value)}
                onFocus={() => setActiveField('to')}
                placeholder={settingPlace ? `Search for your ${settingPlace}...` : 'Enter destination...'}
                className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-400"
                autoFocus
              />
              {toQuery.length > 0 && (
                <button
                  onClick={() => { setToQuery(''); setResults([]); }}
                  className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs shrink-0"
                >×</button>
              )}
            </div>
          </div>

          {/* Autocomplete results */}
          {results.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden max-h-48 overflow-y-auto">
              {loading && (
                <div className="px-4 py-2 text-xs text-gray-400">Searching...</div>
              )}
              {results.map((r, i) => (
                <div
                  key={i}
                  onClick={() => handleSelect(r)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-none"
                >
                  <span className="text-gray-400 shrink-0">📍</span>
                  <span className="text-sm text-gray-700 truncate">{r.formatted}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick buttons — Home / Work / School */}
          {!settingPlace && (
            <div className="flex gap-2 mb-4">
              {quickButtons.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => handleQuickSelect(key)}
                  className="flex flex-col items-center gap-1 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 font-medium transition-colors flex-1"
                >
                  <span>{icon}</span>
                  <span className="text-xs">{savedPlaces[key] ? label : `Set ${label}`}</span>
                </button>
              ))}
            </div>
          )}

          {/* Cancel setting saved place */}
          {settingPlace && (
            <button
              onClick={() => { setSettingPlace(null); setToQuery(''); setResults([]); }}
              className="w-full py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors mb-3"
            >
              ← Back
            </button>
          )}

          {/* Cancel */}
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

