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

function App() {
  const [location, setLocation]               = useState(null);
  const [destination, setDestination]         = useState(null);
  const [selectedStop, setSelectedStop]       = useState(null);
  const [showPlan, setShowPlan]               = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [selectedLeg, setSelectedLeg]         = useState(null);

  // get user location
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted') {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude
          })
        );
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude
          }),
          () => setLocation({ latitude: 43.8971, longitude: -78.8658 })
        );
      }
    });
  }, []);

  // nearby stops
  const { stops } = useNearbyStops(
    location?.latitude,
    location?.longitude
  );

  // auto select closest stop
  useEffect(() => {
    if (stops.length > 0 && !selectedStop) {
      setSelectedStop(stops[0]);
    }
  }, [stops]);

  // arrivals for selected stop
  const { arrivals, loading: arrivalsLoading } = useArrivals(
    selectedStop?.stop_id
  );

  // live websocket
  const { crowding, notifications } = useLiveStop(
    selectedStop?.stop_id
  );

  // trip plan
  const {
    plans,
    loading:  planLoading,
    error:    planError,
    fetchPlan,
    clearPlan
  } = usePlan();

  // fetch plan when destination selected
  useEffect(() => {
    if (destination && location) {
      fetchPlan(
        location.latitude,
        location.longitude,
        destination.latitude,
        destination.longitude
      );
      setShowPlan(true);
    }
  }, [destination]);

  return (
    <div className="w-screen h-screen relative overflow-hidden">

      {/* Map — only user location, no stop markers */}
      <MapView
        location={location}
        stops={[]}
        selectedStop={null}
        onStopClick={null}
        plans={showPlan ? plans : []}
        selectedPlanIndex={selectedPlanIndex}
      />

      {/* Notifications */}
      <NotificationToast notifications={notifications} />

      {/* Route stop detail sheet — highest priority */}
      {selectedLeg && (
        <RouteStopSheet
          leg={selectedLeg}
          onClose={() => setSelectedLeg(null)}
        />
      )}

      {/* Trip plan sheet */}
      {showPlan && !selectedLeg && (
        <TripPlanSheet
          plans={plans}
          loading={planLoading}
          error={planError}
          selectedPlanIndex={selectedPlanIndex}
          onPlanSelect={(i) => setSelectedPlanIndex(i)}
          onLegSelect={(leg) => setSelectedLeg(leg)}
          onClose={() => {
            setShowPlan(false);
            clearPlan();
            setDestination(null);
            setSelectedPlanIndex(0);
          }}
        />
      )}

      {/* Arrival sheet — show when stop selected and no plan */}
      {selectedStop && !showPlan && !selectedLeg && (
        <ArrivalSheet
          stop={selectedStop}
          arrivals={arrivals}
          crowding={crowding}
          loading={arrivalsLoading}
          onClose={() => setSelectedStop(null)}
        />
      )}

      {/* Search bar */}
      {!showPlan && !selectedLeg && (
        <SearchBar
          onDestinationSelect={(dest) => setDestination(dest)}
          onFromSelect={(from) => {
            if (from) setLocation(from);
          }}
        />
      )}
    </div>
  );
}

export default App;