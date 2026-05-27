const API_BASE_URL = 'http://localhost:8000';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export enum UserRole {
  PATIENT = "patient",
  DOCTOR = "doctor",
  ADMIN = "admin"
}

export enum ExerciseType {
  SHOULDER_FLEXION = "shoulder_flexion",
  ARM_RAISE = "arm_raise",
  LEG_LIFT = "leg_lift",
  KNEE_BEND = "knee_bend",
  WALKING = "walking",
  CUSTOM = "custom"
}

export enum AnalysisStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  is_active: boolean;
}

export interface UserCreate {
  email: string;
  full_name: string;
  role?: UserRole;
  google_id?: string;
}

export interface UserLogin {
  email: string;
  google_token?: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  exercise_type: ExerciseType;
  target_body_parts: string[];
  instructions: string[];
  created_at: string;
}

export interface PoseKeypoint {
  x: number;
  y: number;
  z?: number;
  visibility: number;
  name: string;
}

export interface FrameAnalysis {
  frame_number: number;
  timestamp: number;
  keypoints: PoseKeypoint[];
  angles: Record<string, number>;
  quality_score: number;
}

export interface VideoAnalysisResult {
  video_id: string;
  analysis_id: string;
  status: AnalysisStatus;
  exercise_type: ExerciseType;
  frames: FrameAnalysis[];
  summary: Record<string, unknown>;
  insights: string[];
  recommendations: string[];
  progress_score: number;
  created_at: string;
  completed_at?: string;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  exercise_type: ExerciseType;
  file_path: string;
  file_size: number;
  duration?: number;
  status: AnalysisStatus;
  uploaded_by: string;
  patient_id?: string;
  analysis_result?: VideoAnalysisResult;
  created_at: string;
}

export interface HealthStatus {
  status: string;
  message: string;
  services: {
    computer_vision: string;
    database: string;
    file_storage: string;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (options.headers) {
        const provided = new Headers(options.headers as HeadersInit);
        provided.forEach((value, key) => headers.set(key, value));
      }
      if (this.token) {
        headers.set('Authorization', `Bearer ${this.token}`);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || `HTTP error! status: ${response.status}`,
          error: data.detail || 'Request failed'
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async uploadRequest<T>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    try {
      const headers = new Headers();
      if (this.token) {
        headers.set('Authorization', `Bearer ${this.token}`);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || `HTTP error! status: ${response.status}`,
          error: data.detail || 'Upload failed'
        };
      }

      return data;
    } catch (error) {
      console.error('Upload request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async healthCheck(): Promise<ApiResponse<HealthStatus>> {
    return this.request<HealthStatus>('/api/health');
  }

  async register(userData: UserCreate): Promise<ApiResponse<{ user_id: string }>> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(loginData: UserLogin): Promise<ApiResponse<{ user: User; token: string }>> {
    const result = await this.request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });

    if (result.success && result.data?.token) {
      this.setToken(result.data.token);
    }

    return result;
  }

  async logout() {
    this.clearToken();
  }

  async uploadVideo(
    title: string,
    exerciseType: ExerciseType,
    file: File,
    description?: string,
    patientId?: string
  ): Promise<ApiResponse<{ video_id: string }>> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('exercise_type', exerciseType);
    formData.append('file', file);

    if (description) formData.append('description', description);
    if (patientId) formData.append('patient_id', patientId);

    return this.uploadRequest('/api/videos/upload', formData);
  }

  async getVideo(videoId: string): Promise<ApiResponse<Video>> {
    return this.request<Video>(`/api/videos/${videoId}`);
  }

  async getUserVideos(limit = 20, offset = 0): Promise<ApiResponse<{ videos: Video[]; total: number }>> {
    return this.request<{ videos: Video[]; total: number }>(`/api/videos?limit=${limit}&offset=${offset}`);
  }

  async getExercises(exerciseType?: ExerciseType): Promise<ApiResponse<Exercise[]>> {
    const query = exerciseType ? `?exercise_type=${exerciseType}` : '';
    return this.request<Exercise[]>(`/api/exercises${query}`);
  }

  async createExercise(exerciseData: Omit<Exercise, 'id' | 'created_at'>): Promise<ApiResponse<Exercise>> {
    return this.request('/api/exercises', {
      method: 'POST',
      body: JSON.stringify(exerciseData),
    });
  }

  async getPatientProgress(patientId: string, exerciseType?: ExerciseType): Promise<ApiResponse<Record<string, unknown>>> {
    const query = exerciseType ? `?exercise_type=${exerciseType}` : '';
    return this.request(`/api/progress/${patientId}${query}`);
  }

  async getSampleVideo(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/sample-video`);
    if (!response.ok) {
      throw new Error('Failed to fetch sample video');
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}

export const apiClient = new ApiClient();
