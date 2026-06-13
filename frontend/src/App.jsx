import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-blue-600 flex items-center gap-2">
            <span className="text-2xl">⚡</span> OpenAPI Visual Editor
          </Link>
          <span className="text-xs text-gray-400">OpenAPI 3.0.0</span>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:projectId" element={<EditorPage />} />
      </Routes>
    </div>
  )
}
