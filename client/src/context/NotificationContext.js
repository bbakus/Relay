import React, { createContext, useContext, useState, useEffect } from 'react'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [lastFetchTime, setLastFetchTime] = useState(Date.now())
  const [newItems, setNewItems] = useState({
    events: new Set(),
    shotRequests: new Set()
  })

  // Add notification
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...notification
    }
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)) // Keep last 50 notifications
  }

  // Mark item as new
  const markAsNew = (type, id) => {
    setNewItems(prev => ({
      ...prev,
      [type]: new Set([...prev[type], id])
    }))
  }

  // Mark item as seen (remove from new)
  const markAsSeen = (type, id) => {
    setNewItems(prev => {
      const newSet = new Set(prev[type])
      newSet.delete(id)
      return {
        ...prev,
        [type]: newSet
      }
    })
  }

  // Check if item is new
  const isNew = (type, id) => {
    return newItems[type].has(id)
  }

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([])
    setNewItems({})
    setLastFetchTime(Date.now())
  }

  // Remove notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // Auto-remove new badges after 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setNewItems(prev => ({
        events: new Set(),
        shotRequests: new Set()
      }))
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  const value = {
    notifications,
    newItems,
    addNotification,
    markAsNew,
    markAsSeen,
    isNew,
    clearNotifications,
    removeNotification,
    lastFetchTime,
    setLastFetchTime
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
