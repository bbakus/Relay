// API Configuration Utility
// This centralizes all API endpoint configuration for easy deployment management

const getApiConfig = () => {
  // Development environment
  if (process.env.NODE_ENV === 'development') {
    return {
      baseUrl: 'http://localhost:5001',
      port: 5001
    }
  }
  
  // Production environment
  if (process.env.NODE_ENV === 'production') {
    return {
      baseUrl: process.env.REACT_APP_API_URL || 'https://your-backend-domain.com',
      port: process.env.REACT_APP_API_PORT || 5000
    }
  }
  
  // Fallback to development
  return {
    baseUrl: 'http://localhost:5001',
    port: 5001
  }
}

export const API_CONFIG = getApiConfig()

export const buildApiUrl = (endpoint) => {
  const { baseUrl, port } = API_CONFIG
  
  // If baseUrl already includes port, don't add it again
  if (baseUrl.includes(':')) {
    return `${baseUrl}${endpoint}`
  }
  
  // Add port if needed
  return `${baseUrl}:${port}${endpoint}`
}

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/login',
  ACCESS_REQUESTS: '/api/access-requests',
  
  // Core data
  COMPANIES: '/api/companies',
  ORGANIZATIONS: '/api/organizations',
  PROJECTS: '/api/projects',
  EVENTS: '/api/events',
  SHOT_REQUESTS: '/api/shot-requests',
  PERSONNEL: '/api/personnel',
  USERS: '/api/users',
  IMAGES: '/api/images',
  UPLOAD_IMAGES: '/api/upload-images',
  
  // Helper function to get full URL
  getUrl: (endpoint) => buildApiUrl(endpoint)
}
