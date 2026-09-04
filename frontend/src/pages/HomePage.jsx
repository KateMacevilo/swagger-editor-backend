import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject, deleteProject, importFile } from '../services/api'

const DEFAULT_PROJECT = {
  title: '', description: '', version: '1.0.0',
  serverUrl: 'http://localhost:8080', serverDescription: 'Development server',
  contactEmail: '', licenseName: ''
}

export default function HomePage() {
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(DEFAULT_PROJECT)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (err) {
      alert('Ошибка загрузки проектов из GitLab: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const p = await createProject(form)
      setProjects(prev => [...prev, p])
      setShowForm(false)
      setForm(DEFAULT_PROJECT)
      navigate(`/project/${p.id}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Удалить проект?')) return
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const p = await importFile(file)
      navigate(`/project/${p.id}`)
    } catch (err) {
      alert('Ошибка импорта: ' + (err.response?.data?.error || err.message))
    }
    e.target.value = ''
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои проекты</h1>
          <p className="text-gray-500 text-sm mt-1">Визуальный конструктор OpenAPI 3.0 спецификаций</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? 'Загрузка...' : 'Обновить из GitLab'}
          </button>
          <button
            onClick={() => fileRef.current.click()}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Импортировать JSON/YAML
          </button>
          <input ref={fileRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleImport} />
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            + Новый проект
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Новый проект</h2>
            <Field label="Название *" value={form.title} onChange={v => setForm({...form, title: v})} required />
            <Field label="Описание" value={form.description} onChange={v => setForm({...form, description: v})} />
            <Field label="Версия" value={form.version} onChange={v => setForm({...form, version: v})} placeholder="1.0.0" />
            <Field label="URL сервера" value={form.serverUrl} onChange={v => setForm({...form, serverUrl: v})} />
            <Field label="Описание сервера" value={form.serverDescription} onChange={v => setForm({...form, serverDescription: v})} />
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-lg">Нет проектов. Создайте первый!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/project/${p.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                  <span className="text-xs text-gray-400 font-mono">v{p.version}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="ml-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
              {p.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{p.description}</p>
              )}
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {p.endpointCount} эндпоинт{p.endpointCount === 1 ? '' : p.endpointCount < 5 ? 'а' : 'ов'}
                </span>
                {p.serverUrl && (
                  <span className="truncate">{p.serverUrl}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
