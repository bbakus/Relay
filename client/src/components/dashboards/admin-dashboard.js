import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../../utils/apiConfig'
import { useAuth } from '../../context/AuthContext'
import { formatDateForHeader, formatTime12Hour } from '../../utils/dateUtils'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import '../../styles/admin-dashboard.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

export const AdminDashboardView = () => {
  const { user, selectedOrganizationId, selectedProjectId, selectedDate, selectedCompanyId } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isCompanySwitching, setIsCompanySwitching] = useState(false)
  
  // Data states
  const [projects, setProjects] = useState([])
  const [events, setEvents] = useState([])
  const [shotRequests, setShotRequests] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [images, setImages] = useState([])
  const [users, setUsers] = useState([])
  const [accessRequests, setAccessRequests] = useState([])
  const [deliveredTab, setDeliveredTab] = useState('events') // 'events' or 'shotRequests'
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [selectedStaffForAssignment, setSelectedStaffForAssignment] = useState(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showShotRequestForm, setShowShotRequestForm] = useState(false)
  
  // Form states for creating new events and shot requests
  const [eventForm, setEventForm] = useState({
    name: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    description: '',
    process_point: 'idle'
  })
  
  const [shotRequestForm, setShotRequestForm] = useState({
    request: '',
    description: '',
    process_point: 'idle'
  })

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {


      try {
        setLoading(true)
        // Filter personnel by selected company (for Super Admin) or user's company
        let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
        if (selectedCompanyId) {
          personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
        } else if (user?.company_id) {
          personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
        }
        
        // Build events URL with company filtering
        let eventsUrl = `${API_CONFIG.baseUrl}/api/events`
        if (selectedCompanyId) {
          eventsUrl = `${API_CONFIG.baseUrl}/api/events?company_id=${selectedCompanyId}`
        } else if (user?.company_id) {
          eventsUrl = `${API_CONFIG.baseUrl}/api/events?company_id=${user.company_id}`
        }
        
        const [projectsRes, eventsRes, shotRequestsRes, personnelRes, imagesRes, usersRes, accessRequestsRes] = await Promise.all([
          fetch(`${API_CONFIG.baseUrl}/api/projects`),
          fetch(eventsUrl),
          fetch(`${API_CONFIG.baseUrl}/api/shot-requests`),
          fetch(personnelUrl),
          fetch(`${API_CONFIG.baseUrl}/api/images`),
          fetch(`${API_CONFIG.baseUrl}/api/users`),
          fetch(`${API_CONFIG.baseUrl}/api/access-requests`)
        ])

        const projectsData = projectsRes.ok ? await projectsRes.json() : []
        const eventsData = eventsRes.ok ? await eventsRes.json() : []
        const shotRequestsData = shotRequestsRes.ok ? await shotRequestsRes.json() : []
        const personnelData = personnelRes.ok ? await personnelRes.json() : []
        const imagesData = imagesRes.ok ? await imagesRes.json() : []
        const usersData = usersRes.ok ? await usersRes.json() : []
        const accessRequestsData = accessRequestsRes.ok ? await accessRequestsRes.json() : []

        setProjects(projectsData)
        setEvents(eventsData)
        setShotRequests(shotRequestsData)
        setPersonnel(personnelData)
        setImages(imagesData)
        setUsers(usersData)
        setAccessRequests(accessRequestsData)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
        setIsCompanySwitching(false)
      }
    }

    fetchData()
  }, [user?.is_super_admin, selectedCompanyId, user?.company_id])

  // Clear data immediately when company changes (for super admin)
  useEffect(() => {
    if (user?.is_super_admin) {
      if (selectedCompanyId) {
        // Clear data immediately when switching companies, then fetch new data
        setIsCompanySwitching(true)
        setProjects([])
        setEvents([])
        setShotRequests([])
        setPersonnel([])
        setImages([])
        setUsers([])
        setLoading(true)
      }
    }
  }, [selectedCompanyId, user?.is_super_admin])



  // Filter projects by selected organization
  const filteredProjects = useMemo(() => {
    if (!selectedOrganizationId) return projects
    return projects.filter(p => p.organization_id === parseInt(selectedOrganizationId))
  }, [projects, selectedOrganizationId])

  // Filter data by selected project
  const projectEvents = useMemo(() => {
    if (!selectedProjectId) return events
    return events.filter(e => e.project_id === parseInt(selectedProjectId))
  }, [events, selectedProjectId])

  // Filter events by selected date
  const dateFilteredEvents = useMemo(() => {
    if (!selectedDate) return projectEvents
    return projectEvents.filter(e => e.date === selectedDate)
  }, [projectEvents, selectedDate])

  const projectShotRequests = useMemo(() => {
    if (!selectedProjectId) return shotRequests
    return shotRequests.filter(sr => {
      // Shot requests have an events array, not a single event_id
      return sr.events && sr.events.some(event => 
        event.project_id === parseInt(selectedProjectId)
      )
    })
  }, [shotRequests, selectedProjectId])

  // Filter delivered shot requests for selected date (or today if no date selected)
  const deliveredShotRequests = useMemo(() => {
    const targetDate = selectedDate || new Date().toISOString().split('T')[0]
    
    return projectShotRequests.filter(sr => {
      // Check if shot request is delivered
      if (sr.process_point !== 'delivered') return false
      
      // Check if any of the associated events is on the target date
      return sr.events && sr.events.some(event => {
        const eventDate = new Date(event.date)
        const eventDateStr = eventDate.toISOString().split('T')[0]
        return eventDateStr === targetDate
      })
    })
  }, [projectShotRequests, selectedDate])

  // Note: Auto-selection is now handled by the global navigation context

  // Add real-time tick for live data
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeTick(Date.now())
    }, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])
  
  // Date parsing utilities
  const parseDateLocal = (dateStr) => {
    if (!dateStr) return null
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  
  const parseDateTimeLocal = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hour, minute] = timeStr.split(':').map(Number)
    return new Date(year, month - 1, day, hour, minute)
  }
  
  const getEventStatus = (event) => {
    void currentTimeTick // Force recalculation
    if (!event.date || !event.start_time || !event.end_time) return 'scheduled'
    const now = new Date()
    const eventDate = parseDateLocal(event.date)
    const startTime = parseDateTimeLocal(event.date, event.start_time)
    const endTime = parseDateTimeLocal(event.date, event.end_time)
    
    if (!eventDate || !startTime || !endTime) return 'scheduled'
    
    const isToday = now.toDateString() === eventDate.toDateString()
    
    if (!isToday) {
      if (now < startTime) return 'scheduled'
      if (now > endTime) return 'done'
    }
    
    if (isToday) {
      const timeUntilStart = startTime - now
      const timeUntilEnd = endTime - now
      
      if (timeUntilStart > 0) {
        if (timeUntilStart <= 15 * 60 * 1000) return 'starting-soon'
        if (timeUntilStart <= 60 * 60 * 1000) return 'upcoming'
        return 'scheduled'
      } else if (timeUntilEnd > 0) {
        return 'ongoing'
      } else {
        return 'done'
      }
    }
    
    return 'scheduled'
  }

  // Dashboard calculations with proper process point order
  const eventStatusStats = useMemo(() => {
    const processPointOrder = ['idle', 'ingest', 'cull', 'color', 'delivered']
    const stats = {}
    
    // Initialize in proper order
    processPointOrder.forEach(point => {
      stats[point] = 0
    })
    
    // ALWAYS use global date filter - no fallback to all events
    const eventsToCount = selectedDate 
      ? projectEvents.filter(e => e.date === selectedDate)
      : []
    
    eventsToCount.forEach(event => {
      const point = event.process_point || 'idle'
      stats[point] = (stats[point] || 0) + 1
    })
    
    return stats
  }, [projectEvents, selectedDate])

  const shotRequestStats = useMemo(() => {
    const processPointOrder = ['idle', 'ingest', 'cull', 'color', 'delivered']
    const stats = {}
    
    // Initialize in proper order
    processPointOrder.forEach(point => {
      stats[point] = 0
    })
    
    // ALWAYS use global date filter - only show shot requests for selected date
    const dateFilteredShotRequests = shotRequests.filter(sr => {
      // Shot requests have an events array, not a single event_id
      const hasProjectEvent = sr.events && sr.events.some(event => 
        event.project_id === parseInt(selectedProjectId)
      )
      
      if (!hasProjectEvent) return false
      
      // If global date is selected, only include shot requests with events on that date
      if (selectedDate) {
        return sr.events && sr.events.some(event => 
          event.project_id === parseInt(selectedProjectId) && event.date === selectedDate
        )
      }
      
      return hasProjectEvent
    })
    
    dateFilteredShotRequests.forEach(sr => {
      const point = sr.process_point || 'idle'
      stats[point] = (stats[point] || 0) + 1
    })
    
    return stats
  }, [shotRequests, selectedProjectId, selectedDate])

  const deliveredEvents = useMemo(() => {
    const eventsToFilter = selectedDate 
      ? projectEvents.filter(e => e.date === selectedDate)
      : []
    return eventsToFilter.filter(e => e.process_point === 'delivered')
  }, [projectEvents, selectedDate])
  
  const inProcessEvents = useMemo(() => {
    const eventsToFilter = selectedDate 
      ? projectEvents.filter(e => e.date === selectedDate)
      : []
    return eventsToFilter.filter(e => ['ingest', 'cull', 'color'].includes(e.process_point))
  }, [projectEvents, selectedDate])

  const projectCompletion = useMemo(() => {
    void currentTimeTick // Force recalculation for real-time status
    
    // ALWAYS use global date filter
    const dateFilteredEvents = selectedDate 
      ? projectEvents.filter(e => e.date === selectedDate)
      : []
    
    const total = dateFilteredEvents.length
    if (total === 0) return { delivered: 0, occurred: 0 }
    
    const delivered = dateFilteredEvents.filter(e => e.process_point === 'delivered').length
    
    // Count events that are actually "done" (completed) based on real-time status
    const occurred = dateFilteredEvents.filter(event => {
      const status = getEventStatus(event)
      return status === 'done'
    }).length
    
    return {
      delivered: Math.round((delivered / total) * 100),
      occurred: Math.round((occurred / total) * 100)
    }
  }, [projectEvents, selectedDate, currentTimeTick, getEventStatus])

  // Staff load calculations - live availability
  const staffLoad = useMemo(() => {
    // ONLY show data when a global date is explicitly selected
    if (!selectedDate) {
      return { 
        loadPercentage: 0, 
        totalStaff: 0, 
        assignedStaff: 0,
        freeStaff: 0,
        staffStatus: []
      }
    }
    
    void currentTimeTick // Force recalculation
    
    const photoVideoStaff = personnel.filter(p => 
      ['Photographer', 'Videographer', 'Admin'].includes(p.role)
    )

    const staffStatus = []
    const assignedStaffCount = { assigned: 0, free: 0 }
    
    photoVideoStaff.forEach(staff => {
      // Get events this staff is assigned to from their event_ids array
      const assignedEventIds = staff.event_ids || []
      
      // Filter to get events that this staff is assigned to - use projectEvents like working panels
      let assignedEvents = projectEvents.filter(e => assignedEventIds.includes(e.id))
      
      // Only consider events on the selected date
      assignedEvents = assignedEvents.filter(e => e.date === selectedDate)
      
      // Check if any of their assigned events are currently ongoing
      const currentlyActiveEvent = assignedEvents.find(event => {
        const status = getEventStatus(event)
        return status === 'ongoing'
      })
      
      const isAssigned = !!currentlyActiveEvent
      
      staffStatus.push({
        name: staff.name,
        role: staff.role,
        isAssigned,
        activeEvent: currentlyActiveEvent?.name || null
      })
      
      if (isAssigned) {
        assignedStaffCount.assigned++
      } else {
        assignedStaffCount.free++
      }
    })

    const totalStaff = photoVideoStaff.length
    const loadPercentage = totalStaff > 0 ? Math.round((assignedStaffCount.assigned / totalStaff) * 100) : 0

    return { 
      loadPercentage, 
      totalStaff, 
      assignedStaff: assignedStaffCount.assigned,
      freeStaff: assignedStaffCount.free,
      staffStatus: staffStatus.sort((a, b) => {
        // Show free staff first, then assigned staff
        if (!a.isAssigned && b.isAssigned) return -1
        if (a.isAssigned && !b.isAssigned) return 1
        return a.name.localeCompare(b.name)
      })
    }
  }, [projectEvents, personnel, currentTimeTick, getEventStatus, selectedDate])
  
  // Client downloads calculation
  const clientDownloads = useMemo(() => {
    const projectImages = images.filter(img => {
      const event = events.find(e => e.id === img.event_id)
      const shotRequest = shotRequests.find(sr => sr.id === img.requests_id)
      return (event && event.project_id === parseInt(selectedProjectId)) ||
             (shotRequest && events.find(e => e.id === shotRequest.event_id)?.project_id === parseInt(selectedProjectId))
    })
    
    const totalImages = projectImages.length
    const favoritedImages = projectImages.filter(img => img.favorite).length
    
    const percentage = totalImages > 0 ? Math.round((favoritedImages / totalImages) * 100) : 0
    
    return { percentage, totalImages, favoritedImages }
  }, [images, events, shotRequests, selectedProjectId])
  
  // Exhaustion level calculation
  const exhaustionLevel = useMemo(() => {
    const photoVideoStaff = personnel.filter(p => 
      ['Photographer', 'Videographer', 'Admin'].includes(p.role)
    )
    
    // ALWAYS use global date filter for staff assignments
    const dateFilteredEvents = selectedDate 
      ? projectEvents.filter(e => e.date === selectedDate)
      : []
    
    const staffAssignmentCounts = {}
    
    photoVideoStaff.forEach(staff => {
      // Count assignments to project events only (filtered by date)
      const assignedEventIds = staff.event_ids || []
      const projectAssignments = assignedEventIds.filter(eventId => 
        dateFilteredEvents.some(e => e.id === eventId)
      )
      staffAssignmentCounts[staff.name] = projectAssignments.length
    })
    
    const topStaff = Object.entries(staffAssignmentCounts)
      .sort(([,a], [,b]) => b - a)[0]
    
    if (!topStaff) return { name: 'No staff', percentage: 0, assignments: 0 }
    
    const [name, assignments] = topStaff
    const maxPossible = dateFilteredEvents.length // Theoretical max if one person did everything
    const percentage = maxPossible > 0 ? Math.round((assignments / maxPossible) * 100) : 0
    
    return { name, percentage: Math.min(percentage, 100), assignments }
  }, [personnel, projectEvents, selectedDate])
  
  // Image count for delivered events
  const deliveredEventImages = useMemo(() => {
    const deliveredEventsWithImages = deliveredEvents.map(event => {
      const eventImages = images.filter(img => img.event_id === event.id)
      return {
        ...event,
        imageCount: eventImages.length
      }
    }).sort((a, b) => b.imageCount - a.imageCount)
    
    return deliveredEventsWithImages
  }, [deliveredEvents, images])
  
  // Live/Ongoing Events - events that are currently happening
  const liveEvents = useMemo(() => {
    void currentTimeTick // Force recalculation for real-time status
    return projectEvents.filter(event => {
      const status = getEventStatus(event)
      return status === 'ongoing'
    }).sort((a, b) => {
      // Sort by start time (earliest ongoing first)
      if (!a.start_time || !b.start_time) return 0
      return a.start_time.localeCompare(b.start_time)
    })
  }, [projectEvents, currentTimeTick, getEventStatus])
  
  // Helper function to create hourly distribution for selected date (6am - 11pm)
  const createHourlyDistribution = (events, targetDate) => {
    const hours = []
    const eventCounts = []
    
    // Create hour labels from 6am to 11pm (6-23)
    for (let hour = 6; hour <= 23; hour++) {
      const hourLabel = hour === 12 ? '12pm' : 
                       hour < 12 ? `${hour}am` : 
                       `${hour - 12}pm`
      hours.push(hourLabel)
      
      // Count events starting in this hour on the target date
      const eventsInHour = events.filter(event => {
        // Normalize both dates to YYYY-MM-DD format for comparison
        const eventDate = event.date ? event.date.split('T')[0] : null
        const normalizedTargetDate = targetDate ? targetDate.split('T')[0] : null
        
        if (eventDate !== normalizedTargetDate) return false
        if (!event.start_time) return false
        
        const eventHour = parseInt(event.start_time.split(':')[0])
        return eventHour === hour
      }).length
      
      eventCounts.push(eventsInHour)
    }
    
    return {
      labels: hours,
      data: eventCounts
    }
  }

  // Event distribution for selected date by hour
  const eventDistribution = useMemo(() => {
    // ONLY show data when a global date is explicitly selected
    if (!selectedDate) {
      return { labels: [], data: [] }
    }
    
    // Use projectEvents like the working panels do - this ensures proper filtering
    return createHourlyDistribution(projectEvents, selectedDate)
  }, [projectEvents, selectedDate])

  if (loading) {
    return (
      <div className="dashboard-view">
        <div className="loading">Loading dashboard...</div>
      </div>
    )
  }

  // Show company selection message for super admin when no company is selected
  if (user?.is_super_admin && !selectedCompanyId) {
    return (
      <div className="dashboard-view">
        <div className="company-selection-message">
          <h2>Select a Company</h2>
          <p>Please select a company from the dropdown above to view dashboard data.</p>
        </div>
      </div>
    )
  }

  // For super admin, only show loading message when actually loading or switching companies
  if (user?.is_super_admin && selectedCompanyId && (loading || isCompanySwitching)) {
    return (
      <div className="dashboard-view">
        <div className="company-selection-message">
          <h2>Loading Company Data</h2>
          <p>Fetching data for the selected company...</p>
        </div>
      </div>
    )
  }

  // Helper function to get process point color
  const getProcessPointColor = (processPoint) => {
    switch(processPoint) {
      case 'idle': return 'rgba(0, 255, 255, 0.9)'
      case 'ingest': return 'rgba(0, 128, 255, 0.9)'
      case 'cull': return 'rgba(255, 122, 24, 0.9)'
      case 'color': return 'rgba(255, 64, 64, 0.9)'
      case 'delivered': return 'rgba(0, 190, 90, 0.9)'
      default: return 'rgba(0, 255, 255, 0.9)'
    }
  }

  // Chart configurations with proper colors
  const eventStatusChartData = {
    labels: Object.keys(eventStatusStats),
    datasets: [{
      label: 'Events by Status',
      data: Object.values(eventStatusStats),
      backgroundColor: Object.keys(eventStatusStats).map(point => getProcessPointColor(point)),
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  }

  const shotRequestChartData = {
    labels: Object.keys(shotRequestStats),
    datasets: [{
      label: 'Shot Requests by Status',
      data: Object.values(shotRequestStats),
      backgroundColor: Object.keys(shotRequestStats).map(point => getProcessPointColor(point)),
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  }
  
  const eventDistributionChartData = {
    labels: eventDistribution.labels,
    datasets: [{
      label: 'Events Today by Hour',
      data: eventDistribution.data,
      borderColor: 'rgba(255, 122, 24, 0.9)',
      backgroundColor: 'rgba(255, 122, 24, 0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: 'rgba(255, 122, 24, 0.9)',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      pointRadius: 3
    }]
  }
  
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { 
          color: '#ffffff',
          stepSize: 1
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      x: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // Remove the legend
      }
    },
    scales: {
      y: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      x: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  }

  // Helper functions for staff assignment and event creation
  const handleAssignStaffToEvent = async (staffId, eventIds) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: eventIds })
      })
      
      if (response.ok) {
        // Refresh personnel data to update the UI
        const personnelRes = await fetch(`${API_CONFIG.baseUrl}/api/personnel`)
        if (personnelRes.ok) {
          const personnelData = await personnelRes.json()
          setPersonnel(personnelData)
        }
      }
    } catch (error) {
      console.error('Error assigning staff to event:', error)
    }
  }

  const handleCreateEvent = async (eventData) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          project_id: selectedProjectId,
          organization_id: selectedOrganizationId
        })
      })
      
      if (response.ok) {
        const newEvent = await response.json()
        setEvents(prev => [...prev, newEvent])
        setShowEventForm(false)
        setEventForm({
          name: '',
          date: '',
          start_time: '',
          end_time: '',
          location: '',
          description: '',
          process_point: 'idle'
        })
      }
    } catch (error) {
      console.error('Error creating event:', error)
    }
  }

  const handleCreateShotRequest = async (shotRequestData) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shotRequestData,
          project_id: selectedProjectId,
          organization_id: selectedOrganizationId
        })
      })
      
      if (response.ok) {
        const newShotRequest = await response.json()
        setShotRequests(prev => [...prev, newShotRequest])
        setShowShotRequestForm(false)
        setShotRequestForm({
          request: '',
          description: '',
          process_point: 'idle'
        })
      }
    } catch (error) {
      console.error('Error creating shot request:', error)
    }
  }

  const resetEventForm = () => {
    setEventForm({
      name: '',
      date: '',
      start_time: '',
      end_time: '',
      location: '',
      description: '',
      process_point: 'idle'
    })
  }

  const resetShotRequestForm = () => {
    setShotRequestForm({
      request: '',
      description: '',
      process_point: 'idle'
    })
  }

  return (
    <div className="dashboard-view">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        {accessRequests.length > 0 && (
          <div 
            className="access-request-notification clickable"
            onClick={() => navigate(`/${user?.id}/settings`)}
            title="Click to view access requests"
          >
            <span className="notification-badge">{accessRequests.length}</span>
            <span className="notification-text">Pending Access Request{accessRequests.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Dashboard grid */}
      <div className="dashboard-grid">
        {/* Event Status Stats */}
        <div className="dashboard-card">
          <h3>Event Status</h3>
          <div className="chart-container">
            {Object.keys(eventStatusStats).length > 0 ? (
              <Bar data={eventStatusChartData} options={chartOptions} />
            ) : (
              <p className="no-data">No events found</p>
            )}
          </div>
        </div>
        
        {/* Event Distribution Timeline */}
        <div className="dashboard-card admin-event-distribution">
                          <h3>{selectedDate ? `Event Distribution for ${formatDateForHeader(selectedDate)}` : "Today's Event Distribution"}</h3>
          <div className="chart-container">
            {eventDistribution.labels.length > 0 ? (
              <Line data={eventDistributionChartData} options={lineChartOptions} />
            ) : (
                              <p className="no-data">No events scheduled for {selectedDate ? formatDateForHeader(selectedDate) : 'today'}</p>
            )}
          </div>
        </div>

        {/* Combined Delivered Today Section with Tabs */}
        <div className="dashboard-card">
          <div className="delivered-tabs-header">
            <h3>Delivered Today</h3>
            <div className="delivered-tabs">
              <button 
                className={`delivered-tab ${deliveredTab === 'events' ? 'active' : ''}`}
                onClick={() => setDeliveredTab('events')}
              >
                Events ({deliveredEvents.length})
              </button>
              <button 
                className={`delivered-tab ${deliveredTab === 'shotRequests' ? 'active' : ''}`}
                onClick={() => setDeliveredTab('shotRequests')}
              >
                Shot Requests ({deliveredShotRequests.length})
              </button>
            </div>
          </div>
          
          <div className="delivered-tab-content">
            {deliveredTab === 'events' ? (
              // Events Tab
              <div className="admin-events-list">
                {deliveredEvents.length > 0 ? (
                  deliveredEvents.slice(0, 8).map(event => (
                    <div key={event.id} className="admin-event-item delivered">
                      <div className="delivered-indicator">✓</div>
                      <span className="admin-event-name">{event.name}</span>
                      <span className="admin-event-date">{formatDateForHeader(event.date)}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No delivered events for {selectedDate ? formatDateForHeader(selectedDate) : 'today'}</p>
                )}
                {deliveredEvents.length > 8 && (
                  <p className="more-events">+{deliveredEvents.length - 8} more events</p>
                )}
              </div>
            ) : (
              // Shot Requests Tab
              <div className="shot-requests-list">
                {deliveredShotRequests.length > 0 ? (
                  deliveredShotRequests.slice(0, 8).map(sr => {
                    // Get the first event from the events array
                    const event = sr.events && sr.events.length > 0 ? sr.events[0] : null
                    return (
                      <div key={sr.id} className="shot-request-item">
                        <div className="shot-request-info">
                          <span className="shot-request-name">{sr.request}</span>
                          <span className="shot-request-event">{event?.name || 'Unknown Event'}</span>
                        </div>
                        <span 
                          className="shot-request-process-point delivered"
                          style={{ color: '#22c55e' }}
                        >
                          delivered
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="no-data">No delivered shot requests for {selectedDate ? formatDateForHeader(selectedDate) : 'today'}</p>
                )}
                {deliveredShotRequests.length > 8 && (
                  <p className="more-events">+{deliveredShotRequests.length - 8} more delivered</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Project Progress - 4 Circles */}
        <div className="dashboard-card project-progress">
          <h3>Project Progress</h3>
          <div className="progress-circles">
            <div className="progress-circle-item">
              <div className="progress-circle">
                <svg width="160" height="160" className="progress-ring">
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(0, 190, 90, 0.9)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 65}`}
                    strokeDashoffset={`${2 * Math.PI * 65 * (1 - projectCompletion.delivered / 100)}`}
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="progress-circle-content">
                  <span className="progress-circle-percent">{projectCompletion.delivered}%</span>
                  <span className="progress-circle-label">Delivered</span>
                </div>
              </div>
            </div>
            
            <div className="progress-circle-item">
              <div className="progress-circle">
                <svg width="160" height="160" className="progress-ring">
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(33, 150, 243, 0.9)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 65}`}
                    strokeDashoffset={`${2 * Math.PI * 65 * (1 - projectCompletion.occurred / 100)}`}
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="progress-circle-content">
                  <span className="progress-circle-percent">{projectCompletion.occurred}%</span>
                  <span className="progress-circle-label">Occurred</span>
                </div>
              </div>
            </div>
            
            <div className="progress-circle-item">
              <div className="progress-circle">
                <svg width="160" height="160" className="progress-ring">
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(233, 30, 99, 0.9)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 65}`}
                    strokeDashoffset={`${2 * Math.PI * 65 * (1 - clientDownloads.percentage / 100)}`}
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="progress-circle-content">
                  <span className="progress-circle-percent">{clientDownloads.percentage}%</span>
                  <span className="progress-circle-label">Favorites</span>
                </div>
              </div>
            </div>
            
            <div className="progress-circle-item">
              <div className="progress-circle">
                <svg width="160" height="160" className="progress-ring">
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(255, 193, 7, 0.9)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 65}`}
                    strokeDashoffset={`${2 * Math.PI * 65 * (1 - exhaustionLevel.percentage / 100)}`}
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="progress-circle-content">
                  <span className="progress-circle-percent">{exhaustionLevel.percentage}%</span>
                  <span className="progress-circle-label">Exhaustion</span>
                </div>
              </div>
            </div>
          </div>
          <div className="progress-details">
            <div className="detail-item">
              <span className="detail-label">Client Favorites:</span>
              <span className="detail-value">{clientDownloads.favoritedImages} of {clientDownloads.totalImages} images</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Most Assigned:</span>
              <span className="detail-value">{exhaustionLevel.name} ({exhaustionLevel.assignments} events)</span>
            </div>
          </div>
        </div>

        {/* Staff Load - Live Availability */}
        <div className="dashboard-card">
          <h3>Staff Availability (Live)</h3>
          <div className="staff-load">
            <div className="load-summary">
              <div className="load-circle">
                <span className="load-percent">{staffLoad.loadPercentage}%</span>
                <span className="load-label">Busy</span>
              </div>
              <div className="load-details">
                <p>{staffLoad.assignedStaff} busy, {staffLoad.freeStaff} free</p>
                <p className="load-subtitle">({staffLoad.totalStaff} total photo/video staff)</p>
              </div>
            </div>
            
            <div className="staff-list">
              <h4>Current Status:</h4>
              {staffLoad.staffStatus.length > 0 ? (
                staffLoad.staffStatus.map((staff) => (
                  <div 
                    key={staff.name} 
                    className={`staff-row ${staff.isAssigned ? 'assigned' : 'free'} clickable`}
                    onClick={() => {
                      setSelectedStaffForAssignment(staff)
                      setAssignmentModalOpen(true)
                    }}
                    title="Click to assign to events"
                  >
                    <div className="staff-info">
                      <span className="staff-name">{staff.name}</span>
                      <span className="staff-role">({staff.role})</span>
                    </div>
                    <div className="staff-status">
                      {staff.isAssigned ? (
                        <>
                          <span className="status-indicator busy">BUSY</span>
                          <span className="active-event">{staff.activeEvent}</span>
                        </>
                      ) : (
                        <span className="status-indicator free">FREE</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">No photo/video staff found</p>
              )}
            </div>
          </div>
        </div>

        {/* In Process Events */}
        <div className="dashboard-card">
          <h3>In Process Events ({inProcessEvents.length})</h3>
          <div className="admin-events-list">
            {inProcessEvents.length > 0 ? (
              inProcessEvents.slice(0, 8).map(event => (
                <div key={event.id} className="admin-event-item in-process">
                  <span className="admin-event-name">{event.name}</span>
                  <span 
                    className="admin-event-process-point"
                    style={{ color: getProcessPointColor(event.process_point) }}
                  >
                    {event.process_point}
                  </span>
                </div>
              ))
            ) : (
              <p className="no-data">No events in process</p>
            )}
            {inProcessEvents.length > 8 && (
              <p className="more-events">+{inProcessEvents.length - 8} more events</p>
            )}
          </div>
        </div>

        {/* Live Events - Currently Ongoing */}
        <div className="dashboard-card">
          <h3>Live Events ({liveEvents.length})</h3>
          <div className="admin-events-list">
            {liveEvents.length > 0 ? (
              liveEvents.slice(0, 8).map(event => (
                <div key={event.id} className="admin-event-item live">
                  <div className="live-indicator">●</div>
                  <span className="admin-event-name">{event.name}</span>
                  <span className="admin-event-time">
                    {event.start_time ? `${event.start_time} - ${event.end_time}` : 'No time specified'}
                  </span>
                  <span className="admin-event-location">{event.location || 'No location'}</span>
                </div>
              ))
            ) : (
              <p className="no-data">No live events currently</p>
            )}
            {liveEvents.length > 8 && (
              <p className="more-events">+{liveEvents.length - 8} more live events</p>
            )}
          </div>
        </div>
        
        {/* Image Count for Delivered Events */}
        <div className="dashboard-card">
          <h3>Delivered Event Images</h3>
          <div className="admin-image-counts-list">
            {deliveredEventImages.length > 0 ? (
              deliveredEventImages.slice(0, 8).map(event => (
                <div key={event.id} className="admin-image-count-item">
                  <div className="admin-event-info">
                    <span className="admin-event-name">{event.name}</span>
                  </div>
                  <div className="admin-image-count">
                    <span className="count-number">{event.imageCount}</span>
                    <span className="count-label">images</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">No delivered events with images</p>
            )}
            {deliveredEventImages.length > 8 && (
              <p className="more-events">+{deliveredEventImages.length - 8} more events</p>
            )}
          </div>
        </div>
      </div>

      {/* Staff Assignment Modal */}
      {assignmentModalOpen && selectedStaffForAssignment && (
        <div className="staff-assignment-modal-overlay" onClick={() => {
          setAssignmentModalOpen(false)
          setSelectedStaffForAssignment(null)
        }}>
          <div className="staff-assignment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-assignment-modal-header">
              <h3>Assign {selectedStaffForAssignment.name} to Events</h3>
              <button 
                className="staff-assignment-modal-close"
                onClick={() => {
                  setAssignmentModalOpen(false)
                  setSelectedStaffForAssignment(null)
                }}
              >
                ×
              </button>
            </div>
            
            <div className="staff-assignment-modal-body">
              {/* Create New Event/Shot Request Section */}
              <div className="creation-section">
                <h4>Create New</h4>
                <div className="creation-buttons">
                  <button 
                    className="creation-btn event-btn"
                    onClick={() => setShowEventForm(true)}
                  >
                    + New Event
                  </button>
                  <button 
                    className="creation-btn shot-request-btn"
                    onClick={() => setShowShotRequestForm(true)}
                  >
                    + New Shot Request
                  </button>
                </div>
              </div>

              {/* Event Creation Form */}
              {showEventForm && (
                <div className="event-creation-form">
                  <h4>Create New Event</h4>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Event Name:</label>
                      <input
                        type="text"
                        value={eventForm.name}
                        onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter event name"
                      />
                    </div>
                    <div className="form-field">
                      <label>Date:</label>
                      <input
                        type="date"
                        value={eventForm.date}
                        onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div className="form-field">
                      <label>Start Time:</label>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                    </div>
                    <div className="form-field">
                      <label>End Time:</label>
                      <input
                        type="time"
                        value={eventForm.end_time}
                        onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                    </div>
                    <div className="form-field">
                      <label>Location:</label>
                      <input
                        type="text"
                        value={eventForm.location}
                        onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Enter location"
                      />
                    </div>
                    <div className="form-field">
                      <label>Description:</label>
                      <textarea
                        value={eventForm.description}
                        onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter description"
                        rows="3"
                      />
                    </div>
                    <div className="form-field">
                      <label>Process Point:</label>
                      <select
                        value={eventForm.process_point}
                        onChange={(e) => setEventForm(prev => ({ ...prev, process_point: e.target.value }))}
                      >
                        <option value="idle">Idle</option>
                        <option value="ingest">Ingest</option>
                        <option value="cull">Cull</option>
                        <option value="color">Color</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button 
                      className="form-btn primary"
                      onClick={() => handleCreateEvent(eventForm)}
                    >
                      Create Event
                    </button>
                    <button 
                      className="form-btn secondary"
                      onClick={() => {
                        setShowEventForm(false)
                        resetEventForm()
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Shot Request Creation Form */}
              {showShotRequestForm && (
                <div className="shot-request-creation-form">
                  <h4>Create New Shot Request</h4>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Request:</label>
                      <input
                        type="text"
                        value={shotRequestForm.request}
                        onChange={(e) => setShotRequestForm(prev => ({ ...prev, request: e.target.value }))}
                        placeholder="Enter shot request"
                      />
                    </div>
                    <div className="form-field">
                      <label>Description:</label>
                      <textarea
                        value={shotRequestForm.description}
                        onChange={(e) => setShotRequestForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter description"
                        rows="3"
                      />
                    </div>
                    <div className="form-field">
                      <label>Process Point:</label>
                      <select
                        value={shotRequestForm.process_point}
                        onChange={(e) => setShotRequestForm(prev => ({ ...prev, process_point: e.target.value }))}
                      >
                        <option value="idle">Idle</option>
                        <option value="ingest">Ingest</option>
                        <option value="cull">Cull</option>
                        <option value="color">Color</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button 
                      className="form-btn primary"
                      onClick={() => handleCreateShotRequest(shotRequestForm)}
                    >
                      Create Shot Request
                    </button>
                    <button 
                      className="form-btn secondary"
                      onClick={() => {
                        setShowShotRequestForm(false)
                        resetShotRequestForm()
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Event Assignment Section */}
              <div className="assignment-section">
                <h4>Assign to Existing Events</h4>
                <div className="available-events-list">
                  {(() => {
                    // Filter events that are not 'done' and show them for assignment
                    const availableEvents = projectEvents.filter(event => {
                      const status = getEventStatus(event)
                      return status !== 'done'
                    }).sort((a, b) => {
                      // Sort by date, then by start time
                      if (a.date !== b.date) return a.date.localeCompare(b.date)
                      if (!a.start_time || !b.start_time) return 0
                      return a.start_time.localeCompare(b.start_time)
                    })

                    if (availableEvents.length === 0) {
                      return <div className="no-data">No events available for assignment</div>
                    }

                    return availableEvents.map(event => {
                      const isAssigned = (selectedStaffForAssignment.event_ids || []).includes(event.id)
                      const status = getEventStatus(event)
                      const color = getProcessPointColor(status)
                      
                      return (
                        <label key={event.id} className={`event-assignment-item status-${status}`}>
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              const currentEventIds = selectedStaffForAssignment.event_ids || []
                              const newEventIds = e.target.checked
                                ? [...currentEventIds, event.id]
                                : currentEventIds.filter(id => id !== event.id)
                              
                              handleAssignStaffToEvent(selectedStaffForAssignment.id, newEventIds)
                              
                              // Update the selected staff state to reflect changes immediately
                              setSelectedStaffForAssignment(prev => ({
                                ...prev,
                                event_ids: newEventIds
                              }))
                            }}
                          />
                          <div className="event-assignment-info">
                            <div className="event-assignment-name">{event.name}</div>
                            <div className="event-assignment-meta">
                              {event.date} • {event.start_time ? (
                                <span className="event-time">
                                  {formatTime12Hour(event.start_time)}-{formatTime12Hour(event.end_time)}
                                </span>
                              ) : 'No time'}
                              {event.location ? ` • ${event.location}` : ''}
                            </div>
                            <span className="event-assignment-status">
                              {status}
                            </span>
                          </div>
                        </label>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
            
            <div className="staff-assignment-modal-footer">
              <button 
                className="staff-assignment-modal-done"
                onClick={() => {
                  setAssignmentModalOpen(false)
                  setSelectedStaffForAssignment(null)
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



