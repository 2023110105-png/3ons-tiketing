// React Hooks for Tenant-Isolated Data with Realtime
import { useState, useEffect, useCallback } from 'react';
import {
  getParticipants,
  getCheckIns,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  recordCheckIn,
  getTenantStats
} from '../lib/tenantData';
import {
  subscribeParticipants,
  subscribeCheckIns,
  subscribeToAllTables
} from '../lib/tenantRealtime';

// ============================================
// HOOK: Participants with Realtime
// ============================================

export function useParticipants(day = null) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getParticipants(day);
      setParticipants(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [day]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeParticipants((change) => {
      console.log('[useParticipants] Realtime change:', change);
      
      if (change.type === 'INSERT') {
        setParticipants(prev => [change.data, ...prev]);
      } else if (change.type === 'UPDATE') {
        setParticipants(prev =>
          prev.map(p => p.id === change.data.id ? change.data : p)
        );
      } else if (change.type === 'DELETE') {
        setParticipants(prev =>
          prev.filter(p => p.id !== change.data.id)
        );
      }
    });

    return unsubscribe;
  }, []);

  // CRUD operations
  const addParticipant = useCallback(async (data) => {
    const newParticipant = await createParticipant(data);
    return newParticipant;
  }, []);

  const editParticipant = useCallback(async (id, updates) => {
    const updated = await updateParticipant(id, updates);
    return updated;
  }, []);

  const removeParticipant = useCallback(async (id) => {
    await deleteParticipant(id);
  }, []);

  return {
    participants,
    loading,
    error,
    refresh: fetchData,
    addParticipant,
    editParticipant,
    removeParticipant
  };
}

// ============================================
// HOOK: Check-ins with Realtime
// ============================================

export function useCheckIns(day = null) {
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCheckIns(day);
      setCheckIns(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = subscribeCheckIns((change) => {
      console.log('[useCheckIns] Realtime change:', change);
      
      if (change.type === 'INSERT') {
        setCheckIns(prev => [change.data, ...prev]);
      } else if (change.type === 'UPDATE') {
        setCheckIns(prev =>
          prev.map(c => c.id === change.data.id ? change.data : c)
        );
      } else if (change.type === 'DELETE') {
        setCheckIns(prev =>
          prev.filter(c => c.id !== change.data.id)
        );
      }
    });

    return unsubscribe;
  }, []);

  const addCheckIn = useCallback(async (ticketId, gateInfo) => {
    const newCheckIn = await recordCheckIn(ticketId, gateInfo);
    return newCheckIn;
  }, []);

  return {
    checkIns,
    loading,
    error,
    refresh: fetchData,
    addCheckIn
  };
}

// ============================================
// HOOK: Stats with Realtime
// ============================================

export function useTenantStats(day = null) {
  const [stats, setStats] = useState({
    total: 0,
    checkedIn: 0,
    notCheckedIn: 0,
    percentage: 0,
    byCategory: {}
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTenantStats(day);
      setStats(data);
    } catch (err) {
      console.error('[useTenantStats] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Subscribe to both participants and checkins changes
  useEffect(() => {
    const unsubscribe = subscribeToAllTables({
      participants: () => fetchStats(),
      checkins: () => fetchStats()
    });

    return unsubscribe;
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}

// ============================================
// HOOK: Full Tenant Sync
// ============================================

export function useTenantSync() {
  const [syncState, setSyncState] = useState({
    participants: [],
    checkIns: [],
    events: [],
    lastSync: null,
    isSyncing: false
  });

  const sync = useCallback(async () => {
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    
    try {
      const [participants, checkIns] = await Promise.all([
        getParticipants(),
        getCheckIns()
      ]);
      
      setSyncState({
        participants,
        checkIns,
        events: [],
        lastSync: new Date().toISOString(),
        isSyncing: false
      });
    } catch (err) {
      console.error('[useTenantSync] Sync error:', err);
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  // Auto-sync on mount (use callback pattern to avoid cascading renders)
  useEffect(() => {
    const timer = setTimeout(() => {
      sync();
    }, 0);
    return () => clearTimeout(timer);
  }, [sync]);

  // Realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToAllTables({
      participants: (change) => {
        if (change.type === 'INSERT') {
          setSyncState(prev => ({
            ...prev,
            participants: [change.data, ...prev.participants]
          }));
        }
      },
      checkins: (change) => {
        if (change.type === 'INSERT') {
          setSyncState(prev => ({
            ...prev,
            checkIns: [change.data, ...prev.checkIns]
          }));
        }
      }
    });

    return unsubscribe;
  }, []);

  return { ...syncState, sync };
}

export default {
  useParticipants,
  useCheckIns,
  useTenantStats,
  useTenantSync
};
