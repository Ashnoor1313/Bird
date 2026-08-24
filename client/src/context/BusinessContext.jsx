import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const BusinessContext = createContext();

export const BusinessProvider = ({ children }) => {
  const { businesses, fetchBusinesses } = useAuth();
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const initBusiness = useCallback(async () => {
    let list = businesses;
    if (!list || list.length === 0) {
      list = await fetchBusinesses();
    }

    if (list && list.length > 0) {
      const savedId = localStorage.getItem('bird_active_business_id');
      const found = list.find(b => b.id === savedId) || list[0];
      setActiveBusiness(found);
    }
  }, [businesses, fetchBusinesses]);

  useEffect(() => {
    initBusiness();
  }, [initBusiness]);

  const selectBusiness = (business) => {
    setActiveBusiness(business);
    localStorage.setItem('bird_active_business_id', business.id);
    triggerRefresh();
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <BusinessContext.Provider
      value={{
        activeBusiness,
        activeBusinessId: activeBusiness?.id || '',
        selectBusiness,
        refreshTrigger,
        triggerRefresh,
        fetchBusinesses,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);
