import React, { useState, useEffect } from 'react'
import { Line, Pie, Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { API_CONFIG } from '../../utils/apiConfig'
import '../../styles/editor-dashboard.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export const EditorDashboardView = () => {
  const { user, selectedDate, selectedProjectId } = useAuth()
  const { addNotification, markAsNew, isNew, lastFetchTime, setLastFetchTime } = useNotifications()
  const [shotRequests, setShotRequests] = useState([])
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedShotRequests, setExpandedShotRequests] = useState(new Set())
  const [expandedEvents, setExpandedEvents] = useState(new Set())
  const [activePanel, setActivePanel] = useState('events') // 'events' or 'shotRequests'
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState([])
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingText, setEditingText] = useState('')

  // Real-time updates for event status
  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000) // Update every 30 seconds
    return () => clearInterval(intervalId)
  }, [])

  // Process point options for global use
  const processPoints = ['idle', 'ingest', 'cull', 'color', 'delivered']

  // Process point colors (global variables)
  const getProcessPointColor = (processPoint) => {
    switch (processPoint?.toLowerCase()) {
      case 'idle': return {
        backgroundColor: 'rgba(0, 255, 255, 0.15)',
        borderColor: 'rgba(0, 255, 255, 1)',
        chartColor: 'rgba(0, 255, 255, 0.8)'
      }
      case 'ingest': return {
        backgroundColor: 'rgba(0, 128, 255, 0.15)',
        borderColor: 'rgba(0, 128, 255, 1)',
        chartColor: 'rgba(0, 128, 255, 0.8)'
      }
      case 'cull': return {
        backgroundColor: 'rgba(255, 122, 24, 0.15)',
        borderColor: 'rgba(255, 122, 24, 1)',
        chartColor: 'rgba(255, 122, 24, 0.8)'
      }
      case 'color': return {
        backgroundColor: 'rgba(255, 64, 64, 0.15)',
        borderColor: 'rgba(255, 64, 64, 1)',
        chartColor: 'rgba(255, 64, 64, 0.8)'
      }
      case 'delivered': return {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 1)',
        chartColor: 'rgba(34, 197, 94, 0.8)'
      }
      default: return {
        backgroundColor: 'rgba(107, 114, 128, 0.15)',
        borderColor: 'rgba(107, 114, 128, 1)',
        chartColor: 'rgba(107, 114, 128, 0.8)'
      }
    }
  }

  // Get status for shot requests and events
  const getStatus = (item) => {
    if (!item.deadline) return 'no-deadline'
    
    const now = new Date()
    const deadline = new Date(item.deadline)
    
    if (item.process_point === 'delivered') return 'delivered'
    if (deadline < now) return 'overdue'
    if (item.quick_turn) return 'quick-turn'
    return 'on-track'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return '#16a34a'
      case 'overdue': return '#dc2626'
      case 'quick-turn': return '#ea580c'
      case 'on-track': return '#2563eb'
      case 'no-deadline': return '#718096'
      default: return '#718096'
    }
  }

  // Filter items by selected date
  const getFilteredItems = (items, itemType) => {
    let filteredItems = items
    
    // Filter by selected date
    if (selectedDate) {
      filteredItems = items.filter(item => {
        if (itemType === 'event') {
          return item.date === selectedDate
        } else if (itemType === 'shotRequest') {
          // For shot requests, show those that either:
          // 1. Are associated with events on the selected date, OR
          // 2. Have no events (independent shot requests)
          const hasEventOnSelectedDate = item.events && item.events.length > 0 && 
            item.events.some(event => event.date === selectedDate)
          const isIndependent = !item.events || item.events.length === 0
          return hasEventOnSelectedDate || isIndependent
        }
        return false
      })
    }
    
    // Sort by time
    if (itemType === 'event') {
      filteredItems.sort((a, b) => {
        // Sort by start_time
        if (a.start_time && b.start_time) {
          // Parse time strings (handle formats like "10:30", "10:30:00", etc.)
          const parseTime = (timeStr) => {
            const parts = timeStr.split(':').map(p => parseInt(p) || 0)
            return parts[0] * 60 + parts[1] // Convert to minutes for comparison
          }
          
          const minutesA = parseTime(a.start_time)
          const minutesB = parseTime(b.start_time)
          return minutesA - minutesB
        }
        // If no start_time, sort by name
        return a.name.localeCompare(b.name)
      })
    } else if (itemType === 'shotRequest') {
      filteredItems.sort((a, b) => {
        // Sort by deadline
        if (a.deadline && b.deadline) {
          return new Date(a.deadline) - new Date(b.deadline)
        }
        // If no deadline, sort by name
        return a.request.localeCompare(b.request)
      })
    }
    
    return filteredItems
  }

  // Date parsing functions (matching Events.js exactly)
  const parseDateLocal = (dateStr) => {
    const [year, month, day] = (dateStr || '').split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }

  const parseDateTimeLocal = (dateStr, timeStr) => {
    const [year, month, day] = (dateStr || '').split('-').map(Number)
    const [hour = 0, minute = 0, second = 0] = (timeStr || '').split(':').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day, hour, minute, second)
  }

  // Get live status for events (matching Events.js exactly)
  const getEventStatus = (event) => {
    if (!event.date || !event.start_time || !event.end_time) return 'scheduled'
    
    void currentTimeTick // Force recalculation on tick
    const now = new Date()
    const eventDate = parseDateLocal(event.date)
    const startTime = parseDateTimeLocal(event.date, event.start_time)
    const endTime = parseDateTimeLocal(event.date, event.end_time)
    
    // Debug logging
    console.log(`EVENT STATUS DEBUG for ${event.name}:`)
    console.log(`  Event date: ${event.date}, start: ${event.start_time}, end: ${event.end_time}`)
    console.log(`  Now: ${now.toISOString()}`)
    console.log(`  Event date: ${eventDate?.toISOString()}`)
    console.log(`  Start time: ${startTime?.toISOString()}`)
    console.log(`  End time: ${endTime?.toISOString()}`)
    
    const isToday = now.toDateString() === eventDate.toDateString()
    console.log(`  Is today: ${isToday}`)
    
    if (!isToday) {
      if (now < startTime) return 'scheduled'
      if (now > endTime) return 'done'
    }
    
    if (isToday) {
      const timeUntilStart = startTime - now
      const timeUntilEnd = endTime - now
      
      console.log(`  Time until start: ${timeUntilStart}ms (${Math.round(timeUntilStart / 60000)} minutes)`)
      console.log(`  Time until end: ${timeUntilEnd}ms (${Math.round(timeUntilEnd / 60000)} minutes)`)
      
      if (timeUntilStart > 0) {
        if (timeUntilStart <= 15 * 60 * 1000) return 'starting-soon' // 15 minutes
        if (timeUntilStart <= 60 * 60 * 1000) return 'upcoming' // 1 hour
        return 'scheduled'
      }
      
      if (timeUntilEnd > 0) {
        console.log(`  RETURNING: ongoing`)
        return 'ongoing'
      }
      return 'done'
    }
    
    return 'scheduled'
  }

  // Get live status color for events (matching Events.js)
  const getLiveStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#007bff'
      case 'upcoming': return '#fd7e14'
      case 'starting-soon': return '#dc3545'
      case 'ongoing': return '#28a745'
      case 'done': return '#6c757d'
      default: return '#007bff'
    }
  }

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

    // Detect new items and send notifications (only for truly new items)
    useEffect(() => {
        // Only run this after initial data load
        if (lastFetchTime === 0) {
            setLastFetchTime(Date.now())
            return
        }

        // Only check for new items if we have data
        if (events.length > 0) {
            const newEvents = events.filter(event => {
                const eventTime = new Date(event.created_at || event.date).getTime()
                return eventTime > lastFetchTime
            })
            
            if (newEvents.length > 0) {
                console.log('New events detected:', newEvents.length)
                newEvents.forEach(event => {
                    markAsNew('events', event.id)
                    addNotification({
                        type: 'event',
                        title: 'New Event Added',
                        message: `"${event.name}" has been added to the schedule`
                    })
                })
            }
        }

        if (shotRequests.length > 0) {
            const newShotRequests = shotRequests.filter(sr => {
                const srTime = new Date(sr.created_at || sr.deadline).getTime()
                return srTime > lastFetchTime
            })
            
            if (newShotRequests.length > 0) {
                console.log('New shot requests detected:', newShotRequests.length)
                newShotRequests.forEach(sr => {
                    markAsNew('shotRequests', sr.id)
                    addNotification({
                        type: 'shotRequest',
                        title: 'New Shot Request Added',
                        message: `"${sr.request}" has been added to the requests`
                    })
                })
            }
        }

        // Update last fetch time
        setLastFetchTime(Date.now())
    }, [events, shotRequests, lastFetchTime, addNotification, markAsNew, setLastFetchTime])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch shot requests
      const shotRequestsResponse = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests`)
      if (!shotRequestsResponse.ok) {
        throw new Error(`Failed to fetch shot requests: ${shotRequestsResponse.status}`)
      }
      const shotRequestsData = await shotRequestsResponse.json()
      setShotRequests(shotRequestsData)

      // Fetch events
      const eventsResponse = await fetch(`${API_CONFIG.baseUrl}/api/events`)
      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events: ${eventsResponse.status}`)
      }
      const eventsData = await eventsResponse.json()
      setEvents(eventsData)

      // Fetch projects
      const projectsResponse = await fetch(`${API_CONFIG.baseUrl}/api/projects`)
      if (!projectsResponse.ok) {
        throw new Error(`Failed to fetch projects: ${projectsResponse.status}`)
      }
      const projectsData = await projectsResponse.json()
      setProjects(projectsData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle process point updates
  const handleShotRequestProcessUpdate = async (shotRequestId, newProcessPoint) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${shotRequestId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': user?.name || 'Unknown'
        },
        body: JSON.stringify({ process_point: newProcessPoint })
      })

      if (response.ok) {
        setShotRequests(prev => 
          prev.map(sr => 
            sr.id === shotRequestId 
              ? { ...sr, process_point: newProcessPoint }
              : sr
          )
        )
      } else {
        throw new Error(`Failed to update shot request: ${response.status}`)
      }
    } catch (error) {
      console.error('Error updating shot request process point:', error)
      alert(`Failed to update process point: ${error.message}`)
    }
  }

  const handleEventProcessUpdate = async (eventId, newProcessPoint) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Name': user?.name || 'Unknown'
        },
        body: JSON.stringify({ process_point: newProcessPoint })
      })

      if (response.ok) {
        setEvents(prev => 
          prev.map(event => 
            event.id === eventId 
              ? { ...event, process_point: newProcessPoint }
              : event
          )
        )
      } else {
        throw new Error(`Failed to update event: ${response.status}`)
      }
    } catch (error) {
      console.error('Error updating event process point:', error)
      alert(`Failed to update process point: ${error.message}`)
    }
  }

  // Toggle expanded state
  const toggleShotRequestExpanded = (id) => {
    setExpandedShotRequests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleEventExpanded = (id) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Save notes function
  const handleSaveNotes = () => {
    if (notes.trim()) {
      const newNote = {
        id: Date.now(),
        content: notes.trim(),
        timestamp: new Date().toISOString(),
        user: user?.name || 'Editor'
      }
      setSavedNotes(prev => [newNote, ...prev])
      setNotes('')
    }
  }

  // Edit note function
  const handleEditNote = (noteId) => {
    const note = savedNotes.find(n => n.id === noteId)
    if (note) {
      setEditingNoteId(noteId)
      setEditingText(note.content)
    }
  }

  // Save edited note
  const handleSaveEdit = () => {
    if (editingText.trim()) {
      setSavedNotes(prev => prev.map(note => 
        note.id === editingNoteId 
          ? { ...note, content: editingText.trim(), timestamp: new Date().toISOString() }
          : note
      ))
      setEditingNoteId(null)
      setEditingText('')
    }
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingText('')
  }

  // Delete note function
  const handleDeleteNote = (noteId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      setSavedNotes(prev => prev.filter(note => note.id !== noteId))
    }
  }

  // Get current project
  const currentProject = projects.find(p => p.id.toString() === selectedProjectId)

  // Get today's events (filtered by selected project if available)
  const getTodaysEvents = () => {
    const today = selectedDate || new Date().toISOString().split('T')[0]
    let filteredEvents = events.filter(event => event.date === today)
    
    if (selectedProjectId) {
      filteredEvents = filteredEvents.filter(event => event.project_id === parseInt(selectedProjectId))
    }
    
    return filteredEvents
  }

  // Calculate project progress for current project only
  const getProjectProgress = () => {
    if (!currentProject) return []
    
    const projectEvents = events.filter(event => event.project_id === currentProject.id)
    const deliveredEvents = projectEvents.filter(event => event.process_point === 'delivered')
    const progress = projectEvents.length > 0 ? (deliveredEvents.length / projectEvents.length) * 100 : 0
    
    return [{
      ...currentProject,
      totalEvents: projectEvents.length,
      deliveredEvents: deliveredEvents.length,
      progress: Math.round(progress)
    }]
  }

  // Chart data preparation - Event distribution for selected date
  const getEventDistributionData = () => {
    const targetDate = selectedDate || new Date().toISOString().split('T')[0]
    let filteredEvents = events.filter(event => event.date === targetDate)
    
    if (selectedProjectId) {
      filteredEvents = filteredEvents.filter(event => event.project_id === parseInt(selectedProjectId))
    }
    
    // Create hourly distribution (6am to 11pm)
    const hourlyData = Array(18).fill(0)
    filteredEvents.forEach(event => {
      if (event.start_time) {
        const hour = parseInt(event.start_time.split(':')[0])
        if (hour >= 6 && hour <= 23) {
          hourlyData[hour - 6]++
        }
      }
    })

    return {
      labels: Array.from({length: 18}, (_, i) => `${i + 6}:00`),
      datasets: [{
        label: 'Events by Hour',
        data: hourlyData,
        borderColor: '#ff7a18',
        backgroundColor: 'rgba(255, 122, 24, 0.1)',
        tension: 0.4,
        fill: true
      }]
    }
  }

  const getProcessPointBarData = (items, title) => {
    let filteredItems = items
    
    // Filter by selected project if available
    if (selectedProjectId) {
      filteredItems = items.filter(item => {
        if (item.project_id) {
          return item.project_id === parseInt(selectedProjectId)
        }
        // For shot requests, show those that either:
        // 1. Are associated with events in the selected project, OR
        // 2. Have no events (independent shot requests)
        if (item.events && item.events.length > 0) {
          return item.events.some(event => event.project_id === parseInt(selectedProjectId))
        }
        // Independent shot requests (no events) should be shown
        return true
      })
    }

    const processCounts = processPoints.map(point => 
      filteredItems.filter(item => (item.process_point || 'idle') === point).length
    )

    return {
      labels: processPoints.map(point => point.charAt(0).toUpperCase() + point.slice(1)),
      datasets: [{
        label: title,
        data: processCounts,
        backgroundColor: processPoints.map(point => getProcessPointColor(point).chartColor),
        borderColor: processPoints.map(point => getProcessPointColor(point).borderColor),
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      }]
    }
  }

  if (loading) {
    return (
      <div className="editor-dashboard">
        <div className="editor-dashboard-loading">
          Loading Editor Dashboard...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="editor-dashboard">
        <div className="editor-dashboard-panel">
          <h3>Error Loading Dashboard</h3>
          <p style={{ color: '#ff6b6b', marginBottom: '20px' }}>{error}</p>
          <button 
            onClick={fetchDashboardData}
            style={{
              padding: '12px 24px',
              backgroundColor: '#ff7a18',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const todaysEvents = getTodaysEvents()
  const projectProgress = getProjectProgress()

  return (
    <div className="editor-dashboard">
      {/* Header */}
      <div className="editor-dashboard-header">
        <h1>Editor Dashboard</h1>
        <p>
          {currentProject ? `${currentProject.name} - ${currentProject.location}` : 'Select a project to view details'}
        </p>
      </div>

      {/* Dashboard Grid */}
      <div className="editor-dashboard-grid">
        {/* 1. Event Distribution Chart */}
        <div className="editor-dashboard-panel">
          <h3>Event Distribution {selectedDate ? `for ${selectedDate}` : 'for Today'}</h3>
          <div className="editor-chart-container">
            <Line 
              data={getEventDistributionData()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
                  x: { grid: { color: 'rgba(255,255,255,0.1)' } }
                }
              }}
            />
          </div>
        </div>

        {/* 2. Events/Shot Requests Toggle Panel */}
        <div className="editor-dashboard-panel">
          <div className="editor-panel-header">
            <h3>
              {activePanel === 'events' ? 
                `Events (${selectedDate ? getFilteredItems(events, 'event').length : events.length})` : 
                `Shot Requests (${selectedDate ? getFilteredItems(shotRequests, 'shotRequest').length : shotRequests.length})`
              }
            </h3>
            <div className="editor-toggle-buttons">
              <button 
                className={`editor-toggle-btn ${activePanel === 'events' ? 'active' : ''}`}
                onClick={() => setActivePanel('events')}
              >
                Events
              </button>
              <button 
                className={`editor-toggle-btn ${activePanel === 'shotRequests' ? 'active' : ''}`}
                onClick={() => setActivePanel('shotRequests')}
              >
                Shot Requests
              </button>
            </div>
          </div>
          <div className="editor-items-list">
            {activePanel === 'events' ? (
              (() => {
                const filteredEvents = getFilteredItems(events, 'event')
                return filteredEvents.length === 0 ? (
                  <div className="editor-empty-state">
                    {selectedDate ? `No events found for ${new Date(selectedDate).toLocaleDateString()}` : 'No events found'}
                  </div>
                ) : (
                  filteredEvents.map(event => {
                    const processColor = getProcessPointColor(event.process_point || 'idle')
                    const liveStatus = getEventStatus(event)
                    const liveStatusColor = getLiveStatusColor(liveStatus)
                    const status = getStatus(event)
                    const statusColor = getStatusColor(status)
                    const isExpanded = expandedEvents.has(event.id)
                    
                    return (
                      <div key={event.id} className="editor-item-card" style={{ 
                        borderLeftColor: processColor.borderColor,
                        backgroundColor: processColor.backgroundColor 
                      }}>
                        <div className="editor-card-header" onClick={() => toggleEventExpanded(event.id)}>
                          <div className="editor-card-title-row">
                            <span className="editor-process-indicator" style={{ backgroundColor: processColor.borderColor }}></span>
                            <span className="editor-event-name">
                              {event.name}
                              {isNew('events', event.id) && <span className="new-badge">NEW</span>}
                            </span>
                            <span className={`editor-expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                          </div>
                          <div className="editor-card-details-row">
                            {event.quick_turn && <span className="editor-quick-turn-badge">⚡ Quick Turn</span>}
                            {event.start_time && event.end_time && (
                              <span className="editor-time-badge">{event.start_time} - {event.end_time}</span>
                            )}
                            <span className="editor-status-badge" style={{ backgroundColor: liveStatusColor }}>
                              {liveStatus.charAt(0).toUpperCase() + liveStatus.slice(1).replace('-', ' ')}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="editor-card-details">
                            <div className="editor-process-control">
                              <label>Process:</label>
                              <select
                                className="editor-process-select"
                                value={event.process_point || 'idle'}
                                onChange={(e) => handleEventProcessUpdate(event.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ backgroundColor: processColor.backgroundColor, borderColor: processColor.borderColor }}
                              >
                                {processPoints.map(point => (
                                  <option key={point} value={point}>
                                    {point.charAt(0).toUpperCase() + point.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {event.location && (
                              <div className="editor-detail-row">
                                <strong>Location:</strong> {event.location}
                              </div>
                            )}
                            {event.notes && (
                              <div className="editor-detail-row">
                                <strong>Notes:</strong> {event.notes}
                              </div>
                            )}
                            {event.deadline && (
                              <div className="editor-detail-row">
                                <strong>Deadline:</strong> {new Date(event.deadline).toLocaleDateString()}
                              </div>
                            )}
                            {event.shot_requests && event.shot_requests.length > 0 && (
                              <div className="editor-detail-row">
                                <strong>Shot Requests:</strong> {event.shot_requests.map(sr => sr.request).join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )
              })()
            ) : (
              (() => {
                const filteredShotRequests = getFilteredItems(shotRequests, 'shotRequest')
                return filteredShotRequests.length === 0 ? (
                  <div className="editor-empty-state">
                    {selectedDate ? `No shot requests found for ${new Date(selectedDate).toLocaleDateString()}` : 'No shot requests found'}
                  </div>
                ) : (
                  filteredShotRequests.map(shotRequest => {
                    const processColor = getProcessPointColor(shotRequest.process_point || 'idle')
                    const status = getStatus(shotRequest)
                    const statusColor = getStatusColor(status)
                    const isExpanded = expandedShotRequests.has(shotRequest.id)
                    
                    return (
                      <div key={shotRequest.id} className="editor-item-card" style={{ 
                        borderLeftColor: processColor.borderColor,
                        backgroundColor: processColor.backgroundColor 
                      }}>
                        <div className="editor-card-header" onClick={() => toggleShotRequestExpanded(shotRequest.id)}>
                          <div className="editor-card-title-row">
                            <span className="editor-process-indicator" style={{ backgroundColor: processColor.borderColor }}></span>
                            <span className="editor-event-name">
                              {shotRequest.request}
                              {isNew('shotRequests', shotRequest.id) && <span className="new-badge">NEW</span>}
                            </span>
                            <span className={`editor-expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                          </div>
                          <div className="editor-card-details-row">
                            {shotRequest.quick_turn && <span className="editor-quick-turn-badge">⚡ Quick Turn</span>}
                            {shotRequest.deadline && (
                              <span className="editor-time-badge">{new Date(shotRequest.deadline).toLocaleDateString()}</span>
                            )}
                            <span className="editor-status-badge" style={{ backgroundColor: statusColor }}>
                              {status.replace('-', ' ')}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="editor-card-details">
                            <div className="editor-process-control">
                              <label>Process:</label>
                              <select
                                className="editor-process-select"
                                value={shotRequest.process_point || 'idle'}
                                onChange={(e) => handleShotRequestProcessUpdate(shotRequest.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ backgroundColor: processColor.backgroundColor, borderColor: processColor.borderColor }}
                              >
                                {processPoints.map(point => (
                                  <option key={point} value={point}>
                                    {point.charAt(0).toUpperCase() + point.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {shotRequest.notes && (
                              <div className="editor-detail-row">
                                <strong>Notes:</strong> {shotRequest.notes}
                              </div>
                            )}
                            {shotRequest.start_time && (
                              <div className="editor-detail-row">
                                <strong>Start Time:</strong> {shotRequest.start_time}
                              </div>
                            )}
                            {shotRequest.end_time && (
                              <div className="editor-detail-row">
                                <strong>End Time:</strong> {shotRequest.end_time}
                              </div>
                            )}
                            {shotRequest.event && (
                              <div className="editor-detail-row">
                                <strong>Event:</strong> {shotRequest.event.name}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )
              })()
            )}
          </div>
        </div>

        {/* 3. Notes Panel */}
        <div className="editor-dashboard-panel">
          <h3>Notes</h3>
          <div className="editor-notes-section">
            <div className="editor-notes-input">
              <textarea 
                placeholder="Add your notes here..."
                className="editor-notes-textarea"
                rows="4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button 
                className="editor-save-notes-btn"
                onClick={handleSaveNotes}
                disabled={!notes.trim()}
              >
                Save Notes
              </button>
            </div>
            <div className="editor-notes-list">
              {savedNotes.length === 0 ? (
                <div className="editor-empty-state">
                  No notes yet. Add your first note above.
                </div>
              ) : (
                savedNotes.map(note => (
                  <div key={note.id} className="editor-note-item">
                    {editingNoteId === note.id ? (
                      <div className="editor-note-edit">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="editor-notes-textarea"
                          rows="3"
                          placeholder="Edit your note..."
                        />
                        <div className="editor-note-edit-actions">
                          <button 
                            className="editor-save-notes-btn"
                            onClick={handleSaveEdit}
                            disabled={!editingText.trim()}
                          >
                            Save
                          </button>
                          <button 
                            className="editor-cancel-btn"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="editor-note-content">{note.content}</div>
                        <div className="editor-note-meta">
                          <span className="editor-note-user">{note.user}</span>
                          <span className="editor-note-date">
                            {new Date(note.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="editor-note-actions">
                          <button 
                            className="editor-edit-btn"
                            onClick={() => handleEditNote(note.id)}
                            title="Edit note"
                          >
                            ✏️
                          </button>
                          <button 
                            className="editor-delete-btn"
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete note"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 4. Project Progress Stats - Circular Progress Rings */}
        <div className="editor-dashboard-panel">
          <h3>Project Progress</h3>
          {projectProgress.length === 0 ? (
            <div className="editor-empty-state">
              {currentProject ? 'No events found for this project' : 'Select a project to view progress'}
            </div>
          ) : (
            <div className="editor-progress-circles">
              {projectProgress.map(project => (
                <div key={project.id} className="editor-progress-circle-item">
                  <div className="editor-progress-circle">
                    <svg viewBox="0 0 36 36" className="editor-circular-chart">
                      <path className="editor-circle-bg"
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path className="editor-circle"
                        strokeDasharray={`${project.progress}, 100`}
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="editor-percentage">{project.progress}%</div>
                  </div>
                  <div className="editor-progress-label">{project.name}</div>
                  <div className="editor-progress-details">
                    <div className="editor-detail-item">
                      <span className="editor-detail-label">Delivered:</span>
                      <span className="editor-detail-value">{project.deliveredEvents}</span>
                    </div>
                    <div className="editor-detail-item">
                      <span className="editor-detail-label">Total:</span>
                      <span className="editor-detail-value">{project.totalEvents}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Events Process Points Bar Chart */}
        <div className="editor-dashboard-panel">
          <h3>Events by Process Point</h3>
          <div className="editor-chart-container">
            <Bar 
              data={getProcessPointBarData(events, 'Events')}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed}` } }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* 6. Shot Requests Process Points Bar Chart */}
        <div className="editor-dashboard-panel">
          <h3>Shot Requests by Process Point</h3>
          <div className="editor-chart-container">
            <Bar 
              data={getProcessPointBarData(shotRequests, 'Shot Requests')}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed}` } }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}





