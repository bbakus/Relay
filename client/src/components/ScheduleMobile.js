import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import '../styles/schedule-mobile-view.css'

export const ScheduleMobile = () => {
    const { user, company, selectedDate, selectedProjectId } = useAuth()
    const [events, setEvents] = useState([])
    const [scheduleColumns, setScheduleColumns] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [completedNotes, setCompletedNotes] = useState([])
    const [selectedPhotographerId, setSelectedPhotographerId] = useState('')

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'

    // Fetch schedule columns
    const fetchScheduleColumns = async () => {
        if (!selectedProjectId) return

        try {
            const response = await fetch(`${API_URL}/api/schedule-columns?project_id=${selectedProjectId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const data = await response.json()
            setScheduleColumns(data || [])
        } catch (error) {
            console.error('Error fetching schedule columns:', error)
        }
    }

    // Fetch personnel
    const fetchPersonnel = async () => {
        try {
            const response = await fetch(`${API_URL}/api/personnel`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const data = await response.json()
            setPersonnel(data)
        } catch (error) {
            console.error('Error fetching personnel:', error)
        }
    }

    // Fetch events
    const fetchEvents = async () => {
        if (!selectedProjectId || !selectedDate) {
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const response = await fetch(`${API_URL}/api/events`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const data = await response.json()
            
            // Filter by project, date, and company
            let filtered = data.filter(event => {
                const matchesProject = event.project_id === parseInt(selectedProjectId)
                const matchesDate = event.date === selectedDate
                const matchesCompany = company?.id ? event.company_id === company.id : true
                return matchesProject && matchesDate && matchesCompany
            })

            // Filter by photographer if selected
            if (selectedPhotographerId) {
                console.log('📱 Before photographer filter:', filtered.length, 'events')
                filtered = filtered.filter(event => {
                    if (event.assigned_personnel && event.assigned_personnel.length > 0) {
                        return event.assigned_personnel.some(person => person.personnel_id === parseInt(selectedPhotographerId))
                    }
                    return false
                })
                console.log('📱 After photographer filter:', filtered.length, 'events for photographer', selectedPhotographerId)
                console.log('📱 Filtered events:', filtered.map(e => ({ id: e.id, name: e.name, column: e.schedule_column_id })))
            }
            
            setEvents(filtered)
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchScheduleColumns()
        fetchPersonnel()
    }, [selectedProjectId])

    useEffect(() => {
        fetchEvents()
    }, [selectedProjectId, selectedDate, selectedPhotographerId])

    const handleEventClick = (event) => {
        setSelectedEvent(event)
        setCompletedNotes(event.completed_notes || [])
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedEvent(null)
        setCompletedNotes([])
    }

    const handleCompletedNoteToggle = async (noteValue) => {
        const newCompletedNotes = completedNotes.includes(noteValue)
            ? completedNotes.filter(n => n !== noteValue)
            : [...completedNotes, noteValue]
        
        setCompletedNotes(newCompletedNotes)

        try {
            await fetch(`${API_URL}/api/events/${selectedEvent.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ completed_notes: newCompletedNotes })
            })
            fetchEvents() // Refresh events
        } catch (error) {
            console.error('Error updating completed notes:', error)
        }
    }

    const handleQuickTurnChange = async (eventId, quickTurn) => {
        try {
            await fetch(`${API_URL}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ quick_turn: quickTurn })
            })
            fetchEvents() // Refresh events
        } catch (error) {
            console.error('Error updating quick turn:', error)
        }
    }

    const handleProcessPointChange = async (eventId, processPoint) => {
        try {
            await fetch(`${API_URL}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ process_point: processPoint })
            })
            fetchEvents() // Refresh events
        } catch (error) {
            console.error('Error updating process point:', error)
        }
    }

    const formatTimeTo12Hour = (time24) => {
        if (!time24) return ''
        const [hours, minutes] = time24.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
    }

    const formatDateForHeader = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString + 'T00:00:00')
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
        return date.toLocaleDateString('en-US', options)
    }

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
            case 'null': return {
                backgroundColor: 'rgba(75, 85, 99, 0.1)',
                borderColor: 'rgba(75, 85, 99, 0.3)',
                opacity: 0.5
            }
            default: return {
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                borderColor: 'rgba(107, 114, 128, 1)'
            }
        }
    }

    if (loading) {
        return (
            <div className='view-container'>
                <Nav />
                <div className='page-container'>
                    <div className="smv-loading">Loading Schedule...</div>
                </div>
            </div>
        )
    }

    return (
        <div className='view-container'>
            <Nav />
            <div className='page-container'>
                <div className="smv-container">
                    {/* Photographer Filter */}
                    <div className="smv-filter-bar">
                        <label htmlFor='smv-photographer-filter'>Filter by Photographer:</label>
                        <select
                            id='smv-photographer-filter'
                            value={selectedPhotographerId}
                            onChange={(e) => setSelectedPhotographerId(e.target.value)}
                            className='smv-filter-select'
                        >
                            <option value=''>All Photographers</option>
                            {personnel
                                .filter(person => {
                                    const role = (person.role || '').toLowerCase()
                                    const isPhotographerOrVideographer = role.includes('photographer') || role.includes('videographer')
                                    
                                    // Only show if assigned to selected project
                                    if (selectedProjectId && person.project_ids) {
                                        return isPhotographerOrVideographer && person.project_ids.includes(parseInt(selectedProjectId))
                                    }
                                    
                                    return isPhotographerOrVideographer
                                })
                                .map(photographer => (
                                    <option key={photographer.id} value={photographer.id}>
                                        {photographer.name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="smv-columns-wrapper">
                {scheduleColumns.length === 0 ? (
                    <div className="smv-no-data">
                        <p>No columns configured for this project.</p>
                    </div>
                ) : selectedPhotographerId ? (
                    // When photographer filter is active, show ALL their events in ONE column
                    <div className="smv-column" style={{ minWidth: '100vw', width: '100vw' }}>
                        <div className="smv-column-header">
                            <h2>All Events</h2>
                            <span className="smv-event-count">{events.length} events</span>
                        </div>
                        
                        <div className="smv-events-list">
                            {events.length === 0 ? (
                                <div className="smv-no-events">No events for this photographer</div>
                            ) : (
                                events
                                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                                    .map(event => {
                                        const isUnassigned = !event.assigned_personnel || event.assigned_personnel.length === 0
                                        const colors = getProcessPointColor(event.process_point)
                                        
                                        return (
                                            <div
                                                key={event.id}
                                                className={`smv-event-card ${isUnassigned ? 'smv-unassigned' : ''}`}
                                                style={{
                                                    backgroundColor: colors.backgroundColor,
                                                    borderColor: isUnassigned ? '#dc3545' : colors.borderColor
                                                }}
                                                onClick={() => handleEventClick(event)}
                                            >
                                                <div className="smv-event-name">{event.name}</div>
                                                <div className="smv-event-time">
                                                    {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                                                </div>
                                                <div className="smv-event-location">{event.location}</div>
                                                
                                                {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                                                    <div className="smv-event-personnel">
                                                        {event.assigned_personnel.map((person) => (
                                                            <span key={person.personnel_id} className="smv-personnel-badge">
                                                                {person.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })
                            )}
                        </div>
                    </div>
                ) : (
                    // No filter - show normal column layout
                    scheduleColumns.map((column) => {
                        const columnEvents = events
                            .filter(e => e.schedule_column_id === column.id)
                            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                        
                        console.log(`📱 Column ${column.id} (${column.name}):`, columnEvents.length, 'events')

                        return (
                            <div key={column.id} className="smv-column">
                                <div className="smv-column-header">
                                    <h2>{column.name}</h2>
                                    <span className="smv-event-count">{columnEvents.length} events</span>
                                </div>
                                
                                <div className="smv-events-list">
                                    {columnEvents.length === 0 ? (
                                        <div className="smv-no-events">No events in this column</div>
                                    ) : (
                                        columnEvents.map(event => {
                                            const isUnassigned = !event.assigned_personnel || event.assigned_personnel.length === 0
                                            const colors = getProcessPointColor(event.process_point)
                                            
                                            return (
                                                <div
                                                    key={event.id}
                                                    className={`smv-event-card ${isUnassigned ? 'smv-unassigned' : ''}`}
                                                    style={{
                                                        backgroundColor: colors.backgroundColor,
                                                        borderColor: isUnassigned ? '#dc3545' : colors.borderColor
                                                    }}
                                                    onClick={() => handleEventClick(event)}
                                                >
                                                    <div className="smv-event-name">{event.name}</div>
                                                    <div className="smv-event-time">
                                                        {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                                                    </div>
                                                    <div className="smv-event-location">{event.location}</div>
                                                    
                                                    {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                                                        <div className="smv-event-personnel">
                                                            {event.assigned_personnel.map((person) => (
                                                                <span key={person.personnel_id} className="smv-personnel-badge">
                                                                    {person.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
                </div>
                </div>

            {/* Detailed Event Modal */}
            {showModal && selectedEvent && (
                <div className="smv-modal-overlay" onClick={closeModal}>
                    <div className="smv-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="smv-modal-header">
                            <h2>{selectedEvent.name}</h2>
                            <button onClick={closeModal} className="smv-modal-close">✕</button>
                        </div>
                        
                        <div className="smv-modal-body">
                            <div className="smv-modal-field">
                                <strong>Time</strong>
                                <span>{formatTimeTo12Hour(selectedEvent.start_time)} - {formatTimeTo12Hour(selectedEvent.end_time)}</span>
                            </div>
                            
                            <div className="smv-modal-field">
                                <strong>Date</strong>
                                <span>{formatDateForHeader(selectedEvent.date)}</span>
                            </div>
                            
                            <div className="smv-modal-field">
                                <strong>Location</strong>
                                <span>{selectedEvent.location}</span>
                            </div>

                            <div className="smv-modal-field">
                                <strong>Notes Checklist</strong>
                                <div className="smv-notes-checklist">
                                    {(() => {
                                        const notesArray = selectedEvent.notes 
                                            ? selectedEvent.notes.split(',').map(n => n.trim())
                                            : ['Shot'];
                                        
                                        return notesArray.map((noteValue, index) => {
                                            const isCompleted = completedNotes.includes(noteValue);
                                            return (
                                                <label key={index} className="smv-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={isCompleted}
                                                        onChange={() => handleCompletedNoteToggle(noteValue)}
                                                    />
                                                    <span>{noteValue}</span>
                                                </label>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                            
                            {selectedEvent.details && (
                                <div className="smv-modal-field">
                                    <strong>Details</strong>
                                    <div className="smv-details-text">{selectedEvent.details}</div>
                                </div>
                            )}

                            <div className="smv-modal-field">
                                <strong>Quick Turn</strong>
                                <label className="smv-toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedEvent.quick_turn || false}
                                        onChange={(e) => handleQuickTurnChange(selectedEvent.id, e.target.checked)}
                                    />
                                    <span>{selectedEvent.quick_turn ? 'Yes ⚡' : 'No'}</span>
                                </label>
                            </div>
                            
                            {selectedEvent.deadline && (
                                <div className="smv-modal-field">
                                    <strong>Deadline</strong>
                                    <span>{selectedEvent.deadline}</span>
                                </div>
                            )}

                            <div className="smv-modal-field">
                                <strong>Process Point</strong>
                                <select 
                                    value={selectedEvent.process_point || 'idle'} 
                                    onChange={(e) => handleProcessPointChange(selectedEvent.id, e.target.value)}
                                    className="smv-select"
                                >
                                    <option value="idle">Idle</option>
                                    <option value="ingest">Ingest</option>
                                    <option value="cull">Cull</option>
                                    <option value="color">Color</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="null">Not Shot</option>
                                </select>
                            </div>
                            
                            {selectedEvent.assigned_personnel && selectedEvent.assigned_personnel.length > 0 && (
                                <div className="smv-modal-field">
                                    <strong>Assigned Personnel</strong>
                                    <div className="smv-modal-personnel">
                                        {selectedEvent.assigned_personnel.map((person) => (
                                            <span key={person.personnel_id} className="smv-personnel-badge">
                                                {person.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    )
}

