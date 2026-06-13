import { useState } from 'react'

const TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object']

function FieldRow({ field, onChange, onRemove, depth = 0 }) {
  const indent = depth * 16

  return (
    <div style={{ marginLeft: indent }}>
      <div className="flex items-center gap-2 mb-1">
        <input
          type="text"
          value={field.name}
          onChange={e => onChange({ ...field, name: e.target.value })}
          placeholder="field name"
          className="w-32 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <select
          value={field.type}
          onChange={e => onChange({ ...field, type: e.target.value, properties: e.target.value === 'object' ? (field.properties || []) : undefined, items: e.target.value === 'array' ? (field.items || { type: 'string' }) : undefined })}
          className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="text"
          value={field.description || ''}
          onChange={e => onChange({ ...field, description: e.target.value })}
          placeholder="description"
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={e => onChange({ ...field, required: e.target.checked })}
          />
          req
        </label>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
      </div>

      {field.type === 'object' && (
        <ObjectFields
          fields={field.properties || []}
          onChange={props => onChange({ ...field, properties: props })}
          depth={depth + 1}
        />
      )}

      {field.type === 'array' && (
        <div style={{ marginLeft: (depth + 1) * 16 }} className="mb-1">
          <span className="text-xs text-gray-500 mr-2">items type:</span>
          <select
            value={field.items?.type || 'string'}
            onChange={e => onChange({ ...field, items: { type: e.target.value } })}
            className="px-2 py-1 border border-gray-300 rounded text-xs"
          >
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

function ObjectFields({ fields, onChange, depth }) {
  function addField() {
    onChange([...fields, { name: '', type: 'string', required: false, description: '' }])
  }

  function updateField(idx, updated) {
    const next = [...fields]
    next[idx] = updated
    onChange(next)
  }

  function removeField(idx) {
    onChange(fields.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ marginLeft: depth * 4 }} className="border-l-2 border-gray-200 pl-3 mb-2">
      {fields.map((f, i) => (
        <FieldRow
          key={i}
          field={f}
          onChange={v => updateField(i, v)}
          onRemove={() => removeField(i)}
          depth={depth}
        />
      ))}
      <button
        onClick={addField}
        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
        style={{ marginLeft: depth * 16 }}
      >
        + добавить поле
      </button>
    </div>
  )
}

/** Converts our internal fields array to a JSON Schema map */
function fieldsToSchema(fields) {
  const properties = {}
  const required = []

  for (const f of fields) {
    if (!f.name) continue
    const prop = { type: f.type }
    if (f.description) prop.description = f.description
    if (f.type === 'array') {
      prop.items = f.items || { type: 'string' }
    }
    if (f.type === 'object' && f.properties?.length) {
      const nested = fieldsToSchema(f.properties)
      prop.properties = nested.properties
      if (nested.required?.length) prop.required = nested.required
    }
    properties[f.name] = prop
    if (f.required) required.push(f.name)
  }

  return { type: 'object', properties, ...(required.length ? { required } : {}) }
}

/** Parse a JSON schema back to our internal fields array */
function schemaToFields(schema) {
  if (!schema || !schema.properties) return []
  const required = schema.required || []
  return Object.entries(schema.properties).map(([name, prop]) => {
    const field = {
      name,
      type: prop.type || 'string',
      description: prop.description || '',
      required: required.includes(name),
    }
    if (prop.type === 'array') field.items = prop.items || { type: 'string' }
    if (prop.type === 'object' && prop.properties) {
      field.properties = schemaToFields(prop)
    }
    return field
  })
}

export default function SchemaBuilder({ value, onChange }) {
  const parsed = (() => {
    try { return value ? JSON.parse(value) : null } catch { return null }
  })()

  const [fields, setFields] = useState(() => schemaToFields(parsed))
  const [showRaw, setShowRaw] = useState(false)

  function handleFieldsChange(newFields) {
    setFields(newFields)
    const schema = fieldsToSchema(newFields)
    onChange(JSON.stringify(schema))
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">JSON Schema</span>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showRaw ? 'Конструктор' : 'Raw JSON'}
        </button>
      </div>

      {showRaw ? (
        <textarea
          value={value || ''}
          onChange={e => {
            onChange(e.target.value)
            try {
              const parsed = JSON.parse(e.target.value)
              setFields(schemaToFields(parsed))
            } catch {}
          }}
          rows={8}
          placeholder='{"type":"object","properties":{"id":{"type":"integer"}}}'
          className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
      ) : (
        <ObjectFields fields={fields} onChange={handleFieldsChange} depth={0} />
      )}
    </div>
  )
}
