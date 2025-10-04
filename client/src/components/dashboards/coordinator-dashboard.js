import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Line, Pie } from 'react-chartjs-2'
import { formatDateForHeader } from '../../utils/dateUtils'
import '../../styles/coordinator-dashboard.css'
import '../../styles/quick-turn-dot.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement)

export const CoordinatorDashboardView = () => {
    const { user, selectedDate, selectedProjectId } = useAuth()
    const [events, setEvents] = useState([])
    const [shotRequests, setShotRequests] = useState([])
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
    
    // Modal states
    const [showAddEventModal, setShowAddEventModal] = useState(false)
    const [showAddShotRequestModal, setShowAddShotRequestModal] = useState(false)
    const [liveEventsToggle, setLiveEventsToggle] = useState('live') // 'live' or 'upcoming'
    const [deliveredToggle, setDeliveredToggle] = useState('events') // 'events' or 'shots'
    const [processPointToggle, setProcessPointToggle] = useState('events') // 'events' or 'shots'
    
    // Form states
    const [eventForm, setEventForm] = useState({
        name: '',
        date: '',
        start_time: '',
        end_time: '',
        location: '',
        notes: '',
        quick_turn: false,
        process_point: 'idle'
    })
    
    const [shotRequestForm, setShotRequestForm] = useState({
        request: '',
        notes: '',
        details: '',
        quick_turn: false,
        start_time: '',
        end_time: '',
        deadline: '',
        event_id: ''
    })

    // Real-time updates
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000)
        return () => clearInterval(intervalId)
    }, [])

    // Fetch data
    useEffect(() => {
        fetchEvents()
        fetchShotRequests()
        fetchProjects()
    }, [])

    const fetchEvents = async () => {
        try {
            const response = await fetch('/api/events')
            if (response.ok) {
                const data = await response.json()
                setEvents(data)
            }
        } catch (error) {
            console.error('Error fetching events:', error)
        }
    }

    const fetchShotRequests = async () => {
        try {
            const response = await fetch('/api/shot-requests')
            if (response.ok) {
                const data = await response.json()
                setShotRequests(data)
            }
        } catch (error) {
            console.error('Error fetching shot requests:', error)
        }
    }

    const fetchProjects = async () => {
        try {
            const response = await fetch('/api/projects')
            if (response.ok) {
                const data = await response.json()
                setProjects(data)
                setLoading(false)
            }
        } catch (error) {
            console.error('Error fetching projects:', error)
            setLoading(false)
        }
    }

    // Get current project - use global selection or fall back to automatic selection
    const currentProject = useMemo(() => {
        if (!projects.length) return null
        
        // If global project is selected, use that
        if (selectedProjectId) {
            const selectedProject = projects.find(p => p.id.toString() === selectedProjectId)
            if (selectedProject) return selectedProject
        }
        
        // Otherwise, just return the first available project
        return projects[0]
    }, [projects, selectedProjectId])

    // Get project events
    const projectEvents = useMemo(() => {
        if (!currentProject) return []
        return events.filter(event => event.project_id === currentProject.id)
    }, [events, currentProject])

    // Get project shot requests
    const projectShotRequests = useMemo(() => {
        if (!currentProject) return []
        return shotRequests.filter(sr => sr.project_id === currentProject.id)
    }, [shotRequests, currentProject])

    // Get process point color
    const getProcessPointColor = (processPoint) => {
        switch (processPoint?.toLowerCase()) {
            case 'idle': return '#00ffff'
            case 'ingest': return '#0080ff'
            case 'cull': return '#ff7a18'
            case 'color': return '#ff4040'
            case 'delivered': return '#22c55e'
            default: return '#718096'
        }
    }

    // Get event status
    const getEventStatus = (event) => {
        if (!event.start_time || !event.end_time) return 'no-time'
        
        const now = new Date()
        const startTime = new Date(`${event.date}T${event.start_time}`)
        const endTime = new Date(`${event.date}T${event.end_time}`)
        
        if (now < startTime) return 'upcoming'
        if (now >= startTime && now <= endTime) return 'live'
        if (now > endTime) return 'completed'
        return 'no-time'
    }

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'live': return '#22c55e'
            case 'upcoming': return '#3b82f6'
            case 'completed': return '#6b7280'
            case 'no-time': return '#f59e0b'
            default: return '#6b7280'
        }
    }

    // Live events (currently happening)
    const liveEvents = useMemo(() => {
        const now = new Date()
        const targetDate = selectedDate || now.toISOString().split('T')[0]
        
        return projectEvents.filter(event => {
            if (event.date !== targetDate) return false
            if (!event.start_time || !event.end_time) return false
            
            const startTime = new Date(`${event.date}T${event.start_time}`)
            const endTime = new Date(`${event.date}T${event.end_time}`)
            
            return now >= startTime && now <= endTime
        })
    }, [projectEvents, currentTimeTick, selectedDate])

    // Upcoming events (next hour)
    const upcomingEvents = useMemo(() => {
        const now = new Date()
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
        const targetDate = selectedDate || now.toISOString().split('T')[0]
        
        return projectEvents.filter(event => {
            if (event.date !== targetDate) return false
            const startTime = new Date(`${event.date}T${event.start_time}`)
            return startTime > now && startTime <= oneHourFromNow
        })
    }, [projectEvents, currentTimeTick, selectedDate])

    // Scheduled events
    const scheduledEvents = useMemo(() => {
        const now = new Date()
        const targetDate = selectedDate || now.toISOString().split('T')[0]
        
        return projectEvents.filter(event => {
            if (event.date !== targetDate) return false
            const startTime = new Date(`${event.date}T${event.start_time}`)
            return startTime > now
        }).sort((a, b) => new Date(`${a.date}T${a.start_time}`) - new Date(`${b.date}T${b.start_time}`))
    }, [projectEvents, currentTimeTick, selectedDate])

    // Delivered events
    const deliveredEvents = useMemo(() => {
        const eventsToFilter = selectedDate 
            ? projectEvents.filter(e => e.date === selectedDate)
            : projectEvents
        return eventsToFilter.filter(event => event.process_point === 'delivered')
    }, [projectEvents, selectedDate])

    // Delivered shot requests
    const deliveredShotRequests = useMemo(() => {
        return shotRequests.filter(sr => {
            const isDelivered = sr.process_point?.toLowerCase() === 'delivered'
            
            // If global date is selected, show shot requests that either:
            // 1. Are associated with events on that date, OR
            // 2. Have no events (independent shot requests)
            if (selectedDate) {
                const hasEventOnSelectedDate = sr.events && sr.events.length > 0 && 
                    sr.events.some(event => event.date === selectedDate)
                const isIndependent = !sr.events || sr.events.length === 0
                return isDelivered && (hasEventOnSelectedDate || isIndependent)
            }
            
            return isDelivered
        })
    }, [shotRequests, selectedDate])

    // Event distribution for selected day
    const eventDistribution = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        const dayEvents = projectEvents.filter(e => e.date === targetDate)
        
        const hourlyData = Array(18).fill(0) // 6am to 11pm
        dayEvents.forEach(event => {
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
                label: 'Events Today by Hour',
                data: hourlyData,
                borderColor: '#ff7a18',
                backgroundColor: 'rgba(255, 122, 24, 0.1)',
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#ff7a18'
            }]
        }
    }, [projectEvents, selectedDate])

    // Project completion percentage
    const projectCompletion = useMemo(() => {
        if (!projectEvents.length) return 0
        const deliveredCount = projectEvents.filter(e => e.process_point === 'delivered').length
        return Math.round((deliveredCount / projectEvents.length) * 100)
    }, [projectEvents])

    // Shot request completion percentage
    const shotRequestCompletion = useMemo(() => {
        if (!projectShotRequests.length) return 0
        const deliveredShotRequests = projectShotRequests.filter(sr => sr.process_point?.toLowerCase() === 'delivered')
        return Math.round((deliveredShotRequests.length / projectShotRequests.length) * 100)
    }, [projectShotRequests])

    // Events progress percentage (completed vs total events)
    const eventsProgress = useMemo(() => {
        if (!projectEvents.length) return 0
        const now = new Date()
        const completedEvents = projectEvents.filter(event => {
            const eventDate = new Date(`${event.date}T${event.end_time}`)
            return eventDate < now || event.process_point === 'delivered'
        })
        return Math.round((completedEvents.length / projectEvents.length) * 100)
    }, [projectEvents, currentTimeTick])

    // Events in progress pie chart
    const eventsInProgress = useMemo(() => {
        const processPoints = ['idle', 'ingest', 'cull', 'color', 'delivered']
        const eventsToCount = selectedDate 
            ? projectEvents.filter(e => e.date === selectedDate)
            : projectEvents
        
        const counts = processPoints.reduce((acc, point) => {
            acc[point] = eventsToCount.filter(e => e.process_point?.toLowerCase() === point).length
            return acc
        }, {})
        
        return {
            labels: ['Idle', 'Ingest', 'Cull', 'Color', 'Delivered'],
            datasets: [{
                data: [counts.idle, counts.ingest, counts.cull, counts.color, counts.delivered],
                backgroundColor: [
                    getProcessPointColor('idle'),
                    getProcessPointColor('ingest'),
                    getProcessPointColor('cull'),
                    getProcessPointColor('color'),
                    getProcessPointColor('delivered')
                ],
                borderWidth: 2,
                borderColor: '#1e1e1e'
            }]
        }
    }, [projectEvents, selectedDate])

    // Shot requests by process point
    const shotRequestsByProcess = useMemo(() => {
        const processPoints = ['idle', 'ingest', 'cull', 'color', 'delivered']
        
        // Filter shot requests by global date when selected
        const filteredShotRequests = selectedDate 
            ? projectShotRequests.filter(sr => {
                if (!sr.events || sr.events.length === 0) return false
                return sr.events.some(event => event.date === selectedDate)
              })
            : projectShotRequests
        
        return processPoints.map(point => ({
            point,
            requests: filteredShotRequests.filter(sr => sr.process_point?.toLowerCase() === point),
            color: getProcessPointColor(point)
        }))
    }, [projectShotRequests, selectedDate])

    // Handle form submissions
    const handleAddEvent = async (e) => {
        e.preventDefault()
        if (!currentProject) return
        
        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...eventForm,
                    project_id: currentProject.id
                })
            })
            
            if (response.ok) {
                setShowAddEventModal(false)
                setEventForm({
                    name: '', date: '', start_time: '', end_time: '', 
                    location: '', notes: '', quick_turn: false, process_point: 'idle'
                })
                fetchEvents()
            }
        } catch (error) {
            console.error('Error creating event:', error)
        }
    }

    const handleAddShotRequest = async (e) => {
        e.preventDefault()
        if (!currentProject) return
        
        try {
            const response = await fetch('/api/shot-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...shotRequestForm,
                    project_id: currentProject.id
                })
            })
            
            if (response.ok) {
                setShowAddShotRequestModal(false)
                setShotRequestForm({
                    request: '', notes: '', details: '', quick_turn: false,
                    start_time: '', end_time: '', deadline: '', event_id: ''
                })
                fetchShotRequests()
            }
        } catch (error) {
            console.error('Error creating shot request:', error)
        }
    }

    if (loading) {
        return <div className="coordinator-dashboard-loading">Loading dashboard...</div>
    }

    if (!currentProject) {
        return <div className="coordinator-dashboard-error">No active project found</div>
    }

    return (
        <div className="coordinator-dashboard">
            <div className="coordinator-dashboard-header">
                <h1>{currentProject.organization_name || 'Organization'} - {currentProject.name}</h1>
                <div className="coordinator-dashboard-actions">
                    <button 
                        onClick={() => setShowAddEventModal(true)}
                        className="add-event-btn"
                    >
                        Add Event
                    </button>
                    <button 
                        onClick={() => setShowAddShotRequestModal(true)}
                        className="add-shot-request-btn"
                    >
                        Add Shot Request
                    </button>
                    <button 
                        onClick={() => {/* TODO: Handle CSV submission */}}
                        className="submit-csv-btn"
                    >
                        Submit CSV
                    </button>
                </div>
            </div>

            <div className="coordinator-dashboard-grid">
                {/* 1. Project Metrics (vertical layout) */}
                <div className="coordinator-dashboard-panel coordinator-metrics-vertical">
                    <h3>Project Metrics</h3>
                    <div className="coordinator-completion-grid-vertical">
                        <div className="coordinator-completion-item-vertical">
                            <div className="coordinator-completion-circle small">
                                <svg viewBox="0 0 36 36" className="coordinator-circular-chart">
                                    <path className="coordinator-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="coordinator-circle events"
                                        strokeDasharray={`${projectCompletion}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="coordinator-percentage small">{projectCompletion}%</div>
                            </div>
                            <div className="coordinator-completion-label">Events Delivered</div>
                        </div>
                        
                        <div className="coordinator-completion-item-vertical">
                            <div className="coordinator-completion-circle small">
                                <svg viewBox="0 0 36 36" className="coordinator-circular-chart">
                                    <path className="coordinator-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="coordinator-circle shots"
                                        strokeDasharray={`${shotRequestCompletion}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="coordinator-percentage small">{shotRequestCompletion}%</div>
                            </div>
                            <div className="coordinator-completion-label">Requests Delivered</div>
                        </div>
                        
                        <div className="coordinator-completion-item-vertical">
                            <div className="coordinator-completion-circle small">
                                <svg viewBox="0 0 36 36" className="coordinator-circular-chart">
                                    <path className="coordinator-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="coordinator-circle progress"
                                        strokeDasharray={`${eventsProgress}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="coordinator-percentage small">{eventsProgress}%</div>
                            </div>
                            <div className="coordinator-completion-label">Events Progress</div>
                        </div>
                    </div>
                </div>

                {/* 2. Current Events */}
                <div className="coordinator-dashboard-panel">
                    <h3>Current Events</h3>
                    <div className="coordinator-panel-toggle">
                        <button 
                            className={`coordinator-toggle-button ${liveEventsToggle === 'live' ? 'active' : ''}`}
                            onClick={() => setLiveEventsToggle('live')}
                        >
                            Live Events
                        </button>
                        <button 
                            className={`coordinator-toggle-button ${liveEventsToggle === 'upcoming' ? 'active' : ''}`}
                            onClick={() => setLiveEventsToggle('upcoming')}
                        >
                            Upcoming (Next Hour)
                        </button>
                    </div>
                    <div className="coordinator-event-list">
                        {liveEventsToggle === 'live' ? (
                            liveEvents.length ? liveEvents.map(event => {
                                const status = getEventStatus(event)
                                const statusColor = getStatusColor(status)
                                return (
                                    <div key={event.id} className="coordinator-event-card live" style={{ backgroundColor: '#31353d', borderLeft: `4px solid ${statusColor}` }}>
                                        <div className="coordinator-event-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{event.name}</span>
                                            <span className="event-status-badge" style={{ color: statusColor, borderColor: statusColor }}>
                                                {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="coordinator-event-time">{event.start_time} - {event.end_time}</div>
                                        <div className="coordinator-event-location">{event.location}</div>
                                    </div>
                                )
                            }) : <div className="coordinator-empty-state">No live events</div>
                        ) : (
                            upcomingEvents.length ? upcomingEvents.map(event => {
                                const status = getEventStatus(event)
                                const statusColor = getStatusColor(status)
                                return (
                                    <div key={event.id} className="coordinator-event-card upcoming" style={{ backgroundColor: '#31353d', borderLeft: `4px solid ${statusColor}` }}>
                                        <div className="coordinator-event-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{event.name}</span>
                                            <span className="event-status-badge" style={{ color: statusColor, borderColor: statusColor }}>
                                                {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="coordinator-event-time">{event.start_time} - {event.end_time}</div>
                                        <div className="coordinator-event-location">{event.location}</div>
                                    </div>
                                )
                            }) : <div className="coordinator-empty-state">No upcoming events</div>
                        )}
                    </div>
                </div>

                {/* 3. Event Distribution Chart */}
                <div className="coordinator-dashboard-panel">
                    <h3>Today's Event Distribution</h3>
                    <div className="coordinator-chart-container">
                        <Line 
                            data={eventDistribution}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { 
                                        beginAtZero: true,
                                        ticks: { stepSize: 1 }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* 4. Process Point Overview */}
                <div className="coordinator-dashboard-panel">
                    <h3>Process Point Overview</h3>
                    <div className="coordinator-panel-toggle">
                        <button 
                            className={`coordinator-toggle-button ${processPointToggle === 'events' ? 'active' : ''}`}
                            onClick={() => setProcessPointToggle('events')}
                        >
                            Events
                        </button>
                        <button 
                            className={`coordinator-toggle-button ${processPointToggle === 'shots' ? 'active' : ''}`}
                            onClick={() => setProcessPointToggle('shots')}
                        >
                            Shot Requests
                        </button>
                    </div>
                    <div className="coordinator-process-point-key">
                        {shotRequestsByProcess.map(({ point, color }) => (
                            <div key={point} className="coordinator-key-item">
                                <div className="coordinator-color-indicator" style={{ backgroundColor: color }}></div>
                                <span>{point.charAt(0).toUpperCase() + point.slice(1)}</span>
                            </div>
                        ))}
                    </div>
                    {processPointToggle === 'events' ? (
                        <div className="coordinator-chart-container">
                            <Pie 
                                data={eventsInProgress}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            display: false
                                        }
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="coordinator-shot-request-list">
                            {shotRequestsByProcess.map(({ point, requests, color }) => (
                                requests.map(request => (
                                    <div key={request.id} className="coordinator-shot-request-card" style={{ borderLeftColor: color }}>
                                        <div className="coordinator-request-text">{request.request}</div>
                                        <div className="coordinator-request-status" style={{ color }}>{point}</div>
                                    </div>
                                ))
                            ))}
                            {!shotRequests.length && <div className="coordinator-empty-state">No shot requests</div>}
                        </div>
                    )}
                </div>

                {/* 5. Delivered Items */}
                <div className="coordinator-dashboard-panel">
                    <h3>Delivered Items</h3>
                    <div className="coordinator-panel-toggle">
                        <button 
                            className={`coordinator-toggle-button ${deliveredToggle === 'events' ? 'active' : ''}`}
                            onClick={() => setDeliveredToggle('events')}
                        >
                            Events
                        </button>
                        <button 
                            className={`coordinator-toggle-button ${deliveredToggle === 'shots' ? 'active' : ''}`}
                            onClick={() => setDeliveredToggle('shots')}
                        >
                            Shot Requests
                        </button>
                    </div>
                    <div className="coordinator-event-list">
                        {deliveredToggle === 'events' ? (
                            deliveredEvents.length ? deliveredEvents.map(event => (
                                <div key={event.id} className="coordinator-event-card delivered">
                                    <div className="coordinator-event-name">{event.name}</div>
                                    <div className="coordinator-event-date">{formatDateForHeader(event.date)}</div>
                                    <div className="coordinator-delivery-badge">✓ Delivered</div>
                                </div>
                            )) : <div className="coordinator-empty-state">No delivered events</div>
                        ) : (
                            deliveredShotRequests.length ? deliveredShotRequests.map(request => (
                                <div key={request.id} className="coordinator-shot-request-card" style={{ borderLeftColor: getProcessPointColor('delivered') }}>
                                    <div className="coordinator-request-text">{request.request}</div>
                                    <div className="coordinator-request-status" style={{ color: getProcessPointColor('delivered') }}>Delivered</div>
                                    {request.deadline && (
                                        <div className="coordinator-request-deadline">Deadline: {request.deadline}</div>
                                    )}
                                </div>
                            )) : <div className="coordinator-empty-state">No delivered shot requests</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Event Modal */}
            {showAddEventModal && (
                <div className="coordinator-modal-overlay" onClick={() => setShowAddEventModal(false)}>
                    <div className="coordinator-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Event</h2>
                            <button onClick={() => setShowAddEventModal(false)} className="close-btn">×</button>
                        </div>
                        <form onSubmit={handleAddEvent} className="event-form">
                            <div className="coordinator-form-group">
                                <label>Event Name:</label>
                                <input
                                    type="text"
                                    value={eventForm.name}
                                    onChange={(e) => setEventForm({...eventForm, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="coordinator-form-group">
                                <label>Date:</label>
                                <input
                                    type="date"
                                    value={eventForm.date}
                                    onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="coordinator-form-row">
                                <div className="coordinator-form-group">
                                    <label>Start Time:</label>
                                    <input
                                        type="time"
                                        value={eventForm.start_time}
                                        onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="coordinator-form-group">
                                    <label>End Time:</label>
                                    <input
                                        type="time"
                                        value={eventForm.end_time}
                                        onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="coordinator-form-group">
                                <label>Location:</label>
                                <input
                                    type="text"
                                    value={eventForm.location}
                                    onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                                />
                            </div>
                            <div className="coordinator-form-group">
                                <label>Notes:</label>
                                <textarea
                                    value={eventForm.notes}
                                    onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                                    rows={3}
                                />
                            </div>
                            <div className="coordinator-form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={eventForm.quick_turn}
                                        onChange={(e) => setEventForm({...eventForm, quick_turn: e.target.checked})}
                                    />
                                    <span className="quick-turn-text">Quick Turn</span> <span className="quick-turn-dot"></span>
                                </label>
                            </div>
                            <div className="coordinator-form-actions">
                                <button type="button" onClick={() => setShowAddEventModal(false)}>Cancel</button>
                                <button type="submit">Add Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Shot Request Modal */}
            {showAddShotRequestModal && (
                <div className="coordinator-modal-overlay" onClick={() => setShowAddShotRequestModal(false)}>
                    <div className="coordinator-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Shot Request</h2>
                            <button onClick={() => setShowAddShotRequestModal(false)} className="close-btn">×</button>
                        </div>
                        <form onSubmit={handleAddShotRequest} className="shot-request-form">
                            <div className="coordinator-form-group">
                                <label>Request Description:</label>
                                <input
                                    type="text"
                                    value={shotRequestForm.request}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, request: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="coordinator-form-group">
                                <label>Event (Optional):</label>
                                <select
                                    value={shotRequestForm.event_id}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, event_id: e.target.value})}
                                >
                                    <option value="">No specific event</option>
                                    {projectEvents.map(event => (
                                        <option key={event.id} value={event.id}>{event.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="coordinator-form-group">
                                <label>Notes:</label>
                                <textarea
                                    value={shotRequestForm.notes}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, notes: e.target.value})}
                                    rows={3}
                                />
                            </div>
                            <div className="coordinator-form-group">
                                <label>Details:</label>
                                <textarea
                                    value={shotRequestForm.details}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, details: e.target.value})}
                                    rows={3}
                                    placeholder="Add specific individual references, names, or detailed requirements..."
                                />
                            </div>
                            <div className="coordinator-form-row">
                                <div className="coordinator-form-group">
                                    <label>Start Time:</label>
                                    <input
                                        type="time"
                                        value={shotRequestForm.start_time}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, start_time: e.target.value})}
                                    />
                                </div>
                                <div className="coordinator-form-group">
                                    <label>End Time:</label>
                                    <input
                                        type="time"
                                        value={shotRequestForm.end_time}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, end_time: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="coordinator-form-group">
                                <label>Deadline:</label>
                                <input
                                    type="datetime-local"
                                    value={shotRequestForm.deadline}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, deadline: e.target.value})}
                                />
                            </div>
                            <div className="coordinator-form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={shotRequestForm.quick_turn}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, quick_turn: e.target.checked})}
                                    />
                                    <span className="quick-turn-text">Quick Turn</span> <span className="quick-turn-dot"></span>
                                </label>
                            </div>
                            <div className="coordinator-form-actions">
                                <button type="button" onClick={() => setShowAddShotRequestModal(false)}>Cancel</button>
                                <button type="submit">Add Shot Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
