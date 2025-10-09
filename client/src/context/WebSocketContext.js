import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

const WebSocketContext = createContext()

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const MAX_RECONNECT_ATTEMPTS = 5

  // Get server URL from environment or default to localhost
  const getServerUrl = () => {
    // In production, use the backend URL from environment
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL
    }
    // In development, use the proxy or localhost
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:5001' 
      : window.location.origin
  }

  const connectSocket = useCallback(() => {
    const serverUrl = getServerUrl()
    console.log('🔌 Attempting to connect to WebSocket server:', serverUrl)

    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      timeout: 10000,
    })

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected successfully')
      setIsConnected(true)
      setConnectionError(null)
      reconnectAttemptsRef.current = 0
    })

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason)
      setIsConnected(false)
      
      // Don't show error for intentional disconnects
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        setConnectionError(`Disconnected: ${reason}`)
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error)
      setIsConnected(false)
      setConnectionError(`Connection error: ${error.message}`)
      reconnectAttemptsRef.current++
      
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Max reconnection attempts reached')
        setConnectionError('Failed to connect after multiple attempts. Please refresh the page.')
      }
    })

    newSocket.on('connection_response', (data) => {
      console.log('📨 Connection response:', data)
    })

    newSocket.on('pong', (data) => {
      console.log('🏓 Pong received:', data)
    })

    setSocket(newSocket)

    return newSocket
  }, [])

  useEffect(() => {
    const newSocket = connectSocket()

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        console.log('🔌 Disconnecting WebSocket')
        newSocket.disconnect()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connectSocket])

  // Ping server every 30 seconds to keep connection alive
  useEffect(() => {
    if (socket && isConnected) {
      const pingInterval = setInterval(() => {
        socket.emit('ping')
      }, 30000)

      return () => clearInterval(pingInterval)
    }
  }, [socket, isConnected])

  // Subscribe to specific events
  const subscribe = useCallback((eventName, callback) => {
    if (socket) {
      socket.on(eventName, callback)
      console.log(`👂 Subscribed to event: ${eventName}`)
      
      // Return unsubscribe function
      return () => {
        socket.off(eventName, callback)
        console.log(`🔇 Unsubscribed from event: ${eventName}`)
      }
    }
    return () => {}
  }, [socket])

  // Emit events to server
  const emit = useCallback((eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data)
      console.log(`📤 Emitted event: ${eventName}`, data)
    } else {
      console.warn(`⚠️ Cannot emit ${eventName}: Socket not connected`)
    }
  }, [socket, isConnected])

  const value = {
    socket,
    isConnected,
    connectionError,
    subscribe,
    emit,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

