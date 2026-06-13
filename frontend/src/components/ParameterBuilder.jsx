const PARAM_IN = ['query', 'path', 'header', 'cookie']
const TYPES    = ['string', 'integer', 'number', 'boolean', 'array']
const FORMATS  = { string: ['', 'date', 'date-time', 'uuid', 'email', 'uri'], integer: ['', 'int32', 'int64'], number: ['', 'float', 'double'] }

export default function ParameterBuilder({ parameters, onChange }) {
  function add() {
    onChange([...parameters, { name: '', paramIn: 'query', type: 'string', required: false, description: '' }])
  }

  function update(idx, field, val) {
    const next = parameters.map((p, i) => i === idx ? { ...p, [field]: val } : p)
    onChange(next)
  }

  function remove(idx) {
    onChange(parameters.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {parameters.length === 0 && (
        <p className="text-sm text-gray-400 mb-2">Нет параметров</p>
      )}

      {parameters.map((param, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 mb-2 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={param.name}
              onChange={e => update(idx, 'name', e.target.value)}
              placeholder="name *"
              className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={param.paramIn}
              onChange={e => update(idx, 'paramIn', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {PARAM_IN.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <select
              value={param.type}
              onChange={e => update(idx, 'type', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(FORMATS[param.type] || []).length > 1 && (
              <select
                value={param.format || ''}
                onChange={e => update(idx, 'format', e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {(FORMATS[param.type] || ['']).map(f => <option key={f} value={f}>{f || '— формат —'}</option>)}
              </select>
            )}
            {param.type === 'array' && (
              <select
                value={param.itemsType || 'string'}
                onChange={e => update(idx, 'itemsType', e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {['string','integer','number','boolean'].map(t => <option key={t} value={t}>items: {t}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={param.required || false}
                onChange={e => update(idx, 'required', e.target.checked)}
              />
              required
            </label>
            <button onClick={() => remove(idx)} className="ml-auto text-red-400 hover:text-red-600 text-sm">✕</button>
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={param.description || ''}
              onChange={e => update(idx, 'description', e.target.value)}
              placeholder="Описание"
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              value={param.example || ''}
              onChange={e => update(idx, 'example', e.target.value)}
              placeholder="Пример"
              className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      ))}

      <button
        onClick={add}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Добавить параметр
      </button>
    </div>
  )
}
