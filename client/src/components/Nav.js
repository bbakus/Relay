import { useMemo, useState, useEffect } from "react";
import { API_CONFIG } from '../utils/apiConfig'
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from '../context/AuthContext'
import { formatDateDisplay } from '../utils/dateUtils'
import '../styles/nav.css'
import '../styles/mobile-nav.css'

export const Nav = () => {
  const { user, setUser, selectedOrganizationId, selectedProjectId, selectedDate, selectedCompanyId, setGlobalCompany, setGlobalOrganization, setGlobalProject, setGlobalDate } = useAuth()
  const navigate = useNavigate()
  const { userId } = useParams()



  // State for organizations, projects, events, and companies
  const [organizations, setOrganizations] = useState([])
  const [projects, setProjects] = useState([])
  const [events, setEvents] = useState([])
  const [companies, setCompanies] = useState([])
  const [currentCompanyName, setCurrentCompanyName] = useState('RELAY')

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [profileForm, setProfileForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    avatar: user?.avatar || 'avatar1.png'
  })

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)

  // Available avatars list (same as Settings)
  const availableAvatars = [
    'avatar1.png', 'avatar2.png', 'avatar3.png', 'avatar4.png', 'avatar5.png',
    'avatar6.png', 'avatar7.png', 'avatar8.png', 'avatar9.png', 'avatar10.png',
    'avatar11.png', 'avatar12.png', 'avatar13.png', 'avatar14.png', 'avatar15.png'
  ]

  // Open profile modal
  const openProfileModal = () => {
    setProfileForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      avatar: user?.avatar || 'avatar1.png'
    })
    setShowProfileModal(true)
  }

  // Mobile menu functions
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const toggleMobileFilters = () => {
    setIsMobileFiltersOpen(!isMobileFiltersOpen)
  }

  const closeMobileFilters = () => {
    setIsMobileFiltersOpen(false)
  }

  // Handle logout
  const handleLogout = () => {
    setUser(null) // Clear user from context
    navigate('/') // Redirect to login page
  }

  // Handle profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    
    // Validate password fields if user wants to change password
    if (profileForm.newPassword || profileForm.confirmPassword) {
      if (!profileForm.currentPassword) {
        console.log('Current password is required to change password')
        return
      }
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        console.log('New passwords do not match')
        return
      }
      if (profileForm.newPassword.length < 6) {
        console.log('New password must be at least 6 characters')
        return
      }
    }

    try {
      const updateData = {
        avatar: profileForm.avatar
      }
      
      // Add password update if provided
      if (profileForm.newPassword) {
        updateData.password = profileForm.newPassword
      }

      const response = await fetch(`${API_CONFIG.baseUrl}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUser(updatedUser) // Update user in context
        setShowProfileModal(false)
        
      } else {
        const data = await response.json()
        console.log(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      console.log('Failed to update profile')
    }
  }

  // Fetch functions
  const fetchOrganizations = async () => {
    try {
      // For super admin, filter by selected company
      // For regular users, get organizations from ALL companies they have personnel in
      let url = `${API_CONFIG.baseUrl}/api/organizations`
      
      if (user?.is_super_admin && selectedCompanyId) {
        url = `${API_CONFIG.baseUrl}/api/organizations?company_id=${selectedCompanyId}`
      } else if (user?.id && !user?.is_super_admin) {
        // Get organizations from all companies this user has personnel records in
        // First fetch the user's personnel records to get company IDs
        const personnelResponse = await fetch(`${API_CONFIG.baseUrl}/api/personnel`)
        if (personnelResponse.ok) {
          const allPersonnel = await personnelResponse.json()
          const userPersonnel = allPersonnel.filter(p => p.user_id === user.id)
          const companyIds = [...new Set(userPersonnel.map(p => p.company_id).filter(Boolean))]
          
          if (companyIds.length > 0) {
            // Fetch organizations for all these companies
            const orgPromises = companyIds.map(companyId => 
              fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${companyId}`)
            )
            const orgResponses = await Promise.all(orgPromises)
            const orgDataPromises = orgResponses.filter(r => r.ok).map(r => r.json())
            const orgArrays = await Promise.all(orgDataPromises)
            const allOrgs = orgArrays.flat()
            setOrganizations(allOrgs)
            return
          }
        }
      }
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        console.log('Nav fetchOrganizations result:', data.length, 'organizations')
        setOrganizations(data)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchProjects = async () => {
    try {
      // For super admin, filter by selected company's organizations
      // For regular users, get ALL projects they have access to through personnel records
      let url = `${API_CONFIG.baseUrl}/api/projects`
      
      if (user?.is_super_admin && selectedCompanyId) {
        // First get organizations for the selected company, then filter projects
        const orgResponse = await fetch(`${API_CONFIG.baseUrl}/api/organizations?company_id=${selectedCompanyId}`)
        if (orgResponse.ok) {
          const companyOrgs = await orgResponse.json()
          if (companyOrgs.length > 0) {
            const orgIds = companyOrgs.map(org => org.id).join(',')
            url = `${API_CONFIG.baseUrl}/api/projects?organization_ids=${orgIds}`
          }
        }
      } else if (user?.id && !user?.is_super_admin) {
        // For regular users, get ALL projects they have access to through their personnel records
        // This allows photographers to see projects from multiple companies
        url = `${API_CONFIG.baseUrl}/api/projects?user_id=${user.id}`
      }
      
      console.log('Nav fetchProjects URL:', url)
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        console.log('Nav fetchProjects result:', data.length, 'projects')
        console.log('Projects:', data.map(p => ({ id: p.id, name: p.name, org_id: p.organization_id })))
        setProjects(data)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/events`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const fetchCompanies = async () => {
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

  const fetchCurrentCompanyName = async () => {
    try {
      if (!user?.company_id) return
      
      const response = await fetch(`${API_CONFIG.baseUrl}/api/companies/${user.company_id}`)
      if (response.ok) {
        const company = await response.json()
        setCurrentCompanyName(company.name)
      }
    } catch (error) {
      console.error('Error fetching current company name:', error)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchOrganizations()
      fetchProjects()
      fetchEvents()
      fetchCurrentCompanyName()
      // Only fetch companies for super admin
      if (user.is_super_admin) {
        fetchCompanies()
      }
    }
  }, [user])

  // Refetch organizations and projects when selected company changes (for super admin) or when access changes
  useEffect(() => {
    if ((user?.is_super_admin && selectedCompanyId) || user?.access === 'Client' || user?.access === 'Admin') {
      fetchOrganizations()
      fetchProjects()
    }
  }, [selectedCompanyId, user?.is_super_admin, user?.access])

  // Update company name when super admin changes selected company
  useEffect(() => {
    if (user?.is_super_admin && selectedCompanyId) {
      const selectedCompany = companies.find(company => company.id === parseInt(selectedCompanyId))
      if (selectedCompany) {
        setCurrentCompanyName(selectedCompany.name)
      }
    } else if (user?.is_super_admin && !selectedCompanyId) {
      // Super admin with no company selected shows "RELAY"
      setCurrentCompanyName('RELAY')
    } else if (user?.company_id && !user?.is_super_admin) {
      // For regular users, fetch their company name
      fetchCurrentCompanyName()
    }
  }, [selectedCompanyId, companies, user?.is_super_admin, user?.company_id])

  // Filter projects based on selected organization
  const filteredProjects = useMemo(() => {
    if (!selectedOrganizationId) return projects
    const filtered = projects.filter(project => project.organization_id === parseInt(selectedOrganizationId))
    console.log('Nav filteredProjects:', {
      selectedOrganizationId,
      totalProjects: projects.length,
      filteredCount: filtered.length,
      filtered: filtered.map(p => ({ id: p.id, name: p.name, org_id: p.organization_id }))
    })
    return filtered
  }, [projects, selectedOrganizationId])

  // Auto-select first project for photographers if none selected (only on initial load)
  useEffect(() => {
    const access = (user?.access || '').toLowerCase()
    const isPhotoVideoRole = access.includes('photographer') || access.includes('videographer')
    
    if (isPhotoVideoRole && projects.length > 0 && !selectedProjectId) {
      setGlobalProject(projects[0].id.toString())
    }
  }, [projects, selectedProjectId, user?.access, setGlobalProject])

  // Auto-select today's date if no date is selected
  useEffect(() => {
    if (!selectedDate) {
      // Use LOCAL timezone, not UTC
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      setGlobalDate(today)
    }
  }, [selectedDate, setGlobalDate])

  // Get available dates from selected project's duration (start_date to end_date)
  const availableDates = useMemo(() => {
    const dates = []
    
    // Always include today's date (USE LOCAL TIMEZONE)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const today = `${year}-${month}-${day}`
    dates.push(today)
    
    // Use selected project for all users
    let selectedProject
    if (selectedProjectId) {
      selectedProject = projects.find(p => p.id === parseInt(selectedProjectId))
    } else {
      return dates
    }
    
    if (!selectedProject || !selectedProject.start_date || !selectedProject.end_date) {
      return dates
    }
    
    // Generate all dates from start_date to end_date
    // SIMPLE FIX: Just use string manipulation to avoid ALL date object timezone issues
    const startDate = selectedProject.start_date // "2025-08-16"
    const endDate = selectedProject.end_date     // "2025-08-19"
    
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
    
    // Sort dates: today first, then chronologically
    const sortedDates = dates.sort((a, b) => {
      if (a === today) return -1
      if (b === today) return 1
      return a.localeCompare(b)
    })
    
    return sortedDates
  }, [projects, selectedProjectId])

  // Map labels to icon image paths in public/images
  const iconMap = {
    Dashboard: '/images/icons/dashboard.png',
    Personnel: '/images/icons/personnel.png',
    Events: '/images/icons/event.png',
    Requests: '/images/icons/requests.png',
    Deliver: '/images/icons/deliver.png',
    Schedule: '/images/icons/schedule.png',
    Settings: '/images/icons/settings.png',
    Map: '/images/icons/map.png'
  }

  const items = useMemo(() => {
    const base = [
      { label: 'Dashboard', to: `/${userId}/dashboard` },
    ]
    const access = (user?.access || '').toLowerCase()

    // If no user data yet (still loading), just show dashboard
    if (!user || !access) {
      return base
    }

    if (access === 'admin') {
      return [...base,
        { label: 'Personnel', to: `/${userId}/personnel` },
        { label: 'Schedule', to: `/${userId}/schedule`},
        { label: 'Events', to: `/${userId}/events` },
        { label: 'Requests', to: `/${userId}/requests` },
        { label: 'Deliver', to: 'https://g9eventphotography.pixieset.com/2025oraclenetsuitesuiteworldonsitedeliverables/' },
        { label: 'Map', to: `/${userId}/map` },
        { label: 'Settings', to: `/${userId}/settings`},
      ]
    }

    if (access === 'client') {
      return [...base,
        { label: 'Schedule', to:`/${userId}/schedule`},
        { label: 'Deliver', to: 'https://g9eventphotography.pixieset.com/2025oraclenetsuitesuiteworldonsitedeliverables/' },
        { label: 'Map', to: `/${userId}/map` },
      ]
    }

    if (access === 'coordinator') {
      return [...base,
        { label: 'Schedule', to:`/${userId}/schedule`},
        { label: 'Events', to: `/${userId}/events` },
        { label: 'Requests', to: `/${userId}/requests` },
        { label: 'Personnel', to: `/${userId}/personnel` },
        { label: 'Deliver', to: 'https://g9eventphotography.pixieset.com/2025oraclenetsuitesuiteworldonsitedeliverables/' },
        { label: 'Map', to: `/${userId}/map` },
      ]
    }

    if (access === 'photographer' || access === 'videographer') {
      return [...base,
        { label: 'Schedule', to:`/${userId}/schedule`},
        { label: 'Map', to: `/${userId}/map` },
      ]
    }

    if (access === 'editor') {
      return [...base,
        { label: 'Schedule', to: `/${userId}/schedule`},
        { label: 'Events', to: `/${userId}/events` },
        { label: 'Requests', to: `/${userId}/requests` },
        { label: 'Deliver', to: 'https://g9eventphotography.pixieset.com/2025oraclenetsuitesuiteworldonsitedeliverables/' },
        { label: 'Map', to: `/${userId}/map` },
      ]
    }

    return base
  }, [user, userId])

  const itemsWithIcons = items.map(i => ({ ...i, icon: iconMap[i.label] || '/images/logo.png' }))

  return (
    <>
      {/* Mobile Hamburger Menu Button */}
      <button 
        className={`mobile-menu-toggle ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        <div className="hamburger">
          <div className="hamburger-line"></div>
          <div className="hamburger-line"></div>
          <div className="hamburger-line"></div>
        </div>
      </button>

      {/* Mobile Filters Toggle Button */}
      <button 
        className={`mobile-filters-toggle ${isMobileFiltersOpen ? 'open' : ''}`}
        onClick={toggleMobileFilters}
        aria-label="Toggle mobile filters"
      >
        Filters
      </button>

      {/* Mobile Navigation Overlay */}
      <div 
        className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={closeMobileMenu}
      ></div>

      {/* Mobile Navigation Panel */}
      <div className={`mobile-nav-panel ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <h3 className="mobile-nav-title">{currentCompanyName}</h3>
          <button 
            className="mobile-nav-close"
            onClick={closeMobileMenu}
            aria-label="Close mobile menu"
          >
            ×
          </button>
        </div>
        
        <div className="mobile-nav-links">
          {itemsWithIcons.map((item) => {
            // Check if this is an external link (Deliver button)
            if (item.label === 'Deliver') {
              return (
                <a 
                  key={item.label} 
                  href="https://damionhamiltonphotographer.shootproof.com/gallery/AutoDeskAU2025" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className='mobile-nav-link'
                  onClick={closeMobileMenu}
                >
                  <img src={item.icon} alt={item.label} className='mobile-nav-link-icon' />
                  <span className='mobile-nav-link-label'>{item.label}</span>
                </a>
              )
            }
            
            // Regular internal navigation
            return (
              <Link 
                key={item.to} 
                to={item.to} 
                className='mobile-nav-link'
                onClick={closeMobileMenu}
              >
                <img src={item.icon} alt={item.label} className='mobile-nav-link-icon' />
                <span className='mobile-nav-link-label'>{item.label}</span>
              </Link>
            )
          })}
        </div>
        
        <div className="mobile-nav-footer">
          <div className="mobile-nav-user">{user?.access}</div>
        </div>
      </div>

      {/* Mobile Filters Panel */}
      <div className={`mobile-filters-panel ${isMobileFiltersOpen ? 'open' : ''}`}>
        <div className="mobile-filter-groups">
          {/* Company Filter - Only for Super Admin */}
          {user?.is_super_admin && (
            <div className='mobile-filter-group'>
              <label>Company:</label>
              <select 
                value={selectedCompanyId || ''} 
                onChange={(e) => setGlobalCompany(e.target.value)}
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Organization/Project Selection - For Admin, Editor, and Coordinator */}
          {(user?.access === 'Admin' || user?.access === 'Editor' || user?.access === 'Coordinator') && (
            <>
              <div className='mobile-filter-group'>
                <label>Organization:</label>
                <select 
                  value={selectedOrganizationId} 
                  onChange={(e) => setGlobalOrganization(e.target.value)}
                >
                  <option value="">{organizations.length === 0 ? 'No Organizations - Go to Settings to create one' : 'All Organizations'}</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className='mobile-filter-group'>
                <label>Project:</label>
                <select 
                  value={selectedProjectId} 
                  onChange={(e) => setGlobalProject(e.target.value)}
                  disabled={!selectedOrganizationId}
                >
                  <option value="">Auto-Select Project</option>
                  {filteredProjects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          {/* Project Selection - For Client, Editor, Photographer, and Videographer */}
          {(user?.access === 'Client' || user?.access === 'Editor' || user?.access === 'Photographer' || user?.access === 'Videographer') && (
            <div className='mobile-filter-group'>
              <label>Project:</label>
              <select 
                value={selectedProjectId} 
                onChange={(e) => setGlobalProject(e.target.value)}
              >
                <option value="">Select Project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Date Filter - Available to ALL user roles */}
          <div className='mobile-filter-group'>
            <label>Date:</label>
            <select 
              value={selectedDate} 
              onChange={(e) => setGlobalDate(e.target.value)}
            >
              <option value="">All Dates</option>
              {availableDates.map(date => {
                const displayDate = formatDateDisplay(date)
                return (
                  <option key={date} value={date}>
                    {displayDate}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      <header className='app-header'>
        <div className='app-header-left'>
          {/* <img className='app-header-logo' src='/images/logo/logo5.png' alt='Relay logo'/> */}
          <h1>{currentCompanyName}</h1>
        </div>
        
        {/* Global Filters - Visible based on user access and not on Settings page */}
        {!window.location.pathname.includes('/settings') && (
          <div className='global-filters'>
            {/* Company Filter - Only for Super Admin */}
            {user?.is_super_admin && (
              <div className='filter-group'>
                <label>Company:</label>
                <select 
                  value={selectedCompanyId || ''} 
                  onChange={(e) => setGlobalCompany(e.target.value)}
                >
                  <option value="">All Companies</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Organization/Project Selection - For Admin, Editor, and Coordinator */}
            {(user?.access === 'Admin' || user?.access === 'Editor' || user?.access === 'Coordinator') && (
              <>
                <div className='filter-group'>
                  <label>Organization:</label>
                  <select 
                    value={selectedOrganizationId} 
                    onChange={(e) => setGlobalOrganization(e.target.value)}
                  >
                    <option value="">{organizations.length === 0 ? 'No Organizations - Go to Settings to create one' : 'All Organizations'}</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
                <div className='filter-group'>
                  <label>Project:</label>
                  <select 
                    value={selectedProjectId} 
                    onChange={(e) => setGlobalProject(e.target.value)}
                    disabled={!selectedOrganizationId}
                  >
                    <option value="">Auto-Select Project</option>
                    {filteredProjects.map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            
            {/* Project Selection - For Client, Editor, Photographer, and Videographer */}
            {(user?.access === 'Client' || user?.access === 'Editor' || user?.access === 'Photographer' || user?.access === 'Videographer') && (
              <div className='filter-group'>
                <label>Project:</label>
                <select 
                  value={selectedProjectId} 
                  onChange={(e) => setGlobalProject(e.target.value)}
                >
                  <option value="">Select Project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Date Filter - Available to ALL user roles */}
            <div className='filter-group'>
              <label>Date:</label>
              <select 
                value={selectedDate} 
                onChange={(e) => setGlobalDate(e.target.value)}
              >
                <option value="">All Dates</option>
                {availableDates.map(date => {
                  const displayDate = formatDateDisplay(date)
                  return (
                    <option key={date} value={date}>
                      {displayDate}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
        )}
        
        <div className='app-header-right'>
          <div className='user-info' onClick={openProfileModal}>
            <h3>{user?.name || ''}</h3>
            <img 
              className='header-avatar' 
              src={user?.avatar ? `/images/avatars/${user.avatar}` : '/images/avatars/avatar1.png'} 
              alt=''
            />
          </div>
          <button className='logout-btn' onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <nav className='nav'>
        <div className='nav-inner'>
          <div className='nav-links'>
            {itemsWithIcons.map((item) => {
              // Check if this is an external link (Deliver button)
              if (item.label === 'Deliver') {
                return (
                  <a 
                    key={item.label} 
                    href="https://damionhamiltonphotographer.shootproof.com/gallery/AutoDeskAU2025" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className='nav-link'
                  >
                    <img src={item.icon} alt={item.label} className='nav-link-icon' />
                    <span className='nav-link-label'>{item.label}</span>
                  </a>
                )
              }
              
              // Regular internal navigation
              return (
                <Link key={item.to} to={item.to} className='nav-link'>
                  <img src={item.icon} alt={item.label} className='nav-link-icon' />
                  <span className='nav-link-label'>{item.label}</span>
                </Link>
              )
            })}
          </div>
          <div className='nav-right'>
            <span className='nav-user'>{user?.access}</span>
          </div>
        </div>
      </nav>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className='modal-overlay' onClick={() => setShowProfileModal(false)}>
          <div className='profile-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <h2>Edit Profile</h2>
              <button 
                className='close-btn'
                onClick={() => setShowProfileModal(false)}
              >
                ×
              </button>
            </div>

            <form className='profile-form' onSubmit={handleProfileSubmit}>
              <div className='form-section'>
                <h3>Avatar</h3>
                <div className='avatar-selection-wrapper'>
                  <img 
                    className='selected-avatar-preview' 
                    src={`/images/avatars/${profileForm.avatar}`} 
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

              <div className='form-section'>
                <h3>Change Password</h3>
                <div className='form-field'>
                  <label>Current Password:</label>
                  <input
                    type='password'
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm({...profileForm, currentPassword: e.target.value})}
                    placeholder='Enter current password'
                  />
                </div>
                <div className='form-field'>
                  <label>New Password:</label>
                  <input
                    type='password'
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm({...profileForm, newPassword: e.target.value})}
                    placeholder='Enter new password (optional)'
                  />
                </div>
                <div className='form-field'>
                  <label>Confirm New Password:</label>
                  <input
                    type='password'
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                    placeholder='Confirm new password'
                  />
                </div>
              </div>

              <div className='modal-actions'>
                <button type='submit' className='save-btn'>
                  Save Changes
                </button>
                <button 
                  type='button' 
                  className='cancel-btn'
                  onClick={() => setShowProfileModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type='button' 
                  className='logout-btn'
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className='modal-overlay' onClick={() => setShowAvatarModal(false)}>
          <div className='avatar-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <h2>Choose Avatar</h2>
              <button 
                className='close-btn'
                onClick={() => setShowAvatarModal(false)}
              >
                ×
              </button>
            </div>
            <div className='avatar-grid'>
              {availableAvatars.map(avatar => (
                <div 
                  key={avatar}
                  className={`avatar-option ${profileForm.avatar === avatar ? 'selected' : ''}`}
                  onClick={() => {
                    setProfileForm({...profileForm, avatar})
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
    </>
  )
}