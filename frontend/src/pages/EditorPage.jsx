import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProject, updateProject,
  getEndpoints, createEndpoint, updateEndpoint, deleteEndpoint,
  downloadJson, downloadYaml
} from '../services/api'
import ParameterBuilder from '../components/ParameterBuilder'
import ResponseBuilder from '../components/ResponseBuilder'
import SchemaBuilder from '../components/SchemaBuilder'
import SwaggerPreview from '../components/SwaggerPreview'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']
const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-800 border-green-300',
  POST: 'bg-blue-100 text-blue-800 border-blue-300',
  PUT: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  DELETE: 'bg-red-100 text-red-800 border-red-300',
  PATCH: 'bg-orange-100 text-orange-800 border-orange-300',
  OPTIONS: 'bg-purple-100 text-purple-800 border-purple-300',
  HEAD: 'bg-gray-100 text-gray-800 border-gray-300',
}

const EMPTY_ENDPOINT = {
  path: '', method: 'GET', summary: '', description: '',
  tags: '', operationId: '', deprecated: false,
  requestBodySchema: '', requestBodyRequired: false,
  parameters: [], responses: []
}

export default function EditorPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [endpoints, setEndpoints] = useState([])
  const [selectedEndpoint, setSelectedEndpoint] = useState(null)
  const [form, setForm] = useState(EMPTY_ENDPOINT)
  const [isNew, setIsNew] = useState(false)
  const [activeTab, setActiveTab] = useState('params')
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [showProjectEdit, setShowProjectEdit] = useState(false)
  const [projectForm, setProjectForm] = useState({})

  useEffect(() => {
    loadProject()
    loadEndpoints()
  }, [projectId])

  async function loadProject() {
    const p = await getProject(projectId)
    setProject(p)
    setProjectForm(p)
  }

  async function loadEndpoints() {
    const list = await getEndpoints(projectId)
    setEndpoints(list)
  }

  function selectEndpoint(ep) {
    setSelectedEndpoint(ep)
    setForm({ ...ep })
    setIsNew(false)
    setActiveTab('params')
  }

  function startNew() {
    setSelectedEndpoint(null)
    setForm({ ...EMPTY_ENDPOINT })
    setIsNew(true)
    setActiveTab('params')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.path || !form.method) return
    setSaving(true)
    try {
      let saved
      if (isNew) {
        saved = await createEndpoint(projectId, form)
        setEndpoints(prev => [...prev, saved])
      } else {
        saved = await updateEndpoint(projectId, selectedEndpoint.id, form)
        setEndpoints(prev => prev.map(ep => ep.id === saved.id ? saved : ep))
      }
      setSelectedEndpoint(saved)
      setForm({ ...saved })
      setIsNew(false)
      setPreviewKey(k => k + 1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ep) {
    if (!confirm(`Удалить ${ep.method} ${ep.path}?`)) return
    await deleteEndpoint(projectId, ep.id)
    setEndpoints(prev => prev.filter(e => e.id !== ep.id))
    if (selectedEndpoint?.id === ep.id) {
      setSelectedEndpoint(null)
      setForm({ ...EMPTY_ENDPOINT })
    }
    setPreviewKey(k => k + 1)
  }

  async function handleProjectSave() {
    const updated = await updateProject(projectId, projectForm)
    setProject(updated)
    setShowProjectEdit(false)
    setPreviewKey(k => k + 1)
  }

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(form.method)

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  )

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ===== LEFT PANEL: Endpoint list ===== */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-200">
          <Link to="/" className="text-xs text-gray-400 hover:text-blue-600 transition">← Все проекты</Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm truncate">{project.title}</h2>
              <span className="text-xs text-gray-400">v{project.version}</span>
            </div>
            <button onClick={() => setShowProjectEdit(true)} className="text-gray-400 hover:text-blue-600 text-sm" title="Редактировать проект">✏️</button>
          </div>
        </div>

        <div className="p-2">
          <button
            onClick={startNew}
            className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Новый эндпоинт
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {endpoints.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-6">Нет эндпоинтов</p>
          )}
          {endpoints.map(ep => (
            <div
              key={ep.id}
              onClick={() => selectEndpoint(ep)}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer mb-1 group transition ${
                selectedEndpoint?.id === ep.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.GET} flex-shrink-0`}>
                {ep.method}
              </span>
              <span className="text-xs font-mono text-gray-700 truncate flex-1">{ep.path}</span>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(ep) }}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs flex-shrink-0"
              >✕</button>
            </div>
          ))}
        </div>

        {/* Export buttons */}
        <div className="p-2 border-t border-gray-200 space-y-1">
          <p className="text-xs text-gray-400 px-1 mb-1">Экспорт спецификации</p>
          <button
            onClick={() => downloadJson(projectId)}
            className="w-full py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            JSON
          </button>
          <button
            onClick={() => downloadYaml(projectId)}
            className="w-full py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            YAML
          </button>
        </div>
      </aside>

      {/* ===== CENTER PANEL: Editor form ===== */}
      <main className="flex-1 overflow-y-auto bg-gray-50 border-r border-gray-200">
        {!selectedEndpoint && !isNew ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-5xl mb-4">🔧</div>
            <p>Выберите эндпоинт или создайте новый</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-5">
            {/* Method + Path */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                {isNew ? 'Новый эндпоинт' : 'Редактирование эндпоинта'}
              </h3>
              <div className="flex gap-2">
                <select
                  value={form.method}
                  onChange={e => setForm({ ...form, method: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  required
                  value={form.path}
                  onChange={e => setForm({ ...form, path: e.target.value })}
                  placeholder="/api/resource/{id}"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Summary / Description */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Summary</label>
                <input
                  value={form.summary || ''}
                  onChange={e => setForm({ ...form, summary: e.target.value })}
                  placeholder="Краткое описание"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (через запятую)</label>
                <input
                  value={form.tags || ''}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  placeholder="users, auth"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Подробное описание эндпоинта (поддерживается Markdown: - пункт 1, - пункт 2)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Operation ID</label>
                <input
                  value={form.operationId || ''}
                  onChange={e => setForm({ ...form, operationId: e.target.value })}
                  placeholder="getUser"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="deprecated"
                  checked={form.deprecated || false}
                  onChange={e => setForm({ ...form, deprecated: e.target.checked })}
                />
                <label htmlFor="deprecated" className="text-sm text-gray-600">Deprecated</label>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex gap-0">
                {['params', ...(hasBody ? ['body'] : []), 'responses'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      activeTab === tab
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'params' && `Параметры (${form.parameters?.length || 0})`}
                    {tab === 'body' && 'Request Body'}
                    {tab === 'responses' && `Ответы (${form.responses?.length || 0})`}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'params' && (
              <ParameterBuilder
                parameters={form.parameters || []}
                onChange={params => setForm({ ...form, parameters: params })}
              />
            )}

            {activeTab === 'body' && hasBody && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.requestBodyRequired || false}
                      onChange={e => setForm({ ...form, requestBodyRequired: e.target.checked })}
                    />
                    Required
                  </label>
                  <span className="text-xs text-gray-400">Content-Type: application/json</span>
                </div>
                <SchemaBuilder
                  value={form.requestBodySchema}
                  onChange={v => setForm({ ...form, requestBodySchema: v })}
                />
              </div>
            )}

            {activeTab === 'responses' && (
              <ResponseBuilder
                responses={form.responses || []}
                onChange={responses => setForm({ ...form, responses })}
              />
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : isNew ? 'Создать' : 'Сохранить'}
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedEndpoint)}
                  className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition text-sm"
                >
                  Удалить
                </button>
              )}
            </div>
          </form>
        )}
      </main>

      {/* ===== RIGHT PANEL: Swagger Preview ===== */}
      <aside className="w-[42%] flex flex-col bg-white overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">Предпросмотр спецификации</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <SwaggerPreview projectId={projectId} refreshKey={previewKey} />
        </div>
      </aside>

      {/* ===== Project Edit Modal ===== */}
      {showProjectEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-3">
            <h2 className="text-lg font-semibold">Настройки проекта</h2>
            {[
              ['Название', 'title', true],
              ['Описание', 'description'],
              ['Версия', 'version'],
              ['URL сервера', 'serverUrl'],
              ['Описание сервера', 'serverDescription'],
              ['Контакт email', 'contactEmail'],
              ['Лицензия', 'licenseName'],
            ].map(([label, key, req]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  value={projectForm[key] || ''}
                  onChange={e => setProjectForm({ ...projectForm, [key]: e.target.value })}
                  required={req}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={handleProjectSave}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                Сохранить
              </button>
              <button onClick={() => setShowProjectEdit(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
