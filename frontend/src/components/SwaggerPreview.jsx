import { useEffect, useState } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function SwaggerPreview({ spec, onSelectEndpoint }) {
  const [raw, setRaw] = useState('')
  const [tab, setTab] = useState('ui')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!spec) return
    setLoading(true)
    try {
      const rawText = typeof spec === 'string' ? spec : JSON.stringify(spec, null, 2)
      setRaw(rawText)
    } finally {
      // small delay to avoid flicker
      setTimeout(() => setLoading(false), 100)
    }
  }, [spec])

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

  // Delegate clicks inside swagger-ui: clicking an operation block selects
  // the same endpoint in the editor (same as clicking the left panel list).
  function handlePreviewClick(e) {
    if (!onSelectEndpoint) return
    const opblock = e.target.closest('.opblock')
    if (!opblock) return
    const methodEl = opblock.querySelector('.opblock-summary-method')
    const pathEl = opblock.querySelector('.opblock-summary-path')
    if (!methodEl || !pathEl) return
    const method = methodEl.textContent.trim()
    const path = pathEl.textContent.trim()
    if (method && path) onSelectEndpoint(method, path)
  }

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

      <div className="flex-1 overflow-auto" onClickCapture={handlePreviewClick}>
        {tab === 'ui' ? (
          <div className="swagger-preview-wrapper">
            {/* Hide the "Contact the developer" mailto link swagger-ui renders for info.contact.email */}
            <style>{`
              .swagger-preview-wrapper .swagger-ui .info a[href^="mailto:"] {
                display: none;
              }
            `}</style>
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
