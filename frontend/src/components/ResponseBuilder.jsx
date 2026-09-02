import SchemaBuilder from './SchemaBuilder'

const COMMON_CODES = [
  '100', '101', '102',
  '200', '201', '202', '203', '204', '205', '206', '207', '208', '226',
  '300', '301', '302', '303', '304', '307', '308',
  '400', '401', '402', '403', '404', '405', '406', '407', '408', '409', '410',
  '411', '412', '413', '414', '415', '416', '417', '418', '422', '423', '424',
  '425', '426', '428', '429', '431', '451',
  '500', '501', '502', '503', '504', '505', '506', '507', '508', '510', '511'
]
const CODE_LABELS = {
  '100': 'Continue', '101': 'Switching Protocols', '102': 'Processing',
  '200': 'OK', '201': 'Created', '202': 'Accepted', '203': 'Non-Authoritative Info',
  '204': 'No Content', '205': 'Reset Content', '206': 'Partial Content',
  '207': 'Multi-Status', '208': 'Already Reported', '226': 'IM Used',
  '300': 'Multiple Choices', '301': 'Moved Permanently', '302': 'Found',
  '303': 'See Other', '304': 'Not Modified', '307': 'Temporary Redirect',
  '308': 'Permanent Redirect',
  '400': 'Bad Request', '401': 'Unauthorized', '402': 'Payment Required',
  '403': 'Forbidden', '404': 'Not Found', '405': 'Method Not Allowed',
  '406': 'Not Acceptable', '407': 'Proxy Auth Required', '408': 'Request Timeout',
  '409': 'Conflict', '410': 'Gone', '411': 'Length Required',
  '412': 'Precondition Failed', '413': 'Payload Too Large', '414': 'URI Too Long',
  '415': 'Unsupported Media Type', '416': 'Range Not Satisfiable',
  '417': 'Expectation Failed', '418': "I'm a teapot", '422': 'Unprocessable Entity',
  '423': 'Locked', '424': 'Failed Dependency', '425': 'Too Early',
  '426': 'Upgrade Required', '428': 'Precondition Required', '429': 'Too Many Requests',
  '431': 'Request Header Fields Too Large', '451': 'Unavailable For Legal Reasons',
  '500': 'Internal Server Error', '501': 'Not Implemented', '502': 'Bad Gateway',
  '503': 'Service Unavailable', '504': 'Gateway Timeout',
  '505': 'HTTP Version Not Supported', '506': 'Variant Also Negotiates',
  '507': 'Insufficient Storage', '508': 'Loop Detected',
  '510': 'Not Extended', '511': 'Network Authentication Required'
}

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
              {!COMMON_CODES.includes(resp.statusCode) && resp.statusCode && (
                <option value={resp.statusCode}>{resp.statusCode} (custom)</option>
              )}
              {COMMON_CODES.map(code => (
                <option key={code} value={code}>{code} {CODE_LABELS[code]}</option>
              ))}
            </select>
            <StatusBadge code={resp.statusCode} />
            <textarea
              value={resp.description || ''}
              onChange={e => update(idx, 'description', e.target.value)}
              placeholder="Описание ответа (поддерживается Markdown)"
              rows={1}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
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
