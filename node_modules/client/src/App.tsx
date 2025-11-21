import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RoomProvider } from './contexts/RoomContext'
import { Navigation } from './components/Navigation'
import { Home } from './pages/Home'
import { Auth } from './pages/Auth'
import { Rooms } from './pages/Rooms'
import { RoomDetail } from './pages/RoomDetail'
import { Recording } from './pages/Recording'
import { MixLab } from './pages/MixLab'
import { Community } from './pages/Community'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          <div className="app">
            <Navigation />
            <main className="app-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/rooms/:roomId" element={<RoomDetail />} />
                <Route path="/recording" element={<Recording />} />
                <Route path="/mix" element={<MixLab />} />
                <Route path="/community" element={<Community />} />
              </Routes>
            </main>
            <footer className="app-footer">
              <p>BandSpace · Syncroom-inspired 데모. 데스크톱 / 모바일 확장을 준비 중입니다.</p>
            </footer>
          </div>
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
