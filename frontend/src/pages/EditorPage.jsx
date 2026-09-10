import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getProject, updateProject, renameProject, getSpecJson, getSpecJsonText, getSpecYamlText } from '../services/api'
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
  tags: [], operationId: '', deprecated: false, secured: false,
  requestBodySchema: '', requestBodyRequired: false,
  parameters: [], responses: []
}

const DEFAULT_PROJECT = {
  id: '', title: '', description: '', version: '1.0.0',
  termsOfService: '', contactEmail: '', licenseName: '',
  serverUrl: '', serverDescription: '', endpoints: []
}

/** Mirrors OpenApiService.toSlug — must stay in sync with the backend. */
function slugify(title) {
  if (!title || !title.trim()) return 'untitled-project'
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'project'
}

export default function EditorPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState(null)
  const [form, setForm] = useState(EMPTY_ENDPOINT)
  const [isNew, setIsNew] = useState(false)
  const [activeTab, setActiveTab] = useState('params')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [spec, setSpec] = useState(null)
  const [loadingSpec, setLoadingSpec] = useState(false)
  const [showProjectEdit, setShowProjectEdit] = useState(false)
  const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT)
  const [showComponents, setShowComponents] = useState(false)
  const [componentQuery, setComponentQuery] = useState('')
  const [previewWidth, setPreviewWidth] = useState(42)

  const debounceRef = useRef(null)

  useEffect(() => {
    loadProject()
  }, [projectId])

  useEffect(() => {
    if (!project) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      refreshPreview(project)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [project])

  async function loadProject() {
    const p = await getProject(projectId)
    setProject(p)
    setProjectForm(p)
  }

  async function refreshPreview(p) {
    setLoadingSpec(true)
    try {
      const json = await getSpecJson(p)
      setSpec(json)
    } catch (err) {
      console.error('Preview error', err)
    } finally {
      setLoadingSpec(false)
    }
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

  function updateEndpoints(updater) {
    setProject(prev => ({ ...prev, endpoints: updater(prev.endpoints || []) }))
  }

  function updateSchemas(schemas) {
    setProject(prev => ({ ...prev, schemas }))
  }

  /** Drag the splitter between the editor and the swagger preview to resize the preview panel. */
  function startPreviewDrag(e) {
    e.preventDefault()
    const onMove = ev => {
      const pct = Math.min(75, Math.max(15, (1 - ev.clientX / window.innerWidth) * 100))
      setPreviewWidth(pct)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /** Rewrite {"$ref": "#/components/schemas/<oldName>"} to the new name in a JSON string. */
  function rewriteRefs(json, oldName, newName) {
    if (!json || !json.includes('#/components/schemas/')) return json
    const walk = v => {
      if (Array.isArray(v)) return v.map(walk)
      if (v && typeof v === 'object') {
        const out = {}
        for (const [k, val] of Object.entries(v)) out[k] = walk(val)
        return out
      }
      return v === `#/components/schemas/${oldName}` ? `#/components/schemas/${newName}` : v
    }
    try { return JSON.stringify(walk(JSON.parse(json))) } catch { return json }
  }

  function renameComponent(oldName, newName) {
    newName = (newName || '').trim()
    if (!newName || newName === oldName) return
    if (project.schemas?.[newName]) {
      alert(`Компонент «${newName}» уже существует`)
      return
    }
    const schemas = {}
    for (const [k, v] of Object.entries(project.schemas || {})) {
      schemas[k === oldName ? newName : k] = rewriteRefs(v, oldName, newName)
    }
    const endpoints = (project.endpoints || []).map(ep => ({
      ...ep,
      requestBodySchema: rewriteRefs(ep.requestBodySchema, oldName, newName),
      responses: (ep.responses || []).map(r => ({
        ...r,
        bodySchema: rewriteRefs(r.bodySchema, oldName, newName)
      }))
    }))
    setProject(prev => ({ ...prev, schemas, endpoints }))
    // The open endpoint form holds a copy of its bodies — keep it in sync.
    setForm(prev => ({
      ...prev,
      requestBodySchema: rewriteRefs(prev.requestBodySchema, oldName, newName),
      responses: (prev.responses || []).map(r => ({
        ...r,
        bodySchema: rewriteRefs(r.bodySchema, oldName, newName)
      }))
    }))
  }

  async function handleSaveEndpoint(e) {
    e.preventDefault()
    if (!form.path || !form.method) return
    const endpoint = { ...form }
    if (isNew) {
      updateEndpoints(prev => [...prev, endpoint])
    } else {
      updateEndpoints(prev => prev.map(ep => ep === selectedEndpoint ? endpoint : ep))
    }
    setSelectedEndpoint(endpoint)
    setForm({ ...endpoint })
    setIsNew(false)
  }

  function handleDeleteEndpoint(ep) {
    if (!confirm(`Удалить ${ep.method} ${ep.path}?`)) return
    updateEndpoints(prev => prev.filter(e => e !== ep))
    if (selectedEndpoint === ep) {
      setSelectedEndpoint(null)
      setForm({ ...EMPTY_ENDPOINT })
      setIsNew(false)
    }
  }

  async function handleSaveProject() {
    const updated = { ...project, ...projectForm, endpoints: project.endpoints, schemas: project.schemas }
    setSaving(true)
    setSaveError(null)
    try {
      // Title -> slug must match the URL id; rename the GitLab folder when it doesn't.
      const newSlug = slugify(projectForm.title)
      if (newSlug !== projectId) {
        await renameProject(projectId, projectForm.title)
        await updateProject(newSlug, updated)
        navigate(`/project/${newSlug}`, { replace: true })
      } else {
        await updateProject(projectId, updated)
        setProject(updated)
      }
      setShowProjectEdit(false)
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Ошибка сохранения'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  async function downloadJson() {
    if (!project) return
    const blob = new Blob([await getSpecJsonText(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openapi.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadYaml() {
    if (!project) return
    const blob = new Blob([await getSpecYamlText(project)], { type: 'application/x-yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openapi.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(form.method)

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  )

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* LEFT PANEL */}
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
          <button onClick={startNew}
            className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
            + Новый эндпоинт
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {project.endpoints?.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-6">Нет эндпоинтов</p>
          )}
          {project.endpoints?.map((ep, idx) => (
            <div
              key={idx}
              onClick={() => selectEndpoint(ep)}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer mb-1 group transition ${
                selectedEndpoint === ep ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.GET} flex-shrink-0`}>
                {ep.method}
              </span>
              <span className="text-xs font-mono text-gray-700 truncate flex-1">{ep.path}</span>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteEndpoint(ep) }}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs flex-shrink-0"
              >✕</button>
            </div>
          ))}
        </div>

        {/* Save & Export */}
        <div className="p-2 border-t border-gray-200 space-y-1">
          <button onClick={handleSaveProject} disabled={saving}
            className="w-full py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить на GitLab'}
          </button>
          {saveError && (
            <p className="text-[10px] text-red-600 px-1 break-words">{saveError}</p>
          )}
          <p className="text-xs text-gray-400 px-1 mb-1 mt-2">Экспорт спецификации</p>
          <button onClick={downloadJson}
            className="w-full py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition">JSON</button>
          <button onClick={downloadYaml}
            className="w-full py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition">YAML</button>
          <button onClick={() => setShowComponents(true)}
            className="w-full py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Компоненты схем ({Object.keys(project.schemas || {}).length})
          </button>
        </div>
      </aside>

      {/* CENTER PANEL */}
      <main className="flex-1 overflow-y-auto bg-gray-50 border-r border-gray-200">
        {!selectedEndpoint && !isNew ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-5xl mb-4">🔧</div>
            <p>Выберите эндпоинт или создайте новый</p>
          </div>
        ) : (
          <form onSubmit={handleSaveEndpoint} className="p-5 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                {isNew ? 'Новый эндпоинт' : 'Редактирование эндпоинта'}
              </h3>
              <div className="flex gap-2">
                <select value={form.method}
                  onChange={e => setForm({ ...form, method: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input required value={form.path}
                  onChange={e => setForm({ ...form, path: e.target.value })}
                  placeholder="/api/resource/{id}"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Summary</label>
                <input value={form.summary || ''}
                  onChange={e => setForm({ ...form, summary: e.target.value })}
                  placeholder="Краткое описание"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (через запятую)</label>
                <input value={(form.tags || []).join(', ')}
                  onChange={e => setForm({ ...form, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="users, auth"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="Подробное описание эндпоинта"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Operation ID</label>
                <input value={form.operationId || ''}
                  onChange={e => setForm({ ...form, operationId: e.target.value })}
                  placeholder="getUser"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="deprecated" checked={form.deprecated || false}
                  onChange={e => setForm({ ...form, deprecated: e.target.checked })} />
                <label htmlFor="deprecated" className="text-sm text-gray-600">Deprecated</label>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="secured" checked={form.secured || false}
                  onChange={e => setForm({ ...form, secured: e.target.checked })} />
                <label htmlFor="secured" className="text-sm text-gray-600" title="operation.security: [{default: []}] — эндпоинт требует OAuth2-авторизацию">
                  Требует авторизации
                </label>
              </div>
            </div>

            <div className="border-b border-gray-200">
              <div className="flex gap-0">
                {['params', ...(hasBody ? ['body'] : []), 'responses'].map(tab => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {tab === 'params' && `Параметры (${form.parameters?.length || 0})`}
                    {tab === 'body' && 'Request Body'}
                    {tab === 'responses' && `Ответы (${form.responses?.length || 0})`}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'params' && (
              <ParameterBuilder parameters={form.parameters || []}
                onChange={params => setForm({ ...form, parameters: params })} />
            )}

            {activeTab === 'body' && hasBody && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.requestBodyRequired || false}
                      onChange={e => setForm({ ...form, requestBodyRequired: e.target.checked })} />
                    Required
                  </label>
                  <span className="text-xs text-gray-400">Content-Type: application/json</span>
                </div>
                <SchemaBuilder value={form.requestBodySchema}
                  onChange={v => setForm({ ...form, requestBodySchema: v })}
                  schemas={project.schemas}
                  onSchemasChange={updateSchemas} />
              </div>
            )}

            {activeTab === 'responses' && (
              <ResponseBuilder responses={form.responses || []}
                onChange={responses => setForm({ ...form, responses })}
                schemas={project.schemas}
                onSchemasChange={updateSchemas} />
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                {isNew ? 'Добавить' : 'Обновить'}
              </button>
              {!isNew && (
                <button type="button" onClick={() => handleDeleteEndpoint(selectedEndpoint)}
                  className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition text-sm">
                  Удалить
                </button>
              )}
            </div>
          </form>
        )}
      </main>

      {/* RIGHT PANEL */}
      <div className="w-1.5 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
        onMouseDown={startPreviewDrag}
        title="Потяните, чтобы изменить ширину предпросмотра" />
      <aside className="flex flex-col bg-white overflow-hidden flex-shrink-0" style={{ width: `${previewWidth}%` }}>
        <div className="px-4 py-2 border-b border-gray-200 flex-shrink-0 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Предпросмотр спецификации</span>
          {loadingSpec && <span className="text-xs text-gray-400">обновление...</span>}
        </div>
        <div className="flex-1 overflow-auto p-2">
          <SwaggerPreview spec={spec} onSelectEndpoint={(method, path) => {
            const ep = project.endpoints?.find(e => e.method === method && e.path === path)
            if (ep) selectEndpoint(ep)
          }} />
        </div>
      </aside>

      {/* Project Edit Modal */}
      {showProjectEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onMouseDown={() => setShowProjectEdit(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-3"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Настройки проекта</h2>
            {[
              ['Название', 'title', true],
              ['Описание', 'description'],
              ['Версия', 'version'],
              ['URL сервера', 'serverUrl'],
              ['Описание сервера', 'serverDescription'],
              ['Контакт email', 'contactEmail'],
              ['Лицензия', 'licenseName'],
              ['Terms of service URL', 'termsOfService'],
            ].map(([label, key, req]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={projectForm[key] || ''}
                  onChange={e => setProjectForm({ ...projectForm, [key]: e.target.value })}
                  required={req}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}

            <div className="border-t border-gray-200 pt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={projectForm.securityEnabled || false}
                  onChange={e => setProjectForm({ ...projectForm, securityEnabled: e.target.checked })} />
                OAuth2-авторизация (securitySchemes.default)
              </label>
              <p className="text-[11px] text-gray-400">
                Включает глобальный security для спецификации и кнопку Authorize в Swagger UI.
                На отдельных эндпоинтах требование можно переопределить чекбоксом «Требует авторизации».
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Authorization URL</label>
                <input value={projectForm.securityAuthorizationUrl || ''}
                  onChange={e => setProjectForm({ ...projectForm, securityAuthorizationUrl: e.target.value })}
                  placeholder="https://test.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <ScopesEditor scopes={projectForm.securityScopes}
                onChange={scopes => setProjectForm({ ...projectForm, securityScopes: scopes })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveProject}
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
      {/* Components Modal */}
      {showComponents && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onMouseDown={() => setShowComponents(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto space-y-3"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Компоненты схем ({Object.keys(project.schemas || {}).length})</h2>
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => {
                    const name = window.prompt('Имя нового компонента (например, ErrorResponse403):')
                    if (name === null) return
                    const key = name.trim()
                    if (!key) return
                    if (project.schemas?.[key]) {
                      alert(`Компонент «${key}» уже существует`)
                      return
                    }
                    updateSchemas({ ...(project.schemas || {}), [key]: '{"type":"object","properties":{}}' })
                  }}
                  className="text-sm text-blue-600 hover:underline">
                  + Создать компонент
                </button>
                <button onClick={() => setShowComponents(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            {Object.keys(project.schemas || {}).length === 0 && (
              <p className="text-sm text-gray-400">
                Компонентов пока нет. Они появляются при импорте спецификации со ссылками $ref
                или через «сохранить как компонент» в редакторе схемы.
              </p>
            )}
            {Object.keys(project.schemas || {}).length > 0 && (
              <input
                type="text"
                value={componentQuery}
                onChange={e => setComponentQuery(e.target.value)}
                placeholder="Поиск компонента…"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            )}
            {Object.entries(project.schemas || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .filter(([name]) => !componentQuery || name.toLowerCase().includes(componentQuery.toLowerCase()))
              .map(([name, json]) => (
              <ComponentRow key={name} name={name} json={json}
                schemas={project.schemas}
                onSchemasChange={updateSchemas}
                onRename={() => {
                  const newName = window.prompt('Новое имя компонента:', name)
                  if (newName !== null) renameComponent(name, newName)
                }}
                onDelete={() => {
                  if (!confirm(`Удалить компонент «${name}»? Эндпоинты со ссылкой на него сохранят $ref, но схема станет недоступна.`)) return
                  const next = { ...project.schemas }
                  delete next[name]
                  updateSchemas(next)
                }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Edits OAuth2 scopes as a list of name/description pairs (stored as a map). */
function ScopesEditor({ scopes, onChange }) {
  const pairs = Object.entries(scopes || {})

  function updatePair(idx, field, val) {
    const next = [...pairs]
    next[idx] = [field === 'name' ? val : next[idx][0], field === 'description' ? val : next[idx][1]]
    onChange(Object.fromEntries(next.filter(([n]) => n)))
  }

  function addPair() {
    let name = `scope${pairs.length + 1}`
    let i = pairs.length + 1
    while (name in (scopes || {})) name = `scope${++i}`
    onChange({ ...(scopes || {}), [name]: '' })
  }

  function removePair(name) {
    const next = { ...(scopes || {}) }
    delete next[name]
    onChange(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-600">Scopes</label>
        <button type="button" onClick={addPair}
          className="text-xs text-blue-600 hover:underline">+ добавить scope</button>
      </div>
      {pairs.length === 0 && <p className="text-[11px] text-gray-400">Нет scopes</p>}
      {pairs.map(([name, description], idx) => (
        <div key={idx} className="flex items-center gap-2 mb-1">
          <input value={name} onChange={e => updatePair(idx, 'name', e.target.value)}
            placeholder="accounts"
            className="w-32 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <input value={description} onChange={e => updatePair(idx, 'description', e.target.value)}
            placeholder="Описание scope"
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <button type="button" onClick={() => removePair(name)}
            className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
        </div>
      ))}
    </div>
  )
}

/** One component entry: name, short summary, expandable editor, rename, delete. */
function ComponentRow({ name, json, schemas, onSchemasChange, onRename, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  let summary = 'схема'
  try {
    const parsed = JSON.parse(json)
    if (parsed.$ref) summary = 'ссылка'
    else {
      const props = Object.keys(parsed.properties || {}).length
      summary = `${parsed.type || 'object'} · ${props} ${props === 1 ? 'поле' : 'полей'}`
    }
  } catch {}

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-gray-800 flex-1 truncate">{name}</span>
        <span className="text-xs text-gray-400 whitespace-nowrap">{summary}</span>
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap">
          {expanded ? 'Свернуть' : 'Открыть'}
        </button>
        <button type="button" onClick={onRename}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap">
          Переименовать
        </button>
        <button type="button" onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap">
          Удалить
        </button>
      </div>
      {expanded && (
        <div className="mt-3">
          <SchemaBuilder value={json}
            onChange={v => onSchemasChange({ ...schemas, [name]: v })}
            schemas={schemas}
            onSchemasChange={onSchemasChange} />
        </div>
      )}
    </div>
  )
}
