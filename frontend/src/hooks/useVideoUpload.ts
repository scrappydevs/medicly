import { useState } from 'react';

interface VideoUploadOptions {
  userId: string;
  sessionId?: string;
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
}

interface UploadResult {
  id: string;
  key: string;
  path: string;
  url: string | null;
  signedUrl: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  userId: string;
  sessionId?: string;
}

interface UseVideoUploadReturn {
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  uploadedVideo: UploadResult | null;
  uploadVideo: (file: File) => Promise<UploadResult>;
  reset: () => void;
}

export function useVideoUpload(options: VideoUploadOptions): UseVideoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<UploadResult | null>(null);

  const uploadVideo = async (file: File): Promise<UploadResult> => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      setUploadedVideo(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', options.userId);
      if (options.sessionId) {
        formData.append('sessionId', options.sessionId);
      }

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadedVideo(result.data);

      if (options.onUploadComplete) {
        options.onUploadComplete(result.data);
      }

      return result.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('Video upload failed:', error);

      setUploadError(errorMessage);

      if (options.onUploadError) {
        options.onUploadError(errorMessage);
      }

      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setUploadedVideo(null);
  };

  return {
    isUploading,
    uploadProgress,
    uploadError,
    uploadedVideo,
    uploadVideo,
    reset,
  };
} 