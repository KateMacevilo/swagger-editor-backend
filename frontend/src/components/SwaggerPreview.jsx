import { useEffect, useState } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { getSpecJson } from '../services/api'

export default function SwaggerPreview({ projectId, refreshKey }) {
  const [spec, setSpec] = useState(null)
  const [raw, setRaw] = useState('')
  const [tab, setTab] = useState('ui')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    getSpecJson(projectId)
      .then(data => {
        setSpec(data)
        setRaw(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId, refreshKey])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <div className="animate-spin text-3xl mr-3">⏳</div> Загрузка спецификации...
    </div>
  )

  if (!spec) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <p>Добавьте эндпоинт для предпросмотра</p>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-gray-200 mb-2">
        <button
          onClick={() => setTab('ui')}
          className={`px-4 py-2 text-sm font-medium transition ${tab === 'ui' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Swagger UI
        </button>
        <button
          onClick={() => setTab('json')}
          className={`px-4 py-2 text-sm font-medium transition ${tab === 'json' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          JSON
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'ui' ? (
          <div className="swagger-preview-wrapper">
            <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={-1} />
          </div>
        ) : (
          <pre className="text-xs font-mono bg-gray-900 text-green-300 p-4 rounded-lg overflow-auto h-full whitespace-pre-wrap">
            {raw}
          </pre>
        )}
      </div>
    </div>
  )
}
