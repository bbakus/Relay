import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import { formatDateForHeader } from '../utils/dateUtils'
import '../styles/events.css'

export const Events = () => {
    const { user, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()
    
    // State management
    const [events, setEvents] = useState([])
    const [projects, setProjects] = useState([])
    const [organizations, setOrganizations] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddEventModal, setShowAddEventModal] = useState(false)
    const [showShotRequestModal, setShowShotRequestModal] = useState(false)
    const [addShotRequest, setAddShotRequest] = useState(false)
    const [lastCreatedEventId, setLastCreatedEventId] = useState(null)
    const [expandedEventIds, setExpandedEventIds] = useState(new Set())
    
    // Filter states for All Events section (use global selectedDate for date filtering)
    const [filterQuickTurn, setFilterQuickTurn] = useState('all')
    const [filterProcessPoint, setFilterProcessPoint] = useState('all')
    const [filterDate, setFilterDate] = useState('all')
    
    // Filter states for Today's Events section
    const [todayFilterQuickTurn, setTodayFilterQuickTurn] = useState('all')
    const [todayFilterProcessPoint, setTodayFilterProcessPoint] = useState('all')
    
    // Note: Admin filters now handled globally via AuthContext
    
    // Real-time status updates
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000)
        return () => clearInterval(intervalId)
    }, [])

    // Toggle expanded state for event cards
    const toggleEventExpansion = (panelId, eventId) => {
        const uniqueKey = `${panelId}-${eventId}`
        setExpandedEventIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(uniqueKey)) {
                newSet.delete(uniqueKey)
            } else {
                newSet.add(uniqueKey)
            }
            return newSet
        })
    }
    
    // Note: Organization/project relationship now handled in AuthContext
    
    // Event form state
    const [eventForm, setEventForm] = useState({
        name: '',
        date: '',
        start_time: '',
        end_time: '',
        location: '',
        notes: '',
        quick_turn: false,
        deadline: '',
        project_id: ''
    })
    
    // Shot request form state
    const [shotRequestForm, setShotRequestForm] = useState({
        request: '',
        notes: '',
        quick_turn: false,
        start_time: '',
        end_time: '',
        deadline: ''
    })
    
    // Fetch data on mount
    useEffect(() => {
        console.log('Events page: Starting data fetch...')
        Promise.all([
            fetchEvents(),
            fetchProjects(),
            fetchOrganizations()
        ]).finally(() => {
            console.log('Events page: Data fetch completed')
            setLoading(false)
        })
    }, [])
    
    const fetchEvents = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/events')
            if (response.ok) {
                const data = await response.json()
                console.log('Events page: Fetched events:', data.length, 'events')
                console.log('Events data:', data.map(e => ({id: e.id, name: e.name, project_id: e.project_id})))
                setEvents(data)
            }
        } catch (error) {
            console.error('Error fetching events:', error)
        }
    }
    
    const fetchProjects = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/projects')
            if (response.ok) {
                const data = await response.json()
                console.log('Events page: Fetched projects:', data.length, 'projects')
                console.log('Projects data:', data.map(p => ({id: p.id, name: p.name, start: p.start_date, end: p.end_date, organization_id: p.organization_id})))
                setProjects(data)
            }
        } catch (error) {
            console.error('Error fetching projects:', error)
        }
    }
    
    const fetchOrganizations = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/organizations')
            if (response.ok) {
                const data = await response.json()
                setOrganizations(data)
            }
        } catch (error) {
            console.error('Error fetching organizations:', error)
        }
    }
    
    // Status calculation functions (copied from Settings.js)
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

    const getEventStatus = (event) => {
        if (!event.date || !event.start_time || !event.end_time) return 'scheduled'
        
        void currentTimeTick // Force recalculation on tick
        const now = new Date()
        const eventDate = parseDateLocal(event.date)
        const startTime = parseDateTimeLocal(event.date, event.start_time)
        const endTime = parseDateTimeLocal(event.date, event.end_time)
        
        const isToday = now.toDateString() === eventDate.toDateString()
        
        if (!isToday) {
            if (now < startTime) return 'scheduled'
            if (now > endTime) return 'done'
        }
        
        if (isToday) {
            const timeUntilStart = startTime - now
            const timeUntilEnd = endTime - now
            
            if (timeUntilStart > 0) {
                if (timeUntilStart <= 15 * 60 * 1000) return 'starting-soon' // 15 minutes
                if (timeUntilStart <= 60 * 60 * 1000) return 'upcoming' // 1 hour
                return 'scheduled'
            }
            
            if (timeUntilEnd > 0) return 'ongoing'
            return 'done'
        }
        
        return 'scheduled'
    }

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
    
    // Get user's accessible projects (all projects for admin, org projects for others)
    const userProjects = useMemo(() => {
        console.log('userProjects useMemo running:', {
            userRole: user?.access,
            userOrgId: user?.organization_id,
            selectedOrgId: selectedOrganizationId,
            totalProjects: projects.length,
            projects: projects.map(p => ({id: p.id, name: p.name, org_id: p.organization_id}))
        })
        
        // Admin can see projects based on selected organization
        if (user?.access === 'Admin') {
            if (selectedOrganizationId) {
                // Admin selected specific organization
                const filtered = projects.filter(p => p.organization_id === parseInt(selectedOrganizationId))
                console.log('Admin user: showing projects for org', selectedOrganizationId, ':', filtered.map(p => ({id: p.id, name: p.name})))
                return filtered
            } else {
                // Admin selected "All Organizations" - show all projects
                console.log('Admin user: showing all projects')
                return projects
            }
        }
        
        // Non-admin users see only their organization's projects
        if (!user?.organization_id) return projects
        const filtered = projects.filter(p => p.organization_id === user.organization_id)
        console.log('userProjects result:', filtered.map(p => ({id: p.id, name: p.name})))
        return filtered
    }, [projects, user, selectedOrganizationId])
    
    // Get current project (admin selected project or auto-detected live project)
    const currentProject = useMemo(() => {
        // If admin has selected a specific project, use that
        if (user?.access === 'Admin' && selectedProjectId) {
            const selected = userProjects.find(p => p.id === parseInt(selectedProjectId))
            if (selected) {
                console.log('Admin selected project:', selected.name)
                return selected
            }
        }
        
        if (!userProjects.length) return null
        
        const today = new Date().toISOString().split('T')[0]
        const ongoing = userProjects.filter(p => p.start_date <= today && today <= p.end_date)
        
        console.log('Events page debug:', {
            userRole: user?.access,
            selectedProjectId,
            today,
            userProjects: userProjects.map(p => ({id: p.id, name: p.name, start: p.start_date, end: p.end_date})),
            ongoing: ongoing.map(p => ({id: p.id, name: p.name})),
            allEvents: events.length,
            eventsForEachProject: userProjects.map(p => ({
                projectId: p.id, 
                projectName: p.name, 
                eventCount: events.filter(e => e.project_id === p.id).length
            }))
        })
        
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
    }, [userProjects, events, user, selectedProjectId])
    
    // Filter events for current project
    const projectEvents = useMemo(() => {
        if (!currentProject) return []
        return events.filter(event => event.project_id === currentProject.id)
    }, [events, currentProject])
    
    // Get available dates from selected project's duration (start_date to end_date) - matching Personnel component logic
    const availableDates = useMemo(() => {
        const dates = []
        
        // Always include today's date
        const today = new Date().toISOString().split('T')[0]
        dates.push(today)
        
        if (!selectedProjectId) {
            return dates
        }
        
        const selectedProject = projects.find(p => p.id === parseInt(selectedProjectId))
        if (!selectedProject || !selectedProject.start_date || !selectedProject.end_date) {
            return dates
        }
        
        // Generate all dates from start_date to end_date
        // Use string manipulation to avoid date object timezone issues
        const startDate = selectedProject.start_date
        const endDate = selectedProject.end_date
        
        // Parse dates manually
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
        
        // Generate dates by incrementing day numbers
        let currentYear = startYear
        let currentMonth = startMonth
        let currentDay = startDay
        
        while (true) {
            // Format current date
            const dateString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`
            
            // Only add if not already included (avoid duplicates)
            if (!dates.includes(dateString)) {
                dates.push(dateString)
            }
            
            // Check if we've reached the end date
            if (currentYear === endYear && currentMonth === endMonth && currentDay === endDay) {
                break
            }
            
            // Increment day
            currentDay++
            
            // Handle month/year rollover (simplified - just handle up to day 31)
            const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
            if (currentDay > daysInMonth) {
                currentDay = 1
                currentMonth++
                if (currentMonth > 12) {
                    currentMonth = 1
                    currentYear++
                }
            }
        }
        
        // Sort dates to ensure today appears first
        return dates.sort()
    }, [projects, selectedProjectId])
    
    // Filtered events for All Events section (show ALL events in project, not filtered by global date)
    const filteredProjectEvents = useMemo(() => {
        let filtered = projectEvents
        
        // Filter by date (if a specific date is selected)
        if (filterDate !== 'all') {
            filtered = filtered.filter(event => event.date === filterDate)
        }
        
        // Filter by quick turn
        if (filterQuickTurn !== 'all') {
            const isQuickTurn = filterQuickTurn === 'yes'
            filtered = filtered.filter(event => !!event.quick_turn === isQuickTurn)
        }
        
        // Filter by process point
        if (filterProcessPoint !== 'all') {
            filtered = filtered.filter(event => (event.process_point || 'idle') === filterProcessPoint)
        }
        
        // Sort by date first, then by start time within each date
        filtered.sort((a, b) => {
            // First sort by date (chronological order)
            if (a.date !== b.date) {
                return a.date.localeCompare(b.date)
            }
            
            // If same date, sort by start time (earliest to latest)
            if (!a.start_time && !b.start_time) return 0
            if (!a.start_time) return 1
            if (!b.start_time) return -1
            return a.start_time.localeCompare(b.start_time)
        })
        
        return filtered
    }, [projectEvents, filterQuickTurn, filterProcessPoint, filterDate])
    
    // Event filtering by status and date (use global selectedDate, fallback to today)
    const todaysEvents = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        return projectEvents.filter(event => event.date === targetDate)
    }, [projectEvents, selectedDate])
    
    // Filtered today's events
    const filteredTodaysEvents = useMemo(() => {
        let filtered = todaysEvents
        
        // Filter by quick turn
        if (todayFilterQuickTurn !== 'all') {
            const isQuickTurn = todayFilterQuickTurn === 'yes'
            filtered = filtered.filter(event => !!event.quick_turn === isQuickTurn)
        }
        
        // Filter by process point
        if (todayFilterProcessPoint !== 'all') {
            filtered = filtered.filter(event => (event.process_point || 'idle') === todayFilterProcessPoint)
        }
        
        // Sort by start time from earliest to latest
        filtered.sort((a, b) => {
            if (!a.start_time && !b.start_time) return 0
            if (!a.start_time) return 1
            if (!b.start_time) return -1
            return a.start_time.localeCompare(b.start_time)
        })
        
        return filtered
    }, [todaysEvents, todayFilterQuickTurn, todayFilterProcessPoint])
    
    const upcomingEvents = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        return projectEvents.filter(event => {
            // Filter by selected date first
            if (event.date !== targetDate) return false
            
            const status = getEventStatus(event)
            return status === 'upcoming' || status === 'starting-soon'
        })
    }, [projectEvents, selectedDate, currentTimeTick])
    
    const liveEvents = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        return projectEvents.filter(event => {
            // Filter by selected date first
            if (event.date !== targetDate) return false
            
            const status = getEventStatus(event)
            return status === 'ongoing'
        })
    }, [projectEvents, selectedDate, currentTimeTick])
    
    // Event management functions (removed modal functions, now using collapsible cards)
    
    const handleProcessPointChange = async (eventId, newProcessPoint) => {
        try {
            const response = await fetch(`http://localhost:5001/api/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_point: newProcessPoint })
            })
            if (response.ok) {
                // Update the event in the local state
                setEvents(prevEvents =>
                    prevEvents.map(event =>
                        event.id === eventId
                            ? { ...event, process_point: newProcessPoint }
                            : event
                    )
                )
            } else {
                console.error('Failed to update process point')
            }
        } catch (error) {
            console.error('Error updating process point:', error)
        }
    }
    
    const handleAddEvent = async (e) => {
        e.preventDefault()
        
        if (!currentProject) {
            alert('No current project available to add events to')
            return
        }
        
        const eventData = {
            ...eventForm,
            project_id: currentProject.id
        }
        

        
        try {
            const response = await fetch('http://localhost:5001/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            })
            
            if (response.ok) {
                const createdEvent = await response.json()
                setLastCreatedEventId(createdEvent.id)
                
                fetchEvents()
                setEventForm({
                    name: '',
                    date: '',
                    start_time: '',
                    end_time: '',
                    location: '',
                    notes: '',
                    quick_turn: false,
                    deadline: '',
                    project_id: ''
                })
                setShowAddEventModal(false)
                
                // If user wants to add shot request, show shot request modal
                if (addShotRequest) {
                    setShowShotRequestModal(true)
                    setAddShotRequest(false) // Reset checkbox
                }
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to create event')
            }
        } catch (error) {
            console.error('Error creating event:', error)
            alert('Failed to create event')
        }
    }
    
    const handleAddShotRequest = async (e) => {
        e.preventDefault()
        
        if (!currentProject) {
            alert('No current project available to add shot request to')
            return
        }
        
        const shotRequestData = {
            ...shotRequestForm,
            project_id: currentProject.id,
            event_id: lastCreatedEventId
        }
        
        try {
            const response = await fetch('http://localhost:5001/api/shot-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shotRequestData)
            })
            
            if (response.ok) {
                setShotRequestForm({
                    request: '',
                    notes: '',
                    quick_turn: false,
                    start_time: '',
                    end_time: '',
                    deadline: ''
                })
                setShowShotRequestModal(false)
                setLastCreatedEventId(null) // Clear the event ID
                alert('Shot request created successfully!')
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to create shot request')
            }
        } catch (error) {
            console.error('Error creating shot request:', error)
            alert('Failed to create shot request')
        }
    }
    
    const EventCard = ({ event, showProject = false, showProcessColor = false, panelId = 'default' }) => {
        const status = getEventStatus(event)
        const project = projects.find(p => p.id === event.project_id)
        const processClass = showProcessColor ? `process-${(event.process_point || 'idle').toLowerCase()}` : ''
        const uniqueKey = `${panelId}-${event.id}`
        const isExpanded = expandedEventIds.has(uniqueKey)
        

        
        return (
            <div 
                key={event.id} 
                className={`events-card ${processClass} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleEventExpansion(panelId, event.id)}
            >
                <div className="events-card-basic-info">
                    <div className='events-card-header'>
                        <h3>{event.name} {event.quick_turn && <span style={{color: '#ff7a18'}}>⚡ Quick Turn</span>}</h3>

                    </div>
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px'}}>
                        <div style={{flex: 1}}>
                            {showProject && project && <p className="events-card-project" style={{margin: 0}}>{project.name}</p>}
                        </div>
                        
                        {showProcessColor && (
                            <div style={{flex: 1, textAlign: 'center'}}>
                                <span style={{
                                    fontSize: '14px', 
                                    fontWeight: '700',
                                    color: 'rgba(255,255,255,0.9)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}>
                                    {(event.process_point || 'idle')}
                                </span>
                            </div>
                        )}
                        
                        <div style={{flex: 1, textAlign: 'right'}}>
                            <span 
                                className='events-status-badge'
                                style={{ 
                                    color: getStatusColor(status),
                                    borderColor: getStatusColor(status)
                                }}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Expanded details section */}
                {isExpanded && (
                    <div className="events-card-details">
                        <div className="events-detail-row">
                            <strong>Date:</strong>
                            <span>{event.date}</span>
                        </div>

                        {event.start_time && event.end_time && (
                            <div className="events-detail-row">
                                <strong>Time:</strong>
                                <span>{event.start_time} - {event.end_time}</span>
                            </div>
                        )}

                        <div className="events-detail-row">
                            <strong>Location:</strong>
                            <span>{event.location}</span>
                        </div>

                        {event.notes && (
                            <div className="events-detail-row">
                                <strong>Notes:</strong>
                                <span>{event.notes}</span>
                            </div>
                        )}

                        {event.deadline && (
                            <div className="events-detail-row">
                                <strong>Deadline:</strong>
                                <span>{event.deadline}</span>
                            </div>
                        )}

                        <div className="events-detail-row">
                            <strong>Process Point:</strong>
                            <select 
                                value={event.process_point || 'idle'} 
                                onChange={(e) => {
                                    e.stopPropagation()
                                    handleProcessPointChange(event.id, e.target.value)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="events-process-select"
                            >
                                <option value="idle">Idle</option>
                                <option value="ingest">Ingest</option>
                                <option value="cull">Cull</option>
                                <option value="color">Color</option>
                                <option value="delivered">Delivered</option>
                            </select>
                        </div>

                        {user?.access === 'Admin' && project && (
                            <div className="events-detail-row">
                                <strong>Project:</strong>
                                <span>{project.name}</span>
                            </div>
                        )}

                        <div className="events-card-actions">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setAddShotRequest(true)
                                    setLastCreatedEventId(event.id)
                                    setShowShotRequestModal(true)
                                }}
                                className="events-add-shot-btn"
                            >
                                Add Shot Request
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }
    
    if (loading) {
        return (
        <div className='view-container'>
            <Nav />
            <div className='page-container'>
                <div className="events-loading">Loading events...</div>
            </div>
        </div>
        )
    }
    
    return (
        <div className='view-container'>
            <Nav />
            <div className='page-container'>
                <div className="events-main-container">
                    <div className='event-page-header'>
                        <h1>EVENTS</h1>
                        <button onClick={() => setShowAddEventModal(true)}>Add Event</button>
                    </div>
                <div className="events-main-grid">
                    {/* Today's Events - or Selected Date Events */}
                    <div className="events-panel-section">
                        <div className="events-section-header">
                            <h2>{selectedDate ? `Events for ${formatDateForHeader(selectedDate)}` : "Today's Events"}</h2>
                            <span className="events-count-badge">{filteredTodaysEvents.length}</span>
                        </div>
                        
                        {/* Today's Events Filters */}
                        <div className="events-filter-controls">
                            <div className="events-filter-group">
                                <label>Quick Turn:</label>
                                <select 
                                    value={todayFilterQuickTurn} 
                                    onChange={(e) => setTodayFilterQuickTurn(e.target.value)}
                                    className="events-filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="yes">Quick Turn</option>
                                    <option value="no">Standard</option>
                                </select>
                            </div>
                            
                            <div className="events-filter-group">
                                <label>Process:</label>
                                <select 
                                    value={todayFilterProcessPoint} 
                                    onChange={(e) => setTodayFilterProcessPoint(e.target.value)}
                                    className="events-filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="idle">Idle</option>
                                    <option value="ingest">Ingest</option>
                                    <option value="cull">Cull</option>
                                    <option value="color">Color</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="events-panel-list">
                            {filteredTodaysEvents.length === 0 ? (
                                <p className="events-no-results">No events match the current filters</p>
                            ) : (
                                filteredTodaysEvents.map(event => (
                                    <EventCard key={event.id} event={event} showProcessColor={true} panelId="today" />
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Live Events */}
                    <div className="events-panel-section">
                        <div className="events-section-header">
                            <h2>Live Events</h2>
                            <span className="events-count-badge">{liveEvents.length}</span>
                        </div>
                        <div className="events-panel-list">
                            {liveEvents.length === 0 ? (
                                <p className="events-no-results">No events currently ongoing</p>
                            ) : (
                                liveEvents.map(event => (
                                    <EventCard key={event.id} event={event} panelId="live" />
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Upcoming Events */}
                    <div className="events-panel-section">
                        <div className="events-section-header">
                            <h2>Upcoming Events</h2>
                            <span className="events-count-badge">{upcomingEvents.length}</span>
                        </div>
                        <div className="events-panel-list">
                            {upcomingEvents.length === 0 ? (
                                <p className="events-no-results">No upcoming events</p>
                            ) : (
                                upcomingEvents.map(event => (
                                    <EventCard key={event.id} event={event} panelId="upcoming" />
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* All Events */}
                    <div className="events-panel-section">
                        <div className="events-section-header">
                            <h2>All Events in Project</h2>
                            <span className="events-count-badge">{filteredProjectEvents.length}</span>
                        </div>
                        
                        {/* Filters */}
                        <div className="events-filter-controls">
                            <div className="events-filter-group">
                                <label>Date:</label>
                                <select 
                                    value={filterDate} 
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="events-filter-select"
                                >
                                    <option value="all">All Dates</option>
                                    {availableDates.map(date => (
                                        <option key={date} value={date}>
                                            {formatDateForHeader(date)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="events-filter-group">
                                <label>Quick Turn:</label>
                                <select 
                                    value={filterQuickTurn} 
                                    onChange={(e) => setFilterQuickTurn(e.target.value)}
                                    className="events-filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="yes">Quick Turn</option>
                                    <option value="no">Standard</option>
                                </select>
                            </div>
                            
                            <div className="events-filter-group">
                                <label>Process:</label>
                                <select 
                                    value={filterProcessPoint} 
                                    onChange={(e) => setFilterProcessPoint(e.target.value)}
                                    className="events-filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="idle">Idle</option>
                                    <option value="ingest">Ingest</option>
                                    <option value="cull">Cull</option>
                                    <option value="color">Color</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="events-panel-list">
                            {filteredProjectEvents.length === 0 ? (
                                <p className="events-no-results">No events match the current filters</p>
                            ) : (
                                filteredProjectEvents.map(event => (
                                    <EventCard key={event.id} event={event} showProcessColor={true} panelId="all" />
                                ))
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Add Event Modal */}
                {showAddEventModal && (
                    <div className="events-modal-overlay" onClick={() => setShowAddEventModal(false)}>
                        <div className="events-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="events-modal-header">
                                <h2>Add New Event</h2>
                                <button 
                                    className="events-close-btn"
                                    onClick={() => setShowAddEventModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                            
                            <form onSubmit={handleAddEvent} className="events-form">
                                <div className="events-form-group">
                                    <label>Event Name:</label>
                                    <input
                                        type="text"
                                        value={eventForm.name}
                                        onChange={(e) => setEventForm({...eventForm, name: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <div className="events-form-row">
                                    <div className="events-form-group">
                                        <label>Date:</label>
                                        <input
                                            type="date"
                                            value={eventForm.date}
                                            onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="events-form-group">
                                        <label>Start Time:</label>
                                        <input
                                            type="time"
                                            value={eventForm.start_time}
                                            onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="events-form-group">
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            value={eventForm.end_time}
                                            onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Location:</label>
                                    <input
                                        type="text"
                                        value={eventForm.location}
                                        onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Notes:</label>
                                    <textarea
                                        value={eventForm.notes}
                                        onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="events-form-row">
                                    <div className="events-form-group">
                                        <label>Deadline:</label>
                                        <input
                                            type="text"
                                            value={eventForm.deadline}
                                            onChange={(e) => setEventForm({...eventForm, deadline: e.target.value})}
                                            placeholder="e.g. End of day, Next Friday, etc."
                                        />
                                    </div>
                                    
                                    <div className="form-group events-checkbox-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={eventForm.quick_turn}
                                                onChange={(e) => setEventForm({...eventForm, quick_turn: e.target.checked})}
                                            />
                                            Quick Turn
                                        </label>
                                    </div>
                                </div>
                                
                                <div className="form-group events-checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={addShotRequest}
                                            onChange={(e) => setAddShotRequest(e.target.checked)}
                                        />
                                        Add Shot Request after creating event
                                    </label>
                                </div>
                                
                                <div className="events-form-actions">
                                    <button type="button" onClick={() => setShowAddEventModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit">
                                        Create Event
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                

                
                {/* Shot Request Modal */}
                {showShotRequestModal && (
                    <div className="events-modal-overlay" onClick={() => setShowShotRequestModal(false)}>
                        <div className="events-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="events-modal-header">
                                <h2>Add Shot Request</h2>
                                <button 
                                    className="events-close-btn"
                                    onClick={() => setShowShotRequestModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                            
                            <form onSubmit={handleAddShotRequest} className="events-form">
                                <div className="events-form-group">
                                    <label>Shot Request:</label>
                                    <textarea
                                        value={shotRequestForm.request}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, request: e.target.value})}
                                        rows="3"
                                        placeholder="Describe the shot request..."
                                        required
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Notes:</label>
                                    <textarea
                                        value={shotRequestForm.notes}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, notes: e.target.value})}
                                        rows="3"
                                        placeholder="Additional notes..."
                                    />
                                </div>
                                
                                <div className="events-form-row">
                                    <div className="events-form-group">
                                        <label>Start Time:</label>
                                        <input
                                            type="time"
                                            value={shotRequestForm.start_time}
                                            onChange={(e) => setShotRequestForm({...shotRequestForm, start_time: e.target.value})}
                                        />
                                    </div>
                                    
                                    <div className="events-form-group">
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            value={shotRequestForm.end_time}
                                            onChange={(e) => setShotRequestForm({...shotRequestForm, end_time: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="events-form-row">
                                    <div className="events-form-group">
                                        <label>Deadline:</label>
                                        <input
                                            type="text"
                                            value={shotRequestForm.deadline}
                                            onChange={(e) => setShotRequestForm({...shotRequestForm, deadline: e.target.value})}
                                            placeholder="e.g. End of day, Next Friday, etc."
                                        />
                                    </div>
                                    
                                    <div className="form-group events-checkbox-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={shotRequestForm.quick_turn}
                                                onChange={(e) => setShotRequestForm({...shotRequestForm, quick_turn: e.target.checked})}
                                            />
                                            Quick Turn
                                        </label>
                                    </div>
                                </div>
                                
                                <div className="events-form-actions">
                                    <button type="button" onClick={() => setShowShotRequestModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit">
                                        Create Shot Request
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    )
}