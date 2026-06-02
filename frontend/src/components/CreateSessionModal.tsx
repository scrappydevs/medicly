'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Activity } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

interface Treatment {
  id: number;
  name: string;
  description?: string;
  video_link?: string;
}

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (sessionData: SessionFormData) => Promise<{ id: number; exercise?: { name: string }; treatment?: { name: string } }>;
  userId: string;
}

interface SessionFormData {
  patient_id: string;
  doctor_id?: string;
  treatment_id: string; // This will be the evaluation_metrics.id (text field)
  status: 'pending' | 'in_progress' | 'completed' | 'reviewed';
  description?: string;
}

export function CreateSessionModal({ isOpen, onClose, onCreateSession, userId }: CreateSessionModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null)
  const [aiReasoning, setAiReasoning] = useState<string>('')
  const [description, setDescription] = useState('')

  const [formData, setFormData] = useState<SessionFormData>({
    patient_id: userId,
    treatment_id: '',
    status: 'pending' // Always pending until video uploaded
  })

  // Function to analyze description and select exercise
  const analyzeAndSelectExercise = async () => {
    if (!description.trim()) {
      alert('Please describe your problem first')
      return
    }

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/ai/select-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze description')
      }

      const result = await response.json()
      console.log('🤖 AI exercise selection result:', result)

      if (result.success && result.exercise) {
        setSelectedTreatment(result.exercise)
        setAiReasoning(result.reasoning)
        setFormData(prev => ({
          ...prev,
          treatment_id: result.exercise.id,
          description: description.trim()
        }))
      } else {
        throw new Error(result.error || 'Failed to select exercise')
      }
    } catch (error) {
      console.error('❌ AI analysis failed:', error)
      alert('Failed to analyze your description. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDescription('')
      setSelectedTreatment(null)
      setAiReasoning('')
      setFormData({
        patient_id: userId,
        treatment_id: '',
        status: 'pending'
      })
    }
  }, [isOpen, userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTreatment) {
      alert('Please analyze your description first to select an exercise')
      return
    }

    try {
      setIsSubmitting(true)
      const createdSession = await onCreateSession(formData)

      // Reset form and close modal
      setDescription('')
      setSelectedTreatment(null)
      setAiReasoning('')
      setFormData({
        patient_id: userId,
        treatment_id: '',
        status: 'pending'
      })
      onClose()

      // Redirect to the session page with the exercise name
      const exerciseName = (createdSession.exercise?.name || createdSession.treatment?.name || 'exercise').toLowerCase().replace(/\s+/g, '_')
      router.push(`/dashboard/patient/session/${createdSession.id}/${exerciseName}`)
    } catch (error) {
      console.error('Failed to create session:', error)
      alert('Failed to create session. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'hsl(var(--background))',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '900px', // Increased from 600px (1.5x)
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '36px', // Increased from 24px (1.5x)
          borderBottom: '1px solid hsl(var(--border))'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem', // Further reduced to prevent overflow
              fontWeight: 'bold',
              color: 'hsl(var(--foreground))',
              margin: '0 0 4px 0'
            }}>
              Describe Your Problem
            </h2>
            <p style={{
              fontSize: '0.875rem', // Further reduced to prevent overflow
              color: 'hsl(var(--muted-foreground))',
              margin: '0'
            }}>
              Our AI will recommend the best exercise for you
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '12px', // Increased from 8px (1.5x)
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))'
            }}
          >
            <X style={{ width: '30px', height: '30px' }} /> {/* Increased from 20px (1.5x) */}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '36px' }}> {/* Increased from 24px (1.5x) */}
          {/* Problem Description */}
          <div style={{ marginBottom: '36px' }}> {/* Increased from 24px (1.5x) */}
            <label style={{
              display: 'block',
              fontSize: '0.875rem', // Further reduced to prevent overflow
              fontWeight: '600',
              color: 'hsl(var(--foreground))',
              marginBottom: '8px'
            }}>
              <Activity style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} /> {/* Further reduced to prevent overflow */}
              Describe your problem or pain *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: I have pain in my right shoulder when lifting my arm above my head, or my lower back feels stiff in the mornings..."
              rows={4} // Reduced to prevent overflow
              style={{
                width: '100%',
                padding: '12px', // Reduced to prevent overflow
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px', // Reduced to prevent overflow
                backgroundColor: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.875rem', // Reduced to prevent overflow
                resize: 'vertical',
                minHeight: '100px' // Reduced to prevent overflow
              }}
              disabled={isAnalyzing || isSubmitting}
            />
            <div style={{
              marginTop: '12px', // Increased from 8px (1.5x)
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '0.75rem', // Reduced to prevent overflow
                color: 'hsl(var(--muted-foreground))'
              }}>
                Be specific about location, type of pain, and when it occurs
              </div>
              <Button
                type="button"
                onClick={analyzeAndSelectExercise}
                disabled={!description.trim() || isAnalyzing || isSubmitting}
                style={{
                  backgroundColor: isAnalyzing ? 'hsl(var(--secondary))' : 'hsl(var(--primary))',
                  color: isAnalyzing ? 'hsl(var(--secondary-foreground))' : 'hsl(var(--primary-foreground))',
                  padding: '8px 16px', // Reduced to prevent overflow
                  fontSize: '0.875rem' // Reduced to prevent overflow
                }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze & Select Exercise'}
              </Button>
            </div>
          </div>

          {/* AI Selected Exercise Summary */}
          {selectedTreatment && (
            <div style={{
              padding: '24px', // Increased from 16px (1.5x)
              backgroundColor: 'hsl(var(--accent))',
              borderRadius: '12px', // Increased from 8px (1.5x)
              marginBottom: '36px', // Increased from 24px (1.5x)
              border: '1px solid hsl(var(--border))'
            }}>
              <div style={{
                fontSize: '0.75rem', // Reduced to prevent overflow
                fontWeight: '600',
                color: 'hsl(var(--primary))',
                marginBottom: '8px', // Reduced to prevent overflow
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                📋 Evaluation Exercise
              </div>
              <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1.125rem' }}> {/* Reduced to prevent overflow */}
                {selectedTreatment.name}
              </div>
              {selectedTreatment.description && (
                <div style={{
                  fontSize: '0.875rem', // Reduced to prevent overflow
                  color: 'hsl(var(--muted-foreground))',
                  marginBottom: '8px' // Reduced to prevent overflow
                }}>
                  {selectedTreatment.description}
                </div>
              )}
              {aiReasoning && (
                <div style={{
                  fontSize: '0.875rem', // Reduced to prevent overflow
                  color: 'hsl(var(--foreground))',
                  paddingTop: '8px', // Reduced to prevent overflow
                  borderTop: '1px solid hsl(var(--border))'
                }}>
                  <strong>Why this exercise:</strong> {aiReasoning}
                </div>
              )}
            </div>
          )}


          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '18px', // Increased from 12px (1.5x)
            justifyContent: 'flex-end',
            paddingTop: '24px', // Increased from 16px (1.5x)
            borderTop: '1px solid hsl(var(--border))'
          }}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                fontSize: '0.875rem', // Reduced to prevent overflow
                padding: '8px 16px' // Reduced to prevent overflow
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedTreatment || isSubmitting || isAnalyzing}
              style={{
                backgroundColor: (!selectedTreatment || isSubmitting || isAnalyzing) ? 'hsl(var(--secondary))' : 'hsl(var(--primary))',
                color: (!selectedTreatment || isSubmitting || isAnalyzing) ? 'hsl(var(--secondary-foreground))' : 'hsl(var(--primary-foreground))',
                gap: '8px', // Reduced to prevent overflow
                fontSize: '0.875rem', // Reduced to prevent overflow
                padding: '8px 16px' // Reduced to prevent overflow
              }}
            >
              {isSubmitting ? (
                'Creating Session...'
              ) : !selectedTreatment ? (
                'Analyze Description First'
              ) : (
                <>
                  <Plus style={{ width: '16px', height: '16px' }} /> {/* Reduced to prevent overflow */}
                  Start Exercise Session
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 