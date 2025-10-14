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
  const [expandedCards, setExpandedCards] = useState(new Set())
  const [selectedUnassignedEvent, setSelectedUnassignedEvent] = useState(null)
  const [showUnassignedEventModal, setShowUnassignedEventModal] = useState(false)
  
  // Toggle card expansion
  const toggleCardExpansion = (cardId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return newSet
    })
  }
  
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
      
      // If global date is selected, include shot requests that either:
      // 1. Have events on that date in the selected project, OR
      // 2. Have no events (independent shot requests)
      if (selectedDate) {
        const hasEventOnSelectedDate = sr.events && sr.events.some(event => 
          event.project_id === parseInt(selectedProjectId) && event.date === selectedDate
        )
        const isIndependent = !sr.events || sr.events.length === 0
        return hasEventOnSelectedDate || isIndependent
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
  
  // Photographer hours calculation
  const photographerHours = useMemo(() => {
    // Filter photographers by role AND project assignment
    const photoVideoStaff = personnel.filter(p => {
      const hasRole = ['Photographer', 'Lead Photographer', 'Videographer'].includes(p.role)
      
      // If no project selected, show all photographers
      if (!selectedProjectId) return hasRole
      
      // Only include photographers assigned to the selected project
      const isAssignedToProject = p.project_ids && p.project_ids.includes(parseInt(selectedProjectId))
      return hasRole && isAssignedToProject
    })
    
    // ALWAYS use global date filter for staff assignments
    const dateFilteredEvents = selectedDate 
      ? projectEvents.filter(e => e.date === selectedDate)
      : []
    
    const staffHours = {}
    const currentTime = new Date()
    const currentHour = currentTime.getHours()
    const currentMinute = currentTime.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinute
    
    photoVideoStaff.forEach(staff => {
      // Check if staff is assigned through BOTH old event_ids AND new assigned_personnel
      // to prevent double-counting
      const assignedEventIds = new Set()
      
      // Get events from assigned_personnel (new method)
      dateFilteredEvents.forEach(event => {
        if (event.assigned_personnel && Array.isArray(event.assigned_personnel)) {
          const isAssigned = event.assigned_personnel.some(p => p.personnel_id === staff.id)
          if (isAssigned) {
            assignedEventIds.add(event.id)
          }
        }
      })
      
      // Get unique events by ID
      const assignedEvents = Array.from(assignedEventIds)
        .map(eventId => dateFilteredEvents.find(e => e.id === eventId))
        .filter(Boolean)
      
      let scheduledHours = 0
      let workedHours = 0
      
      console.log(`${staff.name}: Processing ${assignedEvents.length} unique events for ${selectedDate}`)
      
      assignedEvents.forEach(event => {
        if (event.start_time && event.end_time) {
          const [startHour, startMinute] = event.start_time.split(':').map(Number)
          const [endHour, endMinute] = event.end_time.split(':').map(Number)
          
          // Validate time values
          if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            console.warn(`Invalid time data for event ${event.id}: ${event.start_time} - ${event.end_time}`)
            return
          }
          
          const startTimeInMinutes = startHour * 60 + startMinute
          let endTimeInMinutes = endHour * 60 + endMinute
          
          // Handle events that span midnight (end time is earlier than start time)
          if (endTimeInMinutes < startTimeInMinutes) {
            endTimeInMinutes += 24 * 60 // Add 24 hours
          }
          
          const eventDurationHours = (endTimeInMinutes - startTimeInMinutes) / 60
          
          // Only add positive durations
          if (eventDurationHours > 0) {
            scheduledHours += eventDurationHours
            
            // Calculate worked hours (events that have already ended)
            if (currentTimeInMinutes >= endTimeInMinutes) {
              workedHours += eventDurationHours
            } else if (currentTimeInMinutes >= startTimeInMinutes) {
              // Event is currently happening, calculate partial hours worked
              const partialWorkedHours = (currentTimeInMinutes - startTimeInMinutes) / 60
              workedHours += Math.max(0, partialWorkedHours) // Ensure non-negative
            }
          } else {
            console.warn(`Invalid duration for event ${event.id}: ${eventDurationHours} hours`)
          }
        }
      })
      
      // Ensure worked hours never exceeds scheduled hours
      const finalWorkedHours = Math.min(workedHours, scheduledHours)
      
      staffHours[staff.name] = {
        scheduled: Math.round(scheduledHours * 10) / 10, // Round to 1 decimal
        worked: Math.round(Math.max(0, finalWorkedHours) * 10) / 10, // Ensure non-negative
        exhausted: scheduledHours >= 8
      }
    })
    
    return staffHours
  }, [personnel, projectEvents, selectedDate, selectedProjectId])

  // Available photographers calculation - real-time
  const availablePhotographers = useMemo(() => {
    // Filter photographers by role AND project assignment
    const photoVideoStaff = personnel.filter(p => {
      const hasRole = ['Photographer', 'Lead Photographer', 'Videographer'].includes(p.role)
      
      // If no project selected, show all photographers
      if (!selectedProjectId) return hasRole
      
      // Only include photographers assigned to the selected project
      const isAssignedToProject = p.project_ids && p.project_ids.includes(parseInt(selectedProjectId))
      return hasRole && isAssignedToProject
    })
    
    const currentTime = new Date()
    const currentDate = currentTime.toISOString().split('T')[0] // YYYY-MM-DD format
    const currentHour = currentTime.getHours()
    const currentMinute = currentTime.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinute
    
    const availableStaff = photoVideoStaff.filter(staff => {
      const assignedEventIds = staff.event_ids || []
      
      // Check ALL events (not just project events) for today
      const todayEvents = events.filter(e => e.date === currentDate)
      const assignedEvents = assignedEventIds
        .map(eventId => todayEvents.find(e => e.id === eventId))
        .filter(Boolean)
      
      // Check if photographer is currently in an event
      const isCurrentlyBusy = assignedEvents.some(event => {
        if (event.start_time && event.end_time) {
          const [startHour, startMinute] = event.start_time.split(':').map(Number)
          const [endHour, endMinute] = event.end_time.split(':').map(Number)
          const startTimeInMinutes = startHour * 60 + startMinute
          const endTimeInMinutes = endHour * 60 + endMinute
          
          return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes
        }
        return false
      })
      
      return !isCurrentlyBusy
    })
    
    return availableStaff
  }, [personnel, events, selectedProjectId])
  
  // Unassigned Events - events with no personnel assigned, filtered by global date
  const unassignedEvents = useMemo(() => {
    // Filter by selected project first
    const projectFilteredEvents = selectedProjectId 
      ? events.filter(e => e.project_id === parseInt(selectedProjectId))
      : events
    
    // Filter by selected date if available, otherwise show future events
    const dateFilteredEvents = selectedDate
      ? projectFilteredEvents.filter(event => event.date === selectedDate)
      : projectFilteredEvents.filter(event => {
          // Filter out invalid/corrupted events
          if (!event.id || !event.name || !event.date) return false
          
          const eventDate = new Date(event.date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          return eventDate >= today // Only show future events (including today)
        })
    
    const unassigned = dateFilteredEvents.filter(event => {
      // Check if event has any assigned personnel
      const hasAssignedPersonnel = event.assigned_personnel && 
                                  Array.isArray(event.assigned_personnel) && 
                                  event.assigned_personnel.length > 0
      return !hasAssignedPersonnel
    }).sort((a, b) => {
      // Sort by date (soonest first)
      return new Date(a.date) - new Date(b.date)
    })
    
    return unassigned
  }, [events, selectedProjectId, selectedDate])
  
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

  // Helper function to format time to 12-hour format
  const formatTimeTo12Hour = (time24) => {
    if (!time24) return ''
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Helper function to calculate days until event
  const getDaysUntilEvent = (eventDate) => {
    const today = new Date()
    const event = new Date(eventDate)
    const timeDiff = event.getTime() - today.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
    return daysDiff
  }

  // Helper function to open assignment modal for an event
  const openAssignmentModal = (event) => {
    // For now, we'll create a basic staff assignment for the event
    // This could be expanded to show available staff for the event
    const eventStaff = {
      id: 'event-' + event.id,
      name: `Staff for ${event.name}`,
      event_ids: [event.id]
    }
    setSelectedStaffForAssignment(eventStaff)
    setAssignmentModalOpen(true)
  }

  // Handler for deleting an unassigned event
  const handleDeleteUnassignedEvent = async (eventId) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove the event from local state
        setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId))
        setShowUnassignedEventModal(false)
        setSelectedUnassignedEvent(null)
      } else {
        console.log('Failed to delete event')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      console.log('Error deleting event')
    }
  }

  // Handler for editing an unassigned event - navigate to schedule
  const handleEditUnassignedEvent = (event) => {
    // Close modal and navigate to Schedule with the event
    setShowUnassignedEventModal(false)
    navigate('/schedule', { state: { editEvent: event } })
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
      case 'null': return 'rgba(75, 85, 99, 0.3)'
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
                  deliveredEvents.map(event => {
                    const isExpanded = expandedCards.has(`delivered-${event.id}`)
                    return (
                      <div key={event.id} className="admin-event-item delivered">
                        <div className="admin-event-header" onClick={() => toggleCardExpansion(`delivered-${event.id}`)}>
                          <div className="delivered-indicator">✓</div>
                          <span className="admin-event-name">{event.name}</span>
                          <span className="admin-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                        {isExpanded && (
                          <div className="admin-event-details">
                            <div className="admin-event-detail-row">
                              <span className="admin-event-detail-label">Date:</span>
                              <span className="admin-event-detail-value">{formatDateForHeader(event.date)}</span>
                            </div>
                            {event.start_time && event.end_time && (
                              <div className="admin-event-detail-row">
                                <span className="admin-event-detail-label">Time:</span>
                                <span className="admin-event-detail-value">{event.start_time} - {event.end_time}</span>
                              </div>
                            )}
                            {event.location && (
                              <div className="admin-event-detail-row">
                                <span className="admin-event-detail-label">Location:</span>
                                <span className="admin-event-detail-value">{event.location}</span>
                              </div>
                            )}
                            {event.notes && (
                              <div className="admin-event-detail-row">
                                <span className="admin-event-detail-label">Notes:</span>
                                <span className="admin-event-detail-value">{event.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className="no-data">No delivered events for {selectedDate ? formatDateForHeader(selectedDate) : 'today'}</p>
                )}
              </div>
            ) : (
              // Shot Requests Tab
              <div className="shot-requests-list">
                {deliveredShotRequests.length > 0 ? (
                  deliveredShotRequests.map(sr => {
                    // Get the first event from the events array
                    const event = sr.events && sr.events.length > 0 ? sr.events[0] : null
                    return (
                      <div key={sr.id} className="shot-request-item">
                        <div className="shot-request-info">
                          <span className="shot-request-name">{sr.request}</span>
                          <span className="shot-request-event">
                            {event?.name || 'Independent Shot Request'}
                          </span>
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
            
            <div className="progress-circle-item available-photographers-item">
              <div className="available-photographers-mini">
                <div className="available-photographers-title">Available Now</div>
                <div className="available-photographers-list">
                  {availablePhotographers.length === 0 ? (
                    <div className="no-available-mini">All busy</div>
                  ) : (
                    availablePhotographers.slice(0, 4).map((photographer) => (
                      <div key={photographer.id} className="available-photographer-item">
                        <div className="photographer-name-mini">{photographer.name}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Photographer Hours */}
        <div className="dashboard-card">
          <h3>Photographer Hours Detail</h3>
          <div className="photographer-hours-container">
            {Object.entries(photographerHours).length === 0 ? (
              <div className="no-photographers">No photographers assigned for this date</div>
            ) : (
              Object.entries(photographerHours)
                .sort(([,a], [,b]) => b.scheduled - a.scheduled)
                .map(([name, hours]) => (
                  <div key={name} className={`photographer-hours-item ${hours.exhausted ? 'exhausted' : ''}`}>
                    <div className="photographer-name">{name}</div>
                    <div className="hours-details">
                      <div className="hours-bar">
                        <div 
                          className="hours-fill" 
                          style={{ 
                            width: `${Math.min((hours.scheduled / 8) * 100, 100)}%`,
                            backgroundColor: hours.exhausted ? '#dc3545' : '#28a745'
                          }}
                        />
                      </div>
                      <div className="hours-text">
                        <span className="scheduled-hours">{hours.scheduled}h scheduled</span>
                        <span className="worked-hours">{hours.worked}h worked</span>
                        {hours.exhausted && <span className="exhausted-badge">EXHAUSTED</span>}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>


        {/* In Process Events */}
        <div className="dashboard-card">
          <h3>In Process Events ({inProcessEvents.length})</h3>
          <div className="admin-events-list">
            {inProcessEvents.length > 0 ? (
              inProcessEvents.map(event => {
                const isExpanded = expandedCards.has(`inprocess-${event.id}`)
                return (
                  <div key={event.id} className="admin-event-item in-process">
                    <div className="admin-event-header" onClick={() => toggleCardExpansion(`inprocess-${event.id}`)}>
                      <span className="admin-event-name">{event.name}</span>
                      <span className="admin-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                    {isExpanded && (
                      <div className="admin-event-details">
                        <div className="admin-event-detail-row">
                          <span className="admin-event-detail-label">Process Point:</span>
                          <span 
                            className="admin-event-detail-value"
                            style={{ color: getProcessPointColor(event.process_point) }}
                          >
                            {event.process_point}
                          </span>
                        </div>
                        <div className="admin-event-detail-row">
                          <span className="admin-event-detail-label">Date:</span>
                          <span className="admin-event-detail-value">{formatDateForHeader(event.date)}</span>
                        </div>
                        {event.start_time && event.end_time && (
                          <div className="admin-event-detail-row">
                            <span className="admin-event-detail-label">Time:</span>
                            <span className="admin-event-detail-value">{event.start_time} - {event.end_time}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="admin-event-detail-row">
                            <span className="admin-event-detail-label">Location:</span>
                            <span className="admin-event-detail-value">{event.location}</span>
                          </div>
                        )}
                        {event.notes && (
                          <div className="admin-event-detail-row">
                            <span className="admin-event-detail-label">Notes:</span>
                            <span className="admin-event-detail-value">{event.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="no-data">No events in process</p>
            )}
          </div>
        </div>

        {/* Live Events - Currently Ongoing */}
        <div className="dashboard-card">
          <h3>Live Events ({liveEvents.length})</h3>
          <div className="admin-events-list">
            {liveEvents.length > 0 ? (
              liveEvents.map(event => {
                const isExpanded = expandedCards.has(`live-${event.id}`)
                return (
                  <div key={event.id} className="admin-event-item live">
                    <div className="admin-event-header" onClick={() => toggleCardExpansion(`live-${event.id}`)}>
                      <div className="live-indicator">●</div>
                      <span className="admin-event-name">{event.name}</span>
                      <span className="admin-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                    {isExpanded && (
                      <div className="admin-event-details">
                        <div className="admin-event-detail-row">
                          <span className="admin-event-detail-label">Time:</span>
                          <span className="admin-event-detail-value">
                            {event.start_time ? `${event.start_time} - ${event.end_time}` : 'No time specified'}
                          </span>
                        </div>
                        <div className="admin-event-detail-row">
                          <span className="admin-event-detail-label">Location:</span>
                          <span className="admin-event-detail-value">{event.location || 'No location'}</span>
                        </div>
                        {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                          <div className="admin-event-detail-row">
                            <span className="admin-event-detail-label">Assigned Photographers:</span>
                            <span className="admin-event-detail-value">
                              {event.assigned_personnel
                                .filter(person => 
                                  person.role && (
                                    person.role.toLowerCase().includes('photographer') || 
                                    person.role.toLowerCase().includes('camera') ||
                                    person.role.toLowerCase().includes('shooter') ||
                                    person.role.toLowerCase().includes('video')
                                  )
                                )
                                .map(person => person.name)
                                .join(', ') || 'No photographers assigned'}
                            </span>
                          </div>
                        )}
                        {event.notes && (
                          <div className="admin-event-detail-row">
                            <span className="admin-event-detail-label">Notes:</span>
                            <span className="admin-event-detail-value">{event.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="no-data">No live events currently</p>
            )}
          </div>
        </div>
        
        {/* Unassigned Events Alert Panel */}
        <div className="dashboard-card alert-card">
          <h3>⚠️ Unassigned Events Alert</h3>
          <div className="admin-unassigned-events-list">
            {unassignedEvents.length > 0 ? (
              unassignedEvents.map(event => (
                <div key={event.id} className="admin-unassigned-event-item">
                  <div 
                    className="admin-event-info clickable-event-info"
                    onClick={() => {
                      setSelectedUnassignedEvent(event)
                      setShowUnassignedEventModal(true)
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Click to view event details"
                  >
                    <span className="admin-event-name">{event.name}</span>
                    <span className="admin-event-date">{formatDateForHeader(event.date)}</span>
                    <span className="admin-event-time">
                      {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                    </span>
                    {event.location && (
                      <span className="admin-event-location">{event.location}</span>
                    )}
                  </div>
                  <div className="admin-event-actions">
                    <button 
                      className="assign-staff-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAssignmentModal(event)
                      }}
                      title="Assign staff to this event"
                    >
                      Assign Staff
                    </button>
                    <span className="days-until">
                      {getDaysUntilEvent(event.date)} days
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">✅ All events have staff assigned</p>
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

      {/* Unassigned Event Details Modal */}
      {showUnassignedEventModal && selectedUnassignedEvent && (
        <div className="modal-overlay" onClick={() => setShowUnassignedEventModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedUnassignedEvent.name}</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowUnassignedEventModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="event-detail-row">
                <label>Date:</label>
                <span>{formatDateForHeader(selectedUnassignedEvent.date)}</span>
              </div>
              
              <div className="event-detail-row">
                <label>Time:</label>
                <span>
                  {formatTimeTo12Hour(selectedUnassignedEvent.start_time)} - {formatTimeTo12Hour(selectedUnassignedEvent.end_time)}
                </span>
              </div>
              
              <div className="event-detail-row">
                <label>Location:</label>
                <span>{selectedUnassignedEvent.location || 'No location specified'}</span>
              </div>
              
              {selectedUnassignedEvent.notes && (
                <div className="event-detail-row">
                  <label>Notes:</label>
                  <span>{selectedUnassignedEvent.notes}</span>
                </div>
              )}
              
              {selectedUnassignedEvent.photographer_notes && (
                <div className="event-detail-row">
                  <label>Photographer Notes:</label>
                  <span>{selectedUnassignedEvent.photographer_notes}</span>
                </div>
              )}
              
              <div className="event-detail-row">
                <label>Process Point:</label>
                <span style={{ 
                  color: getProcessPointColor(selectedUnassignedEvent.process_point),
                  fontWeight: 'bold'
                }}>
                  {selectedUnassignedEvent.process_point || 'idle'}
                </span>
              </div>
              
              <div className="event-detail-row">
                <label>Quick Turn:</label>
                <span>{selectedUnassignedEvent.quick_turn ? 'Yes' : 'No'}</span>
              </div>
              
              <div className="event-detail-row">
                <label>Days Until Event:</label>
                <span style={{ 
                  color: getDaysUntilEvent(selectedUnassignedEvent.date) <= 3 ? '#dc3545' : '#ffffff',
                  fontWeight: getDaysUntilEvent(selectedUnassignedEvent.date) <= 3 ? 'bold' : 'normal'
                }}>
                  {getDaysUntilEvent(selectedUnassignedEvent.date)} days
                </span>
              </div>
            </div>
            
            <div className="modal-footer" style={{ gap: '12px' }}>
              <button 
                className="modal-button assign-button"
                onClick={() => {
                  setShowUnassignedEventModal(false)
                  openAssignmentModal(selectedUnassignedEvent)
                }}
                style={{ 
                  background: 'linear-gradient(135deg, #28a745, #20c997)',
                  flex: 1
                }}
              >
                Assign Staff
              </button>
              <button 
                className="modal-button edit-button"
                onClick={() => handleEditUnassignedEvent(selectedUnassignedEvent)}
                style={{ flex: 1 }}
              >
                Edit Event
              </button>
              <button 
                className="modal-button delete-button"
                onClick={() => handleDeleteUnassignedEvent(selectedUnassignedEvent.id)}
              >
                Delete
              </button>
              <button 
                className="modal-button"
                onClick={() => setShowUnassignedEventModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



