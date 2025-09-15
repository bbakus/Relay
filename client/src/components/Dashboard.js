import { useEffect, useMemo } from "react";
import { API_CONFIG } from '../utils/apiConfig'
import { useParams } from "react-router-dom";
import { Nav } from "./Nav";
import { NotificationCenter } from "./NotificationCenter";
import { useAuth } from '../context/AuthContext'
import { AdminDashboardView } from "./dashboards/admin-dashboard";
import { ClientDashboardView } from "./dashboards/client-dashboard";
import { PhotographerDashboardView } from "./dashboards/photographer-dashboard";
import { EditorDashboardView } from "./dashboards/editor-dashboard";
import { CoordinatorDashboardView } from "./dashboards/coordinator-dashboard";

// Simple role-to-component mapping
function AdminDashboard() { return (

        <div className='view-container'>
            <AdminDashboardView/>
        </div> 
)}
function ClientDashboard() { return (
    <div className='view-container'>
        <ClientDashboardView/>
    </div> 
)}
function CoordinatorDashboard() { return (
    <div className='view-container'>
        <CoordinatorDashboardView/>
    </div> 
) }
function PhotographerDashboard() { return (
      <div className='view-container'>
        <PhotographerDashboardView/>
      </div>
) }
function EditorDashboard() { return (
  <div className='view-container'>
    <EditorDashboardView/>
  </div>
) }

export const Dashboard = () => {
  const { userId } = useParams()
  const { user, setUser } = useAuth()

  useEffect(() => {
    // If user missing (refresh), fetch it
    if (!user && userId && userId !== 'undefined') {
      console.log('Fetching user data for userId:', userId)
      fetch(`${API_CONFIG.baseUrl}/api/users/${userId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch user')
          return res.json()
        })
        .then(data => {
          console.log('Fetched user data:', data)
          setUser(data)
        })
        .catch(err => {
          console.error('Error fetching user:', err)
          // If user fetch fails, redirect to login
          window.location.href = '/'
        })
    }
  }, [user, userId, setUser])

  const View = useMemo(() => {
    switch ((user?.access || '').toLowerCase()) {
      case 'admin': return AdminDashboard
      case 'client': return ClientDashboard
      case 'coordinator': return CoordinatorDashboard
      case 'photographer': return PhotographerDashboard
      case 'videographer': return PhotographerDashboard
      case 'editor': return EditorDashboard
      default: return () => <div>Loading...</div>
    }
  }, [user])

  return (
    <div className='page-container'>
      <Nav />
      {user?.access?.toLowerCase() !== 'client' && (
        <div className="notification-section">
          <div className="notification-container">
            <NotificationCenter />
          </div>
        </div>
      )}
      <View />
    </div>
  )
}