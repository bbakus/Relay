import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import '../styles/schedule-mobile-view.css'

export const ScheduleMobile = () => {
    const { user, company, selectedDate, selectedProjectId } = useAuth()
    const [events, setEvents] = useState([])
    const [scheduleColumns, setScheduleColumns] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showModal, setShowModal] = useState(false)

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
            const filtered = data.filter(event => {
                const matchesProject = event.project_id === parseInt(selectedProjectId)
                const matchesDate = event.date === selectedDate
                const matchesCompany = company?.id ? event.company_id === company.id : true
                return matchesProject && matchesDate && matchesCompany
            })
            
            setEvents(filtered)
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchScheduleColumns()
        fetchEvents()
    }, [selectedProjectId, selectedDate])

    const handleEventClick = (event) => {
        setSelectedEvent(event)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedEvent(null)
    }

    const formatTimeTo12Hour = (time24) => {
        if (!time24) return ''
        const [hours, minutes] = time24.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
    }

    const getProcessPointColor = (processPoint) => {
        const colors = {
            'Coverage': { backgroundColor: 'rgba(52, 152, 219, 0.3)', borderColor: '#3498db' },
            'Processing': { backgroundColor: 'rgba(241, 196, 15, 0.3)', borderColor: '#f1c40f' },
            'Review': { backgroundColor: 'rgba(230, 126, 34, 0.3)', borderColor: '#e67e22' },
            'Delivered': { backgroundColor: 'rgba(46, 204, 113, 0.3)', borderColor: '#2ecc71' },
            'Idle': { backgroundColor: 'rgba(149, 165, 166, 0.3)', borderColor: '#95a5a6' }
        }
        return colors[processPoint] || colors['Idle']
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
                    <div className="smv-columns-wrapper">
                {scheduleColumns.length === 0 ? (
                    <div className="smv-no-data">
                        <p>No columns configured for this project.</p>
                    </div>
                ) : (
                    scheduleColumns.map((column) => {
                        const columnEvents = events
                            .filter(e => e.schedule_column_id === column.id)
                            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

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

            {/* Simple Event Modal */}
            {showModal && selectedEvent && (
                <div className="smv-modal-overlay" onClick={closeModal}>
                    <div className="smv-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="smv-modal-header">
                            <h2>{selectedEvent.name}</h2>
                            <button onClick={closeModal} className="smv-modal-close">✕</button>
                        </div>
                        
                        <div className="smv-modal-body">
                            <div className="smv-modal-field">
                                <strong>Time:</strong>
                                <span>{formatTimeTo12Hour(selectedEvent.start_time)} - {formatTimeTo12Hour(selectedEvent.end_time)}</span>
                            </div>
                            
                            <div className="smv-modal-field">
                                <strong>Location:</strong>
                                <span>{selectedEvent.location}</span>
                            </div>
                            
                            {selectedEvent.description && (
                                <div className="smv-modal-field">
                                    <strong>Description:</strong>
                                    <p>{selectedEvent.description}</p>
                                </div>
                            )}
                            
                            {selectedEvent.assigned_personnel && selectedEvent.assigned_personnel.length > 0 && (
                                <div className="smv-modal-field">
                                    <strong>Assigned Personnel:</strong>
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

