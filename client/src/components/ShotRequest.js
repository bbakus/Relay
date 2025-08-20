import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import '../styles/shot_request.css'

export const ShotRequest = () => {
    const { user, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()
    const [shotRequests, setShotRequests] = useState([])
    const [events, setEvents] = useState([])
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [expandedShotRequests, setExpandedShotRequests] = useState(new Set())
    const [editingShotRequest, setEditingShotRequest] = useState(null)
    const [editFormData, setEditFormData] = useState({})
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
    
    // Filter states (use global selectedDate for date filtering)
    const [filterQuickTurn, setFilterQuickTurn] = useState('all')
    const [filterProcessPoint, setFilterProcessPoint] = useState('all')
    
    // Form state
    const [formData, setFormData] = useState({
        request: '',
        notes: '',
        quick_turn: false,
        start_time: '',
        end_time: '',
        deadline: '',
        event_id: '',
        project_id: ''
    })

    // Event search state
    const [eventSearchText, setEventSearchText] = useState('')
    const [showEventDropdown, setShowEventDropdown] = useState(false)
    const [filteredEvents, setFilteredEvents] = useState([])

    // Filter events based on search text
    useEffect(() => {
        if (eventSearchText.trim() === '') {
            setFilteredEvents(events)
        } else {
            const filtered = events.filter(event => 
                event.name.toLowerCase().includes(eventSearchText.toLowerCase()) ||
                event.date.includes(eventSearchText)
            )
            setFilteredEvents(filtered)
        }
    }, [eventSearchText, events])

    // Handle event selection
    const handleEventSelect = (event) => {
        setFormData(prev => ({...prev, event_id: event.id.toString()}))
        setEventSearchText(event.name + ' - ' + event.date)
        setShowEventDropdown(false)
    }

    // Handle search input focus
    const handleEventSearchFocus = () => {
        setShowEventDropdown(true)
        if (eventSearchText === '') {
            setFilteredEvents(events)
        }
    }

    // Handle search input change
    const handleEventSearchChange = (e) => {
        setEventSearchText(e.target.value)
        setShowEventDropdown(true)
    }

    // Real-time updates
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000)
        return () => clearInterval(intervalId)
    }, [])

    // Fetch data
    useEffect(() => {
        fetchShotRequests()
        fetchEvents()
        fetchProjects()
    }, [])

    const fetchShotRequests = async () => {
        try {
            setLoading(true)
            const response = await fetch('http://localhost:5001/api/shot-requests')
            if (response.ok) {
                const data = await response.json()
                setShotRequests(data)
            }
        } catch (error) {
            console.error('Error fetching shot requests:', error)
        } finally {
            setLoading(false)
        }
    }

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

    const fetchProjects = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/projects')
            if (response.ok) {
                const data = await response.json()
                setProjects(data)
            }
        } catch (error) {
            console.error('Error fetching projects:', error)
        }
    }

    // Filter projects by organization (use global selection like other components)
    const orgProjects = useMemo(() => {
        if (user?.access === 'Admin' && selectedOrganizationId) {
            return projects.filter(p => p.organization_id === parseInt(selectedOrganizationId))
        } else if (!user?.organization_id) {
            return projects
        } else {
            return projects.filter(p => String(p.organization_id) === String(user.organization_id))
        }
    }, [projects, user?.organization_id, user?.access, selectedOrganizationId])

    // Current project logic (use global selectedProjectId like other components)
    const currentProject = useMemo(() => {
        // If admin has selected a specific project, use that
        if (user?.access === 'Admin' && selectedProjectId) {
            const selected = projects.find(p => p.id === parseInt(selectedProjectId))
            if (selected) {
                console.log('Admin selected project for shot requests:', selected.name)
                return selected
            }
        }
        
        // Otherwise auto-detect for non-admin users
        if (!orgProjects.length) return null
        const today = new Date().toISOString().split('T')[0]
        const ongoing = orgProjects.filter(p => p.start_date <= today && today <= p.end_date)
        
        if (ongoing.length) {
            return ongoing.reduce((a, b) => (a.start_date > b.start_date ? a : b))
        } else {
            const upcoming = orgProjects.filter(p => p.start_date >= today)
            if (upcoming.length) {
                return upcoming.reduce((a, b) => (a.start_date < b.start_date ? a : b))
            } else {
                return orgProjects.reduce((a, b) => (a.end_date > b.end_date ? a : b))
            }
        }
    }, [orgProjects, projects, user, selectedProjectId])

    // Get all shot requests (until API provides project filtering)
    const projectShotRequests = useMemo(() => {
        return shotRequests
    }, [shotRequests])

    // Get project dates for filter dropdown
    const projectDates = useMemo(() => {
        if (!currentProject) return []
        const dates = []
        const start = new Date(currentProject.start_date)
        const end = new Date(currentProject.end_date)
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0])
        }
        return dates
    }, [currentProject])

    // Filtered shot requests with all filters applied
    const filteredShotRequests = useMemo(() => {
        let filtered = projectShotRequests
        
        // Filter by date (based on associated events) - use global selectedDate
        if (selectedDate) {
            filtered = filtered.filter(sr => {
                const event = events.find(e => sr.events?.some(ev => ev.id === e.id))
                return event?.date === selectedDate
            })
        }
        
        // Filter by quick turn
        if (filterQuickTurn !== 'all') {
            const isQuickTurn = filterQuickTurn === 'yes'
            filtered = filtered.filter(sr => !!sr.quick_turn === isQuickTurn)
        }
        
        // Filter by process point
        if (filterProcessPoint !== 'all') {
            filtered = filtered.filter(sr => (sr.process_point || 'idle') === filterProcessPoint)
        }
        
        return filtered
    }, [projectShotRequests, selectedDate, filterQuickTurn, filterProcessPoint, events])

    // Date parsing helpers (moved here to be available for getShotRequestStatus)
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

    // Get status for shot request based on associated event (moved here to be available for useMemo)
    const getShotRequestStatus = (shotRequest) => {
        void currentTimeTick // Force recalculation on tick
        
        // Check if shot request has associated events
        if (!shotRequest.events || shotRequest.events.length === 0) {
            return 'scheduled' // No event, default to scheduled
        }

        // Use the first event's timing (shot requests are typically linked to one event)
        const event = shotRequest.events[0]
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
                if (timeUntilStart <= 15 * 60 * 1000) return 'starting-soon' // 15 minutes
                if (timeUntilStart <= 60 * 60 * 1000) return 'upcoming' // 1 hour
                return 'scheduled'
            }
            
            if (timeUntilEnd > 0) return 'ongoing'
            return 'done'
        }
        
        return 'scheduled'
    }

    // Upcoming shot requests (based on event timing, filtered by global date)
    const upcomingShotRequests = useMemo(() => {
        void currentTimeTick // Force recalculation
        
        // Filter shot requests by their individual status and global date
        return projectShotRequests.filter(shotRequest => {
            // First, check if shot request matches global date (if one is selected)
            if (selectedDate) {
                const event = events.find(e => shotRequest.events?.some(ev => ev.id === e.id))
                if (!event || event.date !== selectedDate) {
                    return false
                }
            }
            
            const status = getShotRequestStatus(shotRequest)
            // Only show shot requests that are upcoming, starting-soon, or ongoing
            return status === 'upcoming' || status === 'starting-soon' || status === 'ongoing'
        })
    }, [projectShotRequests, selectedDate, events, currentTimeTick])

    // Scheduled shot requests (for future events, filtered by global date)
    const scheduledShotRequests = useMemo(() => {
        void currentTimeTick // Force recalculation
        
        // Filter shot requests by scheduled status and global date
        return projectShotRequests.filter(shotRequest => {
            // First, check if shot request matches global date (if one is selected)
            if (selectedDate) {
                const event = events.find(e => shotRequest.events?.some(ev => ev.id === e.id))
                if (!event || event.date !== selectedDate) {
                    return false
                }
            }
            
            const status = getShotRequestStatus(shotRequest)
            // Only show shot requests that are scheduled
            return status === 'scheduled'
        })
    }, [projectShotRequests, selectedDate, events, currentTimeTick])

    const handleCreateShotRequest = async (e) => {
        e.preventDefault()
        try {
            const response = await fetch('http://localhost:5001/api/shot-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    project_id: currentProject?.id,
                })
            })
            
            if (response.ok) {
                setFormData({
                    request: '',
                    notes: '',
                    quick_turn: false,
                    start_time: '',
                    end_time: '',
                    deadline: '',
                    event_id: '',
                    project_id: ''
                })
                setShowCreateForm(false)
                fetchShotRequests()
            } else {
                console.error('Failed to create shot request')
            }
        } catch (error) {
            console.error('Error creating shot request:', error)
        }
    }

    const handleUpdateProcessPoint = async (shotRequestId, newProcessPoint) => {
        try {
            const response = await fetch(`http://localhost:5001/api/shot-requests/${shotRequestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    process_point: newProcessPoint
                })
            })
            
            if (response.ok) {
                // Update the shot request in state
                setShotRequests(prev => prev.map(sr => 
                    sr.id === shotRequestId 
                        ? { ...sr, process_point: newProcessPoint }
                        : sr
                ))
                

            } else {
                const errorText = await response.text()
                console.error('Failed to update process point:', response.status, errorText)
            }
        } catch (error) {
            console.error('Error updating process point:', error)
        }
    }





    const handleSaveEdit = async (shotRequestId) => {
        try {
            const response = await fetch(`http://localhost:5001/api/shot-requests/${shotRequestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editFormData)
            })

            if (response.ok) {
                setEditingShotRequest(null)
                setEditFormData({})
                fetchShotRequests() // Refresh the data
            } else {
                console.error('Failed to update shot request')
            }
        } catch (error) {
            console.error('Error updating shot request:', error)
        }
    }

    const handleDeleteShotRequest = async (shotRequestId) => {
        try {
            const response = await fetch(`http://localhost:5001/api/shot-requests/${shotRequestId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                fetchShotRequests() // Refresh the data
            } else {
                console.error('Failed to delete shot request')
            }
        } catch (error) {
            console.error('Error deleting shot request:', error)
        }
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

    // Process point color mapping with translucent backgrounds and vibrant borders
    const getProcessPointColor = (processPoint) => {
        switch (processPoint?.toLowerCase()) {
            case 'idle': return {
                backgroundColor: 'rgba(0, 255, 255, 0.15)',
                borderColor: 'rgba(0, 255, 255, 1)'
            }
            case 'ingest': return {
                backgroundColor: 'rgba(0, 128, 255, 0.15)',
                borderColor: 'rgba(0, 128, 255, 1)'
            }
            case 'cull': return {
                backgroundColor: 'rgba(255, 122, 24, 0.15)',
                borderColor: 'rgba(255, 122, 24, 1)'
            }
            case 'color': return {
                backgroundColor: 'rgba(255, 64, 64, 0.15)',
                borderColor: 'rgba(255, 64, 64, 1)'
            }
            case 'delivered': return {
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderColor: 'rgba(34, 197, 94, 1)'
            }
            default: return {
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                borderColor: 'rgba(107, 114, 128, 1)'
            }
        }
    }

    const ShotRequestCard = ({ shotRequest, showProcessColor = false, panelType = 'default' }) => {
        // Use events directly from shotRequest API response
        const event = shotRequest.events && shotRequest.events.length > 0 ? shotRequest.events[0] : null
        const processClass = showProcessColor ? `process-${(shotRequest.process_point || 'idle').toLowerCase()}` : ''
        const cardId = `${panelType}-${shotRequest.id}` // Unique ID per panel
        const isExpanded = expandedShotRequests.has(cardId)
        const isEditing = editingShotRequest === shotRequest.id
        
        // Get status for this shot request
        const status = getShotRequestStatus(shotRequest)
        const statusColor = getStatusColor(status)
        
        const handleCardClick = () => {
            setExpandedShotRequests(prev => {
                const newSet = new Set(prev)
                if (newSet.has(cardId)) {
                    newSet.delete(cardId)
                } else {
                    newSet.add(cardId)
                }
                return newSet
            })
        }

        const handleEditClick = (e) => {
            e.stopPropagation()
            setEditingShotRequest(shotRequest.id)
            setEditFormData({
                request: shotRequest.request,
                notes: shotRequest.notes || '',
                quick_turn: shotRequest.quick_turn || false,
                start_time: shotRequest.start_time || '',
                end_time: shotRequest.end_time || '',
                deadline: shotRequest.deadline || ''
            })
        }

        const handleCancelEdit = (e) => {
            e.stopPropagation()
            setEditingShotRequest(null)
            setEditFormData({})
        }

        const handleDeleteClick = async (e) => {
            e.stopPropagation()
            if (window.confirm('Are you sure you want to delete this shot request?')) {
                await handleDeleteShotRequest(shotRequest.id)
            }
        }

        const handleProcessPointChange = async (e) => {
            const newProcessPoint = e.target.value
            await handleUpdateProcessPoint(shotRequest.id, newProcessPoint)
        }
        
        return (
            <div className={`shot-request-card-collapsible ${processClass} ${isExpanded ? 'expanded' : ''}`}
                 style={showProcessColor ? {
                     borderColor: getProcessPointColor(shotRequest.process_point).borderColor,
                     backgroundColor: getProcessPointColor(shotRequest.process_point).backgroundColor
                 } : {}}>
                {/* Card Header - Always Visible */}
                <div className="sr-card-header" onClick={handleCardClick}>
                    <div className="sr-header-content">
                        <div className="sr-title-with-status">
                            <h4>{shotRequest.request}</h4>
                            <span 
                                className="sr-status-indicator"
                                style={{ 
                                    backgroundColor: statusColor,
                                    color: status === 'scheduled' ? '#ffffff' : '#ffffff'
                                }}
                            >
                                {status.replace('-', ' ').toUpperCase()}
                            </span>
                        </div>
                        <div className="sr-header-right">
                            {shotRequest.quick_turn && <span className="quick-turn">⚡</span>}
                            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                    </div>
                    
                    {/* Event info - always visible */}
                    {event && (
                        <div className="sr-event-simple">
                            <span className="sr-event-name">{event.name}</span>
                            <span className="sr-event-time">{event.start_time} - {event.end_time}</span>
                        </div>
                    )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="sr-card-details">
                        {isEditing ? (
                            /* Edit Form */
                            <form onSubmit={(e) => {e.preventDefault(); handleSaveEdit(shotRequest.id)}} className="sr-edit-form">
                                <div className="sr-form-group">
                                    <label>Request Description:</label>
                                    <input
                                        type="text"
                                        value={editFormData.request}
                                        onChange={(e) => setEditFormData(prev => ({...prev, request: e.target.value}))}
                                        required
                                    />
                                </div>
                                
                                <div className="sr-form-group">
                                    <label>Notes:</label>
                                    <textarea
                                        value={editFormData.notes}
                                        onChange={(e) => setEditFormData(prev => ({...prev, notes: e.target.value}))}
                                        rows={3}
                                    />
                                </div>
                                
                                <div className="sr-form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={editFormData.quick_turn}
                                            onChange={(e) => setEditFormData(prev => ({...prev, quick_turn: e.target.checked}))}
                                        />
                                        Quick Turn ⚡
                                    </label>
                                </div>
                                
                                <div className="sr-form-row">
                                    <div className="sr-form-group">
                                        <label>Start Time:</label>
                                        <input
                                            type="time"
                                            value={editFormData.start_time}
                                            onChange={(e) => setEditFormData(prev => ({...prev, start_time: e.target.value}))}
                                        />
                                    </div>
                                    
                                    <div className="sr-form-group">
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            value={editFormData.end_time}
                                            onChange={(e) => setEditFormData(prev => ({...prev, end_time: e.target.value}))}
                                        />
                                    </div>
                                </div>
                                
                                <div className="sr-form-group">
                                    <label>Deadline:</label>
                                    <input
                                        type="text"
                                        value={editFormData.deadline}
                                        onChange={(e) => setEditFormData(prev => ({...prev, deadline: e.target.value}))}
                                        placeholder="e.g., End of day, ASAP, etc."
                                    />
                                </div>
                                
                                <div className="sr-form-actions">
                                    <button type="button" onClick={handleCancelEdit} className="sr-cancel-btn">
                                        Cancel
                                    </button>
                                    <button type="submit" className="sr-save-btn">
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Simple Controls */
                            <div className="sr-simple-controls">
                                <div className="sr-controls-row">
                                    <div className="sr-process-group">
                                        <label>Process Point:</label>
                                        <select 
                                            value={shotRequest.process_point || 'idle'} 
                                            onChange={handleProcessPointChange}
                                            className="sr-process-select"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="idle">Idle</option>
                                            <option value="ingest">Ingest</option>
                                            <option value="cull">Cull</option>
                                            <option value="color">Color</option>
                                            <option value="delivered">Delivered</option>
                                        </select>
                                    </div>
                                    
                                    <div className="sr-card-actions">
                                        <button onClick={handleEditClick} className="sr-edit-btn">
                                            Edit
                                        </button>
                                        <button onClick={handleDeleteClick} className="sr-delete-btn">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="page-container">
                <Nav />
                <div className="loading">Loading shot requests...</div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <Nav />
            <div className='shot-request-page-header'>
                <h1>SHOT REQUESTS</h1>
                <button onClick={() => setShowCreateForm(true)}>Add Shot Request</button>
            </div>
            
            <div className="shot-requests-container">
                <div className="shot-requests-grid">
                    {/* Upcoming & Live - Top Left */}
                    <div className="sr-section">
                        <div className="shot-request-section-header">
                            <h2>Upcoming & Live</h2>
                            <span className="sr-count">{upcomingShotRequests.length}</span>
                        </div>
                        <div className="shot-request-sr-list">
                            {upcomingShotRequests.length === 0 ? (
                                <p className="shot-request-no-items">No shot requests for upcoming or live events</p>
                            ) : (
                                upcomingShotRequests.map(sr => (
                                    <ShotRequestCard key={sr.id} shotRequest={sr} panelType="upcoming" />
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* All Shot Requests - Top Right */}
                    <div className="sr-section">
                        <div className="shot-request-section-header">
                            <h2>All Shot Requests</h2>
                            <span className="sr-count">{filteredShotRequests.length}</span>
                        </div>
                        
                        {/* Filters */}
                        <div className="shot-request-sr-filters">
                            <div className="shot-request-filter-group">
                                <label>Quick Turn:</label>
                                <select 
                                    value={filterQuickTurn} 
                                    onChange={(e) => setFilterQuickTurn(e.target.value)}
                                    className="shot-request-filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="yes">Quick Turn</option>
                                    <option value="no">Standard</option>
                                </select>
                            </div>
                            
                            <div className="shot-request-filter-group">
                                <label>Process:</label>
                                <select 
                                    value={filterProcessPoint} 
                                    onChange={(e) => setFilterProcessPoint(e.target.value)}
                                    className="shot-request-filter-select"
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
                        
                        <div className="shot-request-sr-list">
                            {filteredShotRequests.length === 0 ? (
                                <p className="shot-request-no-items">No shot requests match the current filters</p>
                            ) : (
                                filteredShotRequests.map(sr => (
                                    <ShotRequestCard key={sr.id} shotRequest={sr} showProcessColor={true} panelType="all" />
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Scheduled Shot Requests - Bottom Left */}
                    <div className="sr-section">
                        <div className="shot-request-section-header">
                            <h2>Scheduled</h2>
                            <span className="sr-count">{scheduledShotRequests.length}</span>
                        </div>
                        <div className="shot-request-sr-list">
                            {scheduledShotRequests.length === 0 ? (
                                <p className="shot-request-no-items">No scheduled shot requests</p>
                            ) : (
                                scheduledShotRequests.map(sr => (
                                    <ShotRequestCard key={sr.id} shotRequest={sr} panelType="scheduled" />
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Future Panel - Bottom Right */}
                    <div className="sr-section">
                        <div className="shot-request-section-header">
                            <h2>Future Panel</h2>
                            <span className="sr-count">0</span>
                        </div>
                        <div className="shot-request-sr-list">
                            <p className="shot-request-no-items">Panel reserved for future use</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Create Shot Request Modal */}
            {showCreateForm && (
                <div className="shot-request-modal-overlay" onClick={() => setShowCreateForm(false)}>
                    <div className="shot-request-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="shot-request-modal-header">
                            <h2>Create Shot Request</h2>
                            <button 
                                className="shot-request-close-btn"
                                onClick={() => setShowCreateForm(false)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateShotRequest} className="sr-form">
                            <div className="shot-request-form-group">
                                <label>Request Description:</label>
                                <input
                                    type="text"
                                    value={formData.request}
                                    onChange={(e) => setFormData(prev => ({...prev, request: e.target.value}))}
                                    required
                                />
                            </div>
                            
                            <div className="shot-request-form-group">
                                <label>Event:</label>
                                <div className="custom-dropdown-container">
                                    <input
                                        type="text"
                                        value={eventSearchText}
                                        onChange={handleEventSearchChange}
                                        onFocus={handleEventSearchFocus}
                                        onBlur={() => setTimeout(() => setShowEventDropdown(false), 200)}
                                        placeholder="Click to select or type to search events..."
                                        required
                                        className="searchable-dropdown"
                                    />
                                    {showEventDropdown && (
                                        <div className="custom-dropdown-options">
                                            {filteredEvents.length > 0 ? (
                                                filteredEvents.map(event => (
                                                    <div
                                                        key={event.id}
                                                        className="custom-dropdown-option"
                                                        onClick={() => handleEventSelect(event)}
                                                    >
                                                        {event.name} - {event.date}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="custom-dropdown-option no-results">
                                                    No events found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="shot-request-form-group">
                                <label>Notes:</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                                    rows="3"
                                />
                            </div>
                            
                            <div className="shot-request-form-row">
                                <div className="shot-request-form-group">
                                    <label>Start Time:</label>
                                    <input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData(prev => ({...prev, start_time: e.target.value}))}
                                    />
                                </div>
                                
                                <div className="shot-request-form-group">
                                    <label>End Time:</label>
                                    <input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData(prev => ({...prev, end_time: e.target.value}))}
                                    />
                                </div>
                            </div>
                            
                            <div className="shot-request-form-group">
                                <label>Deadline:</label>
                                <input
                                    type="text"
                                    value={formData.deadline}
                                    onChange={(e) => setFormData(prev => ({...prev, deadline: e.target.value}))}
                                    placeholder="e.g., End of day, Next week"
                                />
                            </div>
                            
                            <div className="shot-request-form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.quick_turn}
                                        onChange={(e) => setFormData(prev => ({...prev, quick_turn: e.target.checked}))}
                                    />
                                    Quick Turn ⚡
                                </label>
                            </div>
                            
                            <div className="shot-request-form-actions">
                                <button type="button" onClick={() => setShowCreateForm(false)}>
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
    )
}