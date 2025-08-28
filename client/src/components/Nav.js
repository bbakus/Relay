import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from '../context/AuthContext'
import { formatDateDisplay } from '../utils/dateUtils'
import '../styles/nav.css'

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
        alert('Current password is required to change password')
        return
      }
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        alert('New passwords do not match')
        return
      }
      if (profileForm.newPassword.length < 6) {
        alert('New password must be at least 6 characters')
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

      const response = await fetch(`http://localhost:5001/api/users/${user.id}`, {
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
        alert(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    }
  }

  // Fetch functions
  const fetchOrganizations = async () => {
    try {
      // For super admin, filter by selected company. For regular users, get all their company's orgs.
      let url = 'http://localhost:5001/api/organizations'
      if (user?.is_super_admin && selectedCompanyId) {
        url = `http://localhost:5001/api/organizations?company_id=${selectedCompanyId}`
      } else if (user?.company_id && !user?.is_super_admin) {
        url = `http://localhost:5001/api/organizations?company_id=${user.company_id}`
      }
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchProjects = async () => {
    try {
      // For super admin, filter by selected company's organizations. For regular users, get their company's projects.
      let url = 'http://localhost:5001/api/projects'
      if (user?.is_super_admin && selectedCompanyId) {
        // First get organizations for the selected company, then filter projects
        const orgResponse = await fetch(`http://localhost:5001/api/organizations?company_id=${selectedCompanyId}`)
        if (orgResponse.ok) {
          const companyOrgs = await orgResponse.json()
          if (companyOrgs.length > 0) {
            const orgIds = companyOrgs.map(org => org.id).join(',')
            url = `http://localhost:5001/api/projects?organization_ids=${orgIds}`
          }
        }
      } else if (user?.company_id && !user?.is_super_admin) {
        // For regular users, get projects for their company's organizations
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
        setProjects(data)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/events')
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
      const response = await fetch('http://localhost:5001/api/companies')
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
      
      const response = await fetch(`http://localhost:5001/api/companies/${user.company_id}`)
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

  // Refetch organizations and projects when selected company changes (for super admin)
  useEffect(() => {
    if ((user?.is_super_admin && selectedCompanyId) || user?.access === 'Client') {
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
    return projects.filter(project => project.organization_id === parseInt(selectedOrganizationId))
  }, [projects, selectedOrganizationId])

  // Get available dates from selected project's duration (start_date to end_date)
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
    
    // Sort dates to ensure today appears first
    return dates.sort()
  }, [projects, selectedProjectId])

  // Map labels to icon image paths in public/images
  const iconMap = {
    Dashboard: '/images/icons/dashboard.png',
    Personnel: '/images/icons/personnel.png',
    Events: '/images/icons/event.png',
    Requests: '/images/icons/requests.png',
    Deliver: '/images/icons/deliver.png',
    Schedule: '/images/icons/schedule.png',
    Settings: '/images/icons/settings.png'
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
        { label: 'Deliver', to: `/${userId}/deliver` },
        { label: 'Settings', to: `/${userId}/settings`},
      ]
    }

    if (access === 'client') {
      return [...base,
        { label: 'Schedule', to:`/${userId}/schedule`},
        { label: 'Deliver', to: `/${userId}/deliver` },
      ]
    }

    if (access === 'coordinator') {
      return [...base,
        { label: 'Schedule', to:`/${userId}/schedule`},
        { label: 'Events', to: `/${userId}/events` },
        { label: 'Requests', to: `/${userId}/requests` },
        { label: 'Personnel', to: `/${userId}/personnel` },
        { label: 'Deliver', to: `/${userId}/deliver` },
      ]
    }

    if (access === 'photographer' || access === 'videographer') {
      return [...base,
        { label: 'Schedule', to:`/${userId}/schedule`},
      ]
    }

    if (access === 'editor') {
      return [...base,
        { label: 'Schedule', to: `/${userId}/schedule`},
        { label: 'Events', to: `/${userId}/events` },
        { label: 'Requests', to: `/${userId}/requests` },
        { label: 'Deliver', to: `/${userId}/deliver` },
      ]
    }

    return base
  }, [user, userId])

  const itemsWithIcons = items.map(i => ({ ...i, icon: iconMap[i.label] || '/images/logo.png' }))

  return (
    <>
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
                    <option value="">All Organizations</option>
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
            
            {/* Project Selection - For Client and Editor */}
            {(user?.access === 'Client' || user?.access === 'Editor') && (
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
            {itemsWithIcons.map((item) => (
              <Link key={item.to} to={item.to} className='nav-link'>
                <img src={item.icon} alt={item.label} className='nav-link-icon' />
                <span className='nav-link-label'>{item.label}</span>
              </Link>
            ))}
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