import { useState, useEffect } from 'react';

export interface VideoSource {
  url: string;
  source: 'supabase' | 'backend';
  fileType: 'video';
  fileName: string;
}

export interface SessionVideoData {
  originalVideo?: VideoSource;
  processedVideo?: VideoSource;
  patientNotes?: string;
  aiEvaluation?: any;
  doctorFeedback?: string;
  status?: string;
  treatment?: {
    id: number;
    name: string;
    description?: string;
    video_link?: string;
  };
  isLoading: boolean;
  error: string | null;
}

export function useSessionVideo(sessionId: string) {
  const [videoData, setVideoData] = useState<SessionVideoData>({
    isLoading: true,
    error: null
  });

  const fetchSessionVideos = async () => {
    try {
      setVideoData(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`/api/sessions/${sessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch session');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      const session = result.data;

      const videoSources: SessionVideoData = {
        isLoading: false,
        error: null,
        patientNotes: session.patient_notes,
        aiEvaluation: session.ai_evaluation,
        doctorFeedback: session.doctor_feedback,
        status: session.status,
        treatment: session.treatment
      };

      if (session.previdurl) {
        videoSources.originalVideo = {
          url: session.previdurl,
          source: 'supabase',
          fileType: 'video',
          fileName: 'original.mp4'
        };
      }

      if (session.postvidurl) {
        videoSources.processedVideo = {
          url: session.postvidurl,
          source: session.postvidurl.includes('supabase') ? 'supabase' : 'backend',
          fileType: 'video',
          fileName: 'processed.mp4'
        };
      }

      setVideoData(videoSources);

    } catch (err) {
      console.error('Error fetching session videos:', err);
      setVideoData({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch videos'
      });
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSessionVideos();
    }
  }, [sessionId]);

  return {
    originalVideoUrl: videoData.originalVideo?.url || null,
    processedVideoUrl: videoData.processedVideo?.url || null,
    patientNotes: videoData.patientNotes || '',
    aiEvaluation: videoData.aiEvaluation,
    doctorFeedback: videoData.doctorFeedback || '',
    sessionStatus: videoData.status,
    treatment: videoData.treatment,
    isVideoReady: !videoData.isLoading && (!!videoData.originalVideo || !!videoData.processedVideo),
    isLoading: videoData.isLoading,
    error: videoData.error,
    refetch: fetchSessionVideos
  };
}
