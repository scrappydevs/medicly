'use client'

import React, { useState, useRef, useCallback } from 'react'
import { 
  Upload, 
  Video, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play,
  ArrowLeft,
  Activity
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { useAuth } from '@/contexts/auth-context'
import { Button } from "@/components/ui/button"
import { useVideoUpload } from '@/hooks/useVideoUpload'
import { useSessionVideo } from '@/hooks/useSessionVideo'
import { usePatientSessions } from '@/hooks/usePatientSessions'
import { useToast } from '@/hooks/use-toast'

type ProcessingStep = 'idle' | 'uploading' | 'processing_pose' | 'extracting_keyframes' | 'claude_analysis' | 'complete'
type VideoMode = 'original' | 'processed'

interface AnalysisResult {
  analysis_type?: string
  timestamp?: string
  stage_1_movement_overview?: string
  stage_2_health_report?: any
  analysis_summary?: {
    movement_identified?: string
    confidence_level?: number
    technique_quality?: string
    overall_health_assessment?: string
    key_concerns?: string[]
    main_recommendations?: string[]
    analysis_quality?: string
  }
  movement_identified?: string
  confidence?: number
  message?: string
  key_frames?: any[]
  error?: string
}

export default function ExerciseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.sessionId as string
  const exerciseName = params?.exerciseName as string
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoId, setVideoId] = useState<string>('')
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('idle')
  const [stepProgress, setStepProgress] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [videoMode, setVideoMode] = useState<VideoMode>('original')
  const [keyFrames, setKeyFrames] = useState<any[]>([])
  const [patientNotes, setPatientNotes] = useState<string>('')
  const [isSubmittingNotes, setIsSubmittingNotes] = useState(false)
  const [videoRotation, setVideoRotation] = useState<number>(0)

  const { user } = useAuth()
  const { toast } = useToast()

  const {
    originalVideoUrl,
    processedVideoUrl,
    patientNotes: existingPatientNotes,
    aiEvaluation: existingAiEvaluation,
    doctorFeedback,
    sessionStatus,
    treatment,
    isVideoReady,
    isLoading: isLoadingVideos,
    error: videoError,
    refetch: refetchVideos
  } = useSessionVideo(sessionId)

  const { updateSession } = usePatientSessions()

  const {
    isUploading,
    uploadProgress,
    uploadError,
    uploadedVideo,
    uploadVideo,
    reset: resetUpload
  } = useVideoUpload({
    userId: user?.id || '',
    sessionId,
    onUploadComplete: async (result) => {
      setVideoId(result.id)

      try {
        await updateSession(parseInt(sessionId), {
          previdurl: result.signedUrl || result.url || result.storagePath
        })
      } catch (error) {
        console.error('Failed to update session with video URL:', error)
      }

      setTimeout(() => refetchVideos(), 1000)
    },
    onUploadError: (error) => {
      console.error('Upload failed:', error)
      setError(error)
    }
  })

  React.useEffect(() => {
    if (existingPatientNotes && !patientNotes) {
      setPatientNotes(existingPatientNotes)
    }
    if (existingAiEvaluation && !analysisResult) {
      setAnalysisResult(existingAiEvaluation)
    }

    if ((sessionStatus === 'completed' || sessionStatus === 'feedback') && currentStep === 'idle') {
      setCurrentStep('complete')
    }
  }, [existingPatientNotes, existingAiEvaluation, sessionStatus])

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        await response.json()
      }
    } catch (error) {
      console.warn('Failed to fetch session data:', error)
    }
  }

  React.useEffect(() => {
    if (sessionId) {
      fetchSessionData()
    }
  }, [sessionId])

  React.useEffect(() => {
    if (currentStep === 'complete' && analysisResult && videoMode !== 'processed') {
      setVideoMode('processed')
      refetchVideos()
    }
  }, [currentStep, analysisResult])

  const stepLabels = {
    idle: 'Ready to analyze',
    uploading: 'Uploading your video',
    processing_pose: 'Detecting pose landmarks with MediaPipe',
    extracting_keyframes: 'Extracting key frames for analysis',
    claude_analysis: 'AI analyzing movement patterns and health insights',
    complete: 'Analysis complete'
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file)
      setVideoId('')
      setAnalysisResult(null)
      setError(null)
      setCurrentStep('idle')
      setStepProgress(0)
    }
  }

  const simulateStep = (step: ProcessingStep, duration: number) => {
    return new Promise<void>((resolve) => {
      const interval = 50
      const increment = 100 / (duration / interval)
      let progress = 0
      let currentProgress = 0
      
      const timer = setInterval(() => {
        progress += increment
        const newProgress = Math.min(progress, 100)
        
        // Only update if progress actually changed
        if (Math.floor(newProgress) !== Math.floor(currentProgress)) {
          currentProgress = newProgress
          setStepProgress(currentProgress)
        }
        
        if (progress >= 100) {
          clearInterval(timer)
          setStepProgress(100)
          resolve()
        }
      }, interval)
    })
  }

  const startAnalysis = async () => {
    if (!selectedFile) {
      return
    }

    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setError(null)
    setAnalysisResult(null)
    setKeyFrames([])

    try {
      try {
        const healthResponse = await fetch('http://localhost:8001/api/health')
        if (!healthResponse.ok) {
          throw new Error('Backend is not responding')
        }
        await healthResponse.json()
      } catch (healthError) {
        throw new Error('Backend is not running. Please start the backend server.')
      }

      setCurrentStep('uploading')
      setStepProgress(0)

      let currentVideoId: string
      let uploadResult: any

      try {
        uploadResult = await uploadVideo(selectedFile)
        currentVideoId = uploadResult.id
        setVideoId(currentVideoId)

        if (uploadResult.rotation !== undefined) {
          setVideoRotation(uploadResult.rotation)
        }
      } catch (uploadError) {
        throw new Error(`Upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`)
      }

      if (!currentVideoId) {
        throw new Error('Upload completed but no video ID received')
      }

      let attempts = 0
      while (!uploadedVideo && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }

      try {
        const videoUrl = uploadResult.url || uploadResult.signedUrl || uploadedVideo?.url

        const updateResponse = await fetch(`/api/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previdurl: videoUrl
          })
        })

        if (updateResponse.ok) {
          await updateResponse.json()
          refetchVideos()
        }
      } catch (dbError) {
        console.warn('Database error linking original video to session:', dbError)
      }

      setCurrentStep('processing_pose')
      setStepProgress(0)

      const processingPayload = {
        video_id: currentVideoId,
        video_url: uploadResult?.url || uploadResult?.signedUrl || uploadedVideo?.url,
        storage_path: uploadResult?.storagePath || uploadedVideo?.storagePath,
        session_id: sessionId,
        rotation: uploadResult?.rotation || videoRotation || 0
      }

      const processResponse = await fetch(`http://localhost:8001/api/process-supabase-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processingPayload)
      })

      if (!processResponse.ok) {
        const errorText = await processResponse.text()
        throw new Error(`Pose processing failed: ${processResponse.status} - ${errorText}`)
      }

      await processResponse.json()

      let processingComplete = false
      let pollAttempts = 0
      let processedVideoUrl = null
      const maxPollAttempts = 30

      while (!processingComplete && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        pollAttempts++

        try {
          const statusResponse = await fetch(`http://localhost:8001/api/status/${currentVideoId}`)
          if (statusResponse.ok) {
            const status = await statusResponse.json()

            if (status.status === 'completed') {
              processingComplete = true
              processedVideoUrl = status.processed_video_url
            } else if (status.status === 'error' || status.status === 'failed') {
              throw new Error(`Processing failed: ${status.message}`)
            }

            setStepProgress(Math.min((pollAttempts / maxPollAttempts) * 100, 90))
          }
        } catch (statusError) {
          console.warn('Status check failed:', statusError)
        }
      }

      if (!processingComplete) {
        throw new Error('Pose processing timed out after 30 seconds')
      }

      if (processedVideoUrl) {
        try {
          await fetch(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postvidurl: processedVideoUrl
            })
          })
        } catch (dbError) {
          console.warn('Database error linking processed video to session:', dbError)
        }
      }

      setStepProgress(100)

      setCurrentStep('extracting_keyframes')
      setStepProgress(0)

      await simulateStep('extracting_keyframes', 2000)

      setCurrentStep('claude_analysis')
      setStepProgress(0)

      const analysisResponse = await fetch(`http://localhost:8001/api/two-stage-analysis/${currentVideoId}`, {
        method: 'POST',
      })

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        throw new Error(`AI analysis failed: ${analysisResponse.status} - ${errorText}`)
      }

      const result = await analysisResponse.json()
      setAnalysisResult(result)

      if (result.key_frames) {
        setKeyFrames(result.key_frames)
      }

      try {
        const structuredAnalysis = result?.analysis?.analysis || result?.analysis || result;

        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ai_evaluation: structuredAnalysis
          })
        })
      } catch (dbError) {
        console.warn('Database error saving analysis results:', dbError)
      }

      setStepProgress(100)
      setCurrentStep('complete')

    } catch (error) {
      console.error('Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
      setCurrentStep('idle')
      setStepProgress(0)
    }
  }

  const resetAnalysis = async () => {
    try {
      if ((originalVideoUrl || processedVideoUrl) && user?.id) {
        const deleteResponse = await fetch('/api/delete-session-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: user.id
          })
        })

        if (deleteResponse.ok) {
          await deleteResponse.json()
          setTimeout(() => refetchVideos(), 500)
        }
      }

      setSelectedFile(null)
      setVideoId('')
      setCurrentStep('idle')
      setStepProgress(0)
      setAnalysisResult(null)
      setError(null)
      setKeyFrames([])
      setVideoMode('original')
      setVideoRotation(0)
      resetUpload()

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error resetting analysis:', error)
      setError('Failed to reset analysis. Please refresh the page.')
    }
  }

  const getVideoUrl = () => {
    if (!videoId) return null

    switch (videoMode) {
      case 'original':
        if (originalVideoUrl) {
          return originalVideoUrl
        }
        return `http://localhost:8001/api/video/${videoId}`

      case 'processed':
        if (processedVideoUrl) {
          return processedVideoUrl
        }
        return `http://localhost:8001/api/stream/${videoId}`

      default:
        if (originalVideoUrl) {
          return originalVideoUrl
        }
        return `http://localhost:8001/api/video/${videoId}`
    }
  }

  const getStepColor = (step: ProcessingStep) => {
    switch (step) {
      case 'uploading': return '#3b82f6'
      case 'processing_pose': return '#f59e0b'
      case 'extracting_keyframes': return '#8b5cf6'
      case 'claude_analysis': return '#06b6d4'
      case 'complete': return '#0d4a2b'
      default: return '#6b7280'
    }
  }

  const getVideoRotationStyle = (rotation: number, isProcessedVideo: boolean = false) => {
    if (rotation === 0) return {};

    if (isProcessedVideo) {
      return {};
    }

    let transform = '';
    let additionalStyles = {};

    switch (rotation) {
      case 90:
        transform = 'rotate(270deg)';
        additionalStyles = {
          transformOrigin: 'center center',
          width: '100%',
          height: '100%'
        };
        break;
      case 180:
        transform = 'rotate(180deg)';
        additionalStyles = {
          transformOrigin: 'center center'
        };
        break;
      case 270:
        transform = 'rotate(90deg)';
        additionalStyles = {
          transformOrigin: 'center center',
          width: '100%',
          height: '100%'
        };
        break;
      default:
        return {};
    }

    return {
      transform,
      ...additionalStyles
    };
  }

  const exerciseDisplayName = exerciseName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header with Back Navigation */}
        <div className="mb-8 pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">
            {exerciseDisplayName} Analysis
          </h1>
        </div>

        {/* Evaluation Exercise Information */}
        {treatment && existingPatientNotes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
              📋 Evaluation Exercise
            </div>
            <div className="font-semibold text-gray-900 mb-2 text-base">
              {treatment.name}
            </div>
            {treatment.description && (
              <div className="text-sm text-gray-600 mb-3">
                {treatment.description}
              </div>
            )}
            <div className="text-sm text-gray-700 pt-2 border-t border-blue-200">
              <strong>Your Problem:</strong> {existingPatientNotes}
            </div>
          </div>
        )}

        <div className="space-y-6">

            {!videoId && !originalVideoUrl && !processedVideoUrl && sessionStatus !== 'completed' && sessionStatus !== 'feedback' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Upload Your Exercise Video
                </h3>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    selectedFile 
                      ? 'border-green-600 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  
                  {selectedFile ? (
                    <div>
                      <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        {selectedFile.name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready for analysis
                      </p>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          startAnalysis()
                        }}
                        disabled={isUploading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start AI Analysis
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        Drop your {exerciseDisplayName.toLowerCase()} video here
                      </h4>
                      <p className="text-sm text-gray-600">
                        or click to browse • MP4, AVI, MOV supported • Max 100MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(videoId || originalVideoUrl || processedVideoUrl) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center space-x-2 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Video Analysis
                  </h3>
                  {(sessionStatus === 'completed' || sessionStatus === 'feedback') && (
                    <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                      Auto-playing
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Original Video
                  </h4>
                  <div className="bg-black rounded-lg overflow-hidden aspect-video">
                    {originalVideoUrl ? (
                      <video
                        src={originalVideoUrl}
                        controls
                        autoPlay={(sessionStatus === 'completed' || sessionStatus === 'feedback')}
                        muted={(sessionStatus === 'completed' || sessionStatus === 'feedback')}
                        loop={false}
                        className="w-full h-full object-contain"
                        style={getVideoRotationStyle(videoRotation, false)}
                        onError={(e) => {
                          console.error('Original video failed to load:', e);
                        }}
                        poster="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%23f3f4f6'%3e%3crect width='100%25' height='100%25'/%3e%3c/svg%3e"
                      />
                    ) : isLoadingVideos || isUploading ? (
                      <div style={{ 
                        width: '100%', 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <Loader2 style={{ width: '20px', height: '20px', margin: '0 auto 8px', color: '#0d4a2b' }} className="animate-spin" />
                          <p style={{ fontSize: '0.875rem', margin: 0, fontWeight: '500' }}>
                            {isUploading ? 'Uploading video...' : 'Loading video...'}
                          </p>
                          {isUploading && (
                            <>
                              <p style={{ fontSize: '0.75rem', margin: '4px 0 0 0', color: '#6b7280' }}>
                                {uploadProgress}% complete
                              </p>
                              <div style={{
                                width: '120px',
                                height: '3px',
                                backgroundColor: '#e5e7eb',
                                borderRadius: '2px',
                                marginTop: '6px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${uploadProgress}%`,
                                  height: '100%',
                                  backgroundColor: '#0d4a2b',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '0.875rem', margin: 0 }}>Upload video to begin</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Pose Analysis
                  </h4>
                  <div className="bg-black rounded-lg overflow-hidden aspect-video">
                    {processedVideoUrl ? (
                    <video
                        src={processedVideoUrl}
                      controls
                      autoPlay={(sessionStatus === 'completed' || sessionStatus === 'feedback')}
                      muted={(sessionStatus === 'completed' || sessionStatus === 'feedback')}
                      loop={false}
                      className="w-full h-full object-contain"
                      style={getVideoRotationStyle(videoRotation, true)}
                        onError={(e) => {
                          console.error('Processed video failed to load:', e);
                      }}
                      poster="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%23000'%3e%3crect width='100%25' height='100%25'/%3e%3c/svg%3e"
                    />
                    ) : currentStep === 'complete' ? (
                      <div style={{ 
                        width: '100%', 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '0.875rem', margin: 0 }}>Processing complete, video not available</p>
                        </div>
                      </div>
                    ) : currentStep === 'idle' ? (
                      <div style={{ 
                        width: '100%', 
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '0.875rem', margin: 0 }}>Pose analysis will appear here</p>
                        </div>
                      </div>
                  ) : (
                    <div style={{ 
                      width: '100%', 
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        flexDirection: 'column',
                        gap: '6px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                          <Loader2 style={{ width: '18px', height: '18px', margin: '0 auto 6px', color: '#8b5cf6' }} className="animate-spin" />
                          <p style={{ fontSize: '0.875rem', margin: 0, fontWeight: '500', color: '#374151' }}>
                            {currentStep === 'processing_pose' ? 'Analyzing pose...' :
                             currentStep === 'extracting_keyframes' ? 'Extracting frames...' :
                             currentStep === 'claude_analysis' ? 'AI processing...' :
                             'Generating analysis...'}
                          </p>
                          {stepProgress > 0 && (
                            <div style={{
                              width: '100px',
                              height: '2px',
                              backgroundColor: '#e5e7eb',
                              borderRadius: '1px',
                              marginTop: '6px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${stepProgress}%`,
                                height: '100%',
                                backgroundColor: '#8b5cf6',
                                borderRadius: '1px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    onClick={resetAnalysis}
                    variant="outline"
                    size="sm"
                    className="text-sm"
                  >
                    Upload New Video
                  </Button>
                  {currentStep === 'complete' && videoId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-sm"
                      asChild
                    >
                      <a href={`http://localhost:8001/api/download/${videoId}`} download>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

          {(videoId || originalVideoUrl || processedVideoUrl || sessionStatus === 'completed' || sessionStatus === 'feedback') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Analysis Progress
              </h3>

                <div style={{ marginBottom: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                    gap: '6px',
                    marginBottom: '4px'
                }}>
                    {isUploading ? (
                      <Loader2 style={{ width: '12px', height: '12px', color: getStepColor(currentStep) }} className="animate-spin" />
                  ) : currentStep === 'complete' ? (
                      <CheckCircle2 style={{ width: '12px', height: '12px', color: '#0d4a2b' }} />
                    ) : currentStep !== 'idle' ? (
                      <Loader2 style={{ width: '12px', height: '12px', color: getStepColor(currentStep) }} className="animate-spin" />
                  ) : (
                      <Activity style={{ width: '12px', height: '12px', color: 'hsl(var(--muted-foreground))' }} />
                  )}
                  <span style={{ 
                      fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: currentStep === 'complete' ? '#0d4a2b' : 'hsl(var(--foreground))'
                  }}>
                    {stepLabels[currentStep]}
                  </span>
                </div>

                  {currentStep !== 'idle' && (
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '2px'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                          Overall Progress
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                          {(() => {
                            const steps = Object.keys(stepLabels);
                            const currentIndex = steps.indexOf(currentStep);
                            const totalSteps = steps.length - 1;
                            const progressPercent = currentStep === 'complete' ? 100 : Math.round((currentIndex / totalSteps) * 100);
                            return `${progressPercent}%`;
                          })()}
                        </span>
                      </div>
                  <div style={{ 
                    width: '100%', 
                    backgroundColor: 'hsl(var(--accent))', 
                        borderRadius: '3px', 
                        height: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                          height: '4px',
                          backgroundColor: currentStep === 'complete' ? '#0d4a2b' : getStepColor(currentStep),
                          borderRadius: '3px',
                          width: (() => {
                            const steps = Object.keys(stepLabels);
                            const currentIndex = steps.indexOf(currentStep);
                            const totalSteps = steps.length - 1;
                            return currentStep === 'complete' ? '100%' : `${Math.round((currentIndex / totalSteps) * 100)}%`;
                          })(),
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  {isUploading && (
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '2px'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                          Upload Progress
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                          {uploadProgress}%
                        </span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        backgroundColor: 'hsl(var(--accent))', 
                        borderRadius: '3px', 
                        height: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          height: '4px',
                      backgroundColor: getStepColor(currentStep),
                          borderRadius: '3px',
                          width: `${uploadProgress}%`,
                      transition: 'width 0.3s ease'
                    }} />
                      </div>
                  </div>
                )}
              </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.entries(stepLabels).map(([step, label]) => {
                  const isActive = currentStep === step
                  const isCompleted = step === 'complete' && currentStep === 'complete'
                  const stepIndex = Object.keys(stepLabels).indexOf(step)
                  const currentIndex = Object.keys(stepLabels).indexOf(currentStep)
                  const isPast = stepIndex < currentIndex
                  
                  return (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ 
                          width: '8px', 
                          height: '8px', 
                        borderRadius: '50%',
                        backgroundColor: isCompleted || isPast ? '#0d4a2b' : isActive ? getStepColor(step as ProcessingStep) : '#e5e7eb'
                      }} />
                      <span style={{ 
                          fontSize: '0.875rem',
                        color: isCompleted || isPast ? '#0d4a2b' : isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                        fontWeight: isActive ? '600' : '400'
                      }}>
                        {label}
                      </span>
                    </div>
                  )
                })}
            </div>

                {currentStep === 'complete' && (
              <div style={{ 
                    padding: '6px',
                    backgroundColor: 'rgba(13, 74, 43, 0.05)',
                    borderRadius: '3px',
                    fontSize: '0.875rem',
                    color: '#0d4a2b',
                    textAlign: 'center',
                    fontWeight: '500',
                    marginTop: '8px'
                  }}>
                    Analysis sent to your doctor for review
              </div>
            )}
              </div>

              {sessionStatus === 'feedback' && doctorFeedback && doctorFeedback.trim() && (
                <div className="bg-white rounded-xl border-2 border-green-600 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center space-x-2">
                    <span>🩺</span>
                    <span>Feedback from Your Doctor</span>
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {doctorFeedback}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 italic">
                    This feedback is based on your analysis and will help guide your recovery.
                  </p>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Notes for Your Doctor
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add any symptoms or observations.
                </p>
                
                <textarea
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Describe any pain or observations..."
                  className="w-full min-h-[60px] p-3 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-vertical mb-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      if (!patientNotes.trim()) return
                      
                      setIsSubmittingNotes(true)
                      try {
                        const response = await fetch(`/api/sessions/${sessionId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            patient_notes: patientNotes
                          })
                        })

                        if (response.ok) {
                          toast({
                            title: "Success",
                            description: "Notes saved successfully!",
                            variant: "success",
                          })
                        } else {
                          throw new Error('Failed to save notes')
                        }
                      } catch (error) {
                        console.error('Failed to save notes:', error)
                        toast({
                          title: "Error",
                          description: "Failed to save notes. Please try again.",
                          variant: "destructive",
                        })
                      } finally {
                        setIsSubmittingNotes(false)
                      }
                    }}
                    disabled={!patientNotes.trim() || isSubmittingNotes}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    {isSubmittingNotes ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  )
} 