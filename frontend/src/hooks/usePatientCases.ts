import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PatientCase, CaseStats, SessionStatus } from '@/types/medical.types';
import { doctorApi } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';

interface UsePatientCasesOptions {
  initialStatus?: SessionStatus;
}

export function usePatientCases(options: UsePatientCasesOptions = {}) {
  const { user } = useAuth();
  const [items, setItems] = useState<PatientCase[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorPatients, setDoctorPatients] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    status: options.initialStatus || 'all',
    injuryType: '',
    urgency: '',
    sort: 'submittedAt:desc',
    search: '',
    page: 1,
    perPage: 20,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const loadDoctorPatients = useCallback(async () => {
    if (!user?.id || user.role !== 'doctor') {
      setDoctorPatients([]);
      return;
    }

    try {
      const patients = await doctorApi.getDoctorPatients(user.id);
      const patientIds = patients.map(p => p.id);
      setDoctorPatients(patientIds);
    } catch (e) {
      console.error('[usePatientCases] error loading doctor patients:', e);
      setDoctorPatients([]);
    }
  }, [user?.id, user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filtersWithDoctor = user?.role === 'doctor' && user?.id
        ? { ...filters, doctorId: user.id }
        : filters;

      const res = await doctorApi.listCases(filtersWithDoctor);

      let filteredItems = res.items;
      if (user?.role === 'doctor' && doctorPatients.length > 0 && !('doctorId' in filtersWithDoctor)) {
        filteredItems = res.items.filter(item => doctorPatients.includes(item.patientId));
      }

      setItems(filteredItems);
      setTotal(filteredItems.length);

      let enhancedStats = res.stats;
      if (user?.role === 'doctor' && doctorPatients.length > 0) {
        enhancedStats = {
          ...res.stats,
          activePatients: doctorPatients.length
        };
      }

      setStats(enhancedStats);
    } catch (e) {
      console.error('[usePatientCases] load() error', e);
      setError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [filters, user?.role, user?.id, doctorPatients]);

  useEffect(() => {
    loadDoctorPatients();
  }, [loadDoctorPatients]);

  useEffect(() => {
    if (user?.role !== 'doctor' || doctorPatients.length > 0 || !user?.id) {
      load();
    }
  }, [load, user?.role, doctorPatients.length, user?.id]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!url) return;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_case' || data.type === 'case_updated') {
            loadDoctorPatients().then(() => load());
          }
        } catch {}
      });
      return () => {
        ws.close();
      };
    } catch {
    }
  }, [load, loadDoctorPatients]);

  const updateFilter = useCallback((partial: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...partial, page: partial.page ?? 1 }));
  }, []);

  const pageCount = useMemo(() => Math.ceil(total / filters.perPage), [total, filters.perPage]);

  const reload = useCallback(async () => {
    await loadDoctorPatients();
    await load();
  }, [loadDoctorPatients, load]);

  return {
    items,
    total,
    stats,
    loading,
    error,
    filters,
    updateFilter,
    reload,
    pageCount,
  };
}


