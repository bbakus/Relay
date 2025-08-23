import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Line, Pie } from 'react-chartjs-2'
import { formatDateForHeader } from '../../utils/dateUtils'
import '../../styles/client-dashboard.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement)

export const ClientDashboardView = () => {
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
            const response = await fetch('http://localhost:5001/api/events')
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
            const response = await fetch('http://localhost:5001/api/shot-requests')
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
            const response = await fetch('http://localhost:5001/api/projects')
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
        if (!projects.length || !user?.organization_id) return null
        
        const userProjects = projects.filter(p => p.organization_id === user.organization_id)
        if (!userProjects.length) return null
        
        // If a project is globally selected, use that one
        if (selectedProjectId) {
            const selectedProject = userProjects.find(p => p.id.toString() === selectedProjectId)
            if (selectedProject) return selectedProject
        }
        
        // Fall back to automatic selection logic
        const today = new Date().toISOString().split('T')[0]
        const ongoing = userProjects.filter(p => p.start_date <= today && today <= p.end_date)
        
        if (ongoing.length) {
            return ongoing.reduce((a, b) => (a.start_date > b.start_date ? a : b))
        } else {
            const upcoming = userProjects.filter(p => p.start_date >= today)
            if (upcoming.length) {
                return upcoming.reduce((a, b) => (a.start_date < b.start_date ? a : b))
            } else {
                return userProjects.reduce((a, b) => (a.end_date > b.end_date ? a : b))
            }
        }
    }, [projects, user, selectedProjectId])

    // Filter events for current project
    const projectEvents = useMemo(() => {
        if (!currentProject) return []
        return events.filter(e => e.project_id === currentProject.id)
    }, [events, currentProject])

    // Process point colors (matching the rest of the app)
    const getProcessPointColor = (processPoint) => {
        switch (processPoint?.toLowerCase()) {
            case 'idle': return 'rgba(0, 255, 255, 0.9)'
            case 'ingest': return 'rgba(0, 128, 255, 0.9)'
            case 'cull': return 'rgba(255, 122, 24, 0.9)'
            case 'color': return 'rgba(255, 64, 64, 0.9)'
            case 'delivered': return 'rgba(0, 190, 90, 0.9)'
            default: return 'rgba(0, 255, 255, 0.9)'
        }
    }

    // Event status colors (matching the rest of the app)
    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return '#007bff'
            case 'upcoming': return '#fd7e14'
            case 'starting-soon': return '#dc3545'
            case 'ongoing': return '#28a745'
            case 'done': return '#6c757d'
            default: return '#007bff'
        }
    }

    // Helper function to get event status based on timing
    const getEventStatus = (event) => {
        const now = new Date()
        const startTime = new Date(`${event.date}T${event.start_time}`)
        const endTime = new Date(`${event.date}T${event.end_time}`)
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
        const fifteenMinFromNow = new Date(now.getTime() + 15 * 60 * 1000)

        // Check if event is in the past
        if (endTime < now) {
            return 'done'
        }

        // Check if event is currently ongoing
        if (startTime <= now && endTime >= now) {
            return 'ongoing'
        }

        // Check if event is starting soon (within 15 minutes)
        if (startTime > now && startTime <= fifteenMinFromNow) {
            return 'starting-soon'
        }

        // Check if event is upcoming (within 1 hour)
        if (startTime > now && startTime <= oneHourFromNow) {
            return 'upcoming'
        }

        // Event is scheduled for future
        return 'scheduled'
    }

    // Event categorization
    const liveEvents = useMemo(() => {
        const now = new Date()
        const targetDate = selectedDate || now.toISOString().split('T')[0]
        
        return projectEvents.filter(event => {
            if (event.date !== targetDate) return false
            const startTime = new Date(`${event.date}T${event.start_time}`)
            const endTime = new Date(`${event.date}T${event.end_time}`)
            return now >= startTime && now <= endTime
        })
    }, [projectEvents, currentTimeTick, selectedDate])

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

    const scheduledEvents = useMemo(() => {
        const now = new Date()
        const targetDate = selectedDate || now.toISOString().split('T')[0]
        
        return projectEvents.filter(event => {
            if (event.date !== targetDate) return false
            const startTime = new Date(`${event.date}T${event.start_time}`)
            return startTime > now
        }).sort((a, b) => new Date(`${a.date}T${a.start_time}`) - new Date(`${b.date}T${b.start_time}`))
    }, [projectEvents, currentTimeTick, selectedDate])

    const deliveredEvents = useMemo(() => {
        const eventsToFilter = selectedDate 
            ? projectEvents.filter(e => e.date === selectedDate)
            : projectEvents
        return eventsToFilter.filter(event => event.process_point === 'delivered')
    }, [projectEvents, selectedDate])

    const deliveredShotRequests = useMemo(() => {
        return shotRequests.filter(sr => {
            const isDelivered = sr.process_point?.toLowerCase() === 'delivered'
            
            // If global date is selected, only show shot requests associated with events on that date
            if (selectedDate && sr.events && sr.events.length > 0) {
                const hasEventOnSelectedDate = sr.events.some(event => event.date === selectedDate)
                return isDelivered && hasEventOnSelectedDate
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
        if (!shotRequests.length) return 0
        const deliveredShotRequests = shotRequests.filter(sr => sr.process_point?.toLowerCase() === 'delivered')
        return Math.round((deliveredShotRequests.length / shotRequests.length) * 100)
    }, [shotRequests])

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
            ? shotRequests.filter(sr => {
                if (!sr.events || sr.events.length === 0) return false
                return sr.events.some(event => event.date === selectedDate)
              })
            : shotRequests
        
        return processPoints.map(point => ({
            point,
            requests: filteredShotRequests.filter(sr => sr.process_point?.toLowerCase() === point),
            color: getProcessPointColor(point)
        }))
    }, [shotRequests, selectedDate])

    // Handle form submissions
    const handleAddEvent = async (e) => {
        e.preventDefault()
        if (!currentProject) return
        
        try {
            const response = await fetch('http://localhost:5001/api/events', {
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
            const response = await fetch('http://localhost:5001/api/shot-requests', {
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
                    request: '', notes: '', quick_turn: false,
                    start_time: '', end_time: '', deadline: '', event_id: ''
                })
                fetchShotRequests()
            }
        } catch (error) {
            console.error('Error creating shot request:', error)
        }
    }

    if (loading) {
        return <div className="client-dashboard-loading">Loading dashboard...</div>
    }

    if (!currentProject) {
        return <div className="client-dashboard-error">No active project found</div>
    }

    return (
        <div className="client-dashboard">
            <div className="client-dashboard-header">
                <h1>{currentProject.organization_name || 'Organization'} - {currentProject.name}</h1>
                <div className="client-dashboard-actions">
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

            <div className="client-dashboard-grid">
                {/* 1. Project Metrics (vertical layout) */}
                <div className="client-dashboard-panel client-metrics-vertical">
                    <h3>Project Metrics</h3>
                    <div className="client-completion-grid-vertical">
                        <div className="client-completion-item-vertical">
                            <div className="client-completion-circle small">
                                <svg viewBox="0 0 36 36" className="client-circular-chart">
                                    <path className="client-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="client-circle events"
                                        strokeDasharray={`${projectCompletion}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="client-percentage small">{projectCompletion}%</div>
                            </div>
                            <div className="client-completion-label">Events Delivered</div>
                        </div>
                        
                        <div className="client-completion-item-vertical">
                            <div className="client-completion-circle small">
                                <svg viewBox="0 0 36 36" className="client-circular-chart">
                                    <path className="client-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="client-circle shots"
                                        strokeDasharray={`${shotRequestCompletion}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="client-percentage small">{shotRequestCompletion}%</div>
                            </div>
                            <div className="client-completion-label">Requests Delivered</div>
                        </div>
                        
                        <div className="client-completion-item-vertical">
                            <div className="client-completion-circle small">
                                <svg viewBox="0 0 36 36" className="client-circular-chart">
                                    <path className="client-circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="client-circle progress"
                                        strokeDasharray={`${eventsProgress}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="client-percentage small">{eventsProgress}%</div>
                            </div>
                            <div className="client-completion-label">Events Progress</div>
                        </div>
                    </div>
                </div>

                {/* 2. Current Events */}
                <div className="client-dashboard-panel">
                    <h3>Current Events</h3>
                    <div className="client-panel-toggle">
                        <button 
                            className={`client-toggle-button ${liveEventsToggle === 'live' ? 'active' : ''}`}
                            onClick={() => setLiveEventsToggle('live')}
                        >
                            Live Events
                        </button>
                        <button 
                            className={`client-toggle-button ${liveEventsToggle === 'upcoming' ? 'active' : ''}`}
                            onClick={() => setLiveEventsToggle('upcoming')}
                        >
                            Upcoming (Next Hour)
                        </button>
                    </div>
                    <div className="client-event-list">
                        {liveEventsToggle === 'live' ? (
                            liveEvents.length ? liveEvents.map(event => {
                                const status = getEventStatus(event)
                                const statusColor = getStatusColor(status)
                                return (
                                    <div key={event.id} className="client-event-card live" style={{ backgroundColor: '#31353d', borderLeft: `4px solid ${statusColor}` }}>
                                        <div className="client-event-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{event.name}</span>
                                            <span className="event-status-badge" style={{ color: statusColor, borderColor: statusColor }}>
                                                {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="client-event-time">{event.start_time} - {event.end_time}</div>
                                        <div className="client-event-location">{event.location}</div>
                                    </div>
                                )
                            }) : <div className="client-empty-state">No live events</div>
                        ) : (
                            upcomingEvents.length ? upcomingEvents.map(event => {
                                const status = getEventStatus(event)
                                const statusColor = getStatusColor(status)
                                return (
                                    <div key={event.id} className="client-event-card upcoming" style={{ backgroundColor: '#31353d', borderLeft: `4px solid ${statusColor}` }}>
                                        <div className="client-event-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{event.name}</span>
                                            <span className="event-status-badge" style={{ color: statusColor, borderColor: statusColor }}>
                                                {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="client-event-time">{event.start_time} - {event.end_time}</div>
                                        <div className="client-event-location">{event.location}</div>
                                    </div>
                                )
                            }) : <div className="client-empty-state">No upcoming events</div>
                        )}
                    </div>
                </div>

                {/* 3. Event Distribution Chart */}
                <div className="client-dashboard-panel">
                    <h3>Today's Event Distribution</h3>
                    <div className="client-chart-container">
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
                <div className="client-dashboard-panel">
                    <h3>Process Point Overview</h3>
                    <div className="client-panel-toggle">
                        <button 
                            className={`client-toggle-button ${processPointToggle === 'events' ? 'active' : ''}`}
                            onClick={() => setProcessPointToggle('events')}
                        >
                            Events
                        </button>
                        <button 
                            className={`client-toggle-button ${processPointToggle === 'shots' ? 'active' : ''}`}
                            onClick={() => setProcessPointToggle('shots')}
                        >
                            Shot Requests
                        </button>
                    </div>
                    <div className="client-process-point-key">
                        {shotRequestsByProcess.map(({ point, color }) => (
                            <div key={point} className="client-key-item">
                                <div className="client-color-indicator" style={{ backgroundColor: color }}></div>
                                <span>{point.charAt(0).toUpperCase() + point.slice(1)}</span>
                            </div>
                        ))}
                    </div>
                    {processPointToggle === 'events' ? (
                        <div className="client-chart-container">
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
                        <div className="client-shot-request-list">
                            {shotRequestsByProcess.map(({ point, requests, color }) => (
                                requests.map(request => (
                                    <div key={request.id} className="client-shot-request-card" style={{ borderLeftColor: color }}>
                                        <div className="client-request-text">{request.request}</div>
                                        <div className="client-request-status" style={{ color }}>{point}</div>
                                    </div>
                                ))
                            ))}
                            {!shotRequests.length && <div className="client-empty-state">No shot requests</div>}
                        </div>
                    )}
                </div>

                {/* 5. Delivered Items */}
                <div className="client-dashboard-panel">
                    <h3>Delivered Items</h3>
                    <div className="client-panel-toggle">
                        <button 
                            className={`client-toggle-button ${deliveredToggle === 'events' ? 'active' : ''}`}
                            onClick={() => setDeliveredToggle('events')}
                        >
                            Events
                        </button>
                        <button 
                            className={`client-toggle-button ${deliveredToggle === 'shots' ? 'active' : ''}`}
                            onClick={() => setDeliveredToggle('shots')}
                        >
                            Shot Requests
                        </button>
                    </div>
                    <div className="client-event-list">
                        {deliveredToggle === 'events' ? (
                            deliveredEvents.length ? deliveredEvents.map(event => (
                                <div key={event.id} className="client-event-card delivered">
                                    <div className="client-event-name">{event.name}</div>
                                    <div className="client-event-date">{formatDateForHeader(event.date)}</div>
                                    <div className="client-delivery-badge">✓ Delivered</div>
                                </div>
                            )) : <div className="client-empty-state">No delivered events</div>
                        ) : (
                            deliveredShotRequests.length ? deliveredShotRequests.map(request => (
                                <div key={request.id} className="client-shot-request-card" style={{ borderLeftColor: getProcessPointColor('delivered') }}>
                                    <div className="client-request-text">{request.request}</div>
                                    <div className="client-request-status" style={{ color: getProcessPointColor('delivered') }}>Delivered</div>
                                    {request.deadline && (
                                        <div className="client-request-deadline">Deadline: {request.deadline}</div>
                                    )}
                                </div>
                            )) : <div className="client-empty-state">No delivered shot requests</div>
                        )}
                    </div>
                </div>


            </div>

            {/* Add Event Modal */}
            {showAddEventModal && (
                <div className="client-modal-overlay" onClick={() => setShowAddEventModal(false)}>
                    <div className="client-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Event</h2>
                            <button onClick={() => setShowAddEventModal(false)} className="close-btn">×</button>
                        </div>
                        <form onSubmit={handleAddEvent} className="event-form">
                            <div className="client-form-group">
                                <label>Event Name:</label>
                                <input
                                    type="text"
                                    value={eventForm.name}
                                    onChange={(e) => setEventForm({...eventForm, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="client-form-group">
                                <label>Date:</label>
                                <input
                                    type="date"
                                    value={eventForm.date}
                                    onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="client-form-row">
                                <div className="client-form-group">
                                    <label>Start Time:</label>
                                    <input
                                        type="time"
                                        value={eventForm.start_time}
                                        onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="client-form-group">
                                    <label>End Time:</label>
                                    <input
                                        type="time"
                                        value={eventForm.end_time}
                                        onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="client-form-group">
                                <label>Location:</label>
                                <input
                                    type="text"
                                    value={eventForm.location}
                                    onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                                />
                            </div>
                            <div className="client-form-group">
                                <label>Notes:</label>
                                <textarea
                                    value={eventForm.notes}
                                    onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                                    rows={3}
                                />
                            </div>
                            <div className="client-form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={eventForm.quick_turn}
                                        onChange={(e) => setEventForm({...eventForm, quick_turn: e.target.checked})}
                                    />
                                    Quick Turn ⚡
                                </label>
                            </div>
                            <div className="client-form-actions">
                                <button type="button" onClick={() => setShowAddEventModal(false)}>Cancel</button>
                                <button type="submit">Add Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Shot Request Modal */}
            {showAddShotRequestModal && (
                <div className="client-modal-overlay" onClick={() => setShowAddShotRequestModal(false)}>
                    <div className="client-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Shot Request</h2>
                            <button onClick={() => setShowAddShotRequestModal(false)} className="close-btn">×</button>
                        </div>
                        <form onSubmit={handleAddShotRequest} className="shot-request-form">
                            <div className="client-form-group">
                                <label>Request Description:</label>
                                <input
                                    type="text"
                                    value={shotRequestForm.request}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, request: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="client-form-group">
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
                            <div className="client-form-group">
                                <label>Notes:</label>
                                <textarea
                                    value={shotRequestForm.notes}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, notes: e.target.value})}
                                    rows={3}
                                />
                            </div>
                            <div className="client-form-row">
                                <div className="client-form-group">
                                    <label>Start Time:</label>
                                    <input
                                        type="time"
                                        value={shotRequestForm.start_time}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, start_time: e.target.value})}
                                    />
                                </div>
                                <div className="client-form-group">
                                    <label>End Time:</label>
                                    <input
                                        type="time"
                                        value={shotRequestForm.end_time}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, end_time: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="client-form-group">
                                <label>Deadline:</label>
                                <input
                                    type="text"
                                    value={shotRequestForm.deadline}
                                    onChange={(e) => setShotRequestForm({...shotRequestForm, deadline: e.target.value})}
                                    placeholder="e.g., End of day, ASAP, etc."
                                />
                            </div>
                            <div className="client-form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={shotRequestForm.quick_turn}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, quick_turn: e.target.checked})}
                                    />
                                    Quick Turn ⚡
                                </label>
                            </div>
                            <div className="client-form-actions">
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

