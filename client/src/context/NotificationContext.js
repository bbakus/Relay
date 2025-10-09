import React, { createContext, useContext, useState, useEffect } from 'react'
import { useWebSocket } from './WebSocketContext'

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
  const { subscribe, isConnected } = useWebSocket()

  // Clear all notifications on mount
  useEffect(() => {
    setNotifications([])
    setNewItems({
      events: new Set(),
      shotRequests: new Set()
    })
  }, [])

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
    setNewItems({
      events: new Set(),
      shotRequests: new Set()
    })
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

  // Listen for WebSocket notifications
  useEffect(() => {
    if (!isConnected) return

    // Listen for general notifications
    const unsubNotification = subscribe('notification', (data) => {
      console.log('📨 Received notification:', data)
      if (data.notification) {
        addNotification(data.notification)
      }
    })

    // Listen for event updates
    const unsubEventUpdate = subscribe('event_update', (data) => {
      console.log('📨 Received event update:', data)
      const { action, event } = data
      
      if (action === 'create' && event) {
        addNotification({
          type: 'event',
          title: 'New Event Created',
          message: `${event.name || 'Untitled Event'} has been created`
        })
        markAsNew('events', event.id)
      } else if (action === 'update' && event) {
        // Optionally notify on updates
        console.log('Event updated:', event.id)
      }
    })

    // Listen for shot request updates
    const unsubShotRequestUpdate = subscribe('shot_request_update', (data) => {
      console.log('📨 Received shot request update:', data)
      const { action, shotRequest } = data
      
      if (action === 'create' && shotRequest) {
        addNotification({
          type: 'shotRequest',
          title: 'New Shot Request',
          message: `Shot request for ${shotRequest.event_name || 'event'} has been submitted`
        })
        markAsNew('shotRequests', shotRequest.id)
      } else if (action === 'update' && shotRequest) {
        // Optionally notify on updates
        console.log('Shot request updated:', shotRequest.id)
      }
    })

    // Cleanup subscriptions
    return () => {
      unsubNotification()
      unsubEventUpdate()
      unsubShotRequestUpdate()
    }
  }, [isConnected, subscribe])

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
