import { createContext, useContext, useState, useEffect } from 'react'

import { API_CONFIG } from '../utils/apiConfig'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Initialize from localStorage on mount
    const savedUser = localStorage.getItem('relay_user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  // Global company selection (for Super Admin)
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    const saved = localStorage.getItem('relay_selected_company')
    return saved || ''
  })

  // Global organization and project selection
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => {
    const saved = localStorage.getItem('relay_selected_organization')
    return saved || ''
  })
  
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const saved = localStorage.getItem('relay_selected_project')
    return saved || ''
  })

  // Global date filter
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem('relay_selected_date')
    return saved || ''
  })

  // Enhanced setUser that also saves to localStorage
  const setUserWithPersistence = (userData) => {
    setUser(userData)
    if (userData) {
      localStorage.setItem('relay_user', JSON.stringify(userData))
    } else {
      localStorage.removeItem('relay_user')
    }
  }

  // Functions to update global selections with persistence
  const setGlobalCompany = (companyId) => {
    setSelectedCompanyId(companyId)
    if (companyId) {
      localStorage.setItem('relay_selected_company', companyId)
    } else {
      localStorage.removeItem('relay_selected_company')
    }
    // Reset organization and project when company changes
    setGlobalOrganization('')
    setGlobalProject('')
  }

  const setGlobalOrganization = (orgId) => {
    setSelectedOrganizationId(orgId)
    if (orgId) {
      localStorage.setItem('relay_selected_organization', orgId)
    } else {
      localStorage.removeItem('relay_selected_organization')
    }
    // Reset project when organization changes
    setGlobalProject('')
  }

  const setGlobalProject = (projectId) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      localStorage.setItem('relay_selected_project', projectId)
      // Set date to today when a new project is selected
      const today = new Date().toISOString().split('T')[0]
      setSelectedDate(today)
      localStorage.setItem('relay_selected_date', today)
    } else {
      localStorage.removeItem('relay_selected_project')
      // Clear date when no project is selected
      setGlobalDate('')
    }
  }

  const setGlobalDate = (date) => {
    setSelectedDate(date)
    if (date) {
      localStorage.setItem('relay_selected_date', date)
    } else {
      localStorage.removeItem('relay_selected_date')
    }
  }

  // Auto-select project for non-admin users
  useEffect(() => {
    const autoSelectProjectForNonAdmin = async () => {
      if (user && user.access !== 'Admin' && !selectedProjectId) {
        try {
          // Fetch projects accessible to this user through their personnel records
          const url = user.id 
            ? `${API_CONFIG.baseUrl}/api/projects?user_id=${user.id}`
            : `${API_CONFIG.baseUrl}/api/projects`
            
          const response = await fetch(url)
          if (response.ok) {
            const projects = await response.json()
            // Find current project or the first available project
            const currentProject = projects.find(p => p.current_project) || projects[0]
            if (currentProject) {
              setSelectedProjectId(currentProject.id.toString())
              localStorage.setItem('relay_selected_project', currentProject.id.toString())
              
              // Also set organization for this project
              setSelectedOrganizationId(currentProject.organization_id.toString())
              localStorage.setItem('relay_selected_organization', currentProject.organization_id.toString())
              
              // Set default date to today if no date is currently selected
              if (!selectedDate) {
                const today = new Date().toISOString().split('T')[0]
                setSelectedDate(today)
                localStorage.setItem('relay_selected_date', today)
              }
            }
          }
        } catch (error) {
          console.error('Error auto-selecting project for non-admin user:', error)
        }
      }
    }

    autoSelectProjectForNonAdmin()
  }, [user, selectedProjectId, selectedDate])

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser: setUserWithPersistence,
      selectedCompanyId,
      selectedOrganizationId,
      selectedProjectId,
      selectedDate,
      setGlobalCompany,
      setGlobalOrganization,
      setGlobalProject,
      setGlobalDate
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
