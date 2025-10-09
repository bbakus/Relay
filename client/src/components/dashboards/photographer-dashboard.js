import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../../utils/apiConfig'
import { useAuth } from '../../context/AuthContext'
// import { useNotifications } from '../../context/NotificationContext' // Temporarily disabled
import { formatDateForHeader } from '../../utils/dateUtils'
import '../../styles/photographer-dashboard.css'
import '../../styles/photographer-dashboard-mobile.css'
import '../../styles/quick-turn-dot.css'

export const PhotographerDashboardView = () => {
    const { user, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()
    // const { addNotification, markAsNew, isNew, lastFetchTime, setLastFetchTime } = useNotifications() // Temporarily disabled

    // State management
    const [events, setEvents] = useState([])
    const [shotRequests, setShotRequests] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
    const [searchQuery, setSearchQuery] = useState('')
    const [photographerNotes, setPhotographerNotes] = useState('')
    const [completedNotes, setCompletedNotes] = useState([])
    const [isEditMode, setIsEditMode] = useState(false)
    const [editingNotes, setEditingNotes] = useState('')
    const [newNoteInput, setNewNoteInput] = useState('')
    const [isShotRequestsCollapsed, setIsShotRequestsCollapsed] = useState(false)
    const [selectedShotRequest, setSelectedShotRequest] = useState(null)
    const [showShotRequestModal, setShowShotRequestModal] = useState(false)
    const [completedShotRequestNotes, setCompletedShotRequestNotes] = useState([])

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

    // Notification system temporarily disabled to fix performance issues
    // TODO: Re-implement with proper throttling and no infinite loops

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

            const isAssigned = event.assigned_personnel.some(person => 
                person.personnel_id === currentPhotographer.id
            )
            if (!isAssigned) return false

            // Apply search filter if search query exists
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim()
                const searchableText = [
                    event.name || '',
                    event.location || '',
                    event.notes || '',
                    event.start_time || '',
                    event.end_time || ''
                ].join(' ').toLowerCase()
                
                if (!searchableText.includes(query)) return false
            }

            return true
        })
    }, [events, currentPhotographer, activeDate, searchQuery])

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
    // Only show open shot requests (exclude completed ones)
    const photographerShotRequests = useMemo(() => {
        if (!currentPhotographer || !shotRequests.length) return []

        const photographerEventIds = new Set(photographerEvents.map(event => event.id))

        return shotRequests.filter(sr => {
            // Filter by date
            const hasEventOnSelectedDate = sr.events && sr.events.length > 0 && 
                sr.events.some(event => event.date === activeDate)
            
            // Normalize date - treat null, "null", undefined, and empty string as null
            const srDate = sr.date && sr.date !== 'null' && sr.date !== '' ? sr.date : null
            const hasOwnDateMatch = srDate === activeDate
            
            // Must match the selected date
            if (!hasEventOnSelectedDate && !hasOwnDateMatch) return false

            // Show shot requests that either:
            // 1. Have events assigned to this photographer, OR
            // 2. Are directly assigned to this photographer (check personnels)
            const isDirectlyAssigned = sr.personnels && sr.personnels.some(person => person.id === currentPhotographer.id)
            const hasPhotographerEvent = sr.events && sr.events.some(event => photographerEventIds.has(event.id))

            return isDirectlyAssigned || hasPhotographerEvent
        })
    }, [shotRequests, currentPhotographer, photographerEvents, activeDate])

    // Get shot requests for a specific event
    const getShotRequestsForEvent = (eventId) => {
        return shotRequests.filter(sr => 
            sr.events && sr.events.some(event => event.id === eventId)
        )
    }

    // Event click handler
    const handleEventClick = (event) => {
        setSelectedEvent(event)
        setShowModal(true)
        // Load completed notes from the event data
        setCompletedNotes(event.completed_notes || [])
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedEvent(null)
        setPhotographerNotes('')
        setCompletedNotes([]) // Reset completed notes when closing modal
        setIsEditMode(false)
        setEditingNotes('')
        setNewNoteInput('')
    }
    
    // Handle completed note toggle - save to database
    const handleCompletedNoteToggle = async (noteValue) => {
        if (!selectedEvent) return

        const newCompletedNotes = completedNotes.includes(noteValue) 
            ? completedNotes.filter(note => note !== noteValue)
            : [...completedNotes, noteValue]

        // Update local state immediately for responsive UI
        setCompletedNotes(newCompletedNotes)

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${selectedEvent.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    completed_notes: newCompletedNotes
                })
            })

            if (response.ok) {
                // Update the event in local state
                setEvents(prev => prev.map(event => 
                    event.id === selectedEvent.id 
                        ? { ...event, completed_notes: newCompletedNotes }
                        : event
                ))
                setSelectedEvent(prev => ({ ...prev, completed_notes: newCompletedNotes }))
            } else {
                // Revert local state if save failed
                setCompletedNotes(selectedEvent.completed_notes || [])
                console.error('Failed to save completed notes')
            }
        } catch (error) {
            // Revert local state if save failed
            setCompletedNotes(selectedEvent.completed_notes || [])
            console.error('Error saving completed notes:', error)
        }
    }

    // Handle completed shot request note toggle - save to database
    const handleCompletedShotRequestNoteToggle = async (noteValue) => {
        if (!selectedShotRequest) return

        const newCompletedNotes = completedShotRequestNotes.includes(noteValue) 
            ? completedShotRequestNotes.filter(note => note !== noteValue)
            : [...completedShotRequestNotes, noteValue]

        // Update local state immediately for responsive UI
        setCompletedShotRequestNotes(newCompletedNotes)

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${selectedShotRequest.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    completed_notes: newCompletedNotes
                })
            })

            if (response.ok) {
                // Update the shot request in local state
                setShotRequests(prev => prev.map(sr => 
                    sr.id === selectedShotRequest.id 
                        ? { ...sr, completed_notes: newCompletedNotes }
                        : sr
                ))
                setSelectedShotRequest(prev => ({ ...prev, completed_notes: newCompletedNotes }))
            } else {
                // Revert local state if save failed
                setCompletedShotRequestNotes(selectedShotRequest.completed_notes || [])
                console.error('Failed to save completed shot request notes')
            }
        } catch (error) {
            // Revert local state if save failed
            setCompletedShotRequestNotes(selectedShotRequest.completed_notes || [])
            console.error('Error saving completed shot request notes:', error)
        }
    }

    const handleSavePhotographerNotes = async () => {
        if (!selectedEvent || !photographerNotes.trim()) return

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${selectedEvent.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    photographer_notes: photographerNotes.trim()
                })
            })

            if (response.ok) {
                // Update the event in local state
                setEvents(prev => prev.map(event => 
                    event.id === selectedEvent.id 
                        ? { ...event, photographer_notes: photographerNotes.trim() }
                        : event
                ))
                setSelectedEvent(prev => ({ ...prev, photographer_notes: photographerNotes.trim() }))
                setPhotographerNotes('')
                alert('Notes saved successfully!')
            } else {
                alert('Failed to save notes. Please try again.')
            }
        } catch (error) {
            console.error('Error saving photographer notes:', error)
            alert('Error saving notes. Please try again.')
        }
    }

    const handleEditNotes = () => {
        setIsEditMode(true)
        setEditingNotes(selectedEvent.notes || '')
    }

    const handleSaveEditedNotes = async () => {
        if (!selectedEvent) return

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${selectedEvent.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notes: editingNotes.trim()
                })
            })

            if (response.ok) {
                // Update the event in local state
                setEvents(prev => prev.map(event => 
                    event.id === selectedEvent.id 
                        ? { ...event, notes: editingNotes.trim() }
                        : event
                ))
                setSelectedEvent(prev => ({ ...prev, notes: editingNotes.trim() }))
                setIsEditMode(false)
                setEditingNotes('')
                alert('Notes updated successfully!')
            } else {
                alert('Failed to update notes. Please try again.')
            }
        } catch (error) {
            console.error('Error updating notes:', error)
            alert('Error updating notes. Please try again.')
        }
    }

    const handleAddNewNote = () => {
        if (!newNoteInput.trim()) return
        
        const currentNotes = editingNotes.trim()
        const updatedNotes = currentNotes 
            ? `${currentNotes}, ${newNoteInput.trim()}`
            : newNoteInput.trim()
        
        setEditingNotes(updatedNotes)
        setNewNoteInput('')
    }

    const handleCancelEdit = () => {
        setIsEditMode(false)
        setEditingNotes('')
        setNewNoteInput('')
    }

    // Handle marking shot request as complete
    const handleMarkShotRequestComplete = async (shotRequestId) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${shotRequestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'shot'
                })
            })

            if (response.ok) {
                // Update local state - keep in list but update status
                setShotRequests(prev => prev.map(sr => 
                    sr.id === shotRequestId 
                        ? { ...sr, status: 'shot' }
                        : sr
                ))
            }
        } catch (error) {
            console.error('Error marking shot request as complete:', error)
            alert('Error marking shot request as complete. Please try again.')
        }
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
            case 'null': return {
                backgroundColor: 'rgba(75, 85, 99, 0.1)',
                borderColor: 'rgba(75, 85, 99, 0.3)',
                opacity: 0.5
            }
            default: return {
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                borderColor: 'rgba(107, 114, 128, 0.9)'
            }
        }
    }

    // Function to generate iCalendar (.ics) file for photographer's schedule
    const generateICalendar = async () => {
        try {
            // Fetch ALL events for the photographer (not just current day)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events`)
            if (!response.ok) {
                alert('Failed to fetch events. Please try again.')
                return
            }
            const allEvents = await response.json()
            
            // Filter events for this photographer
            const photographerAllEvents = allEvents.filter(event => {
                if (!event.assigned_personnel || !Array.isArray(event.assigned_personnel)) return false
                return event.assigned_personnel.some(person => person.personnel_id === currentPhotographer.id)
            })
            
            // Filter to only include future and today's events
            const today = new Date().toISOString().split('T')[0]
            const eventsToExport = photographerAllEvents.filter(event => event.date >= today)
            
            // Sort events by date and time
            eventsToExport.sort((a, b) => {
                if (a.date !== b.date) {
                    return a.date.localeCompare(b.date)
                }
                return a.start_time.localeCompare(b.start_time)
            })

            if (eventsToExport.length === 0) {
                alert('No upcoming events to export.')
                return
            }

            // Helper function to format date/time for iCalendar (YYYYMMDDTHHMMSS)
            const formatICalDateTime = (date, time) => {
                const dateStr = date.replace(/-/g, '')
                const timeStr = time.replace(/:/g, '') + '00'
                return `${dateStr}T${timeStr}`
            }

            // Helper function to escape special characters in iCalendar format
            const escapeICalText = (text) => {
                if (!text) return ''
                return text.replace(/\\/g, '\\\\')
                          .replace(/;/g, '\\;')
                          .replace(/,/g, '\\,')
                          .replace(/\n/g, '\\n')
            }

            // Build iCalendar content
            let icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Relay Photography Schedule//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:Relay Photography Schedule',
                'X-WR-TIMEZONE:America/Los_Angeles'
            ]

            eventsToExport.forEach(event => {
                const uid = `${event.id}-${Date.now()}@relay-schedule.com`
                const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
                const dtstart = formatICalDateTime(event.date, event.start_time)
                const dtend = formatICalDateTime(event.date, event.end_time)
                
                // Build description with notes
                let description = ''
                if (event.notes) {
                    description = `Notes: ${event.notes}`
                }
                if (event.photographer_notes) {
                    description += description ? `\\n\\nPhotographer Notes: ${event.photographer_notes}` : `Photographer Notes: ${event.photographer_notes}`
                }
                if (event.quick_turn) {
                    description += description ? `\\n\\n⚠️ QUICK TURN - Priority Delivery` : '⚠️ QUICK TURN - Priority Delivery'
                }

                icsContent.push('BEGIN:VEVENT')
                icsContent.push(`UID:${uid}`)
                icsContent.push(`DTSTAMP:${dtstamp}`)
                icsContent.push(`DTSTART:${dtstart}`)
                icsContent.push(`DTEND:${dtend}`)
                icsContent.push(`SUMMARY:${escapeICalText(event.name)}`)
                if (event.location) {
                    icsContent.push(`LOCATION:${escapeICalText(event.location)}`)
                }
                if (description) {
                    icsContent.push(`DESCRIPTION:${escapeICalText(description)}`)
                }
                
                // Add 5-minute alarm/reminder
                icsContent.push('BEGIN:VALARM')
                icsContent.push('ACTION:DISPLAY')
                icsContent.push('TRIGGER:-PT5M')
                icsContent.push('DESCRIPTION:Event reminder')
                icsContent.push('END:VALARM')
                
                icsContent.push('END:VEVENT')
            })

            icsContent.push('END:VCALENDAR')

            // Create and download the file
            const icsBlob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
            const url = window.URL.createObjectURL(icsBlob)
            const link = document.createElement('a')
            link.href = url
            
            // Create filename based on photographer name
            const photographerName = currentPhotographer.name.replace(/\s+/g, '_')
            const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
            link.download = `Relay_Schedule_${photographerName}_${timestamp}.ics`
            
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error generating iCalendar:', error)
            alert('Failed to generate calendar file. Please try again.')
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
                <div>
                    <h1>Photographer Schedule</h1>
                    <div className="photographer-info">
                        <span className="photographer-name">{currentPhotographer.name}</span>
                        <span className="photographer-role">{currentPhotographer.role}</span>
                        <span className="photographer-date">Schedule for {displayDate}</span>
                    </div>
                </div>
                <button 
                    className='photographer-download-ical-button'
                    onClick={generateICalendar}
                    title='Download your schedule as iCalendar file (.ics) for Apple Calendar'
                >
                    <span>📅</span>
                    Download iCal
                </button>
            </div>

            <div className="photographer-content-grid">
                {/* Search Bar */}
                <div className="photographer-search-section">
                    <div className="photographer-search-container">
                        <input
                            type="text"
                            placeholder="Search events by name, location, notes, or time..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="photographer-search-input"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="photographer-search-clear"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {searchQuery && (
                        <div className="photographer-search-results">
                            Found {photographerEvents.length} event{photographerEvents.length !== 1 ? 's' : ''} matching "{searchQuery}"
                        </div>
                    )}
                </div>

                {/* Refresh Message */}
                <h3 style={{ 
                    textAlign: 'center', 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.95rem',
                    fontWeight: '400',
                    margin: '20px 0',
                    fontStyle: 'italic'
                }}>
                    Please refresh to see updates
                </h3>

                {/* Shot Requests Section - Now First */}
                <div className="photographer-shot-requests-section">
                    <div className="photographer-section-header" onClick={() => setIsShotRequestsCollapsed(!isShotRequestsCollapsed)} style={{ cursor: 'pointer' }}>
                        <h2>Assigned Shot Requests</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="photographer-shot-count">{photographerShotRequests.length} Requests</span>
                            <span className="collapse-icon">{isShotRequestsCollapsed ? '▶' : '▼'}</span>
                        </div>
                    </div>

                    {!isShotRequestsCollapsed && (
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
                                
                                // Determine card colors based on status
                                const isShot = shotRequest.status === 'shot'
                                const baseBackgroundColor = isShot ? 'rgba(40, 167, 69, 0.15)' : 'rgba(255, 255, 255, 0.05)'
                                const hoverBackgroundColor = isShot ? 'rgba(40, 167, 69, 0.25)' : 'rgba(255, 255, 255, 0.08)'
                                const baseBorderColor = isShot ? 'rgba(40, 167, 69, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                                const hoverBorderColor = isShot ? 'rgba(40, 167, 69, 0.6)' : 'rgba(255, 255, 255, 0.2)'
                                
                                return (
                                    <div 
                                        key={shotRequest.id} 
                                        className="photographer-shot-request-card"
                                        onClick={() => {
                                            setSelectedShotRequest(shotRequest)
                                            setCompletedShotRequestNotes(shotRequest.completed_notes || [])
                                            setShowShotRequestModal(true)
                                        }}
                                        style={{ 
                                            cursor: 'pointer',
                                            padding: '12px 16px',
                                            backgroundColor: baseBackgroundColor,
                                            borderRadius: '8px',
                                            border: `1px solid ${baseBorderColor}`,
                                            transition: 'all 0.2s ease',
                                            marginBottom: '8px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = hoverBackgroundColor
                                            e.currentTarget.style.borderColor = hoverBorderColor
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = baseBackgroundColor
                                            e.currentTarget.style.borderColor = baseBorderColor
                                        }}
                                    >
                                        <h3 style={{ 
                                            margin: 0, 
                                            fontSize: '1rem', 
                                            color: 'rgba(255, 255, 255, 0.95)',
                                            fontWeight: '500'
                                        }}>
                                            {shotRequest.request}
                                        </h3>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    )}
                </div>

                {/* Personal Schedule Section - Now Second */}
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
                                                    className={`photographer-dashboard-event-card photographer-status-${eventStatus} ${event.process_point === 'null' ? 'process-null' : ''}`}
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
                                                            {event.quick_turn && <span className='photographer-dashboard-quick-turn'><span className="quick-turn-dot"></span></span>}
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
                            
                            {(selectedEvent.notes || isEditMode) && (
                                <div className="photographer-event-detail-row">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label>Notes:</label>
                                        {!isEditMode && (
                                            <button 
                                                onClick={handleEditNotes}
                                                className="photographer-edit-notes-btn"
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                    
                                    {isEditMode ? (
                                        <div className="notes-edit-mode">
                                            <div style={{ marginBottom: '12px' }}>
                                                <textarea
                                                    value={editingNotes}
                                                    onChange={(e) => setEditingNotes(e.target.value)}
                                                    placeholder="Enter notes separated by commas (each will become a checkbox item)..."
                                                    rows="3"
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '0.9rem',
                                                        fontFamily: 'inherit'
                                                    }}
                                                />
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                                <input
                                                    type="text"
                                                    value={newNoteInput}
                                                    onChange={(e) => setNewNoteInput(e.target.value)}
                                                    placeholder="Add new note item..."
                                                    style={{
                                                        flex: 1,
                                                        padding: '6px',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '0.9rem'
                                                    }}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleAddNewNote()
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={handleAddNewNote}
                                                    disabled={!newNoteInput.trim()}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#28a745',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: newNoteInput.trim() ? 'pointer' : 'not-allowed',
                                                        opacity: newNoteInput.trim() ? 1 : 0.6
                                                    }}
                                                >
                                                    Add
                                                </button>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={handleSaveEditedNotes}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#007bff',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Save Changes
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#6c757d',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="notes-checkboxes-display">
                                            {selectedEvent.notes && selectedEvent.notes.split(',').map((note, index) => {
                                                const noteValue = note.trim();
                                                const isCompleted = completedNotes.includes(noteValue);
                                                return (
                                                    <label key={index} className="checkbox-display-label" style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        marginBottom: '6px',
                                                        cursor: 'pointer'
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isCompleted}
                                                            onChange={() => handleCompletedNoteToggle(noteValue)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                        <span style={{
                                                            textDecoration: isCompleted ? 'line-through' : 'none',
                                                            opacity: isCompleted ? 0.7 : 1
                                                        }}>{noteValue}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="photographer-event-detail-row">
                                <label>Quick Turn:</label>
                                <span>{selectedEvent.quick_turn ? <>Yes <span className="quick-turn-dot"></span></> : 'No'}</span>
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

                            {/* Photographer Notes Section */}
                            <div className="photographer-notes-section">
                                <label>Notes for Editors & Staff:</label>
                                <textarea
                                    value={photographerNotes}
                                    onChange={(e) => setPhotographerNotes(e.target.value)}
                                    placeholder="Add notes for editors and other staff members..."
                                    rows="3"
                                    className="photographer-notes-input"
                                />
                                <button 
                                    className="photographer-save-notes-btn"
                                    onClick={handleSavePhotographerNotes}
                                    disabled={!photographerNotes.trim()}
                                >
                                    Save Notes
                                </button>
                            </div>

                            {/* Display existing photographer notes */}
                            {selectedEvent.photographer_notes && (
                                <div className="photographer-event-detail-row">
                                    <label>Current Notes:</label>
                                    <span className="photographer-existing-notes">{selectedEvent.photographer_notes}</span>
                                </div>
                            )}

                            {/* Shot Requests Section */}
                            {getShotRequestsForEvent(selectedEvent.id).length > 0 && (
                                <div className="photographer-event-detail-row">
                                    <label>Shot Requests:</label>
                                    <div className="photographer-shot-requests-list">
                                        {getShotRequestsForEvent(selectedEvent.id).map((shotRequest, index) => (
                                            <div key={shotRequest.id || index} className="photographer-shot-request-item">
                                                <div className="shot-request-header">
                                                    <span className="shot-request-title">{shotRequest.request || shotRequest.description}</span>
                                                    <span className={`shot-request-priority priority-${shotRequest.priority || 'medium'}`}>
                                                        {shotRequest.priority || 'Medium'}
                                                    </span>
                                                </div>
                                                {shotRequest.notes && (
                                                    <div className="shot-request-notes">
                                                        {shotRequest.notes}
                                                    </div>
                                                )}
                                                {shotRequest.details && (
                                                    <div className="shot-request-details">
                                                        <strong>Details:</strong> {shotRequest.details}
                                                    </div>
                                                )}
                                                {shotRequest.deadline && (
                                                    <div className="shot-request-deadline">
                                                        <strong>Deadline:</strong> {shotRequest.deadline}
                                                    </div>
                                                )}
                                                {shotRequest.special_instructions && (
                                                    <div className="shot-request-instructions">
                                                        <strong>Special Instructions:</strong> {shotRequest.special_instructions}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="photographer-modal-footer">
                            <button className="photographer-modal-button" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shot Request Modal */}
            {showShotRequestModal && selectedShotRequest && (
                <div className="photographer-modal-overlay" onClick={() => setShowShotRequestModal(false)}>
                    <div className="photographer-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="photographer-modal-header">
                            <h2>{selectedShotRequest.request}</h2>
                            <button className="photographer-modal-close" onClick={() => setShowShotRequestModal(false)}>×</button>
                        </div>
                        
                        <div className="photographer-modal-body">
                            {selectedShotRequest.start_time && selectedShotRequest.end_time && (
                                <div className="photographer-detail-row">
                                    <label>Time:</label>
                                    <span>{selectedShotRequest.start_time} - {selectedShotRequest.end_time}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.date && (
                                <div className="photographer-detail-row">
                                    <label>Date:</label>
                                    <span>{selectedShotRequest.date}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.details && (
                                <div className="photographer-detail-row">
                                    <label>Details:</label>
                                    <span>{selectedShotRequest.details}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.notes && (
                                <div className="photographer-detail-row">
                                    <label>Notes:</label>
                                    <div className="notes-checkboxes-display">
                                        {selectedShotRequest.notes.split(',').map((note, index) => {
                                            const noteValue = note.trim();
                                            if (!noteValue) return null;
                                            const isCompleted = (completedShotRequestNotes || []).includes(noteValue);
                                            return (
                                                <label key={index} className="checkbox-display-label" style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '6px',
                                                    cursor: 'pointer'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isCompleted}
                                                        onChange={() => handleCompletedShotRequestNoteToggle(noteValue)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <span style={{
                                                        textDecoration: isCompleted ? 'line-through' : 'none',
                                                        opacity: isCompleted ? 0.7 : 1
                                                    }}>{noteValue}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {selectedShotRequest.deadline && (
                                <div className="photographer-detail-row">
                                    <label>Deadline:</label>
                                    <span>{selectedShotRequest.deadline}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.events && selectedShotRequest.events.length > 0 && (
                                <div className="photographer-detail-row">
                                    <label>Associated Events:</label>
                                    <div>
                                        {selectedShotRequest.events.map(event => (
                                            <div key={event.id} style={{ marginBottom: '4px' }}>
                                                {event.name} - {event.location}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="photographer-modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            {selectedShotRequest.status !== 'shot' && (
                                <button 
                                    className="photographer-modal-button" 
                                    onClick={async () => {
                                        await handleMarkShotRequestComplete(selectedShotRequest.id)
                                        setShowShotRequestModal(false)
                                    }}
                                    style={{
                                        backgroundColor: '#28a745',
                                        color: 'white'
                                    }}
                                >
                                    Mark as Shot
                                </button>
                            )}
                            <button className="photographer-modal-button" onClick={() => setShowShotRequestModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}