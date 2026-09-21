import React, { createContext, useContext, useState, useEffect } from 'react';
import { useBusiness } from './BusinessContext';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const { activeBusinessId } = useBusiness();

  // Instant zero-delay stores initialization from persistent cache
  const [locations, setLocations] = useState(() => {
    try {
      const bId = localStorage.getItem('bird_active_business_id');
      if (bId) {
        const cached = localStorage.getItem(`bird_locations_${bId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      const lastCached = localStorage.getItem('bird_locations_last');
      if (lastCached) {
        const parsed = JSON.parse(lastCached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    // Instant offline fallback stores so navigation dropdown and tabs are NEVER empty
    return [
      { id: 'loc_godown_default', name: 'Godown', type: 'GODOWN', isDefault: true },
      { id: 'loc_store1_default', name: 'Store 1', type: 'STORE' },
      { id: 'loc_store2_default', name: 'Store 2', type: 'STORE' },
    ];
  });

  const [activeLocationId, setActiveLocationId] = useState(() => {
    try {
      const bId = localStorage.getItem('bird_active_business_id');
      if (bId) {
        const saved = localStorage.getItem(`bird_location_${bId}`);
        if (saved) return saved;
      }
      const last = localStorage.getItem('bird_location_last');
      if (last) return last;
    } catch {}
    return 'ALL';
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeBusinessId) {
      fetchLocations();
    }
  }, [activeBusinessId]);

  const fetchLocations = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/locations?businessId=${activeBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLocations(data);
          try {
            localStorage.setItem(`bird_locations_${activeBusinessId}`, JSON.stringify(data));
            localStorage.setItem('bird_locations_last', JSON.stringify(data));
          } catch {}

          // Restore saved location if valid for this business
          const savedId = localStorage.getItem(`bird_location_${activeBusinessId}`);
          if (savedId && (savedId === 'ALL' || data.some(l => l.id === savedId))) {
            setActiveLocationId(savedId);
          } else if (activeLocationId && activeLocationId !== 'ALL') {
            // If current selection is one of the fallback IDs, map to matching real ID
            const matchByName = data.find(l => {
              if (activeLocationId.includes('godown') && l.type === 'GODOWN') return true;
              if (activeLocationId.includes('store1') && l.name.toLowerCase().includes('1')) return true;
              if (activeLocationId.includes('store2') && l.name.toLowerCase().includes('2')) return true;
              return l.id === activeLocationId;
            });
            if (matchByName) {
              setActiveLocationId(matchByName.id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = (id) => {
    setActiveLocationId(id);
    try {
      if (activeBusinessId) {
        localStorage.setItem(`bird_location_${activeBusinessId}`, id);
      }
      localStorage.setItem('bird_location_last', id);
    } catch {}
  };

  const activeLocation = activeLocationId === 'ALL'
    ? null
    : locations.find(l => l.id === activeLocationId) || null;

  return (
    <LocationContext.Provider
      value={{
        locations,
        activeLocationId,
        activeLocation,
        selectLocation,
        setActiveLocationId: selectLocation,
        refreshLocations: fetchLocations,
        loading,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
