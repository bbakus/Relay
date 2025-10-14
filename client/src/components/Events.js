import React, { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '../utils/apiConfig'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { Nav } from './Nav'
import { formatDateForHeader } from '../utils/dateUtils'
import '../styles/events.css'
import '../styles/quick-turn-dot.css'

export const Events = () => {
    const { user, selectedCompanyId, selectedOrganizationId, selectedProjectId, selectedDate } = useAuth()
    const { subscribe, isConnected } = useWebSocket()
    
    // State management
    const [events, setEvents] = useState([])
    const [projects, setProjects] = useState([])
    const [organizations, setOrganizations] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [scheduleColumns, setScheduleColumns] = useState([])
    const [currentColumnIndex, setCurrentColumnIndex] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showAddEventModal, setShowAddEventModal] = useState(false)
    const [showEditEventModal, setShowEditEventModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null)
    const [showShotRequestModal, setShowShotRequestModal] = useState(false)
    const [addShotRequest, setAddShotRequest] = useState(false)
    const [lastCreatedEventId, setLastCreatedEventId] = useState(null)
    const [expandedEventIds, setExpandedEventIds] = useState(new Set())
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    
    // Filter states for All Events section (use global selectedDate for date filtering)
    const [filterQuickTurn, setFilterQuickTurn] = useState('all')
    const [filterProcessPoint, setFilterProcessPoint] = useState('all')
    const [filterDate, setFilterDate] = useState('all')
    
    // Filter states for Today's Events section
    const [todayFilterQuickTurn, setTodayFilterQuickTurn] = useState('all')
    const [todayFilterProcessPoint, setTodayFilterProcessPoint] = useState('all')
    const [todaySortBy, setTodaySortBy] = useState('alphabetical') // 'alphabetical' or 'time'
    
    // Note: Admin filters now handled globally via AuthContext
    
    // Real-time status updates
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000)
        return () => clearInterval(intervalId)
    }, [])
    
    // Get all dates in the selected project's date range for date dropdown
    const projectDates = useMemo(() => {
        if (!selectedProjectId) return []
        
        const project = projects.find(p => p.id === parseInt(selectedProjectId))
        if (!project || !project.start_date || !project.end_date) return []
        
        // Generate all dates between start_date and end_date
        const dates = []
        const startDate = new Date(project.start_date + 'T00:00:00')
        const endDate = new Date(project.end_date + 'T00:00:00')
        
        let currentDate = new Date(startDate)
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0]
            dates.push(dateStr)
            currentDate.setDate(currentDate.getDate() + 1)
        }
        
        return dates
    }, [projects, selectedProjectId])
    
    // Auto-populate date and project when Add Event modal opens
    useEffect(() => {
        if (showAddEventModal) {
            setEventForm(prev => ({
                ...prev,
                date: selectedDate || '',
                project_id: selectedProjectId || ''
            }))
        }
    }, [showAddEventModal, selectedDate, selectedProjectId])

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
        details: '',
        quick_turn: false,
        deadline: '',
        project_id: '',
        assigned_photographers: []
    })
    
    // Shot request form state
    const [shotRequestForm, setShotRequestForm] = useState({
        request: '',
        notes: '',
        details: '',
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
            fetchOrganizations(),
            fetchPersonnel()
        ]).finally(() => {
            console.log('Events page: Data fetch completed')
            setLoading(false)
        })
    }, [])
    
    // Fetch schedule columns when project changes
    useEffect(() => {
        if (selectedProjectId) {
            fetchScheduleColumns()
            setCurrentColumnIndex(0) // Reset to first column when project changes
        }
    }, [selectedProjectId])
    
    // WebSocket: Listen for real-time event updates
    useEffect(() => {
        if (!isConnected) return

        const unsubscribeEvent = subscribe('event_update', (data) => {
            console.log('🔴 LIVE UPDATE: Event changed', data)
            fetchEvents()
        })

        return () => {
            unsubscribeEvent()
        }
    }, [isConnected, subscribe])
    
    const fetchEvents = async () => {
        try {
            // Build events URL with company filtering
            let eventsUrl = `${API_CONFIG.baseUrl}/api/events`
            if (user?.is_super_admin && selectedCompanyId) {
                eventsUrl = `${API_CONFIG.baseUrl}/api/events?company_id=${selectedCompanyId}`
            } else if (user?.company_id && !user?.is_super_admin) {
                eventsUrl = `${API_CONFIG.baseUrl}/api/events?company_id=${user.company_id}`
            }
            
            const response = await fetch(eventsUrl)
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/projects`)
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/organizations`)
            if (response.ok) {
                const data = await response.json()
                setOrganizations(data)
            }
        } catch (error) {
            console.error('Error fetching organizations:', error)
        }
    }

    const fetchPersonnel = async () => {
        try {
            // Build personnel URL with company filtering
            let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
            if (user?.is_super_admin && selectedCompanyId) {
                personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
            } else if (user?.company_id && !user?.is_super_admin) {
                personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
            }
            
            const response = await fetch(personnelUrl)
            if (response.ok) {
                const data = await response.json()
                console.log('Events page: Fetched personnel:', data.length, 'personnel')
                setPersonnel(data)
            }
        } catch (error) {
            console.error('Error fetching personnel:', error)
        }
    }

    const fetchScheduleColumns = async () => {
        try {
            if (!selectedProjectId) {
                setScheduleColumns([])
                return
            }
            const response = await fetch(`${API_CONFIG.baseUrl}/api/schedule-columns?project_id=${selectedProjectId}`)
            if (response.ok) {
                const data = await response.json()
                setScheduleColumns(data)
            }
        } catch (error) {
            console.error('Error fetching schedule columns:', error)
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
    
    // Helper function to filter events by search query
    const filterBySearch = (events) => {
        if (!searchQuery.trim()) return events
        
        const query = searchQuery.toLowerCase().trim()
        return events.filter(event => {
            const name = (event.name || '').toLowerCase()
            const location = (event.location || '').toLowerCase()
            const notes = (event.notes || '').toLowerCase()
            const photographerNotes = (event.photographer_notes || '').toLowerCase()
            const completedNotes = (event.completed_notes || '').toLowerCase()
            
            return name.includes(query) || 
                   location.includes(query) || 
                   notes.includes(query) ||
                   photographerNotes.includes(query) ||
                   completedNotes.includes(query)
        })
    }
    
    // Filtered events for All Events section (show ALL events in project, not filtered by global date)
    const filteredProjectEvents = useMemo(() => {
        let filtered = projectEvents
        
        // Filter by search query
        filtered = filterBySearch(filtered)
        
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
    }, [projectEvents, filterQuickTurn, filterProcessPoint, filterDate, searchQuery])
    
    // Event filtering by status and date (use global selectedDate, fallback to today)
    const todaysEvents = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        return projectEvents.filter(event => event.date === targetDate)
    }, [projectEvents, selectedDate])
    
    // Filtered today's events
    const filteredTodaysEvents = useMemo(() => {
        let filtered = todaysEvents
        
        // Filter by search query
        filtered = filterBySearch(filtered)
        
        // Filter by quick turn
        if (todayFilterQuickTurn !== 'all') {
            const isQuickTurn = todayFilterQuickTurn === 'yes'
            filtered = filtered.filter(event => !!event.quick_turn === isQuickTurn)
        }
        
        // Filter by process point
        if (todayFilterProcessPoint !== 'all') {
            filtered = filtered.filter(event => (event.process_point || 'idle') === todayFilterProcessPoint)
        }
        
        // Sort based on selected option
        filtered.sort((a, b) => {
            if (todaySortBy === 'time') {
                // Sort by start time from earliest to latest
                if (!a.start_time && !b.start_time) return 0
                if (!a.start_time) return 1
                if (!b.start_time) return -1
                return a.start_time.localeCompare(b.start_time)
            } else {
                // Sort alphabetically by name (default)
                return (a.name || '').localeCompare(b.name || '')
            }
        })
        
        return filtered
    }, [todaysEvents, todayFilterQuickTurn, todayFilterProcessPoint, todaySortBy, searchQuery])
    
    const upcomingEvents = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        let filtered = projectEvents.filter(event => {
            // Filter by selected date first
            if (event.date !== targetDate) return false
            
            const status = getEventStatus(event)
            return status === 'upcoming' || status === 'starting-soon'
        })
        
        // Apply search filter
        filtered = filterBySearch(filtered)
        
        return filtered
    }, [projectEvents, selectedDate, currentTimeTick, searchQuery])
    
    const liveEvents = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        let filtered = projectEvents.filter(event => {
            // Filter by selected date first
            if (event.date !== targetDate) return false
            
            const status = getEventStatus(event)
            return status === 'ongoing'
        })
        
        // Apply search filter
        filtered = filterBySearch(filtered)
        
        return filtered
    }, [projectEvents, selectedDate, currentTimeTick, searchQuery])
    
    // Helper function to format time to 12-hour format
    const formatTimeTo12Hour = (time24) => {
        if (!time24) return ''
        const [hours, minutes] = time24.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }
    
    // Group today's events by schedule column for mini schedule view
    const eventsByColumn = useMemo(() => {
        const targetDate = selectedDate || new Date().toISOString().split('T')[0]
        const dateEvents = projectEvents.filter(event => event.date === targetDate)
        
        const grouped = {}
        scheduleColumns.forEach(column => {
            grouped[column.id] = dateEvents
                .filter(event => event.schedule_column_id === column.id)
                .sort((a, b) => {
                    if (!a.start_time || !b.start_time) return 0
                    return a.start_time.localeCompare(b.start_time)
                })
        })
        
        return grouped
    }, [projectEvents, selectedDate, scheduleColumns])
    
    // Navigation functions for mini schedule
    const goToNextColumn = () => {
        if (currentColumnIndex < scheduleColumns.length - 1) {
            setCurrentColumnIndex(currentColumnIndex + 1)
        }
    }
    
    const goToPrevColumn = () => {
        if (currentColumnIndex > 0) {
            setCurrentColumnIndex(currentColumnIndex - 1)
        }
    }
    
    // Get process point color for mini schedule cards
    const getProcessPointColor = (processPoint) => {
        switch (processPoint?.toLowerCase()) {
            case 'idle': return { backgroundColor: 'rgba(0, 255, 255, 0.15)', borderColor: 'rgba(0, 255, 255, 0.9)' }
            case 'ingest': return { backgroundColor: 'rgba(0, 128, 255, 0.15)', borderColor: 'rgba(0, 128, 255, 0.9)' }
            case 'cull': return { backgroundColor: 'rgba(255, 122, 24, 0.15)', borderColor: 'rgba(255, 122, 24, 0.9)' }
            case 'color': return { backgroundColor: 'rgba(255, 64, 64, 0.15)', borderColor: 'rgba(255, 64, 64, 0.9)' }
            case 'delivered': return { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.9)' }
            case 'null': return { backgroundColor: 'rgba(75, 85, 99, 0.1)', borderColor: 'rgba(75, 85, 99, 0.3)', opacity: 0.5 }
            default: return { backgroundColor: 'rgba(107, 114, 128, 0.15)', borderColor: 'rgba(107, 114, 128, 0.9)' }
        }
    }
    
    // Event management functions (removed modal functions, now using collapsible cards)
    
    const handleProcessPointChange = async (eventId, newProcessPoint) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Name': user?.name || 'Unknown'
                },
                body: JSON.stringify({ process_point: newProcessPoint })
            })
            if (response.ok) {
                // Parse the full response data from backend (includes assigned_personnel)
                const updatedEvent = await response.json()
                
                // Update the event in the local state with full data to preserve all fields
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
    
    const handleAddEvent = async (e) => {
        e.preventDefault()
        
        if (!currentProject) {
            console.log('No current project available to add events to')
            return
        }
        
        const eventData = {
            ...eventForm,
            project_id: currentProject.id
        }
        
        console.log('🔍 Creating event with data:', eventData)
        console.log('🔍 assigned_photographers:', eventData.assigned_photographers)
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            })
            
            if (response.ok) {
                const createdEvent = await response.json()
                console.log('🔍 Created event response:', createdEvent)
                console.log('🔍 assigned_personnel in response:', createdEvent.assigned_personnel)
                setLastCreatedEventId(createdEvent.id)
                
                fetchEvents()
                setEventForm({
                    name: '',
                    date: '',
                    start_time: '',
                    end_time: '',
                    location: '',
                    notes: '',
                    details: '',
                    quick_turn: false,
                    deadline: '',
                    project_id: '',
                    assigned_photographers: []
                })
                setShowAddEventModal(false)
                
                // If user wants to add shot request, show shot request modal
                if (addShotRequest) {
                    setShowShotRequestModal(true)
                    setAddShotRequest(false) // Reset checkbox
                }
            } else {
                const data = await response.json()
                console.log(data.error || 'Failed to create event')
            }
        } catch (error) {
            console.error('Error creating event:', error)
            console.log('Failed to create event')
        }
    }

    const handleEditEvent = async (e) => {
        e.preventDefault()
        
        if (!editingEvent) return
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${editingEvent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventForm)
            })
            
            if (response.ok) {
                fetchEvents()
                setShowEditEventModal(false)
                setEditingEvent(null)
                setEventForm({
                    name: '',
                    date: '',
                    start_time: '',
                    end_time: '',
                    location: '',
                    notes: '',
                    details: '',
                    quick_turn: false,
                    deadline: '',
                    project_id: '',
                    assigned_photographers: []
                })
            } else {
                const data = await response.json()
                console.log(data.error || 'Failed to update event')
            }
        } catch (error) {
            console.error('Error updating event:', error)
            console.log('Failed to update event')
        }
    }

    const openEditModal = (event) => {
        setEditingEvent(event)
        setEventForm({
            name: event.name || '',
            date: event.date || '',
            start_time: event.start_time || '',
            end_time: event.end_time || '',
            location: event.location || '',
            notes: event.notes || '',
            details: event.details || '',
            quick_turn: event.quick_turn || false,
            deadline: event.deadline || '',
            project_id: event.project_id || '',
            assigned_photographers: event.assigned_personnel ? event.assigned_personnel.map(p => p.personnel_id) : []
        })
        setShowEditEventModal(true)
    }

    const handleDeleteEvent = async (eventId, eventName) => {
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/events/${eventId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            })
            
            if (response.ok) {
                // Remove event from local state
                setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId))
                // Close expanded view if this event was expanded
                setExpandedEventIds(prev => {
                    const newSet = new Set(prev)
                    // Remove all entries for this event (both panels)
                    newSet.forEach(key => {
                        if (key.endsWith(`-${eventId}`)) {
                            newSet.delete(key)
                        }
                    })
                    return newSet
                })
            } else {
                const data = await response.json()
                console.log(data.error || 'Failed to delete event')
            }
        } catch (error) {
            console.error('Error deleting event:', error)
            console.log('Failed to delete event')
        }
    }
    
    const handleAddShotRequest = async (e) => {
        e.preventDefault()
        
        if (!currentProject) {
            console.log('No current project available to add shot request to')
            return
        }
        
        const shotRequestData = {
            ...shotRequestForm,
            project_id: currentProject.id,
            event_id: lastCreatedEventId
        }
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/shot-requests`, {
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
                    details: '',
                    quick_turn: false,
                    start_time: '',
                    end_time: '',
                    deadline: ''
                })
                setShowShotRequestModal(false)
                setLastCreatedEventId(null) // Clear the event ID
                console.log('Shot request created successfully!')
            } else {
                const data = await response.json()
                console.log(data.error || 'Failed to create shot request')
            }
        } catch (error) {
            console.error('Error creating shot request:', error)
            console.log('Failed to create shot request')
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
                        <h3>{event.name} {event.quick_turn && <span className="quick-turn-text"><span className="quick-turn-dot"></span> Quick Turn</span>}</h3>

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
                                    {event.process_point_updated_by_name && (
                                        <span style={{ 
                                            fontSize: '10px', 
                                            marginLeft: '8px', 
                                            opacity: 0.7,
                                            fontStyle: 'italic'
                                        }}>
                                            by {event.process_point_updated_by_name}
                                        </span>
                                    )}
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

                        {event.details && (
                            <div className="events-detail-row">
                                <strong>Details:</strong>
                                <span style={{ whiteSpace: 'pre-wrap' }}>{event.details}</span>
                            </div>
                        )}

                        {event.deadline && (
                            <div className="events-detail-row">
                                <strong>Deadline:</strong>
                                <span>{event.deadline}</span>
                            </div>
                        )}

                        {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                            <div className="events-detail-row">
                                <strong>Assigned Photographers:</strong>
                                <div className="assigned-photographers">
                                    {event.assigned_personnel.map((person, index) => (
                                        <span key={person.personnel_id} className="photographer-tag">
                                            {person.name} ({person.role})
                                        </span>
                                    ))}
                                </div>
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
                                    openEditModal(event)
                                }}
                                className="events-edit-btn"
                            >
                                Edit Event
                            </button>
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
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteEvent(event.id, event.name)
                                }}
                                className="events-delete-btn"
                            >
                                Delete Event
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
                        <div className='event-header-controls'>
                            <input 
                                type="text"
                                placeholder="Search events by name, location, or notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="events-search-input"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="events-search-clear"
                                    title="Clear search"
                                >
                                    ×
                                </button>
                            )}
                            <button onClick={() => setShowAddEventModal(true)}>Add Event</button>
                        </div>
                    </div>
                <div className="events-main-grid">
                    {/* Today's Events - or Selected Date Events */}
                    <div className="events-panel-section">
                        <div className="events-section-header">
                            <h2>
                                {selectedDate ? `Events for ${formatDateForHeader(selectedDate)}` : "Today's Events"}
                                {searchQuery && <span className="events-search-indicator">Searching...</span>}
                            </h2>
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
                            
                            <div className="events-filter-group">
                                <label>Sort By:</label>
                                <select 
                                    value={todaySortBy} 
                                    onChange={(e) => setTodaySortBy(e.target.value)}
                                    className="events-filter-select"
                                >
                                    <option value="alphabetical">Alphabetically</option>
                                    <option value="time">By Time</option>
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
                    
                    {/* Live Events and Upcoming Events - Side by Side */}
                    <div className="events-panel-dual">
                        {/* Live Events */}
                        <div className="events-panel-section events-panel-half">
                            <div className="events-section-header">
                                <h2>
                                    Live Events
                                    {searchQuery && <span className="events-search-indicator">Searching...</span>}
                                </h2>
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
                        <div className="events-panel-section events-panel-half">
                            <div className="events-section-header">
                                <h2>
                                    Upcoming Events
                                    {searchQuery && <span className="events-search-indicator">Searching...</span>}
                                </h2>
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
                    </div>
                    
                    {/* Mini Schedule View - Column Navigation */}
                    <div className="events-panel-section events-mini-schedule">
                        <div className="events-section-header">
                            <h2>Schedule View</h2>
                            {scheduleColumns.length > 0 && (
                                <div className="mini-schedule-navigation">
                                    <button 
                                        onClick={goToPrevColumn} 
                                        disabled={currentColumnIndex === 0}
                                        className="mini-schedule-nav-btn"
                                    >
                                        ←
                                    </button>
                                    <span className="mini-schedule-column-name">
                                        {scheduleColumns[currentColumnIndex]?.name || 'Column'}
                                    </span>
                                    <button 
                                        onClick={goToNextColumn} 
                                        disabled={currentColumnIndex === scheduleColumns.length - 1}
                                        className="mini-schedule-nav-btn"
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="mini-schedule-container">
                            {scheduleColumns.length === 0 ? (
                                <p className="events-no-results">No schedule columns configured for this project</p>
                            ) : (
                                <div className="mini-schedule-column">
                                    {scheduleColumns[currentColumnIndex] && eventsByColumn[scheduleColumns[currentColumnIndex].id]?.length === 0 ? (
                                        <p className="events-no-results">No events in this column</p>
                                    ) : (
                                        scheduleColumns[currentColumnIndex] && eventsByColumn[scheduleColumns[currentColumnIndex].id]?.map(event => {
                                            const colors = getProcessPointColor(event.process_point)
                                            const isUnassigned = !event.assigned_personnel || event.assigned_personnel.length === 0
                                            return (
                                                <div 
                                                    key={event.id} 
                                                    className={`mini-schedule-event-card ${isUnassigned ? 'unassigned-event' : ''}`}
                                                    style={{
                                                        backgroundColor: colors.backgroundColor,
                                                        border: isUnassigned ? '3px solid #dc3545' : `2px solid ${colors.borderColor}`
                                                    }}
                                                    onClick={() => toggleEventExpansion('mini-schedule', event.id)}
                                                >
                                                    <div className="mini-schedule-event-header">
                                                        <h4>{event.name}</h4>
                                                        {event.quick_turn && <span className="quick-turn-dot"></span>}
                                                    </div>
                                                    <div className="mini-schedule-event-time">
                                                        {formatTimeTo12Hour(event.start_time)} - {formatTimeTo12Hour(event.end_time)}
                                                    </div>
                                                    <div className="mini-schedule-event-location">{event.location}</div>
                                                    {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                                                        <div className='mini-schedule-photographers'>
                                                            {event.assigned_personnel.map((person) => (
                                                                <span key={person.personnel_id} className='photographer-badge'>
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
                            )}
                        </div>
                    </div>
                    
                    {/* All Events */}
                    <div className="events-panel-section">
                        <div className="events-section-header">
                            <h2>
                                All Events in Project
                                {searchQuery && <span className="events-search-indicator">Searching...</span>}
                            </h2>
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
                                        <select
                                            value={eventForm.date}
                                            onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                                            required
                                        >
                                            <option value="">Select a date</option>
                                            {projectDates.map(date => (
                                                <option key={date} value={date}>
                                                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                                                        weekday: 'short', 
                                                        month: 'short', 
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </option>
                                            ))}
                                        </select>
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
                                    <label>Notes (comma-separated for checklist):</label>
                                    <textarea
                                        value={eventForm.notes}
                                        onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Details (raw text):</label>
                                    <textarea
                                        value={eventForm.details}
                                        onChange={(e) => setEventForm({...eventForm, details: e.target.value})}
                                        rows="4"
                                        placeholder="Additional event details..."
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Assign Photographers:</label>
                                    <div className="photographer-selection">
                                        {personnel
                                            .filter(person => 
                                                person.role === 'Photographer' || 
                                                person.role === 'Lead Photographer' || 
                                                person.role === 'Videographer'
                                            )
                                            .map(person => (
                                                <label key={person.id} className="photographer-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={eventForm.assigned_photographers.includes(person.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setEventForm({
                                                                    ...eventForm,
                                                                    assigned_photographers: [...eventForm.assigned_photographers, person.id]
                                                                })
                                                            } else {
                                                                setEventForm({
                                                                    ...eventForm,
                                                                    assigned_photographers: eventForm.assigned_photographers.filter(id => id !== person.id)
                                                                })
                                                            }
                                                        }}
                                                    />
                                                    <span className="photographer-name">
                                                        {person.name} 
                                                        <span className="photographer-role">({person.role})</span>
                                                    </span>
                                                </label>
                                            ))
                                        }
                                        {personnel.filter(person => 
                                            person.role === 'Photographer' || 
                                            person.role === 'Lead Photographer' || 
                                            person.role === 'Videographer'
                                        ).length === 0 && (
                                            <p className="no-photographers">No photographers available</p>
                                        )}
                                    </div>
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
                
                {/* Edit Event Modal */}
                {showEditEventModal && (
                    <div className="events-modal-overlay" onClick={() => setShowEditEventModal(false)}>
                        <div className="events-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="events-modal-header">
                                <h2>Edit Event</h2>
                                <button 
                                    className="events-close-btn"
                                    onClick={() => setShowEditEventModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                            
                            <form onSubmit={handleEditEvent} className="events-form">
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
                                        />
                                    </div>
                                    
                                    <div className="events-form-group">
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            value={eventForm.end_time}
                                            onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Location:</label>
                                    <input
                                        type="text"
                                        value={eventForm.location}
                                        onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Notes (comma-separated for checklist):</label>
                                    <textarea
                                        value={eventForm.notes}
                                        onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Details (raw text):</label>
                                    <textarea
                                        value={eventForm.details}
                                        onChange={(e) => setEventForm({...eventForm, details: e.target.value})}
                                        rows="4"
                                        placeholder="Additional event details..."
                                    />
                                </div>
                                
                                <div className="events-form-group">
                                    <label>Assign Photographers:</label>
                                    <div className="photographer-selection">
                                        {personnel
                                            .filter(person => 
                                                person.role === 'Photographer' || 
                                                person.role === 'Lead Photographer' || 
                                                person.role === 'Videographer'
                                            )
                                            .map(person => (
                                                <label key={person.id} className="photographer-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={eventForm.assigned_photographers.includes(person.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setEventForm({
                                                                    ...eventForm,
                                                                    assigned_photographers: [...eventForm.assigned_photographers, person.id]
                                                                })
                                                            } else {
                                                                setEventForm({
                                                                    ...eventForm,
                                                                    assigned_photographers: eventForm.assigned_photographers.filter(id => id !== person.id)
                                                                })
                                                            }
                                                        }}
                                                    />
                                                    <span className="photographer-name">
                                                        {person.name} 
                                                        <span className="photographer-role">({person.role})</span>
                                                    </span>
                                                </label>
                                            ))
                                        }
                                        {personnel.filter(person => 
                                            person.role === 'Photographer' || 
                                            person.role === 'Lead Photographer' || 
                                            person.role === 'Videographer'
                                        ).length === 0 && (
                                            <p className="no-photographers">No photographers available</p>
                                        )}
                                    </div>
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
                                
                                <div className="events-form-actions">
                                    <button type="button" onClick={() => setShowEditEventModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit">
                                        Update Event
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
                                
                                <div className="events-form-group">
                                    <label>Details:</label>
                                    <textarea
                                        value={shotRequestForm.details}
                                        onChange={(e) => setShotRequestForm({...shotRequestForm, details: e.target.value})}
                                        rows="3"
                                        placeholder="Add specific individual references, names, or detailed requirements..."
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