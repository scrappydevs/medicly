import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { SessionStatus } from '@/types/medical.types';

export interface Session {
  id: number;
  created_at: string;
  patient_id: string;
  doctor_id?: string;
  status: SessionStatus;
  due_date?: string;
  ai_evaluation?: any;
  exercise_sets?: number;
  exercise_reps?: number;
  exercise_weight?: number;
  exercise_duration_in_weeks?: number;
  exercise_frequency_daily?: number;
  treatment_id?: number;
  previdurl?: string;
  pose_video_id?: string;
  patient_notes?: string;
  postvidurl?: string;
  treatment?: Treatment;
}

export interface Treatment {
  id: number;
  name: string;
  description?: string;
  video_link?: string;
}

export function usePatientSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setSessions([]);
      return;
    }

    fetchSessions();
  }, [user?.id]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/sessions?userId=${user?.id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch sessions');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setSessions(result.data || []);
    } catch (err) {
      console.error('Error in fetchSessions:', err);

      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.');
        } else if (err.message.includes('table') || err.message.includes('relation')) {
          setError('Database tables not set up. Please run the SQL setup script.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to fetch sessions');
      }
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (treatmentId: number, additionalData?: Partial<Session>) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: user?.id,
          treatment_id: treatmentId,
          ...additionalData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setSessions(prev => [result.data, ...prev]);
      return result.data;
    } catch (err) {
      console.error('Error in createSession:', err);
      throw err;
    }
  };

  const updateSession = async (sessionId: number, updates: Partial<Session>) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update session');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? result.data : s));
      return result.data;
    } catch (err) {
      console.error('Error in updateSession:', err);
      throw err;
    }
  };

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
    createSession,
    updateSession
  };
} 