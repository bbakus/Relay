import React, { useState, useEffect } from 'react'
import { Line, Pie, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { useAuth } from '../../context/AuthContext'
import { API_CONFIG } from '../../utils/apiConfig'
import '../../styles/editor-dashboard.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export const EditorDashboardView = () => {
  const { user, selectedDate, selectedProjectId } = useAuth()
  const [shotRequests, setShotRequests] = useState([])
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedShotRequests, setExpandedShotRequests] = useState(new Set())
  const [expandedEvents, setExpandedEvents] = useState(new Set())

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

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

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

  const getProcessPointPieData = (items, title) => {
    let filteredItems = items
    
    // Filter by selected project if available
    if (selectedProjectId) {
      filteredItems = items.filter(item => {
        if (item.project_id) {
          return item.project_id === parseInt(selectedProjectId)
        }
        // For shot requests, check if they're associated with events in the selected project
        if (item.events && item.events.length > 0) {
          return item.events.some(event => event.project_id === parseInt(selectedProjectId))
        }
        return false
      })
    }

    const processCounts = processPoints.map(point => 
      filteredItems.filter(item => (item.process_point || 'idle') === point).length
    )

    return {
      labels: processPoints.map(point => point.charAt(0).toUpperCase() + point.slice(1)),
      datasets: [{
        data: processCounts,
        backgroundColor: processPoints.map(point => getProcessPointColor(point).chartColor),
        borderWidth: 2,
        borderColor: '#ffffff'
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

        {/* 2. Shot Requests Panel */}
        <div className="editor-dashboard-panel">
          <h3>Shot Requests ({shotRequests.length})</h3>
          <div className="editor-shot-requests-list">
            {shotRequests.length === 0 ? (
              <div className="editor-empty-state">
                No shot requests found
              </div>
            ) : (
              shotRequests.map(shotRequest => (
                <div key={shotRequest.id} className="editor-shot-request-item">
                  <div className="editor-shot-request-header">
                    <div className="editor-shot-request-title">{shotRequest.request}</div>
                    <div className="editor-shot-request-details">
                      {shotRequest.notes && <span>Notes: {shotRequest.notes}</span>}
                      {shotRequest.deadline && <span>Deadline: {new Date(shotRequest.deadline).toLocaleDateString()}</span>}
                      {shotRequest.quick_turn && <span>Quick Turn</span>}
                    </div>
                  </div>
                  
                  <div className="editor-shot-request-process">
                    <span>Process:</span>
                    <select
                      className="editor-process-select"
                      value={shotRequest.process_point || 'idle'}
                      onChange={(e) => handleShotRequestProcessUpdate(shotRequest.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {processPoints.map(point => (
                        <option key={point} value={point}>
                          {point.charAt(0).toUpperCase() + point.slice(1)}
                        </option>
                      ))}
                    </select>
                    
                    <button 
                      className="editor-expand-button"
                      onClick={() => toggleShotRequestExpanded(shotRequest.id)}
                    >
                      <span className={`editor-expand-icon ${expandedShotRequests.has(shotRequest.id) ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </button>
                  </div>

                  <div className={`editor-expandable-content ${expandedShotRequests.has(shotRequest.id) ? 'expanded' : ''}`}>
                    <div className="editor-expanded-details">
                      <p><strong>Current Process:</strong> {shotRequest.process_point || 'idle'}</p>
                      {shotRequest.start_time && <p><strong>Start Time:</strong> {shotRequest.start_time}</p>}
                      {shotRequest.end_time && <p><strong>End Time:</strong> {shotRequest.end_time}</p>}
                      {shotRequest.events && shotRequest.events.length > 0 && (
                        <p><strong>Related Events:</strong> {shotRequest.events.map(e => e.name).join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Today's Events Panel */}
        <div className="editor-dashboard-panel">
          <h3>Today's Events ({todaysEvents.length})</h3>
          <div className="editor-events-list">
            {todaysEvents.length === 0 ? (
              <div className="editor-empty-state">
                No events scheduled for today
              </div>
            ) : (
              todaysEvents.map(event => (
                <div key={event.id} className="editor-event-item">
                  <div className="editor-event-header">
                    <div className="editor-event-title">{event.name}</div>
                    <div className="editor-event-time">
                      {event.start_time && event.end_time && (
                        <span>{event.start_time} - {event.end_time}</span>
                      )}
                    </div>
                    {event.location && (
                      <div className="editor-event-location">
                        {event.location}
                      </div>
                    )}
                  </div>

                  <div className="editor-shot-request-process">
                    <span>Process:</span>
                    <select
                      className="editor-process-select"
                      value={event.process_point || 'idle'}
                      onChange={(e) => handleEventProcessUpdate(event.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {processPoints.map(point => (
                        <option key={point} value={point}>
                          {point.charAt(0).toUpperCase() + point.slice(1)}
                        </option>
                      ))}
                    </select>
                    
                    <button 
                      className="editor-expand-button"
                      onClick={() => toggleEventExpanded(event.id)}
                    >
                      <span className={`editor-expand-icon ${expandedEvents.has(event.id) ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </button>
                  </div>

                  <div className={`editor-expandable-content ${expandedEvents.has(event.id) ? 'expanded' : ''}`}>
                    <div className="editor-expanded-details">
                      <p><strong>Current Process:</strong> {event.process_point || 'idle'}</p>
                      {event.notes && <p><strong>Notes:</strong> {event.notes}</p>}
                      {event.deadline && <p><strong>Deadline:</strong> {new Date(event.deadline).toLocaleDateString()}</p>}
                      {event.quick_turn && <p><strong>Quick Turn</strong></p>}
                      {event.shot_requests && event.shot_requests.length > 0 && (
                        <p><strong>Shot Requests:</strong> {event.shot_requests.map(sr => sr.request).join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
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

        {/* 5. Events Process Points Pie Chart */}
        <div className="editor-dashboard-panel">
          <h3>Events by Process Point</h3>
          <div className="editor-chart-container">
            <Pie 
              data={getProcessPointPieData(events, 'Events')}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                  tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed}` } }
                }
              }}
            />
          </div>
        </div>

        {/* 6. Shot Requests Process Points Pie Chart */}
        <div className="editor-dashboard-panel">
          <h3>Shot Requests by Process Point</h3>
          <div className="editor-chart-container">
            <Doughnut 
              data={getProcessPointPieData(shotRequests, 'Shot Requests')}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                  tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed}` } }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}




