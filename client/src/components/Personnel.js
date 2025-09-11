import React, { useEffect, useMemo, useState } from 'react'
import { API_CONFIG } from '../utils/apiConfig'
import { Nav } from './Nav'
import { useAuth } from '../context/AuthContext'
import { formatDateForHeader } from '../utils/dateUtils'
import '../styles/personnel.css'

export const Personnel = () => {
  const { user, selectedOrganizationId, selectedProjectId, selectedDate, selectedCompanyId } = useAuth()

  const [personnel, setPersonnel] = useState([])
  const [projects, setProjects] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEventStatus, setSelectedEventStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
  // expanded state per personnel-panel
  const [expandedAllPersonnelIds, setExpandedAllPersonnelIds] = useState(new Set())
  const [expandedEventIds, setExpandedEventIds] = useState(new Set())
  const [expandedPersonIds, setExpandedPersonIds] = useState(new Set())
  const [expandedTeamMemberIds, setExpandedTeamMemberIds] = useState(new Set())
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedPersonnelForAssign, setSelectedPersonnelForAssign] = useState(null)
  const [modalSelectedDate, setModalSelectedDate] = useState('')
  const [eventAssignModalOpen, setEventAssignModalOpen] = useState(false)
  const [selectedEventForAssign, setSelectedEventForAssign] = useState(null)
  const [selectedPersonnelForEvent, setSelectedPersonnelForEvent] = useState([])

  const getRoleClass = (role) => {
    const r = (role || '').toLowerCase()
    if (r.includes('lead photographer')) return 'role-lead-photographer'
    if (r.includes('photographer')) return 'role-photographer'
    if (r.includes('editor')) return 'role-editor'
    if (r.includes('coordinator')) return 'role-coordinator'
    if (r.includes('admin')) return 'role-admin'
    if (r.includes('client')) return 'role-client'
    if (r.includes('videographer')) return 'role-videographer'
    return ''
  }

  // Fetch core data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        // Filter personnel by company - use selectedCompanyId for super admin, user.company_id for regular users
        let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
        if (user?.is_super_admin && selectedCompanyId) {
          personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
        } else if (user?.company_id) {
          personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
        }
        
        const [pplRes, projRes, evtRes] = await Promise.all([
          fetch(personnelUrl),
          fetch(`${API_CONFIG.baseUrl}/api/projects`),
          fetch(`${API_CONFIG.baseUrl}/api/events`),
        ])

        const ppl = pplRes.ok ? await pplRes.json() : []
        const projs = projRes.ok ? await projRes.json() : []
        const evts = evtRes.ok ? await evtRes.json() : []

        setPersonnel(Array.isArray(ppl) ? ppl : [])
        setProjects(Array.isArray(projs) ? projs : [])
        setEvents(Array.isArray(evts) ? evts : [])
      } catch (e) {
        console.error('Error fetching personnel page data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user?.is_super_admin, selectedCompanyId, user?.company_id])

  // Live tick to refresh event statuses
  useEffect(() => {
    const id = setInterval(() => setCurrentTimeTick(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  // Filter projects by organization (use global selection)
  const orgProjects = useMemo(() => {
    if (user?.access === 'Admin' && selectedOrganizationId) {
      return projects.filter(p => p.organization_id === parseInt(selectedOrganizationId))
    } else if (!user?.organization_id) {
      return projects
    } else {
      return projects.filter(p => p.organization_id === user.organization_id)
    }
  }, [projects, user?.organization_id, user?.access, selectedOrganizationId])

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === Number(selectedProjectId)) || null
  }, [projects, selectedProjectId])

  const projectEvents = useMemo(() => {
    if (!selectedProjectId) return events
    return events.filter(e => e.project_id === Number(selectedProjectId))
  }, [events, selectedProjectId])

  const projectTeam = useMemo(() => {
    if (!selectedProjectId) return []
    return personnel.filter(p => (p.project_ids || []).includes(Number(selectedProjectId)))
  }, [personnel, selectedProjectId])

  const eventsById = useMemo(() => {
    const map = new Map()
    for (const e of projectEvents) map.set(e.id, e)
    return map
  }, [projectEvents])

  // Get available dates from selected project's duration (start_date to end_date) - matching Nav component logic
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

  // Note: Date selection now handled globally via AuthContext

  // Event status helpers to match Settings page scheme
  const parseDateLocal = (dateStr) => {
    const [y, m, d] = (dateStr || '').split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const parseDateTimeLocal = (dateStr, timeStr) => {
    const [y, m, d] = (dateStr || '').split('-').map(Number)
    const [hh = 0, mm = 0, ss = 0] = (timeStr || '').split(':').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d, hh, mm, ss)
  }
  const formatDateMMDDYYYY = (dateStr) => {
    const d = parseDateLocal(dateStr)
    if (!d) return dateStr || ''
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${mm}-${dd}-${yyyy}`
  }
  const formatTime12Hour = (timeStr) => {
    if (!timeStr) return ''
    const [rawHour = '0', rawMin = '0'] = String(timeStr).split(':')
    let hour = Number(rawHour)
    const minute = Number(rawMin)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12
    if (hour === 0) hour = 12
    return `${hour}:${String(minute).padStart(2, '0')} ${ampm}`
  }
  const getEventStatus = (evt) => {
    void currentTimeTick
    if (!evt?.date || !evt?.start_time || !evt?.end_time) return 'scheduled'
    const now = new Date()
    const eventDate = parseDateLocal(evt.date)
    const startTime = parseDateTimeLocal(evt.date, evt.start_time)
    const endTime = parseDateTimeLocal(evt.date, evt.end_time)
    if (!eventDate || !startTime || !endTime) return 'scheduled'
    const isToday = now.toDateString() === eventDate.toDateString()
    if (!isToday) {
      if (now < startTime) return 'scheduled'
      if (now > endTime) return 'done'
    }
    const timeUntilStart = startTime - now
    const timeUntilEnd = endTime - now
    if (timeUntilStart > 0) {
      if (timeUntilStart <= 15 * 60 * 1000) return 'starting-soon'
      if (timeUntilStart <= 60 * 60 * 1000) return 'upcoming'
      return 'scheduled'
    } else if (timeUntilEnd > 0) {
      return 'ongoing'
    }
    return 'done'
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

  // Event -> num personnel assigned (within selected project)
  const eventAssignmentSummary = useMemo(() => {
    const counts = new Map()
    if (!selectedProjectId) return []
    for (const member of projectTeam) {
      for (const evtId of member.event_ids || []) {
        const evt = eventsById.get(evtId)
        if (!evt) continue // ignore events outside project
        counts.set(evtId, (counts.get(evtId) || 0) + 1)
      }
    }
    return projectEvents.map(evt => ({
      event: evt,
      personnelCount: counts.get(evt.id) || 0,
    })).sort((a, b) => a.event.date.localeCompare(b.event.date) || (a.event.start_time || '').localeCompare(b.event.start_time || ''))
  }, [projectTeam, projectEvents, eventsById, selectedProjectId])

  // Filtered events based on global selected date and status
  const filteredEventAssignmentSummary = useMemo(() => {
    let filtered = eventAssignmentSummary
    
    // Use global selectedDate for filtering
    if (selectedDate) {
      filtered = filtered.filter(({ event }) => event.date === selectedDate)
    }
    
    if (selectedEventStatus) {
      filtered = filtered.filter(({ event }) => {
        const eventStatus = getEventStatus(event)
        return eventStatus === selectedEventStatus
      })
    }
    
    return filtered
  }, [eventAssignmentSummary, selectedDate, selectedEventStatus])

  // Personnel -> num events assigned (within selected project and global date)
  const personnelAssignmentSummary = useMemo(() => {
    if (!selectedProjectId) return []
    
    // Get events for the selected date (or all events if no date selected)
    const relevantEvents = selectedDate 
      ? projectEvents.filter(event => event.date === selectedDate)
      : projectEvents
    
    const relevantEventIds = new Set(relevantEvents.map(event => event.id))
    
    return projectTeam.map(member => {
      // Count only events that are on the selected date
      const count = (member.event_ids || []).reduce((acc, evtId) => {
        return acc + (eventsById.has(evtId) && relevantEventIds.has(evtId) ? 1 : 0)
      }, 0)
      return { member, eventCount: count }
    })
    .filter(({ eventCount }) => selectedDate ? eventCount > 0 : true) // Only show personnel with assignments on selected date
    .sort((a, b) => b.eventCount - a.eventCount || a.member.name.localeCompare(b.member.name))
  }, [projectTeam, eventsById, selectedProjectId, projectEvents, selectedDate])

  // Filtered events for metrics (use global date when selected)
  const metricsEvents = useMemo(() => {
    if (selectedDate) {
      return projectEvents.filter(event => event.date === selectedDate)
    }
    return projectEvents
  }, [projectEvents, selectedDate])



  const toggleExpandedAllPersonnel = (id) => {
    setExpandedAllPersonnelIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleExpandedEvent = (eventId) => {
    setExpandedEventIds(prev => {
      const next = new Set(prev)
      next.has(eventId) ? next.delete(eventId) : next.add(eventId)
      return next
    })
  }

  const toggleExpandedPerson = (personId) => {
    setExpandedPersonIds(prev => {
      const next = new Set(prev)
      next.has(personId) ? next.delete(personId) : next.add(personId)
      return next
    })
  }

  const toggleExpandedTeamMember = (memberId) => {
    setExpandedTeamMemberIds(prev => {
      const next = new Set(prev)
      next.has(memberId) ? next.delete(memberId) : next.add(memberId)
      return next
    })
  }

  const handleAssignPersonnelToEvent = async (personnelId, eventIds) => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: eventIds })
      })

      if (response.ok) {
        // Refresh personnel data to get updated assignments
        let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
        if (user?.is_super_admin && selectedCompanyId) {
          personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
        } else if (user?.company_id) {
          personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
        }
        
        const pplRes = await fetch(personnelUrl)
        if (pplRes.ok) {
          const updatedPersonnel = await pplRes.json()
          setPersonnel(Array.isArray(updatedPersonnel) ? updatedPersonnel : [])
        }
      } else {
        console.error('Failed to assign personnel to event')
      }
    } catch (error) {
      console.error('Error assigning personnel:', error)
    }
  }

  // Event assignment handlers
  const openEventAssignModal = (event) => {
    setSelectedEventForAssign(event)
    // Pre-populate with currently assigned personnel
    const assigned = projectTeam.filter(m => (m.event_ids || []).includes(event.id))
    setSelectedPersonnelForEvent(assigned.map(m => m.id))
    setEventAssignModalOpen(true)
  }

  const closeEventAssignModal = () => {
    setEventAssignModalOpen(false)
    setSelectedEventForAssign(null)
    setSelectedPersonnelForEvent([])
  }

  const handleEventAssignment = async () => {
    if (!selectedEventForAssign) return

    try {
      // Get all personnel IDs to assign to this event
      const personnelIds = selectedPersonnelForEvent

      // Update each personnel's event assignments
      for (const personnelId of personnelIds) {
        const personnel = projectTeam.find(p => p.id === personnelId)
        if (!personnel) continue

        // Get current event IDs for this personnel
        const currentEventIds = personnel.event_ids || []
        
        // Add this event if not already assigned
        if (!currentEventIds.includes(selectedEventForAssign.id)) {
          const updatedEventIds = [...currentEventIds, selectedEventForAssign.id]
          
          const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_ids: updatedEventIds })
          })

          if (!response.ok) {
            console.error(`Failed to assign personnel ${personnelId} to event`)
          }
        }
      }

      // Remove personnel who are no longer selected
      const personnelToRemove = projectTeam
        .filter(p => (p.event_ids || []).includes(selectedEventForAssign.id))
        .filter(p => !selectedPersonnelForEvent.includes(p.id))

      for (const personnel of personnelToRemove) {
        const currentEventIds = personnel.event_ids || []
        const updatedEventIds = currentEventIds.filter(id => id !== selectedEventForAssign.id)
        
        const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_ids: updatedEventIds })
        })

        if (!response.ok) {
          console.error(`Failed to remove personnel ${personnel.id} from event`)
        }
      }

      // Refresh personnel data to get updated assignments
      let personnelUrl = `${API_CONFIG.baseUrl}/api/personnel`
      if (user?.is_super_admin && selectedCompanyId) {
        personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
      } else if (user?.company_id) {
        personnelUrl = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
      }
      
      const pplRes = await fetch(personnelUrl)
      if (pplRes.ok) {
        const updatedPersonnel = await pplRes.json()
        setPersonnel(Array.isArray(updatedPersonnel) ? updatedPersonnel : [])
      }
      
      closeEventAssignModal()
    } catch (error) {
      console.error('Error assigning personnel to event:', error)
      alert('Failed to assign personnel to event. Please try again.')
    }
  }

  return (
    <div className='view-container'>
      <Nav />
      <div className='page-container'>
        <div className='personnel-container'>
          <div className='personnel-header'>
            <h1>Personnel</h1>
          </div>

          {loading ? (
            <div className='personnel-loading'>Loading...</div>
          ) : (
            <div className='personnel-panels-grid'>
              {/* TOP LEFT: Panel: Team Metrics */}
              <div className='personnel-panel metrics-personnel-panel'>
                <div className='personnel-panel-header'>
                  <h2>Team Metrics</h2>
                </div>
                <div className='personnel-panel-body metrics'>
                  {/* Key Metrics */}
                  <div className='personnel-metrics-grid'>
                    <div className='personnel-metric-card'>
                      <div className='metric-number'>{personnel.length}</div>
                      <div className='metric-label'>Total Crew</div>
                    </div>
                    <div className='personnel-metric-card'>
                      <div className='metric-number'>{metricsEvents.filter(e => {
                        const assigned = projectTeam.filter(m => (m.event_ids || []).includes(e.id))
                        return assigned.length === 0
                      }).length}</div>
                      <div className='metric-label'>{selectedDate ? `Unassigned Events (${formatDateForHeader(selectedDate)})` : 'Unassigned Events'}</div>
                    </div>
                    <div className='personnel-metric-card'>
                      <div className='metric-number'>{projectTeam.length}</div>
                      <div className='metric-label'>Active on Project</div>
                    </div>
                    <div className='personnel-metric-card'>
                      <div className='metric-number'>{metricsEvents.length}</div>
                      <div className='metric-label'>{selectedDate ? `Events (${formatDateForHeader(selectedDate)})` : 'Total Events'}</div>
                    </div>
                  </div>

                  {/* Crew Utilization Chart */}
                  <div className='chart-section'>
                    <h4>Crew Utilization</h4>
                    <div className='utilization-chart'>
                      {personnelAssignmentSummary.map(({ member, eventCount }) => {
                        const maxEvents = Math.max(...personnelAssignmentSummary.map(({ eventCount }) => eventCount), 1)
                        const utilization = (eventCount / maxEvents) * 100
                        return (
                          <div key={member.id} className='utilization-bar'>
                            <div className='member-name'>{member.name}</div>
                            <div className='bar-container'>
                              <div 
                                className={`bar ${getRoleClass(member.role)}`}
                                style={{ width: `${utilization}%` }}
                              ></div>
                            </div>
                            <span className='utilization-percentage'>{eventCount} events</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Role Distribution */}
                  <div className='chart-section'>
                    <h4>Team Composition</h4>
                    <div className='role-distribution'>
                      {(() => {
                        const roleCounts = {}
                        projectTeam.forEach(member => {
                          const role = member.role || 'Unassigned'
                          roleCounts[role] = (roleCounts[role] || 0) + 1
                        })
                        return Object.entries(roleCounts).map(([role, count]) => (
                          <div key={role} className='role-stat'>
                            <span className={`role-dot ${getRoleClass(role)}`}></span>
                            <span className='role-name'>{role}</span>
                            <span className='role-count'>{count}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* TOP RIGHT: Panel: Assignments (by Person) */}
              <div className='personnel-panel'>
                <div className='personnel-panel-header'>
                  <h2>Assignments (by Person)</h2>
                  <span className='count-badge'>{personnelAssignmentSummary.length}</span>
                </div>
                <div className='personnel-panel-body list'>
                  {personnelAssignmentSummary.length === 0 ? (
                    <div className='personnel-empty'>No assignments</div>
                  ) : (
                    personnelAssignmentSummary.map(({ member, eventCount }) => {
                      const evts = (member.event_ids || []).map(id => eventsById.get(id)).filter(Boolean)
                      const isOpen = expandedPersonIds.has(member.id)
                      return (
                        <div key={member.id} className={`personnel-list-row clickable ${getRoleClass(member.role)} ${isOpen ? 'expanded' : ''}`} onClick={() => toggleExpandedPerson(member.id)}>
                          <div className='personnel-list-main'>
                            <div className='name'>{member.name}</div>
                            <div className='meta'>{member.role || '—'}</div>
                          </div>
                          <div className='personnel-list-meta'>
                            <span title='Events in project'>{eventCount}</span>
                            <span className='personnel-chevron'>{isOpen ? '▼' : '▶'}</span>
                          </div>
                          {isOpen && (
                            <div className='personnel-list-details'>
                              {evts.length === 0 ? (
                                <div className='personnel-empty'>No events assigned</div>
                              ) : (
                                <ul className='event-list'>
                                  {evts.map(e => {
                                    const status = getEventStatus(e)
                                    const color = getStatusColor(status)
                                    const label = (status || '').replace('-', ' ')
                                    return (
                                      <li key={e.id} className={`personnel-event-card status-${status}`}>
                                        <div className='event-card-header'>
                                          <div className='event-name'>{e.name}</div>
                                          <span className='event-status-badge' style={{ color, borderColor: color }}>
                                            <span className='event-status-dot' style={{ backgroundColor: color }}></span>
                                            {label.charAt(0).toUpperCase() + label.slice(1)}
                                          </span>
                                        </div>
                                        <div className='event-meta'>
                                          {formatDateMMDDYYYY(e.date)}
                                          {e.start_time ? ` • ${formatTime12Hour(e.start_time)}-${formatTime12Hour(e.end_time)}` : ''}
                                          {e.location ? ` • ${e.location}` : ''}
                                        </div>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* BOTTOM LEFT: Panel: Project Team Members */}
              <div className='personnel-panel'>
                <div className='personnel-panel-header'>
                  <h2>Project Team Members</h2>
                  <span className='count-badge'>{projectTeam.length}</span>
                </div>
                <div className='personnel-panel-body list'>
                  {projectTeam.length === 0 ? (
                    <div className='personnel-empty'>No team members assigned</div>
                  ) : (
                    projectTeam.map(m => (
                      <div key={m.id} className={`personnel-list-row ${getRoleClass(m.role)}`}>
                        <div className='personnel-list-main'>
                          <div className='name-role-line'>
                            <span className='name'>{m.name}</span>
                            <span className='meta'>{m.role || '—'}</span>
                          </div>
                        </div>
                        <div className='personnel-list-meta'>
                          <button 
                            className='personnel-assign-inline-btn'
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPersonnelForAssign(m)
                              setModalSelectedDate('') // Reset modal date
                              setAssignModalOpen(true)
                            }}
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* BOTTOM RIGHT: Panel: Assignments by Event */}
              <div className='personnel-panel assignments-by-event-panel'>
                <div className='personnel-panel-header'>
                  <h2>Assignments by Event</h2>
                  <div className='personnel-panel-controls'>
                    <select
                      value={selectedEventStatus}
                      onChange={(e) => setSelectedEventStatus(e.target.value)}
                      className='project-input status-filter'
                    >
                      <option value="">All Status</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="starting-soon">Starting Soon</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="done">Done</option>
                    </select>
                    <span className='count-badge'>{filteredEventAssignmentSummary.length}</span>
                  </div>
                </div>
                <div className='personnel-panel-body list'>
                  {filteredEventAssignmentSummary.length === 0 ? (
                    <div className='personnel-empty'>
                      {selectedDate && selectedEventStatus ? 'No events match selected filters' : 
                       selectedDate ? 'No events on selected date' : 
                       selectedEventStatus ? 'No events with selected status' : 
                       'No events in project'}
                    </div>
                  ) : (
                    filteredEventAssignmentSummary.map(({ event, personnelCount }) => {
                      const assigned = projectTeam.filter(m => (m.event_ids || []).includes(event.id))
                      const isOpen = expandedEventIds.has(event.id)
                      const status = getEventStatus(event)
                      const color = getStatusColor(status)
                      const label = (status || '').replace('-', ' ')
                      return (
                        <div key={event.id} className={`personnel-list-row clickable ${isOpen ? 'expanded' : ''}`} onClick={() => toggleExpandedEvent(event.id)}>
                          <div className='personnel-list-main'>
                            <div className='name'>{event.name}</div>
                            <div className='meta'>
                              {event.start_time ? `${formatTime12Hour(event.start_time)}-${formatTime12Hour(event.end_time)}` : 'No time specified'}
                            </div>
                          </div>
                          <div className='personnel-list-meta'>
                            <span className='event-status-badge' style={{ color, borderColor: color }}>
                              <span className='event-status-dot' style={{ backgroundColor: color }}></span>
                              {label.charAt(0).toUpperCase() + label.slice(1)}
                            </span>
                            <span title='Assigned personnel'>{personnelCount}</span>
                            <span className='personnel-chevron'>{isOpen ? '▼' : '▶'}</span>
                          </div>
                          {isOpen && (
                            <div className='personnel-list-details'>
                              <div className='event-assignment-section'>
                                <div className='event-assignment-header'>
                                  <h4>Assigned Personnel</h4>
                                  <button 
                                    className='assign-personnel-btn'
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEventAssignModal(event)
                                    }}
                                  >
                                    {assigned.length === 0 ? 'Assign Personnel' : 'Edit Assignments'}
                                  </button>
                                </div>
                                
                                {assigned.length === 0 ? (
                                  <div className='personnel-empty'>No personnel assigned</div>
                                ) : (
                                  <ul className='personnel-inline-list'>
                                    {assigned.map(m => (
                                      <li key={m.id} className={`personnel-assigned-item ${getRoleClass(m.role)}`}>
                                        <span className='personnel-name'>{m.name}</span>
                                        <span className='personnel-role'>{m.role || 'No role'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>



            </div>
          )}

          {/* Assignment Modal */}
          {assignModalOpen && selectedPersonnelForAssign && (
            <div className='personnel-assign-modal-overlay' onClick={() => {
              setAssignModalOpen(false)
              setModalSelectedDate('')
            }}>
              <div className='personnel-assign-modal' onClick={(e) => e.stopPropagation()}>
                <div className='personnel-assign-modal-header'>
                  <h3>Assign {selectedPersonnelForAssign.name} to Events</h3>
                  <button 
                    className='personnel-assign-modal-close'
                    onClick={() => {
                      setAssignModalOpen(false)
                      setModalSelectedDate('')
                    }}
                                      >
                      ✕
                    </button>
                </div>
                
                <div className='personnel-assign-modal-body'>
                  <div className='personnel-assign-date-selector'>
                    <label>Select Date:</label>
                    <select
                      value={modalSelectedDate}
                      onChange={(e) => setModalSelectedDate(e.target.value)}
                      className='personnel-modal-date-input'
                    >
                      <option value="">All Dates</option>
                      {availableDates.map(date => (
                        <option key={date} value={date}>
                          {formatDateMMDDYYYY(date)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className='personnel-assign-events-grid'>
                    {(() => {
                      // Filter events by modal selected date if one is chosen
                      let eventsToShow = modalSelectedDate 
                        ? projectEvents.filter(event => event.date === modalSelectedDate)
                        : projectEvents
                      
                      // Sort events by time in ascending order (earliest first)
                      eventsToShow = eventsToShow.sort((a, b) => {
                        // If no start time, put them at the end
                        if (!a.start_time && !b.start_time) return 0
                        if (!a.start_time) return 1
                        if (!b.start_time) return -1
                        
                        // Compare times (ascending order - earliest first)
                        return a.start_time.localeCompare(b.start_time)
                      })
                      
                      if (eventsToShow.length === 0) {
                        return <div className='personnel-empty'>No events available for this date</div>
                      }
                      
                      return eventsToShow.map(event => {
                        const isAssigned = (selectedPersonnelForAssign.event_ids || []).includes(event.id)
                        const status = getEventStatus(event)
                        const color = getStatusColor(status)
                        const label = (status || '').replace('-', ' ')
                        
                        return (
                          <label key={event.id} className='personnel-assign-event-card'>
                            <div className='event-card-header'>
                              <input
                                type='checkbox'
                                checked={isAssigned}
                                onChange={(e) => {
                                  const currentEventIds = selectedPersonnelForAssign.event_ids || []
                                  const newEventIds = e.target.checked
                                    ? [...currentEventIds, event.id]
                                    : currentEventIds.filter(id => id !== event.id)
                                  
                                  handleAssignPersonnelToEvent(selectedPersonnelForAssign.id, newEventIds)
                                  
                                  // Update the selected personnel state to reflect changes immediately
                                  setSelectedPersonnelForAssign(prev => ({
                                    ...prev,
                                    event_ids: newEventIds
                                  }))
                                }}
                              />
                              <span className='event-card-status' style={{ color, borderColor: color }}>
                                <span className='event-status-dot' style={{ backgroundColor: color }}></span>
                                {label.charAt(0).toUpperCase() + label.slice(1)}
                              </span>
                            </div>
                            <div className='event-card-content'>
                              <div className='event-card-name'>{event.name}</div>
                              <div className='event-card-time'>
                                {event.start_time ? `${formatTime12Hour(event.start_time)} - ${formatTime12Hour(event.end_time)}` : 'No time specified'}
                              </div>

                            </div>
                          </label>
                        )
                      })
                    })()}
                  </div>
                </div>
                
                <div className='personnel-assign-modal-footer'>
                  <button 
                    className='personnel-assign-modal-done'
                    onClick={() => {
                      setAssignModalOpen(false)
                      setModalSelectedDate('')
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Event Assignment Modal */}
          {eventAssignModalOpen && selectedEventForAssign && (
            <div className='personnel-assign-modal-overlay' onClick={closeEventAssignModal}>
              <div className='personnel-assign-modal' onClick={(e) => e.stopPropagation()}>
                <div className='personnel-assign-modal-header'>
                  <h3>Assign Personnel to {selectedEventForAssign.name}</h3>
                  <button 
                    className='personnel-assign-modal-close'
                    onClick={closeEventAssignModal}
                  >
                    ✕
                  </button>
                </div>
                
                <div className='personnel-assign-modal-body'>
                  <div className='event-assign-info'>
                    <p><strong>Event:</strong> {selectedEventForAssign.name}</p>
                    <p><strong>Date:</strong> {formatDateMMDDYYYY(selectedEventForAssign.date)}</p>
                    <p><strong>Time:</strong> {selectedEventForAssign.start_time ? `${formatTime12Hour(selectedEventForAssign.start_time)}-${formatTime12Hour(selectedEventForAssign.end_time)}` : 'No time specified'}</p>
                    <p><strong>Location:</strong> {selectedEventForAssign.location || 'No location specified'}</p>
                  </div>
                  
                  <div className='personnel-assign-personnel-grid'>
                    <h4>Select Personnel to Assign:</h4>
                    {projectTeam.length === 0 ? (
                      <div className='personnel-empty'>No personnel available</div>
                    ) : (
                      <div className='personnel-checkbox-list'>
                        {projectTeam.map(personnel => (
                          <label key={personnel.id} className='personnel-assign-personnel-card'>
                            <div className='personnel-card-header'>
                              <input
                                type='checkbox'
                                checked={selectedPersonnelForEvent.includes(personnel.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPersonnelForEvent(prev => [...prev, personnel.id])
                                  } else {
                                    setSelectedPersonnelForEvent(prev => prev.filter(id => id !== personnel.id))
                                  }
                                }}
                              />
                              <div className='personnel-info'>
                                <span className={`personnel-name ${getRoleClass(personnel.role)}`}>
                                  {personnel.name}
                                </span>
                                <span className='personnel-role'>{personnel.role || 'No role'}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className='personnel-assign-modal-footer'>
                  <button 
                    className='personnel-assign-modal-cancel'
                    onClick={closeEventAssignModal}
                  >
                    Cancel
                  </button>
                  <button 
                    className='personnel-assign-modal-save'
                    onClick={handleEventAssignment}
                  >
                    Save Assignments
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
