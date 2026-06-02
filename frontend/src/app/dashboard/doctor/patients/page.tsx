'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Activity,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  MessageSquare,
  List,
  Search as SearchIcon,
  UserPlus
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { doctorApi } from '@/services/api'
import { PatientSearchResult } from '@/types/medical.types'
import { useRouter } from 'next/navigation'
import { PatientSearch } from '../components/PatientSearch/PatientSearch'

export default function PatientsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [patients, setPatients] = useState<PatientSearchResult[]>([])
  const [allPatients, setAllPatients] = useState<PatientSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [allPatientsLoading, setAllPatientsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'search' | 'list'>('search')

  // Load doctor's patients
  useEffect(() => {
    const loadPatients = async () => {
      if (!user?.id) return

      setLoading(true)
      setError(null)

      try {
        console.log('🔍 Loading patients for doctor:', user.id)
        const patientsData = await doctorApi.getDoctorPatients(user.id)
        console.log('📋 Patients loaded:', patientsData)
        setPatients(patientsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patients')
      } finally {
        setLoading(false)
      }
    }

    loadPatients()
  }, [user?.id])

  // Load all patients for list view
  const loadAllPatients = async () => {
    if (!user?.id) return

    setAllPatientsLoading(true)
    try {
      const response = await doctorApi.searchPatients({
        searchTerm: '', // Empty search to get all patients
        doctorId: undefined
      })
      setAllPatients(response.items || response)
    } catch (err) {
      console.error('Failed to load all patients:', err)
    } finally {
      setAllPatientsLoading(false)
    }
  }

  // Load all patients when switching to list view
  useEffect(() => {
    if (viewMode === 'list' && allPatients.length === 0) {
      loadAllPatients()
    }
  }, [viewMode])

  const handleAssignPatient = async (patient: PatientSearchResult) => {
    if (!user?.id) return

    try {
      await doctorApi.assignPatientToDoctor(user.id, patient.id)
      // Refresh both lists
      const patientsData = await doctorApi.getDoctorPatients(user.id)
      setPatients(patientsData)
      // Also refresh all patients list to update assignment status
      loadAllPatients()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign patient')
    }
  }



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Activity className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const PatientCard = ({ patient }: { patient: PatientSearchResult }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <span className="text-foreground font-semibold text-lg">
              {patient.fullName.split(' ').map((n: string) => n[0]).join('')}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{patient.fullName}</h3>
            <p className="text-sm text-gray-600">ID: {patient.caseId}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(patient.relationshipStatus)}`}>
          {getStatusIcon(patient.relationshipStatus)}
          <span className="ml-1 capitalize">{patient.relationshipStatus}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {patient.email && (
          <div className="flex items-center text-sm text-gray-600">
            <Mail className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">{patient.email}</span>
          </div>
        )}
        {patient.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="w-4 h-4 mr-2 text-gray-400" />
            <span>{patient.phone}</span>
          </div>
        )}
        {patient.age && (
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span>Age: {patient.age}</span>
          </div>
        )}
        <div className="flex items-center text-sm text-gray-600">
          <FileText className="w-4 h-4 mr-2 text-gray-400" />
          <span>Sessions: {patient.totalSessions}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
        <span>Total Sessions: {patient.totalSessions}</span>
        {patient.lastSession && (
          <span>Last session: {new Date(patient.lastSession).toLocaleDateString()}</span>
        )}
        {patient.assignedAt && (
          <span>Assigned: {new Date(patient.assignedAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => router.push(`/dashboard/doctor/patients/${patient.id}`)}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Details
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <MessageSquare className="w-4 h-4 mr-2" />
          Message
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Patient Management
          </h1>
          <p className="text-gray-600">
            Manage your patients and track their progress
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mr-4">
                <Activity className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {patients.reduce((total, p) => total + p.totalSessions, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {patients.length > 0 ? Math.round(patients.reduce((total, p) => total + p.totalSessions, 0) / patients.length) : 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-2xl font-bold text-gray-900">
                  {patients.filter(p => p.lastSession && new Date(p.lastSession) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Patient Management */}
        <div className="railway-card mb-8">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Patient Management</h2>
                  <p className="text-sm text-muted-foreground">
                    Search for patients or browse all available patients to add them to your care
                  </p>
                </div>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center space-x-2 bg-muted rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('search')}
                  className={`${viewMode === 'search' ? 'bg-background shadow-sm' : ''}`}
                >
                  <SearchIcon className="w-4 h-4 mr-2" />
                  Search
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`${viewMode === 'list' ? 'bg-background shadow-sm' : ''}`}
                >
                  <List className="w-4 h-4 mr-2" />
                  Browse All
                </Button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {viewMode === 'search' ? (
              <PatientSearch 
                onPatientSelect={(patient) => {
                  router.push(`/dashboard/doctor/patients/${patient.id}`)
                }}
                showAddButton={true}
              />
            ) : (
              <div>
                {/* All Patients List */}
                {allPatientsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading all patients...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allPatients.map((patient) => (
                      <div key={patient.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                            <span className="text-foreground font-medium text-sm">
                              {patient.fullName.split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">{patient.fullName}</h3>
                            <p className="text-sm text-muted-foreground">{patient.email}</p>
                            <p className="text-xs text-muted-foreground">Case ID: {patient.caseId}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/doctor/patients/${patient.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          
                          {!patients.find(p => p.id === patient.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignPatient(patient)}
                              className="text-primary border-border hover:bg-muted"
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {allPatients.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No patients found</h3>
                        <p className="text-muted-foreground">No patients are available in the system</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-lg mb-4">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading patients...</h3>
            <p className="text-gray-600">Please wait while we fetch your patient list</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading patients</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Current Patients Grid */}
        <div className="railway-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Your Patients</h2>
            <p className="text-sm text-muted-foreground">Patients currently under your care</p>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading your patients...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Failed to load patients</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {patients.map((patient) => (
                    <PatientCard key={patient.id} patient={patient} />
                  ))}
                </div>

                {patients.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No patients assigned</h3>
                    <p className="text-muted-foreground mb-4">
                      Use the search feature above to find and add patients to your care
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
