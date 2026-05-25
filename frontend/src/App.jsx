import { Navigate, Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'
import ColumnMapperPage from './pages/ColumnMapperPage'
import CaseDefinitionPage from './pages/CaseDefinitionPage'
import DataReadyPage from './pages/DataReadyPage'
import DashboardPage from './pages/DashboardPage'
import SharePage from './pages/SharePage'

function ProtectedRoute({ children }) {
  const { session } = useAuth()
  if (session === undefined) {
    // Still loading session — show nothing (or a spinner)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!session) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth"         element={<AuthPage />} />
      <Route path="/share/:token" element={<SharePage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/mapping/:projectId"         element={<ProtectedRoute><ColumnMapperPage /></ProtectedRoute>} />
      <Route path="/data-ready/:projectId"      element={<ProtectedRoute><DataReadyPage /></ProtectedRoute>} />
      <Route path="/case-definition/:projectId" element={<ProtectedRoute><CaseDefinitionPage /></ProtectedRoute>} />
      <Route path="/dashboard/:projectId"       element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/project/:id"                element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
    </Routes>
  )
}
