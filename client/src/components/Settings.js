import '../styles/settings.css'
import { useState, useEffect } from 'react'
import { Nav } from './Nav'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const Settings = () => {
    const { user, selectedCompanyId, setSelectedCompanyId, setGlobalCompany } = useAuth()
    const { userId } = useParams()
    const navigate = useNavigate()
    


    // Available avatars list 
    const availableAvatars = [
        'avatar1.png', 'avatar2.png', 'avatar3.png', 'avatar4.png', 'avatar5.png',
        'avatar6.png', 'avatar7.png', 'avatar8.png', 'avatar9.png', 'avatar10.png',
        'avatar11.png', 'avatar12.png', 'avatar13.png', 'avatar14.png', 'avatar15.png'
    ]

    // State for managing data
    const [events, setEvents] = useState([])
    const [projects, setProjects] = useState([])
    const [organizations, setOrganizations] = useState([])
    const [personnel, setPersonnel] = useState([])
    const [accessRequests, setAccessRequests] = useState([])
    const [users, setUsers] = useState([])
    const [companies, setCompanies] = useState([])
    
    // Fetch companies (for Super Admin)
    const fetchCompanies = async () => {
        if (user?.is_super_admin) {
            try {
                const response = await fetch('http://localhost:5001/api/companies')
                if (response.ok) {
                    const data = await response.json()
                    setCompanies(data)
                }
            } catch (error) {
                console.error('Error fetching companies:', error)
            }
        }
    }

    // Fetch user's company details (for regular admins)
    const fetchUserCompany = async () => {
        if (!user?.company_id) return
        
        try {
            const response = await fetch(`http://localhost:5001/api/companies/${user.company_id}`)
            if (response.ok) {
                const companyData = await response.json()
                setUserCompany(companyData)
            }
        } catch (error) {
            console.error('Error fetching user company:', error)
        }
    }

    // Fetch data based on selected company
    const fetchCompanyData = async (companyId) => {
        if (!companyId) return
        
        try {
            const isRelay = companies.find(c => c.id === parseInt(companyId))?.is_super_admin
            
            // Fetch users for the selected company using backend filtering
            const usersResponse = await fetch(`http://localhost:5001/api/users?company_id=${companyId}`)
            if (usersResponse.ok) {
                const companyUsers = await usersResponse.json()
                setUsers(companyUsers)
            }
            
            if (isRelay) {
                // For Relay: only show Relay users, no orgs/projects unless Relay-specific
                setOrganizations([])
                setProjects([])
                setPersonnel([])
                setEvents([])
            } else {
                // For other companies: fetch their data using backend filtering
                const [orgsResponse, personnelResponse] = await Promise.all([
                    fetch(`http://localhost:5001/api/organizations?company_id=${companyId}`),
                    fetch(`http://localhost:5001/api/personnel?company_id=${companyId}`)
                ])
                
                let companyOrgs = []
                if (orgsResponse.ok) {
                    companyOrgs = await orgsResponse.json()
                    setOrganizations(companyOrgs)
                }
                
                if (personnelResponse.ok) {
                    const companyPersonnel = await personnelResponse.json()
                    setPersonnel(companyPersonnel)
                }
                
                // Fetch projects and events (these are linked through organizations)
                if (companyOrgs.length > 0) {
                    const orgIds = companyOrgs.map(org => org.id).join(',')
                    const [projectsResponse, eventsResponse] = await Promise.all([
                        fetch(`http://localhost:5001/api/projects?organization_ids=${orgIds}`),
                        fetch(`http://localhost:5001/api/events`)
                    ])
                    
                    let companyProjects = []
                    if (projectsResponse.ok) {
                        companyProjects = await projectsResponse.json()
                        setProjects(companyProjects)
                    }
                    
                    if (eventsResponse.ok && companyProjects.length > 0) {
                        const allEvents = await eventsResponse.json()
                        const projectIds = companyProjects.map(p => p.id)
                        const companyEvents = allEvents.filter(e => projectIds.includes(e.project_id))
                        setEvents(companyEvents)
                    } else {
                        setEvents([])
                    }
                } else {
                    setProjects([])
                    setEvents([])
                }
            }
            
        } catch (error) {
            console.error('Error fetching company data:', error)
        }
    }

    // Load companies on mount for Super Admin and set default to Relay
    useEffect(() => {
        if (user?.is_super_admin) {
            fetchCompanies()
        }
    }, [user?.is_super_admin])
    
    // Auto-select Relay company for Super Admin if no company is selected
    useEffect(() => {
        if (user?.is_super_admin && !selectedCompanyId && companies.length > 0) {
            const relayCompany = companies.find(c => c.is_super_admin)
            if (relayCompany) {
                setGlobalCompany(relayCompany.id.toString())
            }
        }
    }, [user?.is_super_admin, selectedCompanyId, companies.length, setGlobalCompany])


    
    // Fetch company-specific data when company selection changes
    useEffect(() => {
        if (user?.is_super_admin && selectedCompanyId && companies.length > 0) {
            fetchCompanyData(selectedCompanyId)
        } else if (user?.is_company_admin && user?.company_id) {
            // For Company Admins, load their own company's data only
            fetchCompanyData(user.company_id.toString())
        }
    }, [selectedCompanyId, companies, user])
    
    // Get current company info for conditional rendering
    const currentCompanyId = user?.is_super_admin ? selectedCompanyId : user?.company_id?.toString()
    const currentCompany = companies.find(c => c.id === parseInt(currentCompanyId || '0'))
    const isViewingRelay = currentCompany?.is_super_admin
    
    // State for forms
    const [showEventForm, setShowEventForm] = useState(false)
    const [showProjectForm, setShowProjectForm] = useState(false)
    const [showOrgForm, setShowOrgForm] = useState(false)
    const [showPersonnelForm, setShowPersonnelForm] = useState(false)
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [showAvatarModal, setShowAvatarModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [selectedRequest, setSelectedRequest] = useState(null)
    const [selectedPersonnel, setSelectedPersonnel] = useState(null)
    const [editingUser, setEditingUser] = useState(null)
    const [userEditForm, setUserEditForm] = useState({ access: '', organization_id: null })
    
    // State for expanded cards
    const [expandedEventCards, setExpandedEventCards] = useState(new Set())
    const [expandedProjectCards, setExpandedProjectCards] = useState(new Set())
    const [expandedOrgCards, setExpandedOrgCards] = useState(new Set())
    const [expandedPersonnelCards, setExpandedPersonnelCards] = useState(new Set())
    const [expandedUserCards, setExpandedUserCards] = useState(new Set())
    
    // Company info for regular admins
    const [userCompany, setUserCompany] = useState(null)
    
    // Filter states
    const [eventDateFilter, setEventDateFilter] = useState('')
    const [eventProjectFilter, setEventProjectFilter] = useState('')
    const [personnelRoleFilter, setPersonnelRoleFilter] = useState('')

    // Filtered data
    const filteredEvents = events.filter(event => {
        if (eventDateFilter && event.date !== eventDateFilter) return false
        if (eventProjectFilter && event.project_id !== parseInt(eventProjectFilter)) return false
        return true
    })

    const filteredPersonnel = personnel.filter(person => {
        if (!personnelRoleFilter) return true
        return person.role?.toLowerCase() === personnelRoleFilter.toLowerCase()
    })

    // Get unique roles from personnel for filter dropdown
    const availableRoles = [...new Set(personnel.map(p => p.role).filter(Boolean))]
    
    // Form data
    const [eventForm, setEventForm] = useState({ name: '', date: '', start_time: '', end_time: '', location: '', notes: '', quick_turn: false, deadline: '', project_id: null })
    const [projectForm, setProjectForm] = useState({ name: '', location: '', start_date: '', end_date: '', deliver_date: '', organization_id: null })
    const [orgForm, setOrgForm] = useState({ name: '', details: '' })
    const [personnelForm, setPersonnelForm] = useState({ name: '', role: '', email: '', phone: '', availability: '', organization_id: null, project_id: null })
    const [approvalForm, setApprovalForm] = useState({ role: 'Client', company_id: '', organization_id: null, create_personnel: false, temporary_password: 'temp123', phone: '', avatar: 'avatar1.png' })
    const [assignForm, setAssignForm] = useState({ selectedProjectIds: [] })
    
    // Company creation and management
    const [showCompanyForm, setShowCompanyForm] = useState(false)
    const [companyForm, setCompanyForm] = useState({ name: '' })
    const [expandedCompanyCards, setExpandedCompanyCards] = useState(new Set())
    const [editingCompany, setEditingCompany] = useState(null)
    const [editCompanyForm, setEditCompanyForm] = useState({ name: '' })

    // Minimal live-tick to refresh time-based statuses
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTimeTick(Date.now()), 30000)
        return () => clearInterval(intervalId)
    }, [])

    // Fetch data on component mount
    useEffect(() => {
        fetchEvents()
        fetchProjects()
        fetchOrganizations()
        fetchPersonnel()
        fetchAccessRequests()
        // fetchUsers() is handled by fetchCompanyData for Super Admin
        if (!user?.is_super_admin) {
            fetchUsers()
            // Fetch company details for regular admins
            if (user?.company_id) {
                fetchUserCompany()
            }
        }
    }, [user?.is_super_admin, user?.company_id])

    const fetchEvents = async () => {
        try {
            let url = 'http://localhost:5001/api/events'
            
            // For company admins, we need to get their projects first, then filter events
            if (user?.is_company_admin && user?.company_id) {
                // First get organizations for this company
                const orgResponse = await fetch(`http://localhost:5001/api/organizations?company_id=${user.company_id}`)
                if (orgResponse.ok) {
                    const companyOrgs = await orgResponse.json()
                    if (companyOrgs.length > 0) {
                        const orgIds = companyOrgs.map(org => org.id).join(',')
                        // Then get projects for these organizations
                        const projectsResponse = await fetch(`http://localhost:5001/api/projects?organization_ids=${orgIds}`)
                        if (projectsResponse.ok) {
                            const companyProjects = await projectsResponse.json()
                            if (companyProjects.length > 0) {
                                // For now, we'll fetch all events and filter client-side since events API doesn't support project filtering yet
                                // TODO: Add project_ids parameter to events API
                                url = 'http://localhost:5001/api/events'
                            }
                        }
                    }
                }
            }
            
            const response = await fetch(url)
            if (response.ok) {
                const data = await response.json()
                // For non-super admins, filter events by their projects
                if (!user?.is_super_admin && user?.company_id) {
                    // Get the projects for this company to filter events
                    const orgResponse = await fetch(`http://localhost:5001/api/organizations?company_id=${user.company_id}`)
                    if (orgResponse.ok) {
                        const companyOrgs = await orgResponse.json()
                        if (companyOrgs.length > 0) {
                            const orgIds = companyOrgs.map(org => org.id).join(',')
                            const projectsResponse = await fetch(`http://localhost:5001/api/projects?organization_ids=${orgIds}`)
                            if (projectsResponse.ok) {
                                const companyProjects = await projectsResponse.json()
                                const projectIds = companyProjects.map(p => p.id)
                                const filteredEvents = data.filter(event => projectIds.includes(event.project_id))
                                setEvents(Array.isArray(filteredEvents) ? filteredEvents : [])
                                return
                            }
                        }
                    }
                }
                setEvents(Array.isArray(data) ? data : [])
            } else {
                setEvents([])
            }
        } catch (error) {
            console.error('Error fetching events:', error)
            setEvents([])
        }
    }

    const fetchProjects = async () => {
        try {
            let url = 'http://localhost:5001/api/projects'
            
            // For non-super admins, we need to get their organizations first, then filter projects
            if (!user?.is_super_admin && user?.company_id) {
                // First get organizations for this company
                const orgResponse = await fetch(`http://localhost:5001/api/organizations?company_id=${user.company_id}`)
                if (orgResponse.ok) {
                    const companyOrgs = await orgResponse.json()
                    if (companyOrgs.length > 0) {
                        const orgIds = companyOrgs.map(org => org.id).join(',')
                        url = `http://localhost:5001/api/projects?organization_ids=${orgIds}`
                    }
                }
            }
            
            const response = await fetch(url)
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

    const fetchOrganizations = async () => {
        try {
            // For non-super admins, filter by their company. For super admin, get all organizations.
            const url = !user?.is_super_admin && user?.company_id 
                ? `http://localhost:5001/api/organizations?company_id=${user.company_id}`
                : 'http://localhost:5001/api/organizations'
            
            const response = await fetch(url)
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

    const fetchPersonnel = async () => {
        try {
            // For non-super admins, filter by their company. For super admin, get all personnel.
            const url = !user?.is_super_admin && user?.company_id 
                ? `http://localhost:5001/api/personnel?company_id=${user.company_id}`
                : 'http://localhost:5001/api/personnel'
            
            const response = await fetch(url)
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

    const fetchAccessRequests = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/access-requests')
            if (response.ok) {
                const data = await response.json()
                setAccessRequests(Array.isArray(data) ? data : [])
            } else {
                setAccessRequests([])
            }
        } catch (error) {
            console.error('Error fetching access requests:', error)
            setAccessRequests([])
        }
    }

    const fetchUsers = async () => {
        try {
            // For non-super admins, filter by their company. For super admin, get all users.
            const url = !user?.is_super_admin && user?.company_id 
                ? `http://localhost:5001/api/users?company_id=${user.company_id}`
                : 'http://localhost:5001/api/users'
            
            console.log('Full user object:', user)
            console.log('User access:', user?.access)
            console.log('User is super admin:', user?.is_super_admin)
            console.log('User company ID:', user?.company_id)
            console.log('Fetching users from:', url)
            const response = await fetch(url)
            console.log('Users response status:', response.status)
            if (response.ok) {
                const data = await response.json()
                console.log('Users data received:', data)
                setUsers(Array.isArray(data) ? data : [])
            } else {
                console.error('Users fetch failed with status:', response.status)
                setUsers([])
            }
        } catch (error) {
            console.error('Error fetching users:', error)
            setUsers([])
        }
    }

    // Event handlers
    const handleEventSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `http://localhost:5001/api/events/${editingItem.id}` : 'http://localhost:5001/api/events'
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventForm)
            })
            
            if (response.ok) {
                fetchEvents()
                resetEventForm()
            }
        } catch (error) {
            console.error('Error saving event:', error)
        }
    }

    const handleProjectSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `http://localhost:5001/api/projects/${editingItem.id}` : 'http://localhost:5001/api/projects'
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectForm)
            })
            
            if (response.ok) {
                fetchProjects()
                resetProjectForm()
            }
        } catch (error) {
            console.error('Error saving project:', error)
        }
    }

    const handleOrgSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `http://localhost:5001/api/organizations/${editingItem.id}` : 'http://localhost:5001/api/organizations'
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orgForm)
            })
            
            if (response.ok) {
                fetchOrganizations()
                resetOrgForm()
            }
        } catch (error) {
            console.error('Error saving organization:', error)
        }
    }

    const handlePersonnelSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `http://localhost:5001/api/personnel/${editingItem.id}` : 'http://localhost:5001/api/personnel'
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(personnelForm)
            })
            
            if (response.ok) {
                await fetchPersonnel() // Make sure fetch completes
                resetPersonnelForm()
                
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to create personnel')
            }
        } catch (error) {
            console.error('Error saving personnel:', error)
        }
    }

        const deleteItem = async (type, id) => {
        
        
        try {
            // Fix personnel endpoint - it's singular 'personnel' not 'personnels'
            let endpoint = `http://localhost:5001/api/${type}s/${id}`
            if (type === 'personnel') {
                endpoint = `http://localhost:5001/api/personnel/${id}`
            }
            
            const response = await fetch(endpoint, {
                method: 'DELETE'
            })
            
            if (response.ok) {
                if (type === 'event') fetchEvents()
                else if (type === 'project') fetchProjects()
                else if (type === 'organization') fetchOrganizations()
                else if (type === 'personnel') fetchPersonnel()
                else if (type === 'user') {
                    fetchUsers()
                    fetchPersonnel() // Refresh personnel since user deletion may delete personnel
                }
                
            } else {
                const data = await response.json()
                alert(data.error || `Failed to delete ${type}`)
            }
        } catch (error) {
            console.error(`Error deleting ${type}:`, error)
            alert(`Failed to delete ${type}`)
        }
    }

    const editItem = (type, item) => {
        setEditingItem(item)
        if (type === 'event') {
            setEventForm({ 
                name: item.name, 
                date: item.date || '', 
                start_time: item.start_time || '',
                end_time: item.end_time || '',
                location: item.location || '', 
                notes: item.notes || '',
                quick_turn: item.quick_turn || false,
                deadline: item.deadline || '',
                project_id: item.project_id || null 
            })
            setShowEventForm(true)
        } else if (type === 'project') {
            setProjectForm({ 
                name: item.name, 
                location: item.location || '', 
                start_date: item.start_date || '',
                end_date: item.end_date || '',
                deliver_date: item.deliver_date || '',
                organization_id: item.organization_id || null 
            })
            setShowProjectForm(true)
        } else if (type === 'organization') {
            setOrgForm({ 
                name: item.name, 
                details: item.details || '' 
            })
            setShowOrgForm(true)
        } else if (type === 'personnel') {
            setPersonnelForm({
                name: item.name,
                role: item.role || '',
                email: item.email || '',
                phone: item.phone || '',
                availability: item.availability || '',
                event_ids: item.event_ids || []
            })
            setShowPersonnelForm(true)
        }
    }

    const openAssignModal = (person) => {
        setSelectedPersonnel(person)
        // Pre-populate with current project assignments if any
        setAssignForm({ selectedProjectIds: person.project_ids || [] })
        setShowAssignModal(true)
    }
    
    // Company creation
    const handleCompanySubmit = async (e) => {
        e.preventDefault()
        try {
            const response = await fetch('http://localhost:5001/api/companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(companyForm)
            })
            
            if (response.ok) {
                const newCompany = await response.json()
                setCompanies(prev => [...prev, newCompany])
                setCompanyForm({ name: '' })
                setShowCompanyForm(false)
                alert('Company created successfully!')
            } else {
                const error = await response.json()
                alert(`Error creating company: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Error creating company:', error)
            alert('Error creating company')
        }
    }
    
    // Company deletion
    const deleteCompany = async (companyId) => {
        if (!window.confirm('Are you sure you want to delete this company? This will permanently delete all associated data.')) {
            return
        }
        
        try {
            const response = await fetch(`http://localhost:5001/api/companies/${companyId}`, {
                method: 'DELETE'
            })
            
            if (response.ok) {
                setCompanies(prev => prev.filter(c => c.id !== companyId))
                // If we're currently viewing the deleted company, switch to Relay
                if (selectedCompanyId === companyId.toString()) {
                    const relayCompany = companies.find(c => c.is_super_admin)
                    if (relayCompany) {
                        setGlobalCompany(relayCompany.id.toString())
                    }
                }
                alert('Company deleted successfully!')
            } else {
                const error = await response.json()
                alert(`Error deleting company: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Error deleting company:', error)
            alert('Error deleting company')
        }
    }

    // Company management functions
    const toggleCompanyCard = (companyId) => {
        setExpandedCompanyCards(prev => {
            const newSet = new Set(prev)
            if (newSet.has(companyId)) {
                newSet.delete(companyId)
            } else {
                newSet.add(companyId)
            }
            return newSet
        })
    }

    const startEditingCompany = (company) => {
        setEditingCompany(company)
        setEditCompanyForm({ name: company.name })
    }

    const cancelEditingCompany = () => {
        setEditingCompany(null)
        setEditCompanyForm({ name: '' })
    }

    const handleCompanyEdit = async (e) => {
        e.preventDefault()
        if (!editingCompany) return

        try {
            const response = await fetch(`http://localhost:5001/api/companies/${editingCompany.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editCompanyForm)
            })

            if (response.ok) {
                // Update company in local state
                setCompanies(companies.map(c => 
                    c.id === editingCompany.id 
                        ? { ...c, name: editCompanyForm.name }
                        : c
                ))
                
                // Update selected company if it was the edited one
                if (selectedCompanyId === editingCompany.id.toString()) {
                    setSelectedCompanyId(editingCompany.id.toString())
                }
                
                setEditingCompany(null)
                setEditCompanyForm({ name: '' })
                console.log('Company updated successfully')
            } else {
                console.error('Failed to update company')
            }
        } catch (error) {
            console.error('Error updating company:', error)
            alert('Error updating company')
        }
    }

    // Get projects for assignment modal
    const getProjectsForAssignment = () => {
        return projects.sort((a, b) => a.name.localeCompare(b.name))
    }

    const handleAssignSubmit = async (e) => {
        e.preventDefault()
        if (!selectedPersonnel) return

        try {
            // Send project_id (single project) instead of project_ids array
            const projectId = assignForm.selectedProjectIds.length > 0 ? assignForm.selectedProjectIds[0] : ''
            
            const response = await fetch(`http://localhost:5001/api/personnel/${selectedPersonnel.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ project_id: projectId })
            })
            
            if (response.ok) {
                fetchPersonnel()
                setShowAssignModal(false)
                setSelectedPersonnel(null)
                setAssignForm({ selectedProjectIds: [] })
                
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to update project assignment')
            }
        } catch (error) {
            console.error('Error assigning personnel to project:', error)
            alert('Error updating project assignment')
        }
    }

    const assignPersonnelToEvent = async (personnelId, eventIds) => {
        try {
            const response = await fetch(`http://localhost:5001/api/personnel/${personnelId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_ids: eventIds })
            })
            
            if (response.ok) {
                fetchPersonnel()
            }
        } catch (error) {
            console.error('Error assigning personnel to event:', error)
        }
    }

    // Card expansion functions
    const toggleEventCard = (eventId) => {
        setExpandedEventCards(prev => {
            const newSet = new Set(prev)
            if (newSet.has(eventId)) {
                newSet.delete(eventId)
            } else {
                newSet.add(eventId)
            }
            return newSet
        })
    }

    const toggleProjectCard = (projectId) => {
        setExpandedProjectCards(prev => {
            const newSet = new Set(prev)
            if (newSet.has(projectId)) {
                newSet.delete(projectId)
            } else {
                newSet.add(projectId)
            }
            return newSet
        })
    }

    const toggleOrgCard = (orgId) => {
        setExpandedOrgCards(prev => {
            const newSet = new Set(prev)
            if (newSet.has(orgId)) {
                newSet.delete(orgId)
            } else {
                newSet.add(orgId)
            }
            return newSet
        })
    }

    const togglePersonnelCard = (personnelId) => {
        setExpandedPersonnelCards(prev => {
            const newSet = new Set(prev)
            if (newSet.has(personnelId)) {
                newSet.delete(personnelId)
            } else {
                newSet.add(personnelId)
            }
            return newSet
        })
    }

    const toggleUserCard = (userId) => {
        setExpandedUserCards(prev => {
            const newSet = new Set(prev)
            if (newSet.has(userId)) {
                newSet.delete(userId)
            } else {
                newSet.add(userId)
            }
            return newSet
        })
    }

    // User management functions
    const handleUserEdit = (userItem) => {
        setEditingUser(userItem)
        setUserEditForm({
            access: userItem.access,
            organization_id: userItem.organization_id || null
        })
    }

    const handleUserUpdate = async (userId) => {
        try {
            const response = await fetch(`http://localhost:5001/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userEditForm)
            })

            if (response.ok) {
                fetchUsers()
                fetchPersonnel() // Refresh in case organization changed
                setEditingUser(null)
                setUserEditForm({ access: '', organization_id: null })
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to update user')
            }
        } catch (error) {
            console.error('Error updating user:', error)
            alert('Failed to update user')
        }
    }

    const cancelUserEdit = () => {
        setEditingUser(null)
        setUserEditForm({ access: '', organization_id: null })
    }

    // Role-based CSS class for personnel cards
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

    // Status calculation functions
    const parseDateLocal = (dateStr) => {
        // Expecting YYYY-MM-DD
        const [year, month, day] = (dateStr || '').split('-').map(Number)
        if (!year || !month || !day) return null
        return new Date(year, month - 1, day)
    }

    const parseDateTimeLocal = (dateStr, timeStr) => {
        // Expecting YYYY-MM-DD and HH:mm (optionally with seconds)
        const [year, month, day] = (dateStr || '').split('-').map(Number)
        const [hour = 0, minute = 0, second = 0] = (timeStr || '').split(':').map(Number)
        if (!year || !month || !day) return null
        return new Date(year, month - 1, day, hour, minute, second)
    }
    const getProjectStatus = (project) => {
        if (!project.start_date || !project.end_date) return 'scheduled'
        
        const now = new Date()
        const startDate = new Date(project.start_date)
        const endDate = new Date(project.end_date)
        
        if (now < startDate) return 'scheduled'
        if (now >= startDate && now <= endDate) return 'live'
        if (now > endDate) return 'done'
        
        return 'scheduled'
    }

    const getEventStatus = (event) => {
        if (!event.date || !event.start_time || !event.end_time) return 'scheduled'
        // Use local parsing to avoid UTC/date-only quirks
        // currentTimeTick is referenced to ensure this recalculates on interval
        void currentTimeTick
        const now = new Date()
        const eventDate = parseDateLocal(event.date)
        const startTime = parseDateTimeLocal(event.date, event.start_time)
        const endTime = parseDateTimeLocal(event.date, event.end_time)
        
        // Check if it's today
        const isToday = now.toDateString() === eventDate.toDateString()
        
        if (!isToday) {
            if (now < startTime) return 'scheduled'
            if (now > endTime) return 'done'
        }
        
        if (isToday) {
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
        
        return 'scheduled'
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return '#007bff' // Blue
            case 'upcoming': return '#fd7e14' // Orange
            case 'starting-soon': return '#dc3545' // Red
            case 'ongoing': return '#28a745' // Green
            case 'live': return '#28a745' // Green
            case 'done': return '#6c757d' // Grey
            default: return '#007bff'
        }
    }

    

    const openApprovalModal = (request) => {
        setSelectedRequest(request)
        setApprovalForm({
            role: 'Client',
            company_id: user?.is_super_admin ? '' : user?.company_id, // Auto-fill company for regular admins
            organization_id: null, // Reset organization selection
            create_personnel: false,
            temporary_password: 'temp123',
            phone: request.phone || '',  // Auto-populate from request
            avatar: 'avatar1.png'  // Default avatar selection
        })
        setShowApprovalModal(true)
    }

    const handleApprovalSubmit = async (e) => {
        e.preventDefault()
        if (!selectedRequest) return

        // Ensure company_id is set for regular admins
        const companyId = user?.is_super_admin ? approvalForm.company_id : user?.company_id
        if (!companyId) {
            alert('Company ID is required')
            return
        }

        try {
            const response = await fetch(`http://localhost:5001/api/access-requests/${selectedRequest.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve',
                    role: approvalForm.role,
                    company_id: companyId,
                    organization_id: approvalForm.organization_id,
                    create_personnel: approvalForm.create_personnel,
                    temporary_password: approvalForm.temporary_password,
                    phone: approvalForm.phone,
                    avatar: approvalForm.avatar,
                    processed_at: new Date().toISOString(),
                    processed_by: user?.id
                })
            })

            if (response.ok) {
                const data = await response.json()
                fetchAccessRequests()
                // Refresh personnel list if personnel was created
                if (approvalForm.create_personnel) {
                    fetchPersonnel()
                }
                setShowApprovalModal(false)
                setSelectedRequest(null)
                
                
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to approve request')
            }
        } catch (error) {
            console.error('Error approving request:', error)
            alert('Failed to approve request')
        }
    }

    const handleAccessRequest = async (requestId, action) => {
        if (action === 'deny') {
            
            
            try {
                const response = await fetch(`http://localhost:5001/api/access-requests/${requestId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deny',
                        processed_at: new Date().toISOString(),
                        processed_by: user?.id
                    })
                })

                if (response.ok) {
                    fetchAccessRequests()
                    
                } else {
                    const data = await response.json()
                    alert(data.error || 'Failed to deny request')
                }
            } catch (error) {
                console.error('Error denying request:', error)
                alert('Failed to deny request')
            }
        }
    }

    const resetEventForm = () => {
        setEventForm({ name: '', date: '', start_time: '', end_time: '', location: '', notes: '', quick_turn: false, deadline: '', project_id: null })
        setShowEventForm(false)
        setEditingItem(null)
    }

    const resetProjectForm = () => {
        setProjectForm({ name: '', location: '', start_date: '', end_date: '', deliver_date: '', organization_id: null })
        setShowProjectForm(false)
        setEditingItem(null)
    }

    const resetOrgForm = () => {
        setOrgForm({ name: '', details: '' })
        setShowOrgForm(false)
        setEditingItem(null)
    }

    const resetPersonnelForm = () => {
        setPersonnelForm({ name: '', role: '', email: '', phone: '', availability: '', organization_id: null, project_id: null })
        setShowPersonnelForm(false)
        setEditingItem(null)
    }

    return (
        <div className='view-container'>
            <Nav />
            <div className='page-container'>
                <div className='settings-container'>
                    <h1 className='settings-title'>Settings & Management</h1>

                    
                    {/* Grid Layout for Sections */}
                    <div className='settings-grid'>
                        
                        {/* Left Column */}
                        <div className='settings-column'>
                            
                                                        {/* Company Management Section for Super Admin */}
                            {user?.is_super_admin && (
                                <div className='settings-section'>
                                    <div className='settings-section-header'>
                                        <h2>Company Management</h2>
                                        <button 
                                            className='add-btn'
                                            onClick={() => setShowCompanyForm(true)}
                                        >
                                            Add Company
                                        </button>
                                    </div>
                                    
                                    {/* Company Selection Dropdown */}
                                    <div className='company-selector'>
                                        <label htmlFor='company-select'>Company View:</label>
                                        <select 
                                            id='company-select'
                                            value={selectedCompanyId || (companies.find(c => c.is_super_admin)?.id || '')}
                                            onChange={(e) => setGlobalCompany(e.target.value)}
                                            className='company-dropdown'
                                        >
                                            {companies.map(company => (
                                                <option key={company.id} value={company.id}>
                                                    {company.name} {company.is_super_admin ? '(Super Admin)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className='company-info'>
                                        <p>You are viewing data for: <strong>{companies.find(c => c.id === parseInt(selectedCompanyId || companies.find(c => c.is_super_admin)?.id))?.name || 'Relay'}</strong></p>
                                    </div>
                                    
                                    <div className='settings-items-list'>
                                        {companies.length === 0 ? (
                                            <div className='settings-empty-state'>
                                                <p>No companies found</p>
                                            </div>
                                        ) : (
                                            companies.map(company => (
                                                <div key={company.id} className='settings-item-card company-card'>
                                                    <div 
                                                        className='settings-item-header'
                                                        onClick={() => toggleCompanyCard(company.id)}
                                                    >
                                                        <div className='settings-item-info'>
                                                            <h3>
                                                                {company.name}
                                                                {company.is_super_admin && <span className='super-admin-badge'>Super Admin</span>}
                                                            </h3>
                                                            <span className='item-meta'>
                                                                Created: {new Date(company.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className='settings-item-actions'>
                                                            <button 
                                                                className='expand-btn'
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleCompanyCard(company.id)
                                                                }}
                                                            >
                                                                {expandedCompanyCards.has(company.id) ? '−' : '+'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {expandedCompanyCards.has(company.id) && (
                                                        <div className='settings-item-expanded'>
                                                            {editingCompany?.id === company.id ? (
                                                                <form onSubmit={handleCompanyEdit} className='edit-form'>
                                                                    <div className='form-field'>
                                                                        <label>Company Name:</label>
                                                                        <input
                                                                            type='text'
                                                                            value={editCompanyForm.name}
                                                                            onChange={(e) => setEditCompanyForm({ name: e.target.value })}
                                                                            required
                                                                        />
                                                                    </div>
                                                                    <div className='form-actions'>
                                                                        <button type='submit' className='save-btn'>Save</button>
                                                                        <button 
                                                                            type='button' 
                                                                            className='cancel-btn'
                                                                            onClick={() => cancelEditingCompany()}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </form>
                                                            ) : (
                                                                <div className='expanded-actions'>
                                                                    <button 
                                                                        className='edit-btn'
                                                                        onClick={() => startEditingCompany(company)}
                                                                    >
                                                                        Edit Company
                                                                    </button>
                                                                    <button 
                                                                        className='delete-btn'
                                                                        onClick={() => {
                                                                            if (window.confirm(`Are you sure you want to delete ${company.name}? This action cannot be undone.`)) {
                                                                                deleteCompany(company.id)
                                                                            }
                                                                        }}
                                                                    >
                                                                        Delete Company
                                                                    </button>
                                                                    <div className='super-admin-note'>
                                                                        <small>Note: Deleting a company will remove all associated data.</small>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}


                            
                            {/* Sections for non-Relay companies */}
                            {!isViewingRelay && (
                            <>




                            {/* Personnel Section - Hidden for Relay */}
                            <div className='settings-section'>
                                <div className='settings-section-header'>
                                    <h2>Personnel Management</h2>
                                    <button 
                                        className='add-btn'
                                        onClick={() => setShowPersonnelForm(true)}
                                    >
                                        Add Personnel
                                    </button>
                                </div>

                                {/* Personnel Role Filter */}
                                <div className='settings-filter-section'>
                                    <label>Filter by Role:</label>
                                    <select
                                        value={personnelRoleFilter}
                                        onChange={(e) => setPersonnelRoleFilter(e.target.value)}
                                        className='settings-filter-select'
                                    >
                                        <option value=''>All Roles</option>
                                        {availableRoles.map(role => (
                                            <option key={role} value={role}>
                                                {role}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {showPersonnelForm && (
                                    <form className='settings-item-form' onSubmit={handlePersonnelSubmit}>
                                        <div className='settings-form-grid'>
                                            <input
                                                type='text'
                                                placeholder='Full Name'
                                                value={personnelForm.name}
                                                onChange={(e) => setPersonnelForm({...personnelForm, name: e.target.value})}
                                                required
                                            />
                                            <div className='settings-form-field'>
                                                <label>Role</label>
                                                <select
                                                    value={personnelForm.role}
                                                    onChange={(e) => setPersonnelForm({...personnelForm, role: e.target.value})}
                                                    required
                                                >
                                                    <option value=''>Select Role</option>
                                                    <option value='Client'>Client</option>
                                                    <option value='Coordinator'>Coordinator</option>
                                                    <option value='Photographer'>Photographer</option>
                                                    <option value='Videographer'>Videographer</option>
                                                    <option value='Editor'>Editor</option>
                                                    <option value='Admin'>Admin</option>
                                                </select>
                                            </div>
                                            <div className='settings-form-field'>
                                                <label>Organization</label>
                                                <select
                                                    value={personnelForm.organization_id}
                                                    onChange={(e) => setPersonnelForm({...personnelForm, organization_id: e.target.value})}
                                                    required
                                                >
                                                    <option value=''>Select Organization</option>
                                                    {organizations.map(org => (
                                                        <option key={org.id} value={org.id}>{org.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className='settings-form-field'>
                                                <label>Project</label>
                                                <select
                                                    value={personnelForm.project_id}
                                                    onChange={(e) => setPersonnelForm({...personnelForm, project_id: e.target.value})}
                                                >
                                                    <option value=''>Select Project (Optional)</option>
                                                    {projects.map(project => {
                                                        const org = organizations.find(o => o.id === project.organization_id)
                                                        return (
                                                            <option key={project.id} value={project.id}>
                                                                {project.name} ({org?.name || 'Unknown Org'})
                                                            </option>
                                                        )
                                                    })}
                                                </select>
                                            </div>
                                            <input
                                                type='email'
                                                placeholder='Email'
                                                value={personnelForm.email}
                                                onChange={(e) => setPersonnelForm({...personnelForm, email: e.target.value})}
                                            />
                                            <input
                                                type='tel'
                                                placeholder='Phone'
                                                value={personnelForm.phone}
                                                onChange={(e) => setPersonnelForm({...personnelForm, phone: e.target.value})}
                                            />
                                        </div>
                                        <textarea
                                            placeholder='Availability Notes'
                                            value={personnelForm.availability}
                                            onChange={(e) => setPersonnelForm({...personnelForm, availability: e.target.value})}
                                            rows='2'
                                        />
                                        <div className='settings-form-actions'>
                                            <button type='submit' className='save-btn'>
                                                {editingItem ? 'Update' : 'Create'} Personnel
                                            </button>
                                            <button type='button' className='cancel-btn' onClick={resetPersonnelForm}>
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <div className='settings-items-list'>
                                    {filteredPersonnel && filteredPersonnel.map(person => (
                                        <div 
                                            key={person.id} 
                                            className={`settings-item-card ${getRoleClass(person.role)} ${expandedPersonnelCards.has(person.id) ? 'expanded' : ''}`}
                                            onClick={() => togglePersonnelCard(person.id)}
                                        >
                                            <div className='settings-item-info'>
                                                <h3>{person.name}</h3>
                                                <p>{person.role}</p>
                                                <span className='item-meta'>{person.email} • {person.phone}</span>
                                                {person.event_ids && person.event_ids.length > 0 && expandedPersonnelCards.has(person.id) && (
                                                    <div className='assignments'>
                                                        <strong>Assigned Events:</strong> {person.event_ids.length} events
                                                        {person.project_ids && person.project_ids.length > 0 && (
                                                            <span> | <strong>Projects:</strong> {person.project_ids.length} projects</span>
                                                        )}
                                                    </div>
                                                )}
                                                {person.availability && expandedPersonnelCards.has(person.id) && (
                                                    <p><strong>Availability:</strong> {person.availability}</p>
                                                )}
                                            </div>
                                            <div className={`settings-item-actions ${expandedPersonnelCards.has(person.id) ? 'expanded' : ''}`}>
                                                <button 
                                                    className='edit-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        editItem('personnel', person)
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    className='assign-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openAssignModal(person)
                                                    }}
                                                >
                                                    Assign
                                                </button>
                                                <button 
                                                    className='delete-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteItem('personnel', person.id)
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            </>
                        )}
                        
                        {/* Personnel Section for Super Admin viewing Relay */}
                        {user?.is_super_admin && isViewingRelay && (
                            <div className='settings-section'>
                                <div className='settings-section-header'>
                                    <h2>Relay Personnel Management</h2>
                                    <button 
                                        className='add-btn'
                                        onClick={() => setShowPersonnelForm(true)}
                                    >
                                        Add Personnel
                                    </button>
                                </div>

                                {/* Personnel Role Filter */}
                                <div className='settings-filter-section'>
                                    <label>Filter by Role:</label>
                                    <select
                                        value={personnelRoleFilter}
                                        onChange={(e) => setPersonnelRoleFilter(e.target.value)}
                                        className='settings-filter-select'
                                    >
                                        <option value=''>All Roles</option>
                                        {availableRoles.map(role => (
                                            <option key={role} value={role}>
                                                {role}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className='settings-items-list'>
                                    {filteredPersonnel.length === 0 ? (
                                        <div className='settings-empty-state'>
                                            <p>No personnel found</p>
                                        </div>
                                    ) : (
                                        filteredPersonnel.map(person => (
                                            <div 
                                                key={person.id} 
                                                className={`settings-item-card ${getRoleClass(person.role)} ${expandedPersonnelCards.has(person.id) ? 'expanded' : ''}`}
                                                onClick={() => togglePersonnelCard(person.id)}
                                            >
                                                <div className='settings-item-info'>
                                                    <h3>{person.name}</h3>
                                                    <p>{person.role}</p>
                                                    <span className='item-meta'>{person.email} • {person.phone}</span>
                                                    {person.event_ids && person.event_ids.length > 0 && expandedPersonnelCards.has(person.id) && (
                                                        <div className='assignments'>
                                                            <strong>Assigned Events:</strong> {person.event_ids.length} events
                                                            <div className='assignments-list'>
                                                                {/* Event assignments would go here */}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {person.availability && expandedPersonnelCards.has(person.id) && (
                                                        <p><strong>Availability:</strong> {person.availability}</p>
                                                    )}
                                                </div>
                                                <div className={`settings-item-actions ${expandedPersonnelCards.has(person.id) ? 'expanded' : ''}`}>
                                                    <button 
                                                        className='edit-btn'
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            editItem('personnel', person)
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        className='assign-btn'
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openAssignModal(person)
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
                        )}
                        </div>

                        {/* Right Column */}
                        <div className='settings-column'>
                            
                            {/* Sections for non-Relay companies */}
                            {!isViewingRelay && (
                            <>
                            {/* Projects Section */}
                            <div className='settings-section'>
                                <div className='settings-section-header'>
                                    <h2>Project Management</h2>
                                    <button 
                                        className='add-btn'
                                        onClick={() => setShowProjectForm(true)}
                                    >
                                        Add Project
                                    </button>
                                </div>

                                {showProjectForm && (
                                    <form className='settings-item-form' onSubmit={handleProjectSubmit}>
                                        <div className='settings-form-grid'>
                                            <input
                                                type='text'
                                                placeholder='Project Name'
                                                value={projectForm.name}
                                                onChange={(e) => setProjectForm({...projectForm, name: e.target.value})}
                                                required
                                            />
                                            <input
                                                type='text'
                                                placeholder='Location'
                                                value={projectForm.location}
                                                onChange={(e) => setProjectForm({...projectForm, location: e.target.value})}
                                                required
                                            />
                                            <div className='settings-form-field'>
                                                <label>Start Date</label>
                                                <input
                                                    type='date'
                                                    value={projectForm.start_date}
                                                    onChange={(e) => setProjectForm({...projectForm, start_date: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className='settings-form-field'>
                                                <label>End Date</label>
                                                <input
                                                    type='date'
                                                    value={projectForm.end_date}
                                                    onChange={(e) => setProjectForm({...projectForm, end_date: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className='settings-form-field'>
                                                <label>Delivery Date</label>
                                                <input
                                                    type='date'
                                                    value={projectForm.deliver_date}
                                                    onChange={(e) => setProjectForm({...projectForm, deliver_date: e.target.value})}
                                                />
                                            </div>
                                            <select
                                                value={projectForm.organization_id}
                                                onChange={(e) => setProjectForm({...projectForm, organization_id: e.target.value})}
                                                required
                                            >
                                                <option value=''>Select Organization</option>
                                                {organizations && organizations.map(org => (
                                                    <option key={org.id} value={org.id}>{org.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className='settings-form-actions'>
                                            <button type='submit' className='save-btn'>
                                                {editingItem ? 'Update' : 'Create'} Project
                                            </button>
                                            <button type='button' className='cancel-btn' onClick={resetProjectForm}>
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <div className='settings-items-list'>
                                    {projects && projects.map(project => (
                                        <div 
                                            key={project.id} 
                                            className={`settings-item-card ${expandedProjectCards.has(project.id) ? 'expanded' : ''}`}
                                            onClick={() => toggleProjectCard(project.id)}
                                        >
                                            <div className='settings-item-info'>
                                                <div className='settings-project-header'>
                                                    <h3>{project.name}</h3>
                                                    <span 
                                                        className='settings-status-badge'
                                                        style={{ 
                                                            color: getStatusColor(getProjectStatus(project)),
                                                            borderColor: getStatusColor(getProjectStatus(project))
                                                        }}
                                                    >
                                                        {getProjectStatus(project).charAt(0).toUpperCase() + getProjectStatus(project).slice(1)}
                                                    </span>
                                                </div>
                                                <p><strong>Location:</strong> {project.location}</p>
                                                <p><strong>Start:</strong> {project.start_date} <strong>End:</strong> {project.end_date}</p>
                                                {project.deliver_date && expandedProjectCards.has(project.id) && <p><strong>Deliver:</strong> {project.deliver_date}</p>}
                                            </div>
                                            <div className={`settings-item-actions ${expandedProjectCards.has(project.id) ? 'expanded' : ''}`}>
                                                <button 
                                                    className='edit-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        editItem('project', project)
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    className='delete-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteItem('project', project.id)
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Organizations Section - Hidden for Relay */}
                            <div className='settings-section'>
                                <div className='settings-section-header'>
                                    <h2>Organization Management</h2>
                                    <button 
                                        className='add-btn'
                                        onClick={() => setShowOrgForm(true)}
                                    >
                                        Add Organization
                                    </button>
                                </div>

                                {showOrgForm && (
                                    <form className='settings-item-form' onSubmit={handleOrgSubmit}>
                                        <div className='settings-form-grid'>
                                            <input
                                                type='text'
                                                placeholder='Organization Name'
                                                value={orgForm.name}
                                                onChange={(e) => setOrgForm({...orgForm, name: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <textarea
                                            placeholder='Organization Details'
                                            value={orgForm.details}
                                            onChange={(e) => setOrgForm({...orgForm, details: e.target.value})}
                                            rows='3'
                                        />
                                        <div className='settings-form-actions'>
                                            <button type='submit' className='save-btn'>
                                                {editingItem ? 'Update' : 'Create'} Organization
                                            </button>
                                            <button type='button' className='cancel-btn' onClick={resetOrgForm}>
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <div className='settings-items-list'>
                                    {organizations && organizations.map(org => (
                                        <div 
                                            key={org.id} 
                                            className={`settings-item-card ${expandedOrgCards.has(org.id) ? 'expanded' : ''}`}
                                            onClick={() => toggleOrgCard(org.id)}
                                        >
                                            <div className='settings-item-info'>
                                                <h3>{org.name}</h3>
                                                {expandedOrgCards.has(org.id) && <p>{org.details}</p>}
                                            </div>
                                            <div className={`settings-item-actions ${expandedOrgCards.has(org.id) ? 'expanded' : ''}`}>
                                                <button 
                                                    className='edit-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        editItem('organization', org)
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    className='delete-btn'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteItem('organization', org.id)
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            </>
                            )}

                            {/* Access Requests Section */}
                            <div className='settings-section'>
                                <div className='settings-section-header'>
                                    <h2>Access Requests</h2>
                                    <span className='request-count'>{accessRequests.length} pending</span>
                                </div>

                                <div className='settings-items-list'>
                                    {accessRequests.length === 0 ? (
                                        <div className='settings-empty-state'>
                                            <p>No pending access requests</p>
                                        </div>
                                    ) : (
                                        accessRequests.map(request => (
                                            <div 
                                                key={request.id} 
                                                className='settings-item-card settings-request-card clickable-card'
                                                onClick={() => openApprovalModal(request)}
                                            >
                                                <div className='settings-item-info'>
                                                    <h3>{request.name}</h3>
                                                    <p>{request.email}</p>
                                                    <span className='item-meta'>
                                                        {request.requested_access && `Requested: ${request.requested_access} • `}
                                                        {request.organization}
                                                        {request.created_at && ` • ${new Date(request.created_at).toLocaleDateString()}`}
                                                    </span>
                                                </div>
                                                <div className='settings-item-actions' onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        className='approve-btn'
                                                        onClick={() => openApprovalModal(request)}
                                                    >
                                                        Review
                                                    </button>
                                                    <button 
                                                        className='deny-btn'
                                                        onClick={() => handleAccessRequest(request.id, 'deny')}
                                                    >
                                                        Deny
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* User Management Section - Admin Only */}
                            {user?.access?.toLowerCase() === 'admin' && (
                                <div className='settings-section'>
                                    <div className='settings-section-header'>
                                        <h2>User Management</h2>
                                        <span className='user-count'>{users.length} users</span>
                                    </div>

                                    <div className='items-container'>
                                        {users.length === 0 ? (
                                            <p className='no-items'>No users found</p>
                                        ) : (
                                            users.map(userItem => {
                                                const isCurrentUser = userItem.id === user?.id
                                                const associatedPersonnel = personnel.find(p => p.user_id === userItem.id)
                                                const orgName = organizations.find(org => org.id === userItem.organization_id)?.name || 'Unknown'
                                                
                                                const isExpanded = expandedUserCards.has(userItem.id)
                                                const isBeingEdited = editingUser?.id === userItem.id
                                                
                                                return (
                                                    <div key={userItem.id} className={`settings-item-card settings-user-card ${isCurrentUser ? 'current-user' : ''} ${isExpanded ? 'expanded' : ''}`}>
                                                        <div 
                                                            className='settings-item-info clickable'
                                                            onClick={() => toggleUserCard(userItem.id)}
                                                        >
                                                            <div className='item-header'>
                                                                <img 
                                                                    src={`/images/avatars/${userItem.avatar || 'default-avatar.png'}`} 
                                                                    alt={userItem.name}
                                                                    className='user-avatar'
                                                                />
                                                                <div className='user-details'>
                                                                    <h3>{userItem.name}</h3>
                                                                    <p className='user-email'>{userItem.email}</p>
                                                                    <p className='user-role' style={{
                                                                        color: userItem.access?.toLowerCase() === 'admin' ? '#dc3545' :
                                                                               userItem.access?.toLowerCase() === 'coordinator' ? '#ffd700' :
                                                                               userItem.access?.toLowerCase() === 'photographer' ? '#1e90ff' :
                                                                               userItem.access?.toLowerCase() === 'editor' ? '#ff7a18' :
                                                                               userItem.access?.toLowerCase() === 'client' ? '#00e5ff' :
                                                                               userItem.access?.toLowerCase() === 'videographer' ? '#8a2be2' : '#ffffff',
                                                                        fontWeight: 'bold'
                                                                    }}>
                                                                        {userItem.access}
                                                                    </p>
                                                                    <p className='user-org'>{orgName}</p>
                                                                    {associatedPersonnel && (
                                                                        <p className='user-personnel'>Personnel: {associatedPersonnel.name}</p>
                                                                    )}
                                                                    {isCurrentUser && (
                                                                        <span className='current-user-badge'>You</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className='settings-item-actions'>
                                                            <span className='expand-indicator'>
                                                                {isExpanded ? '▼' : '▶'}
                                                            </span>
                                                        </div>

                                                        {/* Expanded Content */}
                                                        {isExpanded && (
                                                            <div className='user-expanded-content'>
                                                                {isBeingEdited ? (
                                                                    <div className='user-edit-form'>
                                                                        <h4>Edit User</h4>
                                                                        <div className='settings-form-field'>
                                                                            <label>Access Level:</label>
                                                                            <select
                                                                                value={userEditForm.access}
                                                                                onChange={(e) => setUserEditForm({...userEditForm, access: e.target.value})}
                                                                            >
                                                                                <option value='Client'>Client</option>
                                                                                <option value='Coordinator'>Coordinator</option>
                                                                                <option value='Photographer'>Photographer</option>
                                                                                <option value='Videographer'>Videographer</option>
                                                                                <option value='Editor'>Editor</option>
                                                                                <option value='Admin'>Admin</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className='settings-form-field'>
                                                                            <label>Organization:</label>
                                                                            <select
                                                                                value={userEditForm.organization_id}
                                                                                onChange={(e) => setUserEditForm({...userEditForm, organization_id: e.target.value})}
                                                                            >
                                                                                <option value=''>No Organization</option>
                                                                                {organizations.map(org => (
                                                                                    <option key={org.id} value={org.id}>{org.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div className='settings-form-actions'>
                                                                            <button 
                                                                                className='save-btn'
                                                                                onClick={() => handleUserUpdate(userItem.id)}
                                                                            >
                                                                                Save Changes
                                                                            </button>
                                                                            <button 
                                                                                className='cancel-btn'
                                                                                onClick={cancelUserEdit}
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className='user-actions-expanded'>
                                                                        {!isCurrentUser && (
                                                                            <>
                                                                                <button 
                                                                                    className='edit-btn'
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        handleUserEdit(userItem)
                                                                                    }}
                                                                                >
                                                                                    Edit Access & Organization
                                                                                </button>
                                                                                                                                                <button 
                                                                    className='delete-btn'
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        deleteItem('user', userItem.id)
                                                                    }}
                                                                >
                                                                    Delete User
                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {isCurrentUser && (
                                                                            <p className='current-user-notice'>You cannot edit or delete your own account</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                    </div>
                </div>
            </div>

            {/* Access Request Approval Modal */}
            {showApprovalModal && selectedRequest && (
                <div className='settings-modal-overlay'>
                    <div className='modal-content approval-modal'>
                        <div className='settings-modal-header'>
                            <h2>Review Access Request</h2>
                            <button 
                                className='settings-close-btn'
                                onClick={() => setShowApprovalModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className='request-details'>
                            <div className='settings-detail-row'>
                                <strong>Name:</strong> {selectedRequest.name}
                            </div>
                            <div className='settings-detail-row'>
                                <strong>Email:</strong> {selectedRequest.email}
                            </div>
                            <div className='settings-detail-row'>
                                <strong>Organization:</strong> {selectedRequest.organization}
                            </div>
                            {selectedRequest.phone && (
                                <div className='settings-detail-row'>
                                    <strong>Phone:</strong> {selectedRequest.phone}
                                </div>
                            )}
                            {selectedRequest.requested_access && (
                                <div className='settings-detail-row'>
                                    <strong>Requested Role:</strong> {selectedRequest.requested_access}
                                </div>
                            )}
                            {selectedRequest.message && (
                                <div className='settings-detail-row'>
                                    <strong>Message:</strong> {selectedRequest.message}
                                </div>
                            )}
                            <div className='settings-detail-row'>
                                <strong>Submitted:</strong> {new Date(selectedRequest.created_at).toLocaleString()}
                            </div>
                        </div>

                        <form className='settings-approval-form' onSubmit={handleApprovalSubmit}>
                            <div className='form-section'>
                                <h3>Approval Settings</h3>
                                
                                <div className='settings-form-grid'>
                                    <div className='settings-form-field'>
                                        <label>User Role:</label>
                                        <select
                                            value={approvalForm.role}
                                            onChange={(e) => setApprovalForm({...approvalForm, role: e.target.value})}
                                            required
                                        >
                                            <option value='Client'>Client</option>
                                            <option value='Coordinator'>Coordinator</option>
                                            <option value='Photographer'>Photographer</option>
                                            <option value='Videographer'>Videographer</option>
                                            <option value='Editor'>Editor</option>
                                            <option value='Admin'>Admin</option>
                                        </select>
                                    </div>

                                    <div className='settings-form-field'>
                                        <label>Company:</label>
                                        {user?.is_super_admin ? (
                                            <select
                                                value={approvalForm.company_id}
                                                onChange={(e) => setApprovalForm({...approvalForm, company_id: e.target.value})}
                                                required
                                            >
                                                <option value=''>Select Company</option>
                                                {companies && companies.map(company => (
                                                    <option key={company.id} value={company.id}>
                                                        {company.name} {company.is_super_admin ? '(Super Admin)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className='company-display'>
                                                <span className='company-name'>{userCompany?.name || 'Your Company'}</span>
                                                <span className='company-note'>(Auto-assigned to your company)</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Organization selection - only show for non-super admin roles and when company is selected */}
                                    {approvalForm.role !== 'Admin' && (
                                        <div className='settings-form-field'>
                                            <label>Organization (Optional):</label>
                                            <select
                                                value={approvalForm.organization_id || ''}
                                                onChange={(e) => setApprovalForm({...approvalForm, organization_id: e.target.value || null})}
                                                disabled={user?.is_super_admin && !approvalForm.company_id}
                                            >
                                                <option value=''>No Organization</option>
                                                {organizations.map(org => (
                                                    <option key={org.id} value={org.id}>
                                                        {org.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {user?.is_super_admin && !approvalForm.company_id && (
                                                <small className='field-note'>Select a company first to choose organizations</small>
                                            )}
                                        </div>
                                    )}

                                    <div className='settings-form-field'>
                                        <label>Avatar:</label>
                                        <div className='avatar-selection-wrapper'>
                                            <img 
                                                className='selected-avatar-preview' 
                                                src={`/images/avatars/${approvalForm.avatar}`} 
                                                alt='Selected avatar'
                                            />
                                            <button 
                                                type='button' 
                                                className='select-avatar-btn'
                                                onClick={() => setShowAvatarModal(true)}
                                            >
                                                Choose Avatar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className='settings-form-field'>
                                    <label>Temporary Password:</label>
                                    <input
                                        type='text'
                                        value={approvalForm.temporary_password}
                                        onChange={(e) => setApprovalForm({...approvalForm, temporary_password: e.target.value})}
                                        placeholder='Temporary password for new user'
                                        required
                                    />
                                </div>

                                <div className='form-field checkbox-field'>
                                    <label>
                                        <input
                                            type='checkbox'
                                            checked={approvalForm.create_personnel}
                                            onChange={(e) => setApprovalForm({...approvalForm, create_personnel: e.target.checked})}
                                        />
                                        Also create personnel record (for staff roles)
                                    </label>
                                </div>


                            </div>

                            <div className='modal-actions'>
                                <button type='submit' className='approve-btn'>
                                    Approve & Create User
                                </button>
                                <button 
                                    type='button' 
                                    className='cancel-btn'
                                    onClick={() => setShowApprovalModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type='button' 
                                    className='deny-btn'
                                    onClick={() => {
                                        handleAccessRequest(selectedRequest.id, 'deny')
                                        setShowApprovalModal(false)
                                    }}
                                >
                                    Deny Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Avatar Selection Modal */}
            {showAvatarModal && (
                <div className='settings-modal-overlay' onClick={() => setShowAvatarModal(false)}>
                    <div className='avatar-modal-content' onClick={(e) => e.stopPropagation()}>
                        <div className='settings-modal-header'>
                            <h2>Choose Avatar</h2>
                            <button 
                                className='settings-close-btn'
                                onClick={() => setShowAvatarModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className='avatar-grid'>
                            {availableAvatars.map(avatar => (
                                <div 
                                    key={avatar}
                                    className={`avatar-option ${approvalForm.avatar === avatar ? 'selected' : ''}`}
                                    onClick={() => {
                                        setApprovalForm({...approvalForm, avatar})
                                        setShowAvatarModal(false)
                                    }}
                                >
                                    <img 
                                        src={`/images/avatars/${avatar}`} 
                                        alt={`Avatar ${avatar.replace('.png', '')}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Personnel Assignment Modal */}
            {showAssignModal && selectedPersonnel && (
                <div className='settings-modal-overlay'>
                    <div className='modal-content assignment-modal'>
                        <div className='settings-modal-header'>
                            <h2>Assign {selectedPersonnel.name} to Project</h2>
                            <button 
                                className='settings-close-btn'
                                onClick={() => setShowAssignModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleAssignSubmit} className='assignment-form'>
                            <div className='personnel-info'>
                                <p><strong>Personnel:</strong> {selectedPersonnel.name}</p>
                                <p><strong>Role:</strong> {selectedPersonnel.role}</p>
                            </div>

                            <div className='project-selection'>
                                <h3>Select Project to Assign:</h3>
                                <div className='settings-projects-list'>
                                    {(() => {
                                        const availableProjects = getProjectsForAssignment()
                                        return availableProjects.length === 0 ? (
                                            <p className='no-projects'>No projects available</p>
                                        ) : (
                                            <>
                                                <div className='settings-project-option'>
                                                    <label className='checkbox-label'>
                                                        <input
                                                            type='radio'
                                                            name='projectAssignment'
                                                            checked={assignForm.selectedProjectIds.length === 0}
                                                            onChange={() => setAssignForm({selectedProjectIds: []})}
                                                        />
                                                        <span className='checkmark'></span>
                                                        <div className='settings-project-info'>
                                                            <h4>No Project Assignment</h4>
                                                            <p>Remove this person from all projects</p>
                                                        </div>
                                                    </label>
                                                </div>
                                                {availableProjects.map(project => (
                                                    <div key={project.id} className='settings-project-option'>
                                                        <label className='checkbox-label'>
                                                            <input
                                                                type='radio'
                                                                name='projectAssignment'
                                                                checked={assignForm.selectedProjectIds.includes(project.id)}
                                                                onChange={() => {
                                                                    setAssignForm({selectedProjectIds: [project.id]})
                                                                }}
                                                            />
                                                            <span className='checkmark'></span>
                                                            <div className='settings-project-info'>
                                                                <h4>{project.name}</h4>
                                                                <p><strong>Location:</strong> {project.location}</p>
                                                                <p><strong>Duration:</strong> {project.start_date} to {project.end_date}</p>
                                                                {project.deliver_date && (
                                                                    <p><strong>Delivery:</strong> {project.deliver_date}</p>
                                                                )}
                                                            </div>
                                                        </label>
                                                    </div>
                                                ))}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>

                            <div className='modal-actions'>
                                <button type='submit' className='save-btn'>
                                    Update Project Assignment
                                </button>
                                <button 
                                    type='button' 
                                    className='cancel-btn'
                                    onClick={() => setShowAssignModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Company Creation Modal */}
            {showCompanyForm && (
                <div className='settings-modal-overlay'>
                    <div className='modal-content'>
                        <div className='settings-modal-header'>
                            <h2>Create New Company</h2>
                            <button 
                                className='settings-close-btn'
                                onClick={() => setShowCompanyForm(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form className='settings-form' onSubmit={handleCompanySubmit}>
                            <div className='settings-form-field'>
                                <label>Company Name:</label>
                                <input
                                    type='text'
                                    value={companyForm.name}
                                    onChange={(e) => setCompanyForm({...companyForm, name: e.target.value})}
                                    placeholder='Enter company name'
                                    required
                                />
                            </div>

                            <div className='modal-actions'>
                                <button type='submit' className='save-btn'>
                                    Create Company
                                </button>
                                <button 
                                    type='button' 
                                    className='cancel-btn'
                                    onClick={() => setShowCompanyForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}