import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../../utils/apiConfig'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { formatDateForHeader } from '../../utils/dateUtils'
import '../../styles/photographer-dashboard.css'
import '../../styles/photographer-dashboard-mobile.css'

export const PhotographerDashboardView = () => {
    const { user, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()
    const { addNotification, markAsNew, isNew, lastFetchTime, setLastFetchTime } = useNotifications()

    // State management
    const [events, setEvents] = useState([])
    const [shotRequests, setShotRequests] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())

    // Use global selectedDate, fallback to today
    const activeDate = selectedDate || new Date().toISOString().split('T')[0]

    // Real-time updates for event status
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000) // Update every 30 seconds
        return () => clearInterval(intervalId)
    }, [])

    // Generate time slots in 15-minute intervals from 6 AM to midnight ONLY
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

    // Format time to 12-hour format
    const formatTimeTo12Hour = (time24) => {
        if (!time24) return ''
        const [hours, minutes] = time24.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

    // Fetch data on component mount and when dependencies change
    useEffect(() => {
        if (selectedOrganizationId && selectedProjectId) {
            fetchPhotographerData()
        }
    }, [selectedOrganizationId, selectedProjectId, selectedDate])

    const fetchPhotographerData = async () => {
        try {
            setLoading(true)
            
            // Fetch events for the current project
            const eventsResponse = await fetch(`${API_CONFIG.baseUrl}/api/events?project_id=${selectedProjectId}`)
            const eventsData = await eventsResponse.json()
            setEvents(eventsData)

            // Fetch shot requests for the current project
            const shotRequestsResponse = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests?project_id=${selectedProjectId}`)
            const shotRequestsData = await shotRequestsResponse.json()
            setShotRequests(shotRequestsData)

            // Fetch personnel data
            const personnelResponse = await fetch(`${API_CONFIG.baseUrl}/api/personnel?organization_id=${selectedOrganizationId}`)
            const personnelData = await personnelResponse.json()
            setPersonnel(personnelData)
        } catch (error) {
            console.error('Error fetching photographer data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Get current photographer's info
    const currentPhotographer = useMemo(() => {
        return personnel.find(p => p.user_id === user?.id)
    }, [personnel, user?.id])

    // Filter events for current photographer on selected date
    const photographerEvents = useMemo(() => {
        if (!currentPhotographer || !events.length) return []

        return events.filter(event => {
            // Check if event is on the selected date
            if (event.date !== activeDate) return false

            // Check if photographer is assigned to this event
            if (!event.assigned_personnel || !Array.isArray(event.assigned_personnel)) return false

            return event.assigned_personnel.some(person => 
                person.personnel_id === currentPhotographer.id
            )
        })
    }, [events, currentPhotographer, activeDate])

    // Calculate event positions for the schedule grid - USING SAME LOGIC AS SCHEDULE.JS
    const eventsWithPositions = useMemo(() => {
        return photographerEvents.map(event => {
            if (!event.start_time || !event.end_time) {
                return { ...event, position: { top: 0, height: 60 } }
            }

            const [startHour, startMinute] = event.start_time.split(':').map(Number)
            const [endHour, endMinute] = event.end_time.split(':').map(Number)

            // Don't show events outside our time range (6 AM to 11 PM)
            if (startHour < 6 || startHour > 23) return null

            // Use EXACT SAME calculation as Schedule.js
            // Calculate exact start position using total minutes
            const startTotalMinutes = (startHour * 60) + startMinute
            const endTotalMinutes = (endHour * 60) + endMinute
            
            // Exact start slot calculation (from 6 AM = 0)
            const exactStartSlot = (startTotalMinutes - (6 * 60)) / 15
            
            // Exact duration in slots
            const durationMinutes = endTotalMinutes - startTotalMinutes
            const exactDurationSlots = durationMinutes / 15
            
            // CORRECT CALCULATION: Based on 6AM = 0, using 87px per hour = 21.75px per 15-min slot
            const PIXELS_PER_15MIN_SLOT = 87 / 4 // 21.75px per 15-min slot
            const top = exactStartSlot * PIXELS_PER_15MIN_SLOT // NO OFFSET - events container starts at grid
            const height = Math.max(exactDurationSlots * PIXELS_PER_15MIN_SLOT, 21.75)

            // Debug logging
            console.log(`EVENT: ${event.name} (${event.start_time}-${event.end_time})`)
            console.log(`  Start total minutes: ${startTotalMinutes}, End total minutes: ${endTotalMinutes}`)
            console.log(`  Exact start slot: ${exactStartSlot}, Duration slots: ${exactDurationSlots}`)
            console.log(`  Calculated top: ${top}px, Height: ${height}px`)
            console.log(`  Expected for 10:30: slot ${(10*60+30-6*60)/15} = ${(10*60+30-6*60)/15}`)
            console.log(`  Expected for 14:00: slot ${(14*60+0-6*60)/15} = ${(14*60+0-6*60)/15}`)




            return {
                ...event,
                position: { top, height }
            }
        }).filter(event => event.position.top >= 0) // Only show events within time range
        .sort((a, b) => a.position.height - b.position.height) // Sort by height - shorter events first for z-index priority
    }, [photographerEvents])

    // Filter shot requests for photographer's assigned events OR independent shot requests
    const photographerShotRequests = useMemo(() => {
        if (!currentPhotographer || !shotRequests.length) return []

        const photographerEventIds = new Set(photographerEvents.map(event => event.id))

        return shotRequests.filter(sr => {
            // Show shot requests that either:
            // 1. Have events assigned to this photographer, OR
            // 2. Have no events (independent shot requests)
            if (!sr.events || !Array.isArray(sr.events) || sr.events.length === 0) {
                return true // Independent shot requests
            }

            return sr.events.some(event => photographerEventIds.has(event.id))
        })
    }, [shotRequests, currentPhotographer, photographerEvents])

    // Event click handler
    const handleEventClick = (event) => {
        setSelectedEvent(event)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedEvent(null)
    }

    // Get real-time event status
    const getEventStatus = (event) => {
        // Reference currentTimeTick to ensure real-time updates
        void currentTimeTick
        
        if (!event.start_time || !event.end_time) return 'scheduled'

        const now = new Date()
        const eventDate = new Date(event.date + 'T00:00:00')
        const startTime = new Date(`${event.date}T${event.start_time}`)
        const endTime = new Date(`${event.date}T${event.end_time}`)

        // Check if it's today
        const isToday = now.toDateString() === eventDate.toDateString()

        if (!isToday) {
            if (now < startTime) return 'scheduled'
            if (now > endTime) return 'done'
            return 'scheduled'
        }

        // For today's events
        const timeUntilStart = startTime - now
        const timeUntilEnd = endTime - now

        if (timeUntilStart > 0) {
            // Before event starts
            if (timeUntilStart <= 15 * 60 * 1000) return 'starting-soon' // 15 minutes
            if (timeUntilStart <= 60 * 60 * 1000) return 'upcoming' // 1 hour
            return 'scheduled'
        } else if (timeUntilEnd > 0) {
            // During event
            return 'ongoing'
        } else {
            // After event
            return 'done'
        }
    }

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return '#007bff' // Blue
            case 'upcoming': return '#fd7e14' // Orange
            case 'starting-soon': return '#dc3545' // Red
            case 'ongoing': return '#28a745' // Green
            case 'done': return '#6c757d' // Grey
            default: return '#007bff'
        }
    }

    // Get process point color for event cards
    const getProcessPointColor = (processPoint) => {
        switch (processPoint?.toLowerCase()) {
            case 'idle': return {
                backgroundColor: 'rgba(0, 255, 255, 0.15)',
                borderColor: 'rgba(0, 255, 255, 0.9)'
            }
            case 'ingest': return {
                backgroundColor: 'rgba(0, 128, 255, 0.15)',
                borderColor: 'rgba(0, 128, 255, 0.9)'
            }
            case 'cull': return {
                backgroundColor: 'rgba(255, 122, 24, 0.15)',
                borderColor: 'rgba(255, 122, 24, 0.9)'
            }
            case 'color': return {
                backgroundColor: 'rgba(255, 64, 64, 0.15)',
                borderColor: 'rgba(255, 64, 64, 0.9)'
            }
            case 'delivered': return {
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderColor: 'rgba(34, 197, 94, 0.9)'
            }
            default: return {
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                borderColor: 'rgba(107, 114, 128, 0.9)'
            }
        }
    }

    if (loading) {
        return (
            <div className="photographer-dashboard-container">
                <div className="photographer-loading">Loading photographer dashboard...</div>
            </div>
        )
    }

    if (!currentPhotographer) {
        return (
            <div className="photographer-dashboard-container">
                <div className="photographer-error">User profile not found. Please ensure you have a personnel record.</div>
            </div>
        )
    }

    const displayDate = formatDateForHeader(activeDate)

    return (
        <div className="photographer-dashboard-container">
            <div className="photographer-header">
                <h1>Photographer Schedule</h1>
                <div className="photographer-info">
                    <span className="photographer-name">{currentPhotographer.name}</span>
                    <span className="photographer-role">{currentPhotographer.role}</span>
                    <span className="photographer-date">Schedule for {displayDate}</span>
                </div>
            </div>

            <div className="photographer-content-grid">
                {/* Personal Schedule Section - Using Schedule Grid Layout */}
                <div className="photographer-schedule-section">
                    <div className="photographer-schedule-grid">
                        {/* Global grid lines */}
                        <div className='photographer-global-grid-lines'>
                            {timeSlots.map((slot) => (
                                <div
                                    key={`gline-${slot.time}`}
                                    className={`photographer-grid-slot ${slot.time.endsWith(':00') ? 'hour' : ''}`}
                                />
                            ))}
                        </div>

                        {/* Time column */}
                        <div className='photographer-time-column'>
                            <div className='photographer-time-header'>Time</div>
                            {timeSlots.map((slot) => (
                                <div key={slot.time} className='photographer-time-slot'>
                                    <p className='photographer-time-text'>{slot.display}</p>
                                </div>
                            ))}
                        </div>

                        {/* Single Events column */}
                        <div className='photographer-events-area'>
                            {/* Events header */}
                            <div className='photographer-events-header'>
                                <div className='photographer-column-header'>My Schedule</div>
                            </div>
                            
                            {/* Event column container */}
                            <div className='photographer-events-container'>
                                {eventsWithPositions.length === 0 ? (
                                    <div className='photographer-no-events'>
                                        <p>No events scheduled for {displayDate}</p>
                                    </div>
                                ) : (
                                    <div className='photographer-event-column'>
                                        {/* Render photographer's events */}
                                        {eventsWithPositions.map((event, index) => {
                                            const eventStatus = getEventStatus(event)
                                            const processColors = getProcessPointColor(event.process_point)
                                            return (
                                                <div
                                                    key={event.id}
                                                    className={`photographer-dashboard-event-card photographer-status-${eventStatus}`}
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${event.position.top}px`,
                                                        height: `${event.position.height}px`,
                                                        left: '8px',
                                                        zIndex: eventsWithPositions.length - index, // Shorter events (sorted first) get higher z-index
                                                        right: '8px',
                                                        backgroundColor: processColors.backgroundColor,
                                                        border: `2px solid ${processColors.borderColor}`,
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleEventClick(event)}
                                                >
                                                    <div className='photographer-dashboard-event-header'>
                                                        <h3 className='photographer-dashboard-event-title'>{event.name}</h3>
                                                        <div className='photographer-dashboard-event-status-container'>
                                                            {event.quick_turn && <span className='photographer-dashboard-quick-turn'>⚡</span>}
                                                            <span 
                                                                className='photographer-dashboard-event-status'
                                                                style={{ color: getStatusColor(eventStatus) }}
                                                            >
                                                                {eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1).replace('-', ' ')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className='photographer-dashboard-event-time'>
                                                        {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                                                    </div>
                                                    <div className='photographer-dashboard-event-location'>{event.location}</div>
                                                    <div className='photographer-dashboard-event-process' style={{ 
                                                        color: processColors.borderColor,
                                                        fontWeight: '600',
                                                        fontSize: '0.7rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginTop: '4px'
                                                    }}>
                                                        {(event.process_point || 'idle')}
                                                        {event.process_point_updated_by_name && (
                                                            <span style={{ 
                                                                fontSize: '0.6rem', 
                                                                marginLeft: '6px', 
                                                                opacity: 0.8,
                                                                fontStyle: 'italic',
                                                                textTransform: 'none',
                                                                fontWeight: '400'
                                                            }}>
                                                                by {event.process_point_updated_by_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shot Requests Section */}
                <div className="photographer-shot-requests-section">
                    <div className="photographer-section-header">
                        <h2>Assigned Shot Requests</h2>
                        <span className="photographer-shot-count">{photographerShotRequests.length} Requests</span>
                    </div>

                    <div className="photographer-shot-requests-list">
                        {photographerShotRequests.length === 0 ? (
                            <div className="photographer-no-shots">
                                <p>No shot requests available</p>
                            </div>
                        ) : (
                            photographerShotRequests.map(shotRequest => {
                                // Get the event status from the associated event (if any)
                                const associatedEvent = shotRequest.events && shotRequest.events.length > 0 
                                    ? shotRequest.events.find(event => photographerEvents.some(pe => pe.id === event.id))
                                    : null
                                
                                // For independent shot requests, use the shot request's own deadline
                                const isIndependent = !shotRequest.events || shotRequest.events.length === 0
                                
                                const eventStatus = associatedEvent ? getEventStatus(associatedEvent) : 'scheduled'
                                const statusColor = getStatusColor(eventStatus)
                                
                                return (
                                    <div key={shotRequest.id} className="photographer-shot-request-card">
                                        <div className="photographer-shot-header">
                                            <h3 className="photographer-shot-name">{shotRequest.request}</h3>
                                            <span
                                                className="photographer-shot-status"
                                                style={{
                                                    color: statusColor,
                                                    borderColor: statusColor
                                                }}
                                            >
                                                {eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1).replace('-', ' ')}
                                            </span>
                                        </div>

                                        <div className="photographer-shot-details">
                                            {shotRequest.notes && (
                                                <p className="photographer-shot-description">{shotRequest.notes}</p>
                                            )}

                                            <div className="photographer-shot-meta">
                                                <span className={`photographer-shot-priority ${shotRequest.quick_turn ? 'quick-turnaround' : 'normal-priority'}`}>
                                                    {shotRequest.quick_turn ? (
                                                        <>
                                                            <span className="lightning-bolt">⚡</span>
                                                            Quick Turnaround
                                                        </>
                                                    ) : (
                                                        'Priority: Normal'
                                                    )}
                                                </span>
                                                {shotRequest.quick_turn && shotRequest.deadline && (
                                                    <span className="photographer-shot-deadline">
                                                        Deadline: {shotRequest.deadline}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Event Association Display */}
                                            {isIndependent && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    padding: '4px 8px',
                                                    backgroundColor: 'rgba(255, 184, 77, 0.1)',
                                                    borderRadius: '4px',
                                                    border: '1px solid rgba(255, 184, 77, 0.3)'
                                                }}>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        color: '#ffb84d',
                                                        fontWeight: '500'
                                                    }}>
                                                        📸 Independent Shot Request
                                                    </span>
                                                </div>
                                            )}

                                            {/* Process Point Display */}
                                            <div className="photographer-shot-process" style={{
                                                marginTop: '8px',
                                                padding: '6px 8px',
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(255, 255, 255, 0.1)'
                                            }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    color: '#ffffff'
                                                }}>
                                                    Process: {(shotRequest.process_point || 'idle')}
                                                    {shotRequest.process_point_updated_by_name && (
                                                        <span style={{ 
                                                            fontSize: '0.65rem', 
                                                            marginLeft: '6px', 
                                                            opacity: 0.8,
                                                            fontStyle: 'italic',
                                                            textTransform: 'none',
                                                            fontWeight: '400'
                                                        }}>
                                                            by {shotRequest.process_point_updated_by_name}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Event Details Modal (same as Schedule.js) */}
            {showModal && selectedEvent && (
                <div className="photographer-modal-overlay" onClick={closeModal}>
                    <div className="photographer-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="photographer-modal-header">
                            <h2>{selectedEvent.name}</h2>
                            <button className="photographer-modal-close" onClick={closeModal}>×</button>
                        </div>
                        
                        <div className="photographer-modal-body">
                            <div className="photographer-event-detail-row">
                                <label>Time:</label>
                                <span>{formatTimeTo12Hour(selectedEvent.start_time)} - {formatTimeTo12Hour(selectedEvent.end_time)}</span>
                            </div>
                            
                            <div className="photographer-event-detail-row">
                                <label>Date:</label>
                                <span>{formatDateForHeader(selectedEvent.date)}</span>
                            </div>
                            
                            <div className="photographer-event-detail-row">
                                <label>Location:</label>
                                <span>{selectedEvent.location}</span>
                            </div>
                            
                            {selectedEvent.notes && (
                                <div className="photographer-event-detail-row">
                                    <label>Notes:</label>
                                    <span>{selectedEvent.notes}</span>
                                </div>
                            )}
                            
                            <div className="photographer-event-detail-row">
                                <label>Quick Turn:</label>
                                <span>{selectedEvent.quick_turn ? 'Yes ⚡' : 'No'}</span>
                            </div>
                            
                            {selectedEvent.deadline && (
                                <div className="photographer-event-detail-row">
                                    <label>Deadline:</label>
                                    <span>{selectedEvent.deadline}</span>
                                </div>
                            )}
                            
                            <div className="photographer-event-detail-row">
                                <label>Status:</label>
                                <span style={{ 
                                    color: getStatusColor(getEventStatus(selectedEvent)),
                                    fontWeight: 'bold'
                                }}>
                                    {getEventStatus(selectedEvent).charAt(0).toUpperCase() + getEventStatus(selectedEvent).slice(1).replace('-', ' ')}
                                </span>
                            </div>
                        </div>
                        
                        <div className="photographer-modal-footer">
                            <button className="photographer-modal-button" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}