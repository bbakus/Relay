
import './App.css';
import './styles/mobile-general.css';
import { BrowserRouter, Routes, Route} from 'react-router-dom'
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { Settings } from './components/Settings';
import { ScheduleWrapper } from './components/ScheduleWrapper';
import { Personnel } from './components/Personnel';
import { Events } from './components/Events';
import { ShotRequest } from './components/ShotRequest';
import { Deliver } from './components/Deliver';
import { Map } from './components/Map';
import { Ingest } from './components/Ingest';
import { useEffect } from 'react';



function App() {
  // Fix Safari viewport height issues
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set initial value
    setVH();

    // Update on resize
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  return (
    <div className="App">
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Routes>
                <Route path='/' element={<Login />}/>
                <Route path='/:userId/dashboard' element={<Dashboard />}/>
                <Route path='/:userId/settings' element={<Settings/>}/>
                <Route path='/:userId/schedule' element={<ScheduleWrapper/>}/>
                <Route path='/:userId/personnel' element={<Personnel/>}/>
                <Route path='/:userId/events' element={<Events/>}/>
                <Route path='/:userId/requests' element={<ShotRequest/>}/>
                <Route path='/:userId/ingest' element={<Ingest/>}/>
                <Route path='/:userId/deliver' element={<Deliver/>}/>
                <Route path='/:userId/map' element={<Map/>}/>
              </Routes>
            </BrowserRouter>
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
