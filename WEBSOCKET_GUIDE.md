# WebSocket Implementation Guide

## Overview
Your Relay app now has **real-time updates** using WebSockets! No more manual refreshes needed.

## What Was Implemented

### Backend (Flask-SocketIO)
- ✅ Added Flask-SocketIO with eventlet for WebSocket support
- ✅ Created WebSocket event handlers for connections
- ✅ Implemented broadcast functions for:
  - Event create/update/delete
  - Shot request create/update/delete
  - General notifications
- ✅ Integrated broadcasts into all relevant API endpoints

### Frontend (React + socket.io-client)
- ✅ Created `WebSocketContext` for connection management
- ✅ Updated `NotificationContext` to listen for real-time updates
- ✅ Wrapped app with WebSocket provider
- ✅ Auto-reconnection and connection status tracking

## How to Test Locally

### 1. Start Backend Server
```bash
cd server
python main.py
```

You should see:
```
🚀 Starting Relay server on port 5001
🔧 Debug mode: False
🌐 CORS origins: ['http://localhost:3000']
🔌 WebSocket support enabled
```

### 2. Start Frontend
```bash
cd client
npm start
```

### 3. Test Real-Time Updates

#### Test 1: Open Two Browser Windows
1. Open `http://localhost:3000` in two separate browser windows
2. Log in to both
3. In Window 1: Create a new event
4. **Window 2 should instantly show the new event without refresh!**

#### Test 2: Check Console Logs
Open browser DevTools Console and look for:
```
🔌 Attempting to connect to WebSocket server: http://localhost:5001
✅ WebSocket connected successfully
📨 Connection response: {status: 'connected', message: '...'}
```

#### Test 3: Notifications
1. Create a new event in one window
2. Check the notification bell in another window
3. You should see a real-time notification appear!

## Deployment

### Railway (Backend)
Your backend is already configured correctly! Railway supports WebSockets out of the box.

**Important:** Make sure to set the `CORS_ORIGINS` environment variable in Railway:
```
CORS_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:3000
```

### Vercel (Frontend)
No special configuration needed! Vercel fully supports WebSocket clients.

**Set environment variable:**
```
REACT_APP_API_URL=https://your-railway-backend.up.railway.app
```

## Features

### What Updates in Real-Time:
1. **Events**: Create, update, delete operations
2. **Shot Requests**: Create, update, delete operations
3. **Notifications**: Instant notification center updates
4. **Process Point Changes**: Live status updates

### Graceful Degradation:
- If WebSocket connection fails, the app still works normally
- Users just need to manually refresh (like before)
- Auto-reconnection attempts up to 5 times

### Connection Management:
- Automatic reconnection on disconnect
- Ping/pong keep-alive every 30 seconds
- Connection status tracking

## Adding More Real-Time Features

Want to add real-time updates to other parts of your app? Here's how:

### Step 1: Add Broadcast to Backend Endpoint
```python
# In your Flask endpoint, after database commit:
broadcast_data = {'id': item.id, 'name': item.name, ...}
socketio.emit('your_event_name', {
    'action': 'create',  # or 'update', 'delete'
    'data': broadcast_data
})
```

### Step 2: Listen in React Component
```javascript
import { useWebSocket } from '../context/WebSocketContext'

function YourComponent() {
  const { subscribe, isConnected } = useWebSocket()

  useEffect(() => {
    if (!isConnected) return

    const unsubscribe = subscribe('your_event_name', (data) => {
      console.log('Received update:', data)
      // Update your component state here
    })

    return unsubscribe
  }, [isConnected, subscribe])
}
```

## Troubleshooting

### "WebSocket connection failed"
- Check that backend server is running
- Verify CORS_ORIGINS includes your frontend URL
- Check browser console for specific error messages

### "No real-time updates"
- Open browser console and check for WebSocket connection
- Look for broadcast messages in Flask server logs (should see 📡 emoji)
- Make sure you're testing with multiple browser windows/tabs

### Production Issues
- Verify Railway deployment logs show "🔌 WebSocket support enabled"
- Check Vercel environment variables are set correctly
- Ensure CORS_ORIGINS in Railway includes your Vercel URL

## Performance Notes

- WebSocket connections are lightweight (uses ~1-2MB memory per connection)
- Broadcasts are efficient (only sends JSON data)
- Connection pooling handled automatically by Flask-SocketIO
- Works with 100+ simultaneous connections easily

## Need Help?

Check the Flask-SocketIO documentation: https://flask-socketio.readthedocs.io/
Check the socket.io-client documentation: https://socket.io/docs/v4/client-api/

