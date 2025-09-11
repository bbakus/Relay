import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../../utils/apiConfig'
import { useAuth } from '../../context/AuthContext'
import { formatDateForHeader } from '../../utils/dateUtils'
import '../../styles/photographer-dashboard.css'

export const PhotographerDashboardView = () => {
    const { user, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()

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
    }, [photographerEvents])

    // Filter shot requests for photographer's assigned events
    const photographerShotRequests = useMemo(() => {
        if (!currentPhotographer || !shotRequests.length) return []

        const photographerEventIds = new Set(photographerEvents.map(event => event.id))

        return shotRequests.filter(sr => {
            // Check if shot request has events assigned to this photographer
            if (!sr.events || !Array.isArray(sr.events)) return false

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
                                        {eventsWithPositions.map(event => {
                                            const eventStatus = getEventStatus(event)
                                            return (
                                                <div
                                                    key={event.id}
                                                    className={`photographer-dashboard-event-card photographer-status-${eventStatus}`}
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${event.position.top}px`,
                                                        height: `${event.position.height}px`,
                                                        left: '8px',
                                                        right: '8px',
                                                        backgroundColor: 'rgba(0, 123, 255, 0.15)', /* Blue background */
                                                        border: `2px solid rgba(0, 123, 255, 0.8)`, /* Blue border */
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
                                <p>No shot requests assigned to your events</p>
                            </div>
                        ) : (
                            photographerShotRequests.map(shotRequest => {
                                // Get the event status from the associated event
                                const associatedEvent = shotRequest.events && shotRequest.events.length > 0 
                                    ? shotRequest.events.find(event => photographerEvents.some(pe => pe.id === event.id))
                                    : null
                                
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
                                <span>{selectedEvent.start_time} - {selectedEvent.end_time}</span>
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