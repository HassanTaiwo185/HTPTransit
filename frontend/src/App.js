import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import SearchBar from './components/SearchBar';
import ArrivalSheet from './components/ArrivalSheet';
import TripPlanSheet from './components/TripPlanSheet';
import RouteStopSheet from './components/RouteStopSheet';
import NotificationToast from './components/NotificationToast';
import useNearbyStops from './hooks/useNearbyStops';
import useArrivals from './hooks/useArrivals';
import usePlan from './hooks/usePlan';
import useLiveStop from './hooks/useLiveStop';
import { getTripStops, getVehiclePositions } from './services/api';

function App() {
  const [location, setLocation]                   = useState(null);
  const [destination, setDestination]             = useState(null);
  const [selectedStop, setSelectedStop]           = useState(null);
  const [showPlan, setShowPlan]                   = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [selectedLeg, setSelectedLeg]             = useState(null);
  const [selectedWalkLeg, setSelectedWalkLeg]     = useState(null);
  const [tripStops, setTripStops]                 = useState([]);
  const [vehicles, setVehicles]                   = useState([]);

  // Get user location
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted') {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        );
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => setLocation({ latitude: 43.8971, longitude: -78.8658 })
        );
      }
    });
  }, []);

  // Nearby stops
  const { stops } = useNearbyStops(location?.latitude, location?.longitude);

  // Auto select closest stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stops.length > 0 && !selectedStop) setSelectedStop(stops[0]);
  }, [stops]);

  // Arrivals for selected stop
  const { arrivals, loading: arrivalsLoading } = useArrivals(selectedStop?.stop_id);

  // Live websocket
  const { crowding, notifications } = useLiveStop(selectedStop?.stop_id);

  // Trip plan
  const { plans, loading: planLoading, error: planError, fetchPlan, clearPlan } = usePlan();

  // Fetch plan when destination selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (destination && location) {
      fetchPlan(location.latitude, location.longitude, destination.latitude, destination.longitude);
      setShowPlan(true);
    }
  }, [destination]);

  // Fetch trip stops when transit leg selected
  useEffect(() => {
    if (!selectedLeg?.trip_id) { setTripStops([]); return; }
    getTripStops(selectedLeg.trip_id, selectedLeg.start_time)
      .then(data => setTripStops(data.stops || []))
      .catch(() => setTripStops([]));
  }, [selectedLeg]);

  // Fetch + poll vehicle positions when a transit leg is selected
  useEffect(() => {
    if (!selectedLeg?.global_route_id) {
      setVehicles([]);
      return;
    }

    // Immediate fetch
    getVehiclePositions(selectedLeg.global_route_id)
      .then(data => setVehicles(data.vehicles || []))
      .catch(() => setVehicles([]));

    // Poll every 15s for live updates
    const interval = setInterval(() => {
      getVehiclePositions(selectedLeg.global_route_id)
        .then(data => setVehicles(data.vehicles || []))
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedLeg?.global_route_id]);

  // Handle arrival row tap
  const handleArrivalSelect = (arrival) => {
    setSelectedLeg({
      route:           arrival.route_short_name,
      route_color:     arrival.route_color || '#3b82f6',
      global_route_id: arrival.global_route_id || null,
      trip_id:         arrival.trip_id,
      start_time:      Math.floor(Date.now() / 1000) + Math.round(arrival.arrives_in_min * 60),
      is_real_time:    arrival.arrives_in_min < 5,
      headsign:        arrival.headsign,
      duration_min:    0,
      stop_times:      [],
      polyline:        '',
    });
  };

  const handleClosePlan = () => {
    setShowPlan(false);
    clearPlan();
    setDestination(null);
    setSelectedPlanIndex(0);
    setSelectedLeg(null);
    setSelectedWalkLeg(null);
    setTripStops([]);
    setVehicles([]);
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">

      <MapView
        location={location}
        stops={[]}
        selectedStop={null}
        onStopClick={null}
        plans={showPlan ? plans : []}
        selectedPlanIndex={selectedPlanIndex}
        selectedLeg={selectedLeg}
        tripStops={tripStops}
        walkLeg={selectedWalkLeg}
        vehicles={vehicles}
      />

      <NotificationToast notifications={notifications} />

      {/* Route stop detail — shown when a transit leg is tapped */}
      {selectedLeg && (
        <RouteStopSheet
          leg={selectedLeg}
          vehicles={vehicles}
          onClose={() => {
            setSelectedLeg(null);
            setTripStops([]);
            setVehicles([]);
          }}
        />
      )}

      {/* Trip plan sheet — hidden while viewing a specific leg */}
      {showPlan && !selectedLeg && (
        <TripPlanSheet
          plans={plans}
          loading={planLoading}
          error={planError}
          selectedPlanIndex={selectedPlanIndex}
          onPlanSelect={(i) => { setSelectedPlanIndex(i); setSelectedWalkLeg(null); }}
          onLegSelect={(leg) => setSelectedLeg(leg)}
          onWalkLegSelect={(leg) => setSelectedWalkLeg(
            selectedWalkLeg?.start_time === leg.start_time ? null : leg
          )}
          selectedWalkLeg={selectedWalkLeg}
          onClose={handleClosePlan}
        />
      )}

      {/* Arrival sheet */}
      {selectedStop && !showPlan && !selectedLeg && (
        <ArrivalSheet
          stop={selectedStop}
          arrivals={arrivals}
          crowding={crowding}
          loading={arrivalsLoading}
          onClose={() => setSelectedStop(null)}
          onArrivalSelect={handleArrivalSelect}
        />
      )}

      {/* Search bar */}
      {!showPlan && !selectedLeg && (
        <SearchBar
          onDestinationSelect={(dest) => setDestination(dest)}
          onFromSelect={(from) => { if (from) setLocation(from); }}
        />
      )}
    </div>
  );
}

export default App;