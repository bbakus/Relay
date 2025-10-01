import '../styles/settings.css'
import '../styles/settings-mobile.css'
import { useState, useEffect } from 'react'
import { API_CONFIG } from '../utils/apiConfig'
import { Nav } from './Nav'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const Settings = () => {
    const { user, selectedCompanyId, setSelectedCompanyId, setGlobalCompany } = useAuth()
    const { userId } = useParams()
    const navigate = useNavigate()
    
    /*
    ACCESS CONTROL LOGIC:
    
    1. SUPER ADMIN (Relay company users):
       - Can see company dropdown to switch between companies
       - Can edit personnel/users in any company
       - Can view all companies' data
       - Default view is Relay company
       - When viewing a specific company, can create organizations/projects/personnel for THAT company
    
    2. REGULAR ADMIN (Non-Relay company users):
       - Only see their own company's data
       - Cannot switch company view
       - Can edit personnel/users in their company only
       - Cannot see Relay company or other companies
       - Can only create organizations/projects/personnel for their own company
    */
    


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
                const response = await fetch(`${API_CONFIG.baseUrl}/api/companies`)
                if (response.ok) {
                    const data = await response.json()
                    setCompanies(data)
                }
            } catch (error) {
                console.error('Error fetching companies:', error)
            }
        }
    }

    // Fetch organizations for a specific company
    const fetchOrganizationsForCompany = async (companyId) => {
        if (!companyId) {
            setOrganizations([])
            return
        }
        
        try {
            const company = companies.find(c => c.id === parseInt(companyId))
            if (company?.is_super_admin) {
                // Relay company doesn't have organizations
                setOrganizations([])
                return
            }
            
            console.log('Fetching organizations for company:', companyId, company?.name)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${companyId}`)
            if (response.ok) {
                const data = await response.json()
                console.log('Organizations fetched:', data)
                setOrganizations(data)
            } else {
                console.log('Failed to fetch organizations:', response.status)
                setOrganizations([])
            }
        } catch (error) {
            console.error('Error fetching organizations for company:', error)
            setOrganizations([])
        }
    }

    // Fetch user's company details (for regular admins)
    const fetchUserCompany = async () => {
        if (!user?.company_id) return
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/companies/${user.company_id}`)
            if (response.ok) {
                const companyData = await response.json()
                setUserCompany(companyData)
            }
        } catch (error) {
            console.error('Error fetching user company:', error)
        }
    }

    // Fetch data based on selected company - SIMPLE AND CLEAN
    const fetchCompanyData = async (companyId) => {
        if (!companyId) return
        
        console.log('🔍 fetchCompanyData called for company ID:', companyId)
        
        try {
            const selectedCompany = companies.find(c => c.id === parseInt(companyId))
            if (!selectedCompany) {
                console.log('🔍 Company not found, aborting')
                return
            }
            
            console.log('🔍 Loading data for company:', selectedCompany.name, 'IsRelay:', selectedCompany.is_super_admin)
            
            // ALWAYS clear all data first to prevent mixing between companies
            setUsers([])
            setPersonnel([])
            setOrganizations([])
            setProjects([])
            setEvents([])
            
            const isRelay = selectedCompany.is_super_admin
            

            
            // Fetch users for the selected company using backend filtering
            const usersResponse = await fetch(`${API_CONFIG.baseUrl}/api/users?company_id=${companyId}`)
            if (usersResponse.ok) {
                const companyUsers = await usersResponse.json()
                setUsers(companyUsers)
            }
            
            if (isRelay) {
                // For Relay: show Relay users and personnel, no orgs/projects
                // Only clear data if we're actually switching TO Relay from another company
                // Don't clear on initial load
                setOrganizations([])
                setProjects([])
                setEvents([])
                
                // Fetch Relay personnel
                const personnelResponse = await fetch(`${API_CONFIG.baseUrl}/api/personnel?company_id=${companyId}`)
                if (personnelResponse.ok) {
                    const relayPersonnel = await personnelResponse.json()
                    setPersonnel(relayPersonnel)
                }
            } else {
                // For other companies: fetch their data using backend filtering
                const [usersResponse, orgsResponse, personnelResponse] = await Promise.all([
                    fetch(`${API_CONFIG.baseUrl}/api/users?company_id=${companyId}`),
                    fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${companyId}`),
                    fetch(`${API_CONFIG.baseUrl}/api/personnel?company_id=${companyId}`)
                ])
                
                // Set users
                if (usersResponse.ok) {
                    const companyUsers = await usersResponse.json()
                    console.log('🔍 Company users response:', companyUsers)
                    setUsers(companyUsers)
                    console.log('🔍 Set company users:', companyUsers.length)
                }
                
                let companyOrgs = []
                if (orgsResponse.ok) {
                    companyOrgs = await orgsResponse.json()
                    console.log('🔍 Company orgs response for company', companyId, ':', companyOrgs)
                    setOrganizations(companyOrgs)
                    console.log('🔍 Set company organizations:', companyOrgs.length)
                } else {
                    console.log('🔍 Failed to fetch organizations for company', companyId, 'Status:', orgsResponse.status)
                }
                
                if (personnelResponse.ok) {
                    const companyPersonnel = await personnelResponse.json()
                    console.log('🔍 Company personnel response:', companyPersonnel)
                    setPersonnel(companyPersonnel)
                    console.log('🔍 Set company personnel:', companyPersonnel.length)
                }
                
                // Fetch projects and events (these are linked through organizations)
                if (companyOrgs.length > 0) {
                    const orgIds = companyOrgs.map(org => org.id).join(',')
                    const [projectsResponse, eventsResponse] = await Promise.all([
                        fetch(`${API_CONFIG.baseUrl}/api/projects?organization_ids=${orgIds}`),
                        fetch(`${API_CONFIG.baseUrl}/api/events`)
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
            
            console.log('🔍 fetchCompanyData completed for company:', selectedCompany.name)
            
        } catch (error) {
            console.error('❌ Error fetching company data:', error)
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
    
    // Initial data load for super admin when companies are loaded
    useEffect(() => {
        if (user?.is_super_admin && companies.length > 0) {
            if (selectedCompanyId) {
                const selectedCompany = companies.find(c => c.id === parseInt(selectedCompanyId))
                if (selectedCompany) {
                    if (selectedCompany.is_super_admin) {
                        // Load Relay data
                        fetchUsers()
                        fetchPersonnel()
                    } else {
                        // Load company data
                        fetchCompanyData(selectedCompanyId)
                    }
                }
            }
        }
    }, [companies, user?.is_super_admin, selectedCompanyId])




    
    // SIMPLE COMPANY FILTERING LOGIC:
    // When viewing Company X, ONLY show data for Company X
    
    // Effect for super admin company switching
    useEffect(() => {
        if (user?.is_super_admin && selectedCompanyId && companies.length > 0) {
            const selectedCompany = companies.find(c => c.id === parseInt(selectedCompanyId))
            if (selectedCompany) {
                console.log('🔍 Super admin switching to company:', selectedCompany.name, 'ID:', selectedCompanyId)
                
                if (selectedCompany.is_super_admin) {
                    // Relay company - load Relay users and personnel
                    fetchUsers()
                    fetchPersonnel()
                } else {
                    // Other company - load ONLY that company's data
                    fetchCompanyData(selectedCompanyId)
                }
            }
        }
    }, [selectedCompanyId, user?.is_super_admin])
    
    // Effect for regular admin - always load their company's data
    useEffect(() => {
        if (!user?.is_super_admin && user?.company_id) {
            console.log('🔍 Regular admin loading company data for:', user.company_id)
            fetchCompanyData(user.company_id.toString())
        }
    }, [user?.company_id, user?.is_super_admin])
    
    // Reset forms when company changes (for super admin)
    useEffect(() => {
        if (user?.is_super_admin && selectedCompanyId) {
            // Reset all forms when switching companies to prevent cross-company data
            resetProjectForm()
            resetOrgForm()
            resetPersonnelForm()
            resetEventForm()
        }
    }, [selectedCompanyId, user?.is_super_admin])
    
    // Get current company info for conditional rendering
    const currentCompanyId = user?.is_super_admin ? selectedCompanyId : user?.company_id?.toString()
    const currentCompany = companies.find(c => c.id === parseInt(currentCompanyId || '0'))
    
    // For super admin, determine if currently viewing Relay company
    const isViewingRelay = user?.is_super_admin && (
        (selectedCompanyId && currentCompany?.is_super_admin) || 
        (!selectedCompanyId && companies.some(c => c.is_super_admin))
    )
    

    

    
    // State for forms
    const [showEventForm, setShowEventForm] = useState(false)
    const [showProjectForm, setShowProjectForm] = useState(false)
    const [showOrgForm, setShowOrgForm] = useState(false)
    const [showPersonnelForm, setShowPersonnelForm] = useState(false)
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [approvalLoading, setApprovalLoading] = useState(false)
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
    const [personnelForm, setPersonnelForm] = useState({ name: '', role: '', email: '', phone: '', availability: '', project_id: null })
    const [approvalForm, setApprovalForm] = useState({ role: 'Client', company_id: '', organization_id: null, create_personnel: false, temporary_password: 'temp123', phone: '', avatar: 'avatar1.png' })
    const [assignForm, setAssignForm] = useState({ selectedProjectIds: [] })
    
    // Company creation and management
    const [showCompanyForm, setShowCompanyForm] = useState(false)
    const [companyForm, setCompanyForm] = useState({ name: '' })
    const [expandedCompanyCards, setExpandedCompanyCards] = useState(new Set())
    const [editingCompany, setEditingCompany] = useState(null)
    const [editCompanyForm, setEditCompanyForm] = useState({ name: '' })
    
    // User attachment modal states
    const [showAttachPersonnelModal, setShowAttachPersonnelModal] = useState(false)
    const [selectedPersonnelForAttach, setSelectedPersonnelForAttach] = useState(null)
    const [selectedUserForAttach, setSelectedUserForAttach] = useState('')
    
    // Popup state for organization requirement
    const [showOrgRequiredPopup, setShowOrgRequiredPopup] = useState(false)
    
    // Company details modal
    const [showCompanyDetailsModal, setShowCompanyDetailsModal] = useState(false)
    const [selectedCompanyForDetails, setSelectedCompanyForDetails] = useState(null)
    const [companyDetails, setCompanyDetails] = useState({
        users: [],
        organizations: [],
        projects: []
    })
    
    // Company editing state
    const [isEditingCompany, setIsEditingCompany] = useState(false)
    const [editingCompanyData, setEditingCompanyData] = useState({
        name: ''
    })

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
        // Don't call fetchOrganizations() here - it conflicts with fetchCompanyData()
        // Organizations are fetched by fetchCompanyData() based on selected company
        fetchPersonnel()
        fetchAccessRequests()
        // For super admins, also fetch users for the selected company
        if (user?.is_super_admin && selectedCompanyId) {
            fetchUsers()
        } else if (!user?.is_super_admin) {
            fetchUsers()
            // Fetch company details for regular admins
            if (user?.company_id) {
                fetchUserCompany()
            }
        }
    }, [user?.is_super_admin, user?.company_id, selectedCompanyId])



    const fetchEvents = async () => {
        try {
            let url = `${API_CONFIG.baseUrl}/api/events`
            
            // For company admins, we need to get their projects first, then filter events
            if (user?.is_company_admin && user?.company_id) {
                // First get organizations for this company
                const orgResponse = await fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${user.company_id}`)
                if (orgResponse.ok) {
                    const companyOrgs = await orgResponse.json()
                    if (companyOrgs.length > 0) {
                        const orgIds = companyOrgs.map(org => org.id).join(',')
                        // Then get projects for these organizations
                        const projectsResponse = await fetch(`${API_CONFIG.baseUrl}/api/projects?organization_ids=${orgIds}`)
                        if (projectsResponse.ok) {
                            const companyProjects = await projectsResponse.json()
                            if (companyProjects.length > 0) {
                                // For now, we'll fetch all events and filter client-side since events API doesn't support project filtering yet
                                // TODO: Add project_ids parameter to events API
                                url = `${API_CONFIG.baseUrl}/api/events`
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
                    const orgResponse = await fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${user.company_id}`)
                    if (orgResponse.ok) {
                        const companyOrgs = await orgResponse.json()
                        if (companyOrgs.length > 0) {
                            const orgIds = companyOrgs.map(org => org.id).join(',')
                            const projectsResponse = await fetch(`${API_CONFIG.baseUrl}/api/projects?organization_ids=${orgIds}`)
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
            let url = `${API_CONFIG.baseUrl}/api/projects`
            
            // For non-super admins, we need to get their organizations first, then filter projects
            if (!user?.is_super_admin && user?.company_id) {
                // First get organizations for this company
                const orgResponse = await fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${user.company_id}`)
                if (orgResponse.ok) {
                    const companyOrgs = await orgResponse.json()
                    if (companyOrgs.length > 0) {
                        const orgIds = companyOrgs.map(org => org.id).join(',')
                        url = `${API_CONFIG.baseUrl}/api/projects?organization_ids=${orgIds}`
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
            let url = `${API_CONFIG.baseUrl}/api/organizations`
            
            if (user?.company_id) {
                // For company admins, filter by their company
                url = `${API_CONFIG.baseUrl}/api/organizations?company_id=${user.company_id}`
            } else if (user?.is_super_admin && selectedCompanyId) {
                // For super admins with a company selected, filter by that company
                url = `${API_CONFIG.baseUrl}/api/organizations?company_id=${selectedCompanyId}`
            }
            // For super admins with no company selected, get all organizations
            
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
            let url = `${API_CONFIG.baseUrl}/api/personnel`
            
            if (user?.company_id !== null && user?.company_id !== undefined) {
                // For company admins, filter by their company
                url = `${API_CONFIG.baseUrl}/api/personnel?company_id=${user.company_id}`
            } else if (user?.is_super_admin && selectedCompanyId) {
                // For super admins with a company selected, filter by that company
                url = `${API_CONFIG.baseUrl}/api/personnel?company_id=${selectedCompanyId}`
            }
            
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/access-requests`)
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
            let url = `${API_CONFIG.baseUrl}/api/users`
            
            if (user?.company_id !== null && user?.company_id !== undefined) {
                // For company admins, filter by their company
                url = `${API_CONFIG.baseUrl}/api/users?company_id=${user.company_id}`
            } else if (user?.is_super_admin && selectedCompanyId) {
                // For super admins with a company selected, filter by that company
                url = `${API_CONFIG.baseUrl}/api/users?company_id=${selectedCompanyId}`
            }
            
            const response = await fetch(url)
            if (response.ok) {
                const data = await response.json()
                setUsers(Array.isArray(data) ? data : [])
            } else {
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
            const url = editingItem ? `${API_CONFIG.baseUrl}/api/events/${editingItem.id}` : `${API_CONFIG.baseUrl}/api/events`
            
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

    const handleAddProjectClick = () => {
        // Check if organizations exist before allowing project creation
        if (!organizations || organizations.length === 0) {
            setShowOrgRequiredPopup(true)
            return
        }
        setShowProjectForm(true)
    }

    const handleProjectSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `${API_CONFIG.baseUrl}/api/projects/${editingItem.id}` : `${API_CONFIG.baseUrl}/api/projects`
            
            // Projects are linked to organizations, which are linked to companies
            // No need to set company_id directly on projects
            const submitData = { ...projectForm }
            console.log('🔍 Project creation - available organizations:', organizations)
            console.log('🔍 Project creation - selected organization_id:', projectForm.organization_id)
            console.log('🔍 Project creation - current company context:', user?.is_super_admin ? selectedCompanyId : user?.company_id)
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            })
            
            if (response.ok) {
                const result = await response.json()
                alert(editingItem ? 'Project updated successfully!' : 'Project created successfully!')
                
                // Refresh data for the current company context
                if (user?.is_super_admin && selectedCompanyId) {
                    const selectedCompany = companies.find(c => c.id === parseInt(selectedCompanyId))
                    if (selectedCompany && !selectedCompany.is_super_admin) {
                        // Refresh company data for non-Relay companies
                        fetchCompanyData(selectedCompanyId)
                    } else {
                        // For Relay company, just fetch projects
                        fetchProjects()
                    }
                } else if (!user?.is_super_admin && user?.company_id) {
                    // For regular admins, refresh their company data
                    fetchCompanyData(user.company_id.toString())
                } else {
                    // Fallback
                    fetchProjects()
                }
                
                resetProjectForm()
                setShowProjectForm(false)
                setEditingItem(null)
            } else {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to save project')
            }
        } catch (error) {
            console.error('Error saving project:', error)
            alert('Failed to save project')
        }
    }

    const handleOrgSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `${API_CONFIG.baseUrl}/api/organizations/${editingItem.id}` : `${API_CONFIG.baseUrl}/api/organizations`
            
            // Include company_id when creating organizations
            const submitData = { ...orgForm }
            if (!editingItem) {
                if (user?.is_super_admin && selectedCompanyId) {
                    // For super admins, use the currently selected company
                    submitData.company_id = parseInt(selectedCompanyId)
                    console.log('🔍 Organization creation - using selected company_id:', selectedCompanyId, '->', parseInt(selectedCompanyId))
                } else if (user?.company_id && !user?.is_super_admin) {
                    // For regular company admins, use their company_id
                    submitData.company_id = user.company_id
                    console.log('🔍 Organization creation - using user company_id:', user.company_id)
                } else {
                    console.log('🔍 Organization creation - NO company_id set! User:', user?.is_super_admin, 'selectedCompanyId:', selectedCompanyId)
                }
            }
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            })
            
            if (response.ok) {
                const result = await response.json()
                alert(editingItem ? 'Organization updated successfully!' : 'Organization created successfully!')
                
                // Refresh data for the current company context
                if (user?.is_super_admin && selectedCompanyId) {
                    const selectedCompany = companies.find(c => c.id === parseInt(selectedCompanyId))
                    if (selectedCompany && !selectedCompany.is_super_admin) {
                        // Refresh company data for non-Relay companies
                        fetchCompanyData(selectedCompanyId)
                    } else {
                        // For Relay company, just fetch organizations
                        fetchOrganizations()
                    }
                } else if (!user?.is_super_admin && user?.company_id) {
                    // For regular admins, refresh their company data
                    fetchCompanyData(user.company_id.toString())
                } else {
                    // Fallback
                    fetchOrganizations()
                }
                
                resetOrgForm()
                setShowOrgForm(false)
                setEditingItem(null)
            } else {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to save organization')
            }
        } catch (error) {
            console.error('Error saving organization:', error)
            alert('Failed to save organization')
        }
    }

    const handlePersonnelSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingItem ? 'PUT' : 'POST'
            const url = editingItem ? `${API_CONFIG.baseUrl}/api/personnel/${editingItem.id}` : `${API_CONFIG.baseUrl}/api/personnel`
            
            // Prepare the data to send, including company_id for company admins
            const submitData = { ...personnelForm }
            
            // Clean up form data - convert empty strings to null for optional fields
            if (submitData.project_id === '') {
                submitData.project_id = null
            }
            
            // Remove user_id if it's null or empty - personnel don't require user_id
            if (!submitData.user_id || submitData.user_id === '') {
                delete submitData.user_id
            }
            
            // SUPER ADMIN LOGIC: Always use selectedCompanyId, never their own company_id
            if (user?.is_super_admin && selectedCompanyId && !editingItem) {
                // For super admins, use the currently selected company
                submitData.company_id = parseInt(selectedCompanyId)
                console.log('🔍 Setting company_id for super admin:', selectedCompanyId, '->', parseInt(selectedCompanyId))
            } else if (user?.company_id && !user?.is_super_admin && !editingItem) {
                // For regular company admins, use their company_id
                submitData.company_id = user.company_id
                console.log('🔍 Setting company_id for regular admin:', user.company_id)
            } else {
                console.log('🔍 No company_id set. User:', user?.is_super_admin, 'selectedCompanyId:', selectedCompanyId, 'editingItem:', editingItem)
            }
            
            console.log('🔍 Final submitData:', submitData)
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            })
            
            if (response.ok) {
                const personnelData = await response.json()
                
                // Only do user attachment for new personnel (not editing)
                if (!editingItem && personnelForm.user_id && personnelData.id) {
                    try {
                        const attachResponse = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnelData.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: personnelForm.user_id })
                        })
                        
                        if (!attachResponse.ok) {
                            const attachData = await attachResponse.json()
                            alert(`Personnel created but failed to attach to user: ${attachData.error}`)
                        }
                    } catch (attachError) {
                        console.error('Error attaching personnel to user:', attachError)
                        alert('Personnel created but failed to attach to user')
                    }
                }
                
                // Refresh data for the current company context
                if (user?.is_super_admin && selectedCompanyId) {
                    const selectedCompany = companies.find(c => c.id === parseInt(selectedCompanyId))
                    if (selectedCompany && !selectedCompany.is_super_admin) {
                        // Refresh company data for non-Relay companies
                        fetchCompanyData(selectedCompanyId)
                    } else {
                        // For Relay company, just fetch personnel and users
                        await fetchPersonnel()
                        await fetchUsers()
                    }
                } else if (!user?.is_super_admin && user?.company_id) {
                    // For regular admins, refresh their company data
                    fetchCompanyData(user.company_id.toString())
                } else {
                    // Fallback
                    await fetchPersonnel()
                    await fetchUsers()
                }
                
                resetPersonnelForm()
                setEditingItem(null) // Clear editing state
                
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to save personnel')
            }
        } catch (error) {
            console.error('Error saving personnel:', error)
        }
    }

                const deleteItem = async (type, id) => {
            // Special confirmation for project deletion
            if (type === 'project') {
                const project = projects.find(p => p.id === id)
                const projectName = project ? project.name : 'this project'
                
                const confirmed = window.confirm(
                    `⚠️ WARNING: You are about to delete "${projectName}"\n\n` +
                    `This action will permanently remove:\n` +
                    `• All events in this project\n` +
                    `• All shot requests in this project\n` +
                    `• All personnel assignments to this project\n` +
                    `• All images and files associated with this project\n\n` +
                    `This action cannot be undone.\n\n` +
                    `Are you sure you want to continue?`
                )
                
                if (!confirmed) {
                    return
                }
            }
            
            // Special confirmation for organization deletion
            if (type === 'organization') {
                const organization = organizations.find(o => o.id === id)
                const orgName = organization ? organization.name : 'this organization'
                
                const confirmed = window.confirm(
                    `⚠️ WARNING: You are about to delete "${orgName}"\n\n` +
                    `This action will permanently remove:\n` +
                    `• All projects in this organization\n` +
                    `• All events in those projects\n` +
                    `• All shot requests in those projects\n` +
                    `• All personnel assignments to those projects\n` +
                    `• All images and files associated with those projects\n\n` +
                    `This action cannot be undone.\n\n` +
                    `Are you sure you want to continue?`
                )
                
                if (!confirmed) {
                    return
                }
            }
            
            // Special confirmation for user deletion
            if (type === 'user') {
                const user = users.find(u => u.id === id)
                const userName = user ? user.name : 'this user'
                
                const confirmed = window.confirm(
                    `⚠️ WARNING: You are about to delete "${userName}"\n\n` +
                    `This action will permanently remove:\n` +
                    `• The user account and all associated data\n` +
                    `• Any personnel records associated with this user\n` +
                    `• All user preferences and settings\n\n` +
                    `This action cannot be undone.\n\n` +
                    `Are you sure you want to continue?`
                )
                
                if (!confirmed) {
                    return
                }
            }
            
            // Special confirmation for personnel deletion
            if (type === 'personnel') {
                const personnelItem = personnel.find(p => p.id === id)
                const personnelName = personnelItem ? personnelItem.name : 'this personnel'
                
                const confirmed = window.confirm(
                    `⚠️ WARNING: You are about to delete "${personnelName}"\n\n` +
                    `This action will permanently remove:\n` +
                    `• The personnel record and all associated data\n` +
                    `• All project assignments for this personnel\n` +
                    `• All event assignments for this personnel\n\n` +
                    `This action cannot be undone.\n\n` +
                    `Are you sure you want to continue?`
                )
                
                if (!confirmed) {
                    return
                }
            }
            
            // Special confirmation for event deletion
            if (type === 'event') {
                const event = events.find(e => e.id === id)
                const eventName = event ? event.name : 'this event'
                
                const confirmed = window.confirm(
                    `⚠️ WARNING: You are about to delete "${eventName}"\n\n` +
                    `This action will permanently remove:\n` +
                    `• The event and all associated data\n` +
                    `• All shot requests for this event\n` +
                    `• All personnel assignments to this event\n` +
                    `• All images and files associated with this event\n\n` +
                    `This action cannot be undone.\n\n` +
                    `Are you sure you want to continue?`
                )
                
                if (!confirmed) {
                    return
                }
            }
        
        try {
            // Fix personnel endpoint - it's singular 'personnel' not 'personnels'
            let endpoint = `${API_CONFIG.baseUrl}/api/${type}s/${id}`
            if (type === 'personnel') {
                endpoint = `${API_CONFIG.baseUrl}/api/personnel/${id}`
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
            const formData = {
                name: item.name,
                role: item.role || '',
                email: item.email || '',
                phone: item.phone || '',
                availability: item.availability || '',
                project_id: item.project_ids && item.project_ids.length > 0 ? item.project_ids[0] : null
            }
            
            // Only include user_id if it exists
            if (item.user_id) {
                formData.user_id = item.user_id
            }
            
            setPersonnelForm(formData)
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/companies`, {
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/companies/${companyId}`, {
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/companies/${editingCompany.id}`, {
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
            } else {
                alert('Failed to update company')
            }
        } catch (error) {
            console.error('Error updating company:', error)
            alert('Error updating company')
        }
    }

    const openCompanyDetailsModal = async (company) => {
        setSelectedCompanyForDetails(company)
        setShowCompanyDetailsModal(true)
        setIsEditingCompany(false)
        setEditingCompanyData({ name: company.name })
        
        try {
            // Fetch company details
            const [usersResponse, orgsResponse, projectsResponse] = await Promise.all([
                fetch(`${API_CONFIG.baseUrl}/api/users?company_id=${company.id}`),
                fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${company.id}`),
                fetch(`${API_CONFIG.baseUrl}/api/projects?company_id=${company.id}`)
            ])
            
            if (usersResponse.ok && orgsResponse.ok && projectsResponse.ok) {
                const [users, orgs, projects] = await Promise.all([
                    usersResponse.json(),
                    orgsResponse.json(),
                    projectsResponse.json()
                ])
                
                setCompanyDetails({
                    users: users || [],
                    organizations: orgs || [],
                    projects: projects || []
                })
            }
        } catch (error) {
            console.error('Error fetching company details:', error)
            setCompanyDetails({ users: [], organizations: [], projects: [] })
        }
    }
    
    const handleEditCompany = async (e) => {
        e.preventDefault()
        if (!selectedCompanyForDetails || selectedCompanyForDetails.is_super_admin) return
        
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/companies/${selectedCompanyForDetails.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editingCompanyData)
            })
            
            if (response.ok) {
                // Update company in local state
                setCompanies(companies.map(c => 
                    c.id === selectedCompanyForDetails.id 
                        ? { ...c, name: editingCompanyData.name }
                        : c
                ))
                
                // Update selected company if it was the edited one
                if (selectedCompanyId === selectedCompanyForDetails.id.toString()) {
                    setSelectedCompanyId(selectedCompanyForDetails.id.toString())
                }
                
                // Update the selected company for details
                setSelectedCompanyForDetails({
                    ...selectedCompanyForDetails,
                    name: editingCompanyData.name
                })
                
                setIsEditingCompany(false)
                alert('Company updated successfully!')
            } else {
                const data = await response.json()
                alert(`Failed to update company: ${data.error || 'Unknown error'}`)
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
            
            const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${selectedPersonnel.id}`, {
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnelId}`, {
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
            const response = await fetch(`${API_CONFIG.baseUrl}/api/users/${userId}`, {
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

    const grantSuperAdminAccess = async (userId) => {
        if (!window.confirm('Are you sure you want to grant super admin access to this user? This will give them full system access.')) {
            return
        }

        try {
            // Find the Relay company
            const relayCompany = companies.find(c => c.is_super_admin)
            if (!relayCompany) {
                alert('Relay company not found. Cannot grant super admin access.')
                return
            }

            const response = await fetch(`${API_CONFIG.baseUrl}/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    company_id: relayCompany.id,
                    access: 'Admin',
                    organization_id: null
                })
            })

            if (response.ok) {
                fetchUsers()
                alert('Super admin access granted successfully')
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to grant super admin access')
            }
        } catch (error) {
            console.error('Error granting super admin access:', error)
            alert('Failed to grant super admin access')
        }
    }

    // Role-based CSS class for personnel cards
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
        const initialCompanyId = user?.is_super_admin ? selectedCompanyId : user?.company_id?.toString()
        
        setSelectedRequest(request)
        setApprovalForm({
            role: 'Client',
            company_id: initialCompanyId || '', // Auto-fill company for regular admins
            organization_id: null, // Reset organization selection
            create_personnel: false,
            temporary_password: 'temp123',
            phone: request.phone || '',  // Auto-populate from request
            avatar: 'avatar1.png'  // Default avatar selection
        })
        setShowApprovalModal(true)
        
        // If company is already selected, fetch organizations for it
        if (initialCompanyId) {
            fetchOrganizationsForCompany(initialCompanyId)
        }
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

        setApprovalLoading(true)
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/access-requests/${selectedRequest.id}`, {
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
                
                // Check if we should auto-link to existing personnel with same name
                if (data.user_id && !approvalForm.create_personnel) {
                    try {
                        // Fetch personnel to find matching name
                        const personnelResponse = await fetch(`${API_CONFIG.baseUrl}/api/personnel?company_id=${companyId}`)
                        if (personnelResponse.ok) {
                            const personnelList = await personnelResponse.json()
                            const matchingPersonnel = personnelList.find(p => 
                                p.name.toLowerCase() === selectedRequest.name.toLowerCase() && 
                                !p.user_id
                            )
                            
                            if (matchingPersonnel) {
                                // Auto-link the personnel to the new user
                                const linkResponse = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${matchingPersonnel.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ user_id: data.user_id })
                                })
                                
                                if (linkResponse.ok) {
                                    console.log(`Auto-linked personnel "${matchingPersonnel.name}" to new user`)
                                }
                            }
                        }
                    } catch (linkError) {
                        console.error('Error auto-linking personnel:', linkError)
                    }
                }
                
                fetchAccessRequests()
                // Always refresh users list since a new user was created
                fetchUsers()
                // Refresh personnel list if personnel was created or auto-linked
                fetchPersonnel()
                setShowApprovalModal(false)
                setSelectedRequest(null)
                // Reset approval form
                setApprovalForm({ role: 'Client', company_id: '', organization_id: null, create_personnel: false, temporary_password: 'temp123', phone: '', avatar: 'avatar1.png' })
                
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to approve request')
            }
        } catch (error) {
            console.error('Error approving request:', error)
            alert('Failed to approve request')
        } finally {
            setApprovalLoading(false)
        }
    }

    const handleAccessRequest = async (requestId, action) => {
        if (action === 'deny') {
            
            
            try {
                const response = await fetch(`${API_CONFIG.baseUrl}/api/access-requests/${requestId}`, {
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
        setPersonnelForm({ name: '', role: '', email: '', phone: '', availability: '', project_id: null })
        setShowPersonnelForm(false)
        setEditingItem(null)
    }

    // User attachment handlers
    const openAttachPersonnelModal = (personnel) => {
        setSelectedPersonnelForAttach(personnel)
        setSelectedUserForAttach('')
        setShowAttachPersonnelModal(true)
    }

    const closeAttachPersonnelModal = () => {
        setShowAttachPersonnelModal(false)
        setSelectedPersonnelForAttach(null)
        setSelectedUserForAttach('')
    }

    const handleAttachPersonnelToUser = async () => {
        if (!selectedPersonnelForAttach || !selectedUserForAttach) {
            alert('Please select a user to attach to this personnel')
            return
        }

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${selectedPersonnelForAttach.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: parseInt(selectedUserForAttach) })
            })

            if (response.ok) {
                await fetchPersonnel()
                await fetchUsers()
                closeAttachPersonnelModal()
                alert('Personnel successfully attached to user')
            } else {
                const errorData = await response.json()
                alert(`Failed to attach personnel to user: ${errorData.error}`)
            }
        } catch (error) {
            console.error('Error attaching personnel to user:', error)
            alert('Failed to attach personnel to user. Please try again.')
        }
    }

    const handleDetachPersonnelFromUser = async (personnelId) => {
        if (!window.confirm('Are you sure you want to detach this personnel from their user account?')) {
            return
        }

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/personnel/${personnelId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: null })
            })

            if (response.ok) {
                await fetchPersonnel()
                await fetchUsers()
                alert('Personnel successfully detached from user')
            } else {
                const errorData = await response.json()
                alert(`Failed to detach personnel from user: ${errorData.error}`)
            }
        } catch (error) {
            console.error('Error detaching personnel from user:', error)
            alert('Failed to detach personnel from user. Please try again.')
        }
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
                                    
                                    {/* Company Selection Dropdown - Only for Relay Super Admins */}
                                    {user?.is_super_admin && (
                                        <>
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
                                        </>
                                    )}
                                    
                                    {/* Company Info for Regular Admins */}
                                    {!user?.is_super_admin && userCompany && (
                                        <div className='company-info'>
                                            <p>You are viewing data for: <strong>{userCompany.name}</strong></p>
                                        </div>
                                    )}
                                    
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
                                        onClick={() => openCompanyDetailsModal(company)}
                                    >
                                        View Details
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
                                        <div className='personnel-form-grid'>
                                            <div className='form-row'>
                                                <div className='form-field'>
                                                    <label>Full Name *</label>
                                                    <input
                                                        type='text'
                                                        placeholder='Enter full name'
                                                        value={personnelForm.name}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, name: e.target.value})}
                                                        required
                                                    />
                                                </div>
                                                <div className='form-field'>
                                                    <label>Role *</label>
                                                    <select
                                                        value={personnelForm.role}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, role: e.target.value})}
                                                        required
                                                    >
                                                        <option value=''>Select a role</option>
                                                        <option value='Client'>Client</option>
                                                        <option value='Coordinator'>Coordinator</option>
                                                        <option value='Photographer'>Photographer</option>
                                                        <option value='Lead Photographer'>Lead Photographer</option>
                                                        <option value='Videographer'>Videographer</option>
                                                        <option value='Editor'>Editor</option>
                                                        <option value='Admin'>Admin</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field'>
                                                    <label>Email</label>
                                                    <input
                                                        type='email'
                                                        placeholder='Enter email address'
                                                        value={personnelForm.email}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, email: e.target.value})}
                                                    />
                                                </div>
                                                <div className='form-field'>
                                                    <label>Phone</label>
                                                    <input
                                                        type='tel'
                                                        placeholder='Enter phone number'
                                                        value={personnelForm.phone}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, phone: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field full-width'>
                                                    <label>Project Assignment (Optional)</label>
                                                    <select
                                                        value={personnelForm.project_id}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, project_id: e.target.value})}
                                                    >
                                                        <option value=''>No Project Assignment</option>
                                                        {projects.map(project => {
                                                            const org = organizations.find(o => o.id === project.organization_id)
                                                            return (
                                                                <option key={project.id} value={project.id}>
                                                                    {project.name} - {org?.name || 'Unknown Org'}
                                                                </option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field full-width'>
                                                    <label>Availability Notes</label>
                                                    <textarea
                                                        placeholder='Enter availability information, schedule preferences, or any other relevant notes'
                                                        value={personnelForm.availability}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, availability: e.target.value})}
                                                        rows='3'
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className='form-actions'>
                                                <button type='submit' className='save-btn'>
                                                    {editingItem ? 'Update' : 'Create'} Personnel
                                                </button>
                                                <button type='button' className='cancel-btn' onClick={resetPersonnelForm}>
                                                    Cancel
                                                </button>
                                            </div>
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
                                                {person.user_id && expandedPersonnelCards.has(person.id) && (
                                                    <div className='user-attachment'>
                                                        <strong>Attached to User:</strong> {users.find(u => u.id === person.user_id)?.name || 'Unknown User'}
                                                    </div>
                                                )}
                                                {!person.user_id && expandedPersonnelCards.has(person.id) && (
                                                    <div className='user-attachment'>
                                                        <strong>User Status:</strong> <span className='not-attached'>Not attached to any user</span>
                                                    </div>
                                                )}
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
                                                {person.user_id ? (
                                                    <button 
                                                        className='detach-btn'
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDetachPersonnelFromUser(person.id)
                                                        }}
                                                    >
                                                        Detach User
                                                    </button>
                                                ) : (
                                                    <button 
                                                        className='attach-btn'
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openAttachPersonnelModal(person)
                                                        }}
                                                    >
                                                        Attach User
                                                    </button>
                                                )}
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

                                {/* Personnel Edit Form - Show when editing */}
                                {showPersonnelForm && (
                                    <form className='settings-item-form' onSubmit={handlePersonnelSubmit}>
                                        <div className='personnel-form-grid'>
                                            <div className='form-row'>
                                                <div className='form-field'>
                                                    <label>Full Name *</label>
                                                    <input
                                                        type='text'
                                                        placeholder='Enter full name'
                                                        value={personnelForm.name}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, name: e.target.value})}
                                                        required
                                                    />
                                                </div>
                                                <div className='form-field'>
                                                    <label>Role *</label>
                                                    <select
                                                        value={personnelForm.role}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, role: e.target.value})}
                                                        required
                                                    >
                                                        <option value=''>Select a role</option>
                                                        <option value='Client'>Client</option>
                                                        <option value='Coordinator'>Coordinator</option>
                                                        <option value='Photographer'>Photographer</option>
                                                        <option value='Lead Photographer'>Lead Photographer</option>
                                                        <option value='Videographer'>Videographer</option>
                                                        <option value='Editor'>Editor</option>
                                                        <option value='Admin'>Admin</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field'>
                                                    <label>Email</label>
                                                    <input
                                                        type='email'
                                                        placeholder='Enter email address'
                                                        value={personnelForm.email}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, email: e.target.value})}
                                                    />
                                                </div>
                                                <div className='form-field'>
                                                    <label>Phone</label>
                                                    <input
                                                        type='tel'
                                                        placeholder='Enter phone number'
                                                        value={personnelForm.phone}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, phone: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field full-width'>
                                                    <label>Project Assignment (Optional)</label>
                                                    <select
                                                        value={personnelForm.project_id}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, project_id: e.target.value})}
                                                    >
                                                        <option value=''>No Project Assignment</option>
                                                        {projects.map(project => {
                                                            const org = organizations.find(o => o.id === project.organization_id)
                                                            return (
                                                                <option key={project.id} value={project.id}>
                                                                    {project.name} - {org?.name || 'Unknown Org'}
                                                                </option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field full-width'>
                                                    <label>Availability Notes</label>
                                                    <textarea
                                                        placeholder='Enter availability information, schedule preferences, or any other relevant notes'
                                                        value={personnelForm.availability}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, availability: e.target.value})}
                                                        rows='3'
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className='form-row'>
                                                <div className='form-field full-width'>
                                                    <label>Attach to User (Optional)</label>
                                                    <select
                                                        value={personnelForm.user_id || ''}
                                                        onChange={(e) => setPersonnelForm({...personnelForm, user_id: e.target.value || null})}
                                                    >
                                                        <option value=''>No User Attachment</option>
                                                        {users.filter(u => !u.personnel).map(user => (
                                                            <option key={user.id} value={user.id}>
                                                                {user.name} ({user.email})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className='form-actions'>
                                                <button type='submit' className='save-btn'>
                                                    {editingItem ? 'Update' : 'Create'} Personnel
                                                </button>
                                                <button type='button' className='cancel-btn' onClick={resetPersonnelForm}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                )}

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
                                                    {person.user_id && expandedPersonnelCards.has(person.id) && (
                                                        <div className='user-attachment'>
                                                            <strong>Attached to User:</strong> {users.find(u => u.id === person.user_id)?.name || 'Unknown User'}
                                                        </div>
                                                    )}
                                                    {!person.user_id && expandedPersonnelCards.has(person.id) && (
                                                        <div className='user-attachment'>
                                                            <strong>User Status:</strong> <span className='not-attached'>Not attached to any user</span>
                                                        </div>
                                                    )}
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
                                                    {person.user_id ? (
                                                        <button 
                                                            className='detach-btn'
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDetachPersonnelFromUser(person.id)
                                                            }}
                                                        >
                                                            Detach User
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            className='attach-btn'
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                openAttachPersonnelModal(person)
                                                            }}
                                                        >
                                                            Attach User
                                                        </button>
                                                    )}
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
                                        onClick={handleAddProjectClick}
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
                                            <div className='settings-form-field'>
                                                <label>Organization</label>
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

                                {/* Organization Required Popup */}
                                {showOrgRequiredPopup && (
                                    <div className='org-required-popup-overlay'>
                                        <div className='org-required-popup'>
                                            <div className='popup-header'>
                                                <h3>⚠️ Organization Required</h3>
                                            </div>
                                            <div className='popup-content'>
                                                <p>You need to create an organization before you can create a project.</p>
                                                <p>Projects are organized within organizations, so please add an organization first.</p>
                                            </div>
                                            <div className='popup-actions'>
                                                <button 
                                                    className='popup-btn primary'
                                                    onClick={() => {
                                                        setShowOrgRequiredPopup(false)
                                                        setShowOrgForm(true)
                                                    }}
                                                >
                                                    Add Organization
                                                </button>
                                                <button 
                                                    className='popup-btn secondary'
                                                    onClick={() => setShowOrgRequiredPopup(false)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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
                                                                                {user?.is_super_admin && !userItem.is_super_admin && (
                                                                                    <button 
                                                                                        className='grant-super-admin-btn'
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation()
                                                                                            grantSuperAdminAccess(userItem.id)
                                                                                        }}
                                                                                    >
                                                                                        Grant Super Admin
                                                                                    </button>
                                                                                )}
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

                        <div className='approval-modal-content'>
                            {/* Left Column - Request Details */}
                            <div className='approval-left-column'>
                                <div className='request-details-section'>
                                    <h3>Request Details</h3>
                                    <div className='request-details-grid'>
                                        <div className='detail-item'>
                                            <label>Name:</label>
                                            <span>{selectedRequest.name}</span>
                                        </div>
                                        <div className='detail-item'>
                                            <label>Email:</label>
                                            <span>{selectedRequest.email}</span>
                                        </div>
                                        <div className='detail-item'>
                                            <label>Organization:</label>
                                            <span>{selectedRequest.organization}</span>
                                        </div>
                                        {selectedRequest.phone && (
                                            <div className='detail-item'>
                                                <label>Phone:</label>
                                                <span>{selectedRequest.phone}</span>
                                            </div>
                                        )}
                                        {selectedRequest.requested_access && (
                                            <div className='detail-item'>
                                                <label>Requested Role:</label>
                                                <span>{selectedRequest.requested_access}</span>
                                            </div>
                                        )}
                                        <div className='detail-item'>
                                            <label>Submitted:</label>
                                            <span>{new Date(selectedRequest.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    
                                    {selectedRequest.message && (
                                        <div className='message-section'>
                                            <label>Message:</label>
                                            <div className='message-content'>{selectedRequest.message}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Approval Form */}
                            <div className='approval-right-column'>
                                <div className='approval-form-section'>
                                    <h3>Approval Settings</h3>
                                    
                                    <div className='form-field-group'>
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

                                    <div className='form-field-group'>
                                        <label>Company:</label>
                                        {user?.is_super_admin ? (
                                                                                    <select
                                            value={approvalForm.company_id}
                                            onChange={(e) => {
                                                const companyId = e.target.value
                                                setApprovalForm({...approvalForm, company_id: companyId, organization_id: null})
                                                // Fetch organizations for the selected company
                                                if (companyId) {
                                                    fetchOrganizationsForCompany(companyId)
                                                } else {
                                                    setOrganizations([])
                                                }
                                            }}
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
                                        <div className='form-field-group'>
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

                                    <div className='form-field-group'>
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

                                    <div className='form-field-group'>
                                        <label>Temporary Password:</label>
                                        <input
                                            type='text'
                                            value={approvalForm.temporary_password}
                                            onChange={(e) => setApprovalForm({...approvalForm, temporary_password: e.target.value})}
                                            placeholder='Temporary password for new user'
                                            required
                                        />
                                    </div>

                                    <div className='checkbox-field-group'>
                                        <input
                                            type='checkbox'
                                            id='create-personnel-checkbox'
                                            checked={approvalForm.create_personnel}
                                            onChange={(e) => setApprovalForm({...approvalForm, create_personnel: e.target.checked})}
                                        />
                                        <label htmlFor='create-personnel-checkbox'>
                                            Also create personnel record
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleApprovalSubmit}>
                            <div className='modal-actions'>
                                <button 
                                    type='submit' 
                                    className='approve-btn'
                                    disabled={approvalLoading}
                                >
                                    {approvalLoading ? 'Creating User...' : 'Approve & Create User'}
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

            {/* Company Details Modal */}
            {showCompanyDetailsModal && selectedCompanyForDetails && (
                <div className='settings-modal-overlay'>
                    <div className='modal-content company-details-modal'>
                        <div className='settings-modal-header'>
                            <h2>{selectedCompanyForDetails.name} - Company Details</h2>
                            <div className='modal-header-actions'>
                                {user?.is_super_admin && !selectedCompanyForDetails.is_super_admin && (
                                    <button 
                                        className='edit-company-btn'
                                        onClick={() => setIsEditingCompany(!isEditingCompany)}
                                    >
                                        {isEditingCompany ? 'Cancel Edit' : 'Edit Company'}
                                    </button>
                                )}
                                <button 
                                    className='settings-close-btn'
                                    onClick={() => setShowCompanyDetailsModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Company Edit Form */}
                        {isEditingCompany && user?.is_super_admin && !selectedCompanyForDetails.is_super_admin && (
                            <div className='company-edit-form'>
                                <h3>Edit Company</h3>
                                <form onSubmit={handleEditCompany}>
                                    <div className='form-group'>
                                        <label htmlFor='company-name'>Company Name:</label>
                                        <input
                                            type='text'
                                            id='company-name'
                                            value={editingCompanyData.name}
                                            onChange={(e) => setEditingCompanyData({ name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className='form-actions'>
                                        <button type='submit' className='save-btn'>
                                            Save Changes
                                        </button>
                                        <button 
                                            type='button' 
                                            className='cancel-btn'
                                            onClick={() => setIsEditingCompany(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className='company-details-content'>
                            <div className='company-details-grid'>
                                {/* Company Users Section */}
                                <div className='company-details-column'>
                                    <h3>Users ({companyDetails.users.length})</h3>
                                    <div className='company-details-list'>
                                        {companyDetails.users.length > 0 ? (
                                            companyDetails.users.map(user => (
                                                <div key={user.id} className='company-detail-item'>
                                                    <div className='user-info'>
                                                        <img 
                                                            src={`/images/avatars/${user.avatar || 'default-avatar.png'}`} 
                                                            alt='User avatar' 
                                                            className='user-avatar'
                                                        />
                                                        <div className='user-details'>
                                                            <h4>{user.name}</h4>
                                                            <p>{user.email}</p>
                                                            <span className='user-role'>{user.access}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className='no-data'>No users found for this company.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Company Organizations Section */}
                                <div className='company-details-column'>
                                    <h3>Organizations ({companyDetails.organizations.length})</h3>
                                    <div className='company-details-list'>
                                        {companyDetails.organizations.length > 0 ? (
                                            companyDetails.organizations.map(org => (
                                                <div key={org.id} className='company-detail-item'>
                                                    <div className='org-info'>
                                                        <h4>{org.name}</h4>
                                                        <p>{org.details || 'No details available'}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className='no-data'>No organizations found for this company.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Company Projects Section */}
                                <div className='company-details-column'>
                                    <h3>Projects ({companyDetails.projects.length})</h3>
                                    <div className='company-details-list'>
                                        {companyDetails.projects.length > 0 ? (
                                            companyDetails.projects.map(project => (
                                                <div key={project.id} className='company-detail-item'>
                                                    <div className='project-info'>
                                                        <h4>{project.name}</h4>
                                                        <p><strong>Location:</strong> {project.location}</p>
                                                        <p><strong>Duration:</strong> {project.start_date} to {project.end_date}</p>
                                                        {project.deliver_date && (
                                                            <p><strong>Delivery:</strong> {project.deliver_date}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className='no-data'>No projects found for this company.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='modal-actions'>
                            <button 
                                type='button' 
                                className='cancel-btn'
                                onClick={() => setShowCompanyDetailsModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Attach Personnel to User Modal */}
            {showAttachPersonnelModal && selectedPersonnelForAttach && (
                <div className='modal-overlay' onClick={closeAttachPersonnelModal}>
                    <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                        <div className='modal-header'>
                            <h2>Attach Personnel to User</h2>
                            <button className='modal-close' onClick={closeAttachPersonnelModal}>×</button>
                        </div>
                        <div className='modal-body'>
                            <div className='personnel-info'>
                                <h3>{selectedPersonnelForAttach.name}</h3>
                                <p><strong>Role:</strong> {selectedPersonnelForAttach.role}</p>
                                <p><strong>Email:</strong> {selectedPersonnelForAttach.email}</p>
                            </div>
                            
                            <div className='form-group'>
                                <label>Select User to Attach:</label>
                                <select
                                    value={selectedUserForAttach}
                                    onChange={(e) => setSelectedUserForAttach(e.target.value)}
                                    className='form-input'
                                >
                                    <option value=''>Select a user...</option>
                                    {users
                                        .filter(user => !user.personnel) // Only show users not already attached to personnel
                                        .map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.name} ({user.email}) - {user.access}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                            
                            {users.filter(user => !user.personnel).length === 0 && (
                                <div className='no-users-message'>
                                    <p>No available users to attach. All users are already attached to personnel.</p>
                                </div>
                            )}
                        </div>
                        <div className='modal-footer'>
                            <button 
                                className='modal-button attach-button'
                                onClick={handleAttachPersonnelToUser}
                                disabled={!selectedUserForAttach}
                            >
                                Attach Personnel
                            </button>
                            <button 
                                className='modal-button'
                                onClick={closeAttachPersonnelModal}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}