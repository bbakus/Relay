import React, { useState } from 'react'
import { useNotifications } from '../context/NotificationContext'
import '../styles/notification-center.css'

export const NotificationCenter = () => {
  const { notifications, clearNotifications, removeNotification } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'event':
        return '📅'
      case 'shotRequest':
        return '📸'
      case 'processPoint':
        return '⚙️'
      case 'delivery':
        return '✅'
      default:
        return '🔔'
    }
  }

  return (
    <div className="notification-center">
      <button 
        className="notification-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔔
        {notifications.length > 0 && (
          <span className="notification-badge">{notifications.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {notifications.length > 0 && (
              <button 
                className="clear-all-btn"
                onClick={clearNotifications}
              >
                Clear All
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <p>No new notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div key={notification.id} className="notification-item">
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {formatTime(notification.timestamp)}
                    </div>
                  </div>
                  <button 
                    className="notification-close"
                    onClick={() => removeNotification(notification.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
