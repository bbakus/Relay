import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../utils/apiConfig'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import { formatDateForHeader } from '../utils/dateUtils'
import '../styles/schedule.css'

export const Schedule = () => {
    const { user, selectedDate, selectedProjectId } = useAuth()
    // Use global selectedDate from AuthContext, fallback to today if not set
    const activeDate = selectedDate || new Date().toISOString().split('T')[0]
    

    

    const [events, setEvents] = useState([])
    const [projects, setProjects] = useState([])
    const [organizations, setOrganizations] = useState([])
    const [personnel, setPersonnel] = useState([])

    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showModal, setShowModal] = useState(false)

    // Generate time slots in 15-minute intervals from 6 AM to 11 PM
    const generateTimeSlots = () => {
        const slots = []
        for (let hour = 6; hour <= 23; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                let display = ''
                
                if (minute === 0) {
                    // Show hour labels only
                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
                    display = `${displayHour}${hour >= 12 ? ' PM' : ' AM'}`
                }
                
                slots.push({
                    time: timeString,
                    display: display,
                    position: ((hour - 6) * 4) + (minute / 15) // Position in grid
                })
            }
        }
        return slots
    }

    const timeSlots = generateTimeSlots()

    // Check if user is admin
    const isAdmin = useMemo(() => {
        return (user?.access || '').toLowerCase() === 'admin'
    }, [user])

    const fetchOrganizations = async () => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/organizations`)
            if (response.ok) {
                const data = await response.json()
                setOrganizations(Array.isArray(data) ? data : [])
            } else {
                setOrganizations([])
            }
        } catch (error) {
            console.error('Error fetching organizations:', error)
            setOrganizations([])
        }
    }

    const fetchProjects = async () => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/projects`)
            if (response.ok) {
                const data = await response.json()
                setProjects(Array.isArray(data) ? data : [])
            } else {
                setProjects([])
            }
        } catch (error) {
            console.error('Error fetching projects:', error)
            setProjects([])
        }
    }

    const fetchPersonnel = async () => {
        try {
            // Filter personnel by company for company admins (same logic as Personnel component)
            let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
            if (user?.company_id) {
                personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
            }
            
            const response = await fetch(personnelUrl)
            if (response.ok) {
                const data = await response.json()
                setPersonnel(Array.isArray(data) ? data : [])
            } else {
                setPersonnel([])
            }
        } catch (error) {
            console.error('Error fetching personnel:', error)
            setPersonnel([])
        }
    }

    const fetchEvents = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events`)
            if (response.ok) {
                const allEvents = await response.json()
                // Filter events for selected date
                const dayEvents = allEvents
                    .filter(event => event.date === activeDate)
                    .filter(event => !selectedProjectId || event.project_id === Number(selectedProjectId))
                setEvents(dayEvents)
            }
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAdmin) {
            fetchOrganizations()
        }
        fetchProjects()
        fetchPersonnel()
        fetchEvents()
    }, [activeDate, selectedProjectId, isAdmin, user?.company_id])







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

    // Handle process point change in modal
    const handleProcessPointChange = async (eventId, newProcessPoint) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    process_point: newProcessPoint
                })
            })

            if (response.ok) {
                // Update the selectedEvent immediately for modal display
                setSelectedEvent(prev => prev ? { ...prev, process_point: newProcessPoint } : null)
                
                // Update events state directly instead of fetching all events to prevent scroll jump
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

    const handleQuickTurnChange = async (eventId, newQuickTurn) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quick_turn: newQuickTurn
                })
            })

            if (response.ok) {
                // Update the selectedEvent immediately for modal display
                setSelectedEvent(prev => prev ? { ...prev, quick_turn: newQuickTurn } : null)
                
                // Update events state directly instead of fetching all events to prevent scroll jump
                setEvents(prevEvents => 
                    prevEvents.map(event => 
                        event.id === eventId 
                            ? { ...event, quick_turn: newQuickTurn }
                            : event
                    )
                )
            } else {
                console.error('Failed to update quick turn status')
            }
        } catch (error) {
            console.error('Error updating quick turn status:', error)
        }
    }

    const handleDeleteEvent = async (eventId) => {
        if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            return
        }
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'DELETE'
            })
            
            if (response.ok) {
                // Remove the event from local state
                setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId))
                
                // Close modal and clear selected event
                setSelectedEvent(null)
                setShowModal(false)
            } else {
                console.error('Failed to delete event')
            }
        } catch (error) {
            console.error('Error deleting event:', error)
        }
    }

    // Handle personnel assignment to event
    const handleAssignPersonnelToEvent = async (personnelId, eventIds) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnelId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_ids: eventIds })
            })

            if (response.ok) {
                // Refresh personnel data to get updated assignments
                fetchPersonnel()
            } else {
                console.error('Failed to assign personnel to event')
            }
        } catch (error) {
            console.error('Error assigning personnel:', error)
        }
    }

    // Handle column change when dragging events
    const handleColumnChange = async (eventId, newColumnNumber) => {
        try {
            // Store current scroll position
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop

            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    column_number: newColumnNumber
                })
            })

            if (response.ok) {
                // Update events state directly instead of fetching all events
                setEvents(prevEvents => 
                    prevEvents.map(event => 
                        event.id === eventId 
                            ? { ...event, column_number: newColumnNumber }
                            : event
                    )
                )
                
                // Restore scroll position after state update
                setTimeout(() => {
                    window.scrollTo(0, scrollPosition)
                }, 0)
            } else {
                console.error('Failed to update column')
            }
        } catch (error) {
            console.error('Error updating column:', error)
        }
    }

    // Drag and drop handlers
    const handleDragStart = (e, event) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            eventId: event.id,
            currentColumn: event.column_number || 0
        }))
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        // Add visual feedback
        e.currentTarget.setAttribute('data-drag-over', 'true')
    }

    const handleDragLeave = (e) => {
        e.currentTarget.removeAttribute('data-drag-over')
    }

    const handleDrop = (e, targetColumn) => {
        e.preventDefault()
        // Remove visual feedback
        e.currentTarget.removeAttribute('data-drag-over')
        
        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
            const { eventId, currentColumn } = dragData
            
            // Only update if actually moving to a different column
            if (currentColumn !== targetColumn) {
                handleColumnChange(eventId, targetColumn)
            }
        } catch (error) {
            console.error('Error handling drop:', error)
        }
    }

    const getEventPosition = (event) => {
        if (!event.start_time || !event.end_time) return null

        const [startHour, startMinute] = event.start_time.split(':').map(Number)
        const [endHour, endMinute] = event.end_time.split(':').map(Number)

        // Don't show events outside our time range (6 AM to 11 PM)
        if (startHour < 6 || startHour > 23) return null

        // Precise positioning calculation to align with time slots
        // Each time slot is 60px tall and represents 15 minutes
        // 6:00 AM = slot 0 = 0px
        // 6:15 AM = slot 1 = 60px  
        // 6:30 AM = slot 2 = 120px
        // 6:45 AM = slot 3 = 180px
        // 7:00 AM = slot 4 = 240px
        
        // Calculate exact start position
        const startTotalMinutes = (startHour * 60) + startMinute
        const endTotalMinutes = (endHour * 60) + endMinute
        
        // Exact start slot calculation (from 6 AM = 0)
        const exactStartSlot = (startTotalMinutes - (6 * 60)) / 15
        
        // Exact duration in slots
        const durationMinutes = endTotalMinutes - startTotalMinutes
        const exactDurationSlots = durationMinutes / 15
        
        // MATCH THE ACTUAL CSS: .time-slot has height: 60px per 15-min slot
        const PIXELS_PER_15MIN_SLOT = 60 // CSS: .time-slot { height: 60px }
        const PIXELS_PER_HOUR = PIXELS_PER_15MIN_SLOT * 4 // 60px × 4 = 240px per hour
        const top = exactStartSlot * PIXELS_PER_15MIN_SLOT // NO OFFSET - let's see where this puts events
        const height = Math.max(exactDurationSlots * PIXELS_PER_15MIN_SLOT, 60)



        return {
            top: top,
            height: height,
            startTime: event.start_time,
            endTime: event.end_time
        }
    }

    const getEventsWithPositions = () => {
        return events
            .map(event => ({ ...event, position: getEventPosition(event) }))
            .filter(event => event.position !== null)
            .sort((a, b) => a.position.top - b.position.top)
    }

    // Group events by column
    const getEventsByColumn = () => {
        const eventsByColumn = { 0: [], 1: [], 2: [], 3: [], 4: [] }
        
        eventsWithPositions.forEach(event => {
            const column = event.column_number || 0
            if (eventsByColumn[column]) {
                eventsByColumn[column].push(event)
            }
        })
        
        return eventsByColumn
    }

    const eventsWithPositions = useMemo(() => getEventsWithPositions(), [events])
    const eventsByColumn = useMemo(() => getEventsByColumn(), [eventsWithPositions])

    // Project status calculation based on active date
    const getProjectStatus = (project) => {
        if (!project.start_date || !project.end_date) return 'scheduled'
        
        const projActiveDate = new Date(activeDate)
        const startDate = new Date(project.start_date)
        const endDate = new Date(project.end_date)
        
        if (projActiveDate < startDate) return 'scheduled'
        if (projActiveDate >= startDate && projActiveDate <= endDate) return 'live'
        if (projActiveDate > endDate) return 'done'
        
        return 'scheduled'
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return '#ffd700' // Bright yellow
            case 'live': return '#00ff00' // Bright green
            case 'done': return '#ff6b6b' // Bright red
            default: return '#ffd700'
        }
    }

 

    // Fixed 5 columns
    const columns = [0, 1, 2, 3, 4]



    // Note: Project auto-selection is now handled by global navigation context

    const handleEventClick = (event) => {
        console.log('Event clicked:', event.name) // DEBUG
        setSelectedEvent(event)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedEvent(null)
    }

    // Get personnel assigned to the selected event (and assigned to the current project)
    const getAssignedPersonnel = () => {
        if (!selectedEvent) return []
        
        // First filter by project - only show personnel assigned to the current project
        const projectPersonnel = personnel.filter(person => {
            if (!selectedProjectId) return true // If no project selected, show all
            return (person.project_ids || []).includes(Number(selectedProjectId))
        })
        
        // Then filter to only show personnel assigned to this event
        return projectPersonnel.filter(person => 
            (person.event_ids || []).includes(selectedEvent.id)
        )
    }

    // Get available personnel (not assigned to this event AND assigned to the current project)
    const getAvailablePersonnel = () => {
        if (!selectedEvent) return []
        
        // First filter by project - only show personnel assigned to the current project
        const projectPersonnel = personnel.filter(person => {
            if (!selectedProjectId) return true // If no project selected, show all
            return (person.project_ids || []).includes(Number(selectedProjectId))
        })
        
        // Then filter out personnel already assigned to this event
        return projectPersonnel.filter(person => 
            !(person.event_ids || []).includes(selectedEvent.id)
        )
    }

    // Get role class for styling
    const getRoleClass = (role) => {
        const r = (role || '').toLowerCase()
        if (r.includes('photographer')) return 'role-photographer'
        if (r.includes('editor')) return 'role-editor'
        if (r.includes('coordinator')) return 'role-coordinator'
        if (r.includes('admin')) return 'role-admin'
        if (r.includes('client')) return 'role-client'
        if (r.includes('videographer')) return 'role-videographer'
        return ''
    }

    return (
        <div className='view-container'>
            <Nav />
            <div className='page-container'>
                <div className='schedule-container'>
                    <div className='schedule-header'>
                        <h1>Schedule</h1>
                        

                    </div>



                    {loading ? (
                        <div className='loading'>Loading events...</div>
                    ) : (
                        <div className='schedule-grid'>
                            {/* TEST: Compare schedule-grid positioning vs events-container positioning */}

                            
                            {/* unified grid overlay across time + events */}
                            <div className='global-grid-lines'>
                                {timeSlots.map((slot) => (
                                    <div
                                        key={`gline-${slot.time}`}
                                        className={`global-grid-slot ${slot.time.endsWith(':00') ? 'hour' : ''}`}
                                    />
                                ))}
                            </div>
                            {/* Time column */}
                            <div className='time-column'>
                                <div className='time-header'>Time</div>
                                {timeSlots.map((slot) => (
                                    <div key={slot.time} className='time-slot'>
                                        <p className='time-text'>{slot.display}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Events columns - Fixed 5 columns */}
                            <div className='events-area'>
                                {/* Events header to match time header */}
                                <div className='events-header'>
                                    <div className='column-header'>Column 1</div>
                                    <div className='column-header'>Column 2</div>
                                    <div className='column-header'>Column 3</div>
                                    <div className='column-header'>Column 4</div>
                                    <div className='column-header'>Column 5</div>
                                </div>
                                
                                {/* Event columns container */}
                                <div className='sched-events-container'>
                                    


                                    
                                    {eventsWithPositions.length === 0 ? (
                                        <div className='no-events'>
                                            <p>No events scheduled for {formatDateForHeader(activeDate)}</p>
                                        </div>
                                    ) : (
                                        // Render drop zones for each column
                                        columns.map((columnIndex) => (
                                            <div 
                                                key={columnIndex} 
                                                className='sched-event-column'
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, columnIndex)}
                                            >
                                                {/* Render events for this column */}
                                                {eventsByColumn[columnIndex]?.map(event => (
                                                    <div
                                                        key={event.id}
                                                        className={`sched-event-card process-${(event.process_point || 'idle').toLowerCase()}`}
                                                        style={{
                                                            position: 'absolute',
                                                            top: `${event.position.top}px`,
                                                            height: `${event.position.height}px`,
                                                            left: '8px',
                                                            right: '8px',
                                                            minHeight: '60px',
                                                            backgroundColor: getProcessPointColor(event.process_point).backgroundColor,
                                                            border: `2px solid ${getProcessPointColor(event.process_point).borderColor}`,
                                                            cursor: 'grab'
                                                        }}
                                                        draggable={true}
                                                        onDragStart={(e) => handleDragStart(e, event)}
                                                        onClick={() => handleEventClick(event)}
                                                    >
                                                        <div className='event-header'>
                                                            <h3>{event.name}</h3>
                                                            {event.quick_turn && <span className='quick-turn'>⚡</span>}
                                                        </div>
                                                        <div className='event-time'>
                                                            {event.start_time} - {event.end_time}
                                                        </div>
                                                        <div className='event-location'>{event.location}</div>
                                                        {event.notes && <div className='event-notes'>{event.notes}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Event Details Modal */}
            {showModal && selectedEvent && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedEvent.name}</h2>
                            <button className="modal-close" onClick={closeModal}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="event-detail-row">
                                <label>Time:</label>
                                <span>{selectedEvent.start_time} - {selectedEvent.end_time}</span>
                            </div>
                            
                            <div className="event-detail-row">
                                <label>Date:</label>
                                <span>{formatDateForHeader(selectedEvent.date)}</span>
                            </div>
                            
                            <div className="event-detail-row">
                                <label>Location:</label>
                                <span>{selectedEvent.location}</span>
                            </div>
                            
                            {selectedEvent.notes && (
                                <div className="event-detail-row">
                                    <label>Notes:</label>
                                    <span>{selectedEvent.notes}</span>
                                </div>
                            )}
                            
                            <div className="event-detail-row">
                                <label>Quick Turn:</label>
                                <div className="quick-turn-toggle">
                                    <input
                                        type="checkbox"
                                        id="quick-turn-checkbox"
                                        checked={selectedEvent.quick_turn || false}
                                        onChange={(e) => handleQuickTurnChange(selectedEvent.id, e.target.checked)}
                                    />
                                    <label htmlFor="quick-turn-checkbox">
                                        {selectedEvent.quick_turn ? 'Yes ⚡' : 'No'}
                                    </label>
                                </div>
                            </div>
                            
                            {selectedEvent.deadline && (
                                <div className="event-detail-row">
                                    <label>Deadline:</label>
                                    <span>{selectedEvent.deadline}</span>
                                </div>
                            )}
                            
                            <div className="event-detail-row">
                                <label>Process Point:</label>
                                <select 
                                    value={selectedEvent.process_point || 'idle'} 
                                    onChange={(e) => handleProcessPointChange(selectedEvent.id, e.target.value)}
                                    className="process-point-select"
                                >
                                    <option value="idle">Idle</option>
                                    <option value="ingest">Ingest</option>
                                    <option value="cull">Cull</option>
                                    <option value="color">Color</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                            </div>

                            {/* Personnel Assignment Section */}
                            <div className="event-personnel-section">
                                <h3>Assigned Personnel</h3>
                                <div className="assigned-personnel-list">
                                    {getAssignedPersonnel().length === 0 ? (
                                        <div className="no-personnel">No personnel assigned to this event</div>
                                    ) : (
                                        getAssignedPersonnel().map(person => (
                                            <div key={person.id} className={`personnel-item ${getRoleClass(person.role)}`}>
                                                <div className="personnel-info">
                                                    <span className="personnel-name">{person.name}</span>
                                                    <span className="personnel-role"> - {person.role || 'No role'}</span>
                                                </div>
                                                <button 
                                                    className="unassign-personnel-btn"
                                                    onClick={() => {
                                                        const currentEventIds = person.event_ids || []
                                                        const newEventIds = currentEventIds.filter(id => id !== selectedEvent.id)
                                                        handleAssignPersonnelToEvent(person.id, newEventIds)
                                                    }}
                                                    title="Remove from event"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                
                                <h4>Assign Personnel</h4>
                                <div className="personnel-assign-dropdown-section">
                                    {getAvailablePersonnel().length === 0 ? (
                                        <div className="no-personnel">All personnel are assigned to this event</div>
                                    ) : (
                                        <select 
                                            className="personnel-assign-dropdown"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const personnelId = parseInt(e.target.value)
                                                    const person = personnel.find(p => p.id === personnelId)
                                                    if (person) {
                                                        const currentEventIds = person.event_ids || []
                                                        const newEventIds = [...currentEventIds, selectedEvent.id]
                                                        handleAssignPersonnelToEvent(person.id, newEventIds)
                                                    }
                                                    // Reset dropdown
                                                    e.target.value = ''
                                                }
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Select personnel to assign...</option>
                                            {getAvailablePersonnel().map(person => (
                                                <option key={person.id} value={person.id}>
                                                    {person.name} - {person.role || 'No role'}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="modal-footer">
                            <button 
                                className="modal-button delete-button" 
                                onClick={() => handleDeleteEvent(selectedEvent.id)}
                            >
                                Delete Event
                            </button>
                            <button className="modal-button" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

