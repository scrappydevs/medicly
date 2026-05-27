import { useState, useCallback } from 'react'
import { PatientSearchResult, PatientSearchParams } from '@/types/medical.types'
import { doctorApi } from '@/services/api'

export function usePatientSearch() {
  const [results, setResults] = useState<PatientSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (params: PatientSearchParams) => {
    setLoading(true)
    setError(null)

    try {
      const response = await doctorApi.searchPatients(params)
      setResults(response.items)
      return response.items
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed'
      setError(errorMessage)
      setResults([])
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  const assignPatient = useCallback(async (doctorId: string, patientId: string, notes?: string) => {
    try {
      await doctorApi.assignPatientToDoctor(doctorId, patientId, notes)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign patient'
      setError(errorMessage)
      throw err
    }
  }, [])

  return {
    results,
    loading,
    error,
    search,
    clearResults,
    assignPatient
  }
}