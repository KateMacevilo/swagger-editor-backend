import SchemaBuilder from './SchemaBuilder'

const COMMON_CODES = ['200', '201', '204', '400', '401', '403', '404', '409', '422', '500']
const CODE_LABELS  = { '200': 'OK', '201': 'Created', '204': 'No Content', '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found', '409': 'Conflict', '422': 'Unprocessable', '500': 'Server Error' }

export default function ResponseBuilder({ responses, onChange }) {
  function add() {
    onChange([...responses, { statusCode: '200', description: 'OK', bodySchema: '' }])
  }

  function update(idx, field, val) {
    onChange(responses.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  function remove(idx) {
    onChange(responses.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {responses.length === 0 && (
        <p className="text-sm text-gray-400 mb-2">Нет ответов. По умолчанию вернётся 200.</p>
      )}

      {responses.map((resp, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 mb-3 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <select
              value={resp.statusCode}
              onChange={e => update(idx, 'statusCode', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {COMMON_CODES.map(code => (
                <option key={code} value={code}>{code} {CODE_LABELS[code]}</option>
              ))}
            </select>
            <StatusBadge code={resp.statusCode} />
            <input
              value={resp.description || ''}
              onChange={e => update(idx, 'description', e.target.value)}
              placeholder="Описание ответа"
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
          </div>

          {resp.statusCode !== '204' && (
            <SchemaBuilder
              value={resp.bodySchema}
              onChange={v => update(idx, 'bodySchema', v)}
            />
          )}
        </div>
      ))}

      <button
        onClick={add}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Добавить ответ
      </button>
    </div>
  )
}

function StatusBadge({ code }) {
  const n = parseInt(code)
  const cls = n >= 500 ? 'bg-red-100 text-red-700'
    : n >= 400 ? 'bg-yellow-100 text-yellow-700'
    : n >= 300 ? 'bg-purple-100 text-purple-700'
    : 'bg-green-100 text-green-700'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{code}</span>
  )
}
