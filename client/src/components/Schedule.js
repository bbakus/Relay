import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../utils/apiConfig'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { Nav } from './Nav'
// import { NotificationCenter } from './NotificationCenter' // Temporarily disabled
import { formatDateForHeader } from '../utils/dateUtils'
import '../styles/schedule.css'
import '../styles/quick-turn-dot.css'
import '../styles/schedule-mobile.css'

export const Schedule = () => {
    const { user, selectedDate, selectedProjectId, selectedCompanyId } = useAuth()
    const { subscribe, isConnected } = useWebSocket()
    // Use global selectedDate from AuthContext, fallback to today if not set
    const activeDate = selectedDate || new Date().toISOString().split('T')[0]
    

    

    const [events, setEvents] = useState([])
    const [projects, setProjects] = useState([])
    const [organizations, setOrganizations] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [selectedPhotographerId, setSelectedPhotographerId] = useState('')
    const [currentView, setCurrentView] = useState('events') // 'events' or 'shot-requests'
    const [shotRequests, setShotRequests] = useState([])
    const [scheduleColumns, setScheduleColumns] = useState([])
    const [editingColumnId, setEditingColumnId] = useState(null)
    const [editingColumnName, setEditingColumnName] = useState('')

    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null)
    const [showShotRequestModal, setShowShotRequestModal] = useState(false)
    const [shotRequestEvent, setShotRequestEvent] = useState(null)
    const [shotRequestForm, setShotRequestForm] = useState({
        description: '',
        priority: 'medium',
        deadline: '',
        special_instructions: '',
        details: ''
    })
    const [selectedShotRequest, setSelectedShotRequest] = useState(null)
    const [showShotRequestDetailModal, setShowShotRequestDetailModal] = useState(false)
    const [showShotRequestEditModal, setShowShotRequestEditModal] = useState(false)
    const [editingShotRequest, setEditingShotRequest] = useState(null)
    const [editingNotes, setEditingNotes] = useState('')
    const [newNoteInput, setNewNoteInput] = useState('')
    const [quickTurn, setQuickTurn] = useState(false)
    const [completedNotes, setCompletedNotes] = useState([])

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

    // Format time to 12-hour format
    const formatTimeTo12Hour = (time24) => {
        if (!time24) return ''
        const [hours, minutes] = time24.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

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
            // Filter personnel by company (same logic as Personnel component)
            let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
            if (user?.is_super_admin && selectedCompanyId) {
                // For super admins, use the selected company
                personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
            } else if (user?.company_id) {
                // For regular company admins, use their company
                personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
            }
            
            const response = await fetch(personnelUrl)
            if (response.ok) {
                const data = await response.json()
                console.log('Fetched personnel:', data.length, 'personnel')
                setPersonnel(Array.isArray(data) ? data : [])
            } else {
                console.error('Error fetching personnel:', response.statusText)
                setPersonnel([])
            }
        } catch (error) {
            console.error('Error fetching personnel:', error)
            setPersonnel([])
        }
    }

    const fetchScheduleColumns = async () => {
        if (!selectedProjectId) {
            // If no project is selected, use default columns
            setScheduleColumns([
                { id: 1, name: 'Column 1', order_index: 0, project_id: null },
                { id: 2, name: 'Column 2', order_index: 1, project_id: null },
                { id: 3, name: 'Column 3', order_index: 2, project_id: null },
                { id: 4, name: 'Column 4', order_index: 3, project_id: null },
                { id: 5, name: 'Column 5', order_index: 4, project_id: null }
            ])
            return
        }
        
        try {
            // Add cache busting parameter
            const response = await fetch(`${API_CONFIG.baseUrl}/api/schedule-columns?project_id=${selectedProjectId}&t=${Date.now()}`)
            if (response.ok) {
                const columns = await response.json()
                
                // If no columns exist for this project, auto-create 5 default columns
                if (columns.length === 0 && isAdmin) {
                    console.log('No schedule columns found for project, creating defaults...')
                    const createPromises = []
                    for (let i = 0; i < 5; i++) {
                        createPromises.push(
                            fetch(`${API_CONFIG.baseUrl}/api/schedule-columns`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: `Column ${i + 1}`,
                                    project_id: selectedProjectId,
                                    order_index: i
                                })
                            })
                        )
                    }
                    
                    await Promise.all(createPromises)
                    // Fetch again to get the created columns with real IDs
                    const refetchResponse = await fetch(`${API_CONFIG.baseUrl}/api/schedule-columns?project_id=${selectedProjectId}&t=${Date.now()}`)
                    if (refetchResponse.ok) {
                        const newColumns = await refetchResponse.json()
                        setScheduleColumns(newColumns)
                    }
                } else if (columns.length >= 5) {
                    setScheduleColumns(columns)
                } else {
                    // If fewer than 5, pad with existing columns (shouldn't normally happen)
                    setScheduleColumns(columns)
                }
            } else {
                // Fallback to default columns if API fails
                setScheduleColumns([
                    { id: 1, name: 'Column 1', order_index: 0, project_id: selectedProjectId },
                    { id: 2, name: 'Column 2', order_index: 1, project_id: selectedProjectId },
                    { id: 3, name: 'Column 3', order_index: 2, project_id: selectedProjectId },
                    { id: 4, name: 'Column 4', order_index: 3, project_id: selectedProjectId },
                    { id: 5, name: 'Column 5', order_index: 4, project_id: selectedProjectId }
                ])
            }
        } catch (error) {
            console.error('Error fetching schedule columns:', error)
        }
    }

    const fetchEvents = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events?t=${Date.now()}`)
            if (response.ok) {
                const allEvents = await response.json()
                
                // Filter events for selected date and project
                const dayEvents = allEvents
                    .filter(event => event.date === activeDate)
                    .filter(event => {
                        if (!selectedProjectId) return true
                        return event.project_id === Number(selectedProjectId)
                    })
                
                setEvents(dayEvents)
            }
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchShotRequests = async () => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests`)
            if (response.ok) {
                const allShotRequests = await response.json()
                
                console.log('📅 Schedule fetchShotRequests: Total fetched:', allShotRequests.length)
                console.log('📅 activeDate:', activeDate, 'selectedProjectId:', selectedProjectId)
                
                // Filter shot requests for selected date and project
                const filteredShotRequests = allShotRequests.filter(sr => {
                    // Check if shot request has events on the selected date
                    const hasEventOnSelectedDate = sr.events && sr.events.length > 0 && 
                        sr.events.some(event => event.date === activeDate)
                    
                    // Normalize date - treat null, "null", undefined, and empty string as null
                    const srDate = sr.date && sr.date !== 'null' && sr.date !== '' ? sr.date : null
                    const hasOwnDateMatch = srDate === activeDate
                    
                    const dateMatch = hasEventOnSelectedDate || hasOwnDateMatch
                    
                    // Check if shot request belongs to selected project
                    let projectMatch = false
                    if (!selectedProjectId) {
                        projectMatch = true  // No project filter, show all
                    } else {
                        // Check if any of the shot request's events belong to the selected project
                        const hasMatchingEvent = sr.events && sr.events.length > 0 && 
                            sr.events.some(event => event.project_id === Number(selectedProjectId))
                        
                        // Check if shot request is directly linked to the project
                        const hasMatchingProject = sr.projects && sr.projects.length > 0 && 
                            sr.projects.some(project => project.id === Number(selectedProjectId))
                        
                        projectMatch = hasMatchingEvent || hasMatchingProject
                    }
                    
                    return dateMatch && projectMatch
                })
                
                console.log('📅 Schedule fetchShotRequests: Filtered to', filteredShotRequests.length, 'SRs')
                console.log('📅 Filtered SRs:', filteredShotRequests.map(sr => ({
                    id: sr.id,
                    request: sr.request,
                    schedule_column_id: sr.schedule_column_id,
                    hasTime: !!(sr.start_time && sr.end_time)
                })))
                
                setShotRequests(filteredShotRequests)
            }
        } catch (error) {
            console.error('Error fetching shot requests:', error)
        }
    }

    // Column management functions
    const handleAddColumn = async () => {
        if (!selectedProjectId) {
            console.log('Please select a project to add a column.')
            return
        }
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/schedule-columns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_id: selectedProjectId,
                    name: `Column ${scheduleColumns.length + 1}`
                })
            })
            
            if (response.ok) {
                fetchScheduleColumns()
            }
        } catch (error) {
            console.error('Error adding column:', error)
        }
    }

    const handleStartEditColumn = (column) => {
        setEditingColumnId(column.id)
        setEditingColumnName(column.name)
    }

    const handleSaveColumnName = async (columnId) => {
        if (!editingColumnName.trim()) {
            console.log('Column name cannot be empty')
            return
        }
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/schedule-columns/${columnId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editingColumnName.trim()
                })
            })
            
            if (response.ok) {
                setEditingColumnId(null)
                setEditingColumnName('')
                fetchScheduleColumns()
            }
        } catch (error) {
            console.error('Error updating column name:', error)
        }
    }

    const handleCancelEditColumn = () => {
        setEditingColumnId(null)
        setEditingColumnName('')
    }

    const handleDeleteColumn = async (columnId) => {
        // Prevent deletion if only 5 columns remain
        if (scheduleColumns.length <= 5) {
            console.log('Cannot delete column. A minimum of 5 columns is required.')
            return
        }
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/schedule-columns/${columnId}`, {
                method: 'DELETE'
            })
            
            if (response.ok) {
                fetchScheduleColumns()
                fetchEvents() // Refresh events to show updated assignments
            }
        } catch (error) {
            console.error('Error deleting column:', error)
        }
    }

    useEffect(() => {
        if (isAdmin) {
            fetchOrganizations()
        }
        fetchProjects()
        fetchPersonnel()
        fetchScheduleColumns()
        fetchEvents()
        fetchShotRequests()
    }, [activeDate, selectedProjectId, isAdmin, user?.company_id, selectedCompanyId])

    // WebSocket: Listen for real-time event updates
    useEffect(() => {
        if (!isConnected) return

        const unsubscribeEvent = subscribe('event_update', (data) => {
            console.log('🔴 LIVE UPDATE: Event changed', data)
            const { action, event: updatedEvent } = data
            
            if (action === 'create') {
                // Only add the event if it matches current filters
                if (updatedEvent.date === activeDate && 
                    (!selectedProjectId || updatedEvent.project_id === Number(selectedProjectId))) {
                    setEvents(prev => {
                        // Check if event already exists (avoid duplicates)
                        if (prev.find(e => e.id === updatedEvent.id)) {
                            return prev
                        }
                        return [...prev, updatedEvent]
                    })
                }
            } else if (action === 'update') {
                // Update the event in state
                setEvents(prev => {
                    const eventIndex = prev.findIndex(e => e.id === updatedEvent.id)
                    if (eventIndex !== -1) {
                        // Event exists in current view, update it
                        const newEvents = [...prev]
                        newEvents[eventIndex] = { ...newEvents[eventIndex], ...updatedEvent }
                        return newEvents
                    } else {
                        // Event not in current view (different date/project)
                        // Check if it should be added to current view
                        if (updatedEvent.date === activeDate && 
                            (!selectedProjectId || updatedEvent.project_id === Number(selectedProjectId))) {
                            return [...prev, updatedEvent]
                        }
                        return prev
                    }
                })
                
                // Also update selectedEvent if it's the one being viewed in modal
                setSelectedEvent(prev => {
                    if (prev && prev.id === updatedEvent.id) {
                        return { ...prev, ...updatedEvent }
                    }
                    return prev
                })
            } else if (action === 'delete') {
                // Remove the event from state
                setEvents(prev => prev.filter(e => e.id !== updatedEvent.id))
                
                // Close modal if viewing the deleted event
                setSelectedEvent(prev => {
                    if (prev && prev.id === updatedEvent.id) {
                        // Event being viewed was deleted
                        setTimeout(() => setShowModal(false), 0)
                        return null
                    }
                    return prev
                })
            }
        })

        const unsubscribeShotRequest = subscribe('shot_request_update', (data) => {
            console.log('🔴 LIVE UPDATE: Shot request changed', data)
            const { action, shotRequest: updatedSR } = data
            
            if (action === 'create') {
                setShotRequests(prev => {
                    // Check if shot request already exists (avoid duplicates)
                    if (prev.find(sr => sr.id === updatedSR.id)) {
                        return prev
                    }
                    return [...prev, updatedSR]
                })
            } else if (action === 'update') {
                // Update the shot request in state
                setShotRequests(prev => {
                    const srIndex = prev.findIndex(sr => sr.id === updatedSR.id)
                    if (srIndex !== -1) {
                        const newSRs = [...prev]
                        newSRs[srIndex] = { ...newSRs[srIndex], ...updatedSR }
                        return newSRs
                    }
                    return prev
                })
                
                // Also update selectedShotRequest if it's the one being viewed in modal
                setSelectedShotRequest(prev => {
                    if (prev && prev.id === updatedSR.id) {
                        return { ...prev, ...updatedSR }
                    }
                    return prev
                })
            } else if (action === 'delete') {
                // Remove the shot request from state
                setShotRequests(prev => prev.filter(sr => sr.id !== updatedSR.id))
                
                // Close modal if viewing the deleted shot request
                setSelectedShotRequest(prev => {
                    if (prev && prev.id === updatedSR.id) {
                        // Shot request being viewed was deleted
                        setTimeout(() => setShowShotRequestDetailModal(false), 0)
                        return null
                    }
                    return prev
                })
            }
        })

        return () => {
            unsubscribeEvent()
            unsubscribeShotRequest()
        }
    }, [isConnected, subscribe, activeDate, selectedProjectId])





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

    // Handle process point change in modal
    const handleProcessPointChange = async (eventId, newProcessPoint) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Name': user?.name || 'Unknown'
                },
                body: JSON.stringify({
                    process_point: newProcessPoint
                })
            })

            if (response.ok) {
                // Parse the full response data from backend (includes assigned_personnel)
                const updatedEvent = await response.json()
                
                // Update the selectedEvent with full data from backend
                setSelectedEvent(prev => prev ? { ...prev, ...updatedEvent } : null)
                
                // Update events state with full data to preserve all fields including photographer assignments
                setEvents(prevEvents => 
                    prevEvents.map(event => 
                        event.id === eventId 
                            ? { ...event, ...updatedEvent }
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
                // Parse the full response data from backend (includes assigned_personnel)
                const updatedEvent = await response.json()
                
                // Update the selectedEvent with full data from backend
                setSelectedEvent(prev => prev ? { ...prev, ...updatedEvent } : null)
                
                // Update events state with full data to preserve all fields including photographer assignments
                setEvents(prevEvents => 
                    prevEvents.map(event => 
                        event.id === eventId 
                            ? { ...event, ...updatedEvent }
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

    const handleEditEvent = (event) => {
        // Close the details modal and open edit modal
        setShowModal(false)
        setSelectedEvent(null)
        setEditingEvent(event)
        setShowEditModal(true)
        
        // Initialize editing notes and quick turn
        setEditingNotes(event.notes || '')
        setQuickTurn(event.quick_turn || false)
        setNewNoteInput('')
        
        console.log('Opening edit modal for event:', event.name)
        console.log('Event notes:', event.notes)
    }

    const closeEditModal = () => {
        setShowEditModal(false)
        setEditingEvent(null)
        setEditingNotes('')
        setNewNoteInput('')
        setQuickTurn(false)
    }

    // Handle adding new note to the editing notes
    const handleAddNewNote = () => {
        if (!newNoteInput.trim()) return
        
        const currentNotes = editingNotes.trim()
        const updatedNotes = currentNotes 
            ? `${currentNotes}, ${newNoteInput.trim()}`
            : newNoteInput.trim()
        
        setEditingNotes(updatedNotes)
        setNewNoteInput('')
    }

    const handleUpdateEvent = async (e, eventId) => {
        e.preventDefault()
        
        const formData = new FormData(e.target)
        
        const eventData = {
            name: formData.get('name'),
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            location: formData.get('location'),
            notes: editingNotes.trim(),
            details: formData.get('details'),
            quick_turn: quickTurn,
            // Preserve existing photographer assignments
            assigned_photographers: editingEvent.assigned_personnel 
                ? editingEvent.assigned_personnel.map(p => p.personnel_id)
                : []
        }
        
        console.log('🔧 Updating event:', eventId)
        console.log('🔧 editingEvent.assigned_personnel:', editingEvent.assigned_personnel)
        console.log('🔧 Sending eventData:', eventData)
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            })
            
            if (response.ok) {
                const updatedEventData = await response.json()
                
                console.log('🔧 Response from server:', updatedEventData)
                console.log('🔧 assigned_personnel in response:', updatedEventData.assigned_personnel)
                
                // Update the event in local state with the full response from server
                setEvents(prevEvents => 
                    prevEvents.map(event => 
                        event.id === eventId 
                            ? { ...event, ...updatedEventData }
                            : event
                    )
                )
                
                // Close edit modal and reopen view modal with updated data
                setShowEditModal(false)
                setEditingEvent(null)
                setSelectedEvent(updatedEventData)
                setShowModal(true)
                
                // Update completed notes if they exist
                setCompletedNotes(updatedEventData.completed_notes || [])
            } else {
                console.error('Failed to update event')
                console.log('Failed to update event. Please try again.')
            }
        } catch (error) {
            console.error('Error updating event:', error)
            console.log('Error updating event. Please try again.')
        }
    }

    const handleShotRequest = (event) => {
        setShotRequestEvent(event)
        setShowShotRequestModal(true)
    }

    const closeShotRequestModal = () => {
        setShowShotRequestModal(false)
        setShotRequestEvent(null)
        setShotRequestForm({
            description: '',
            priority: 'medium',
            deadline: '',
            special_instructions: '',
            details: ''
        })
    }

    const handleShotRequestSubmit = async (e) => {
        e.preventDefault()
        
        if (!shotRequestEvent) return
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...shotRequestForm,
                    event_id: shotRequestEvent.id,
                    requester_id: user.id,
                    status: 'pending'
                })
            })
            
            if (response.ok) {
                console.log('Shot request submitted successfully!')
                closeShotRequestModal()
                fetchShotRequests() // Refresh shot requests to show the new one
            } else {
                console.error('Failed to submit shot request')
                console.log('Failed to submit shot request. Please try again.')
            }
        } catch (error) {
            console.error('Error submitting shot request:', error)
            console.log('Error submitting shot request. Please try again.')
        }
    }

    // Handle personnel assignment to event
    const handleAssignPersonnelToEvent = async (personnelId, action = 'add') => {
        try {
            if (!selectedEvent) return
            
            // Get current assigned personnel
            const currentAssigned = selectedEvent.assigned_personnel || []
            
            let newAssigned
            if (action === 'add') {
                // Add personnel to event
                const person = personnel.find(p => p.id === personnelId)
                if (person) {
                    newAssigned = [...currentAssigned, {
                        personnel_id: personnelId,
                        name: person.name,
                        role: person.role
                    }]
                }
            } else {
                // Remove personnel from event
                newAssigned = currentAssigned.filter(p => p.personnel_id !== personnelId)
            }
            
            // Update the event
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${selectedEvent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    assigned_photographers: newAssigned.map(p => p.personnel_id)
                })
            })

            if (response.ok) {
                // Refresh events data to get updated assignments
                fetchEvents()
                // Update the selected event locally
                setSelectedEvent({
                    ...selectedEvent,
                    assigned_personnel: newAssigned
                })
            } else {
                console.error('Failed to assign personnel to event')
            }
        } catch (error) {
            console.error('Error assigning personnel:', error)
        }
    }

    // Handle column change when dragging events
    const handleColumnChange = async (eventId, newScheduleColumnId) => {
        try {
            // Store current scroll position
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop

            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    schedule_column_id: newScheduleColumnId
                })
            })

            if (response.ok) {
                // Get the full updated event from the server response
                const updatedEvent = await response.json()
                
                // Update events state with full event data from server (preserves all fields)
                setEvents(prevEvents => 
                    prevEvents.map(event => 
                        event.id === eventId 
                            ? { ...event, ...updatedEvent }
                            : event
                    )
                )
                
                // Update selectedEvent if this is the currently viewed event
                if (selectedEvent?.id === eventId) {
                    setSelectedEvent({ ...selectedEvent, ...updatedEvent })
                }
                
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
            currentColumn: event.schedule_column_id || null
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
            const { eventId, currentColumn, shotRequestId, currentSRColumn } = dragData
            
            // Handle event drop
            if (eventId && currentColumn !== targetColumn) {
                handleColumnChange(eventId, targetColumn)
            }
            
            // Handle shot request drop
            if (shotRequestId && currentSRColumn !== targetColumn) {
                handleShotRequestColumnChange(shotRequestId, targetColumn)
            }
        } catch (error) {
            console.error('Error handling drop:', error)
        }
    }

    // Shot Request Drag and Drop handlers
    const handleShotRequestDragStart = (e, shotRequest) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            shotRequestId: shotRequest.id,
            currentSRColumn: shotRequest.schedule_column_id || null
        }))
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleShotRequestColumnChange = async (shotRequestId, newScheduleColumnId) => {
        try {
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop

            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${shotRequestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    schedule_column_id: newScheduleColumnId
                })
            })

            if (response.ok) {
                // Get the full updated shot request from the server response
                const updatedShotRequest = await response.json()
                
                // Update shot requests state with full data from server (preserves all fields)
                setShotRequests(prevRequests => 
                    prevRequests.map(sr => 
                        sr.id === shotRequestId 
                            ? { ...sr, ...updatedShotRequest }
                            : sr
                    )
                )
                
                // Update selectedShotRequest if this is the currently viewed one
                if (selectedShotRequest?.id === shotRequestId) {
                    setSelectedShotRequest({ ...selectedShotRequest, ...updatedShotRequest })
                }
                
                setTimeout(() => {
                    window.scrollTo(0, scrollPosition)
                }, 0)
            } else {
                console.error('Failed to update shot request column')
            }
        } catch (error) {
            console.error('Error updating shot request column:', error)
        }
    }

    // Shot Request modal handlers
    const openShotRequestDetailModal = (shotRequest) => {
        setSelectedShotRequest(shotRequest)
        setShowShotRequestDetailModal(true)
    }

    const closeShotRequestDetailModal = () => {
        setShowShotRequestDetailModal(false)
        setSelectedShotRequest(null)
    }

    const openShotRequestEditModal = (shotRequest) => {
        // Create a clean copy with only the fields we need to edit
        setEditingShotRequest({
            id: shotRequest.id,
            request: shotRequest.request || '',
            start_time: shotRequest.start_time || '',
            end_time: shotRequest.end_time || '',
            date: shotRequest.date || '',
            details: shotRequest.details || '',
            notes: shotRequest.notes || '',
            deadline: shotRequest.deadline || '',
            quick_turn: shotRequest.quick_turn || false,
            process_point: shotRequest.process_point || 'idle'
        })
        setShowShotRequestEditModal(true)
        closeShotRequestDetailModal()
    }

    const closeShotRequestEditModal = () => {
        setShowShotRequestEditModal(false)
        setEditingShotRequest(null)
    }

    const handleShotRequestProcessPointChange = async (shotRequestId, newProcessPoint) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${shotRequestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    process_point: newProcessPoint
                })
            })

            if (response.ok) {
                const updatedShotRequest = await response.json()
                setShotRequests(prevRequests =>
                    prevRequests.map(sr => sr.id === shotRequestId ? updatedShotRequest : sr)
                )
                if (selectedShotRequest && selectedShotRequest.id === shotRequestId) {
                    setSelectedShotRequest(updatedShotRequest)
                }
            }
        } catch (error) {
            console.error('Error updating shot request process point:', error)
        }
    }

    const handleShotRequestDelete = async (shotRequestId) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${shotRequestId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                setShotRequests(prevRequests => prevRequests.filter(sr => sr.id !== shotRequestId))
                closeShotRequestDetailModal()
            }
        } catch (error) {
            console.error('Error deleting shot request:', error)
        }
    }

    const handleShotRequestPersonnelAssign = async (shotRequestId, personnelId) => {
        try {
            const shotRequest = shotRequests.find(sr => sr.id === shotRequestId)
            if (!shotRequest) return

            const currentPersonnelIds = shotRequest.personnels ? shotRequest.personnels.map(p => p.id) : []
            const newPersonnelIds = currentPersonnelIds.includes(personnelId)
                ? currentPersonnelIds.filter(id => id !== personnelId) // Remove if already assigned
                : [...currentPersonnelIds, personnelId] // Add if not assigned

            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${shotRequestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    personnel_ids: newPersonnelIds
                })
            })

            if (response.ok) {
                const updatedShotRequest = await response.json()
                setShotRequests(prevRequests =>
                    prevRequests.map(sr => sr.id === shotRequestId ? updatedShotRequest : sr)
                )
                if (selectedShotRequest && selectedShotRequest.id === shotRequestId) {
                    setSelectedShotRequest(updatedShotRequest)
                }
            }
        } catch (error) {
            console.error('Error assigning personnel to shot request:', error)
        }
    }

    const handleShotRequestEdit = async (e) => {
        e.preventDefault()
        if (!editingShotRequest) return

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests/${editingShotRequest.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editingShotRequest)
            })

            if (response.ok) {
                const updatedShotRequest = await response.json()
                setShotRequests(prevRequests =>
                    prevRequests.map(sr => sr.id === updatedShotRequest.id ? updatedShotRequest : sr)
                )
                closeShotRequestEditModal()
                fetchShotRequests()
            }
        } catch (error) {
            console.error('Error updating shot request:', error)
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
        let filteredEvents = events
        
        // Filter by selected photographer if one is selected
        if (selectedPhotographerId) {
            filteredEvents = events.filter(event => {
                // Check if event has personnel assigned (events use assigned_personnel)
                if (event.assigned_personnel && event.assigned_personnel.length > 0) {
                    return event.assigned_personnel.some(person => person.personnel_id === parseInt(selectedPhotographerId))
                }
                return false
            })
        }
        
        return filteredEvents
            .map(event => ({ ...event, position: getEventPosition(event) }))
            .filter(event => event.position !== null)
            .sort((a, b) => a.position.top - b.position.top)
    }

    // Group events by column
    const getEventsByColumn = () => {
        const eventsByColumn = {}
        
        // Initialize empty arrays for each schedule column
        scheduleColumns.forEach(column => {
            eventsByColumn[column.id] = []
        })
        
        // Add an array for unassigned events (null column_id)
        eventsByColumn['unassigned'] = []
        
        eventsWithPositions.forEach(event => {
            const columnId = event.schedule_column_id
            if (columnId && eventsByColumn[columnId]) {
                eventsByColumn[columnId].push(event)
            } else {
                eventsByColumn['unassigned'].push(event)
            }
        })
        
        return eventsByColumn
    }

    const eventsWithPositions = useMemo(() => getEventsWithPositions(), [events, selectedPhotographerId])
    const eventsByColumn = useMemo(() => getEventsByColumn(), [eventsWithPositions, scheduleColumns])

    // Filter shot requests by photographer
    const filteredShotRequests = useMemo(() => {
        if (selectedPhotographerId) {
            return shotRequests.filter(sr => {
                // Check if shot request has personnel assigned
                if (sr.personnels && sr.personnels.length > 0) {
                    return sr.personnels.some(person => person.id === parseInt(selectedPhotographerId))
                }
                return false
            })
        }
        return shotRequests
    }, [shotRequests, selectedPhotographerId])

    // Group shot requests by column
    const getShotRequestsByColumn = () => {
        const srByColumn = {}
        
        // Initialize empty arrays for each schedule column
        scheduleColumns.forEach(column => {
            srByColumn[column.id] = []
        })
        
        // Add an array for unassigned shot requests
        srByColumn['unassigned'] = []
        
        filteredShotRequests.forEach(sr => {
            const columnId = sr.schedule_column_id
            if (columnId && srByColumn[columnId]) {
                srByColumn[columnId].push(sr)
            } else {
                srByColumn['unassigned'].push(sr)
            }
        })
        
        return srByColumn
    }

    const shotRequestsByColumn = useMemo(() => {
        const result = getShotRequestsByColumn()
        console.log('📊 shotRequestsByColumn:', Object.keys(result).map(key => `${key}: ${result[key].length} SRs`))
        return result
    }, [filteredShotRequests, scheduleColumns])

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

 

    // Use dynamic schedule columns instead of fixed columns
    // columns are now managed by scheduleColumns state



    // Note: Project auto-selection is now handled by global navigation context

    const handleEventClick = (event) => {
        console.log('Event clicked:', event.name) // DEBUG
        setSelectedEvent(event)
        setShowModal(true)
        // Load completed notes from the event data
        setCompletedNotes(event.completed_notes || [])
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedEvent(null)
        setCompletedNotes([]) // Reset completed notes when closing modal
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

    // Get personnel assigned to the selected event
    const getAssignedPersonnel = () => {
        if (!selectedEvent || !selectedEvent.assigned_personnel) return []
        
        // Return the assigned personnel from the event's assigned_personnel field
        return selectedEvent.assigned_personnel.map(assignment => ({
            id: assignment.personnel_id,
            name: assignment.name,
            role: assignment.role
        }))
    }

    // Get available personnel (not assigned to this event)
    const getAvailablePersonnel = () => {
        if (!selectedEvent) return []
        
        // Get currently assigned personnel IDs
        const assignedIds = (selectedEvent.assigned_personnel || []).map(p => p.personnel_id)
        
        // Filter out personnel already assigned to this event
        // Don't filter by project - show all personnel for assignment
        const availablePersonnel = personnel.filter(person => 
            !assignedIds.includes(person.id)
        )
        
        console.log('Available personnel:', availablePersonnel.length, 'out of', personnel.length, 'total personnel')
        console.log('Assigned IDs:', assignedIds)
        
        return availablePersonnel
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
        <div className='page-container'>
            <Nav />
            {/* Notification system temporarily disabled to fix performance issues */}
            <div className='view-container'>
                <div className='schedule-container'>
                    <div className='schedule-header'>
                        <h1>Schedule</h1>
                        <div className='schedule-filters'>
                            <div className='view-toggle'>
                                <button
                                    className={`view-toggle-btn ${currentView === 'events' ? 'active' : ''}`}
                                    onClick={() => setCurrentView('events')}
                                >
                                    Events
                                </button>
                                <button
                                    className={`view-toggle-btn ${currentView === 'shot-requests' ? 'active' : ''}`}
                                    onClick={() => setCurrentView('shot-requests')}
                                >
                                    Shot Requests
                                </button>
                            </div>
                            <div className='filter-group'>
                                <label htmlFor='photographer-filter'>Filter by Photographer:</label>
                                <select
                                    id='photographer-filter'
                                    value={selectedPhotographerId}
                                    onChange={(e) => setSelectedPhotographerId(e.target.value)}
                                    className='filter-select'
                                >
                                    <option value=''>All Photographers</option>
                                    {personnel
                                        .filter(person => {
                                            const role = (person.role || '').toLowerCase()
                                            return role.includes('photographer')
                                        })
                                        .map(photographer => (
                                            <option key={photographer.id} value={photographer.id}>
                                                {photographer.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            {isAdmin && selectedProjectId && (
                                <button onClick={handleAddColumn} className='btn-add-column-top' title='Add new column'>
                                    + Add Column
                                </button>
                            )}
                        </div>
                    </div>



                    {loading ? (
                        <div className='loading'>Loading {currentView}...</div>
                    ) : (
                        <div className='schedule-grid'>
                            {/* TEST: Compare schedule-grid positioning vs events-container positioning */}
                            {currentView === 'events' ? (
                                <>
                                <div className='desktop-layout'>
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
                                            {scheduleColumns.map((column, index) => (
                                                <div key={column.id} className='column-header'>
                                                    {isAdmin ? (
                                                        editingColumnId === column.id ? (
                                                            <div className='column-edit-form'>
                                                                <input
                                                                    type='text'
                                                                    value={editingColumnName}
                                                                    onChange={(e) => setEditingColumnName(e.target.value)}
                                                                    onKeyPress={(e) => {
                                                                        if (e.key === 'Enter') handleSaveColumnName(column.id)
                                                                    }}
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => handleSaveColumnName(column.id)} className='btn-save'>✓</button>
                                                                <button onClick={handleCancelEditColumn} className='btn-cancel'>✕</button>
                                                            </div>
                                                        ) : (
                                                            <div className='column-title-row'>
                                                                <span onClick={() => handleStartEditColumn(column)} style={{cursor: 'pointer'}}>{column.name}</span>
                                                                {/* Only show delete button for columns 6+ (index 5+) */}
                                                                {index >= 5 && (
                                                                    <button onClick={() => handleDeleteColumn(column.id)} className='btn-delete-column' title='Delete column'>🗑</button>
                                                                )}
                                                            </div>
                                                        )
                                                    ) : (
                                                        column.name
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Event columns container */}
                                        <div className='sched-events-container'>
                                    
                                    {scheduleColumns.length === 0 ? (
                                        <div className='no-events'>
                                            <p>No columns configured. {isAdmin && selectedProjectId ? 'Add a column to get started.' : 'Please select a project.'}</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Render drop zones for each column */}
                                            {scheduleColumns.map((column) => (
                                                <div 
                                                    key={column.id} 
                                                    className='sched-event-column'
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, column.id)}
                                                >
                                                    {/* Render events for this column */}
                                                    {eventsByColumn[column.id]?.map(event => (
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
                                                            {event.quick_turn && <span className='quick-turn'><span className="quick-turn-dot"></span></span>}
                                                        </div>
                                                        <div className='event-time'>
                                                            {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                                                        </div>
                                                        <div className='event-location'>{event.location}</div>
                                                        {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                                                            <div className='event-photographers'>
                                                                {event.assigned_personnel.map((person, idx) => (
                                                                    <span key={person.personnel_id} className='photographer-badge'>
                                                                        {person.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Layout */}
                            <div className='mobile-layout'>
                                {/* Time column */}
                                <div className='time-column'>
                                    <div className='time-header'>Time</div>
                                    {timeSlots.map((slot) => (
                                        <div key={slot.time} className='time-slot'>
                                            <p className='time-text'>{slot.display}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Mobile columns */}
                                {scheduleColumns.length === 0 ? (
                                    <div className='mobile-column-wrapper'>
                                        <div className='mobile-column-header'>
                                            <h3>No Columns</h3>
                                        </div>
                                        <div className='mobile-events-container'>
                                            <p>No columns configured. {isAdmin && selectedProjectId ? 'Add a column to get started.' : 'Please select a project.'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    scheduleColumns.map((column) => (
                                        <div key={column.id} className='mobile-column-wrapper'>
                                            <div className='mobile-column-header'>
                                                <h3>{column.name}</h3>
                                            </div>
                                            <div className='mobile-events-container'>
                                                {eventsByColumn[column.id]?.map(event => (
                                                    <div
                                                        key={event.id}
                                                        className='mobile-event-card'
                                                        style={{
                                                            position: 'absolute',
                                                            top: `${event.position.top}px`,
                                                            height: `${event.position.height}px`,
                                                            left: '8px',
                                                            right: '8px',
                                                            minHeight: '60px',
                                                            backgroundColor: getProcessPointColor(event.process_point).backgroundColor,
                                                            border: `2px solid ${getProcessPointColor(event.process_point).borderColor}`
                                                        }}
                                                        onClick={() => handleEventClick(event)}
                                                    >
                                                        <div className='event-header'>
                                                            <h3>{event.name}</h3>
                                                            {event.quick_turn && <span className='quick-turn'><span className="quick-turn-dot"></span></span>}
                                                        </div>
                                                        <div className='event-time'>
                                                            {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                                                        </div>
                                                        <div className='event-location'>{event.location}</div>
                                                        {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                                                            <div className='event-photographers'>
                                                                {event.assigned_personnel.map((person, idx) => (
                                                                    <span key={person.personnel_id} className='photographer-badge'>
                                                                        {person.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Mobile scroll indicator */}
                        <div className="mobile-scroll-indicator">
                            ← Swipe to see more columns →
                        </div>
                        </>
                    ) : (
                /* Shot Requests Timeline View */
                <>
                <div className='desktop-layout'>
                    {/* unified grid overlay */}
                    <div className='global-grid-lines'>
                        {timeSlots.map((slot) => (
                            <div
                                key={`gline-sr-${slot.time}`}
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

                    {/* Shot Requests area */}
                    <div className='events-area'>
                        <div className='events-header'>
                            {scheduleColumns.map((column, index) => (
                                <div key={column.id} className='column-header'>
                                    {isAdmin ? (
                                        editingColumnId === column.id ? (
                                            <div className='column-edit-form'>
                                                <input
                                                    type='text'
                                                    value={editingColumnName}
                                                    onChange={(e) => setEditingColumnName(e.target.value)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') handleSaveColumnName(column.id)
                                                    }}
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSaveColumnName(column.id)} className='btn-save'>✓</button>
                                                <button onClick={handleCancelEditColumn} className='btn-cancel'>✕</button>
                                            </div>
                                        ) : (
                                            <div className='column-title-row'>
                                                <span onClick={() => handleStartEditColumn(column)} style={{cursor: 'pointer'}}>{column.name}</span>
                                                {/* Only show delete button for columns 6+ (index 5+) */}
                                                {index >= 5 && (
                                                    <button onClick={() => handleDeleteColumn(column.id)} className='btn-delete-column' title='Delete column'>🗑</button>
                                                )}
                                            </div>
                                        )
                                    ) : (
                                        column.name
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <div className='sched-events-container'>
                            {scheduleColumns.length === 0 ? (
                                <div className='no-events'>
                                    <p>No columns configured. {isAdmin && selectedProjectId ? 'Add a column to get started.' : 'Please select a project.'}</p>
                                </div>
                            ) : (
                                scheduleColumns.map((column) => (
                                    <div 
                                        key={column.id} 
                                        className='sched-event-column'
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, column.id)}
                                    >
                                        {shotRequestsByColumn[column.id]?.map(sr => {
                                            // Default to 6:00 AM - 7:00 AM if no time is specified
                                            const startTime = (sr.start_time && sr.start_time.trim() !== '') ? sr.start_time : '06:00'
                                            const endTime = (sr.end_time && sr.end_time.trim() !== '') ? sr.end_time : '07:00'
                                            
                                            const position = getEventPosition({
                                                start_time: startTime,
                                                end_time: endTime,
                                                startTime: startTime,
                                                endTime: endTime
                                            })
                                            
                                            // Position should always exist now since we provide defaults
                                            if (!position) {
                                                console.warn('Shot request missing position:', sr.id, startTime, endTime)
                                                return null
                                            }
                                            
                                            return (
                                                <div
                                                    key={sr.id}
                                                    className={`sched-event-card process-${(sr.process_point || 'idle').toLowerCase()}`}
                                                    draggable={isAdmin}
                                                    onDragStart={(e) => handleShotRequestDragStart(e, sr)}
                                                    onClick={() => openShotRequestDetailModal(sr)}
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${position.top}px`,
                                                        height: `${position.height}px`,
                                                        left: '8px',
                                                        right: '8px',
                                                        minHeight: '60px',
                                                        backgroundColor: getProcessPointColor(sr.process_point).backgroundColor,
                                                        border: `2px solid ${getProcessPointColor(sr.process_point).borderColor}`,
                                                        cursor: isAdmin ? 'move' : 'pointer'
                                                    }}
                                                >
                                                    <div className='event-header'>
                                                        <h3>{sr.request}</h3>
                                                        {sr.quick_turn && <span className='quick-turn'><span className="quick-turn-dot"></span></span>}
                                                    </div>
                                                    <div className='event-time'>
                                                        {sr.start_time && sr.end_time ? (
                                                            `${formatTimeTo12Hour(startTime)} - ${formatTimeTo12Hour(endTime)}`
                                                        ) : (
                                                            <span style={{ opacity: 0.6, fontStyle: 'italic' }}>No time specified</span>
                                                        )}
                                                    </div>
                                                    {sr.notes && <div className='event-notes'>{sr.notes}</div>}
                                                    <div className='event-process'>
                                                        {(sr.process_point || 'idle').toUpperCase()}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                </>
            )}
            </div>
                    )}
            
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
                                <span>{formatTimeTo12Hour(selectedEvent.start_time)} - {formatTimeTo12Hour(selectedEvent.end_time)}</span>
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
                                    <div className="notes-checkboxes-display">
                                        {selectedEvent.notes.split(',').map((note, index) => {
                                            const noteValue = note.trim();
                                            const isCompleted = completedNotes.includes(noteValue);
                                            return (
                                                <label key={index} className="checkbox-display-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={isCompleted}
                                                        onChange={() => handleCompletedNoteToggle(noteValue)}
                                                    />
                                                    <span>{noteValue}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {selectedEvent.details && (
                                <div className="event-detail-row">
                                    <label>Details:</label>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{selectedEvent.details}</div>
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
                                        {selectedEvent.quick_turn ? <>Yes <span className="quick-turn-dot"></span></> : 'No'}
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
                                    <option value="null">Not Shot</option>
                                </select>
                            </div>

                            {/* Personnel Assignment Section - Admin Only */}
                            {isAdmin && (
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
                                                            handleAssignPersonnelToEvent(person.id, 'remove')
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
                                                        handleAssignPersonnelToEvent(personnelId, 'add')
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
                            )}

                            {/* Client View - Show Assigned Personnel (Read Only) */}
                            {!isAdmin && (
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
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="modal-footer">
                            <button 
                                className="modal-button edit-button" 
                                onClick={() => handleEditEvent(selectedEvent)}
                            >
                                Edit Event
                            </button>
                            {isAdmin && (
                                <button 
                                    className="modal-button delete-button" 
                                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                                >
                                    Delete Event
                                </button>
                            )}
                            {!isAdmin && (
                                <button 
                                    className="modal-button shot-request-button" 
                                    onClick={() => handleShotRequest(selectedEvent)}
                                >
                                    Add Shot Request
                                </button>
                            )}
                            <button className="modal-button" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Event Modal */}
            {showEditModal && editingEvent && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Event</h2>
                            <button className="modal-close" onClick={closeEditModal}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            <form onSubmit={(e) => handleUpdateEvent(e, editingEvent.id)}>
                                <div className="form-group">
                                    <label>Event Name:</label>
                                    <input
                                        type="text"
                                        name="name"
                                        defaultValue={editingEvent.name}
                                        required
                                    />
                                </div>
                                
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Start Time:</label>
                                        <input
                                            type="time"
                                            name="start_time"
                                            defaultValue={editingEvent.start_time}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            name="end_time"
                                            defaultValue={editingEvent.end_time}
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>Location:</label>
                                    <input
                                        type="text"
                                        name="location"
                                        defaultValue={editingEvent.location}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Notes:</label>
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
                                                fontFamily: 'inherit',
                                                resize: 'vertical'
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
                                            type="button"
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
                                </div>
                                
                                <div className="form-group">
                                    <label>Details (raw text):</label>
                                    <textarea
                                        name="details"
                                        defaultValue={editingEvent.details}
                                        rows="4"
                                        placeholder="Additional event details..."
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Quick Turn:</label>
                                    <input
                                        type="checkbox"
                                        checked={quickTurn}
                                        onChange={(e) => setQuickTurn(e.target.checked)}
                                    />
                                </div>
                                
                                <div className="modal-footer">
                                    <button type="submit" className="modal-button edit-button">
                                        Update Event
                                    </button>
                                    <button type="button" className="modal-button" onClick={closeEditModal}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Shot Request Modal */}
            {showShotRequestModal && shotRequestEvent && (
                <div className="modal-overlay" onClick={closeShotRequestModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Shot Request</h2>
                            <button className="modal-close" onClick={closeShotRequestModal}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="event-info">
                                <h3>{shotRequestEvent.name}</h3>
                                <p>{formatTimeTo12Hour(shotRequestEvent.start_time)} - {formatTimeTo12Hour(shotRequestEvent.end_time)}</p>
                                <p>{shotRequestEvent.location}</p>
                            </div>
                            
                            <form onSubmit={handleShotRequestSubmit}>
                                <div className="form-group">
                                    <label>Description:</label>
                                    <textarea
                                        name="description"
                                        value={shotRequestForm.description}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, description: e.target.value})}
                                        required
                                        rows="3"
                                        placeholder="Describe the shots you need..."
                                    />
                                </div>
                                
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Priority:</label>
                                        <select
                                            name="priority"
                                            value={shotRequestForm.priority}
                                            onChange={(e) => setShotRequestForm({...shotRequestForm, priority: e.target.value})}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Deadline:</label>
                                        <input
                                            type="datetime-local"
                                            name="deadline"
                                            value={shotRequestForm.deadline}
                                            onChange={(e) => setShotRequestForm({...shotRequestForm, deadline: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>Special Instructions:</label>
                                    <textarea
                                        name="special_instructions"
                                        value={shotRequestForm.special_instructions}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, special_instructions: e.target.value})}
                                        rows="2"
                                        placeholder="Any specific requirements or notes..."
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Details:</label>
                                    <textarea
                                        name="details"
                                        value={shotRequestForm.details}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, details: e.target.value})}
                                        rows="3"
                                        placeholder="Add specific individual references, names, or detailed requirements..."
                                    />
                                </div>
                                
                                <div className="modal-footer">
                                    <button type="submit" className="modal-button shot-request-button">
                                        Submit Shot Request
                                    </button>
                                    <button type="button" className="modal-button" onClick={closeShotRequestModal}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Shot Request Detail Modal */}
            {showShotRequestDetailModal && selectedShotRequest && (
                <div className="modal-overlay" onClick={closeShotRequestDetailModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedShotRequest.request}</h2>
                            <button className="modal-close" onClick={closeShotRequestDetailModal}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            {selectedShotRequest.start_time && selectedShotRequest.end_time && (
                                <div className="event-detail-row">
                                    <label>Time:</label>
                                    <span>{formatTimeTo12Hour(selectedShotRequest.start_time)} - {formatTimeTo12Hour(selectedShotRequest.end_time)}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.date && (
                                <div className="event-detail-row">
                                    <label>Date:</label>
                                    <span>{formatDateForHeader(selectedShotRequest.date)}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.details && (
                                <div className="event-detail-row">
                                    <label>Details:</label>
                                    <span>{selectedShotRequest.details}</span>
                                </div>
                            )}
                            
                            {selectedShotRequest.notes && (
                                <div className="event-detail-row">
                                    <label>Notes:</label>
                                    <span>{selectedShotRequest.notes}</span>
                                </div>
                            )}
                            
                            <div className="event-detail-row">
                                <label>Quick Turn:</label>
                                <span>{selectedShotRequest.quick_turn ? <>Yes <span className="quick-turn-dot"></span></> : 'No'}</span>
                            </div>
                            
                            {selectedShotRequest.deadline && (
                                <div className="event-detail-row">
                                    <label>Deadline:</label>
                                    <span>{selectedShotRequest.deadline}</span>
                                </div>
                            )}
                            
                            <div className="event-detail-row">
                                <label>Process Point:</label>
                                <select 
                                    value={selectedShotRequest.process_point || 'idle'} 
                                    onChange={(e) => handleShotRequestProcessPointChange(selectedShotRequest.id, e.target.value)}
                                    className="process-point-select"
                                >
                                    <option value="idle">Idle</option>
                                    <option value="ingest">Ingest</option>
                                    <option value="cull">Cull</option>
                                    <option value="color">Color</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="null">Not Shot</option>
                                </select>
                            </div>
                            
                            <div className="event-detail-row">
                                <label>Status:</label>
                                <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: selectedShotRequest.status === 'shot' ? '#4CAF50' : '#757575',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold'
                                }}>
                                    {(selectedShotRequest.status || 'open').toUpperCase()}
                                </span>
                            </div>
                            
                            <div className="event-detail-row">
                                <label>Assigned Personnel:</label>
                                <div className="personnel-list">
                                    {selectedShotRequest.personnels && selectedShotRequest.personnels.length > 0 ? (
                                        selectedShotRequest.personnels.map(person => (
                                            <div key={person.id} className="personnel-item">
                                                {person.name}
                                                {isAdmin && (
                                                    <button 
                                                        className="personnel-remove-btn"
                                                        onClick={() => handleShotRequestPersonnelAssign(selectedShotRequest.id, person.id)}
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <span>No personnel assigned</span>
                                    )}
                                </div>
                            </div>
                            
                            {isAdmin && (
                                <div className="event-detail-row">
                                    <label>Add Personnel:</label>
                                    <select 
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleShotRequestPersonnelAssign(selectedShotRequest.id, parseInt(e.target.value))
                                                e.target.value = ''
                                            }
                                        }}
                                        className="personnel-select"
                                    >
                                        <option value="">Select personnel...</option>
                                        {personnel
                                            .filter(p => (p.role || '').toLowerCase().includes('photographer'))
                                            .filter(p => !selectedShotRequest.personnels?.some(assigned => assigned.id === p.id))
                                            .map(person => (
                                                <option key={person.id} value={person.id}>
                                                    {person.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        
                        <div className="modal-actions">
                            {isAdmin && (
                                <>
                                    <button 
                                        className="modal-button edit-button" 
                                        onClick={() => openShotRequestEditModal(selectedShotRequest)}
                                    >
                                        Edit Shot Request
                                    </button>
                                    <button 
                                        className="modal-button delete-button" 
                                        onClick={() => handleShotRequestDelete(selectedShotRequest.id)}
                                    >
                                        Delete Shot Request
                                    </button>
                                </>
                            )}
                            <button className="modal-button" onClick={closeShotRequestDetailModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Shot Request Modal */}
            {showShotRequestEditModal && editingShotRequest && (
                <div className="modal-overlay" onClick={closeShotRequestEditModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Shot Request</h2>
                            <button className="modal-close" onClick={closeShotRequestEditModal}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            <form onSubmit={handleShotRequestEdit}>
                                <div className="form-group">
                                    <label>Request:</label>
                                    <input
                                        type="text"
                                        value={editingShotRequest.request || ''}
                                        onChange={(e) => setEditingShotRequest({...editingShotRequest, request: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Start Time:</label>
                                        <input
                                            type="time"
                                            value={editingShotRequest.start_time || ''}
                                            onChange={(e) => setEditingShotRequest({...editingShotRequest, start_time: e.target.value})}
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            value={editingShotRequest.end_time || ''}
                                            onChange={(e) => setEditingShotRequest({...editingShotRequest, end_time: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>Date:</label>
                                    <input
                                        type="date"
                                        value={editingShotRequest.date || ''}
                                        onChange={(e) => setEditingShotRequest({...editingShotRequest, date: e.target.value})}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Details:</label>
                                    <textarea
                                        value={editingShotRequest.details || ''}
                                        onChange={(e) => setEditingShotRequest({...editingShotRequest, details: e.target.value})}
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Notes:</label>
                                    <textarea
                                        value={editingShotRequest.notes || ''}
                                        onChange={(e) => setEditingShotRequest({...editingShotRequest, notes: e.target.value})}
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Deadline:</label>
                                    <input
                                        type="datetime-local"
                                        value={editingShotRequest.deadline || ''}
                                        onChange={(e) => setEditingShotRequest({...editingShotRequest, deadline: e.target.value})}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={editingShotRequest.quick_turn || false}
                                            onChange={(e) => setEditingShotRequest({...editingShotRequest, quick_turn: e.target.checked})}
                                        />
                                        Quick Turn <span className="quick-turn-dot"></span>
                                    </label>
                                </div>
                                
                                <div className="form-group">
                                    <label>Process Point:</label>
                                    <select
                                        value={editingShotRequest.process_point || 'idle'}
                                        onChange={(e) => setEditingShotRequest({...editingShotRequest, process_point: e.target.value})}
                                    >
                                        <option value="idle">Idle</option>
                                        <option value="ingest">Ingest</option>
                                        <option value="cull">Cull</option>
                                        <option value="color">Color</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="null">Not Shot</option>
                                    </select>
                                </div>
                                
                                <div className="modal-actions">
                                    <button type="submit" className="modal-button save-button">
                                        Save Changes
                                    </button>
                                    <button type="button" className="modal-button" onClick={closeShotRequestEditModal}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
                </div>
            </div>
        </div>
    )
}

