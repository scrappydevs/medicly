import { useState, useEffect } from 'react';

export interface Treatment {
  id: number;
  name: string;
  description?: string;
  video_link?: string;
}

export function useTreatments() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/treatments');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch treatments');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setTreatments(result.data || []);
    } catch (err) {
      console.error('Error in fetchTreatments:', err);

      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.');
        } else if (err.message.includes('table') || err.message.includes('relation')) {
          setError('Treatments table not set up. Please run the SQL setup script.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to fetch treatments');
      }
      setTreatments([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    treatments,
    loading,
    error,
    refetch: fetchTreatments
  };
} 