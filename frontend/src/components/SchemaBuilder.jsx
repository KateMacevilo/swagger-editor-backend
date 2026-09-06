import { useState, useEffect } from 'react'

const TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object']
const REF_PREFIX = '#/components/schemas/'
const EMPTY_SCHEMA = '{"type":"object","properties":{}}'

function safeParse(v) {
  try { return v ? JSON.parse(v) : null } catch { return null }
}

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
        <textarea
          value={field.description || ''}
          onChange={e => onChange({ ...field, description: e.target.value })}
          placeholder="description (Markdown supported)"
          rows={1}
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
        />
        <input
          type="text"
          value={field.example || ''}
          onChange={e => onChange({ ...field, example: e.target.value })}
          placeholder="example"
          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={e => onChange({ ...field, required: e.target.checked })}
          />
          req
        </label>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
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
        type="button"
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
    if (f.example) {
      try { prop.example = JSON.parse(f.example) } catch { prop.example = f.example }
    }
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
    if (prop.example !== undefined) {
      field.example = typeof prop.example === 'string' ? prop.example : JSON.stringify(prop.example)
    }
    if (prop.type === 'array') field.items = prop.items || { type: 'string' }
    if (prop.type === 'object' && prop.properties) {
      field.properties = schemaToFields(prop)
    }
    return field
  })
}

/**
 * Schema editor. Two modes:
 *  - inline: edits `value` directly;
 *  - component ref: value is {"$ref": "#/components/schemas/<name>"} and the
 *    editor shows/edits the component body from `schemas[name]`, so every
 *    endpoint referencing the component stays a $ref in the exported spec.
 */
export default function SchemaBuilder({ value, onChange, schemas, onSchemasChange }) {
  const [showRaw, setShowRaw] = useState(false)

  const parsed = safeParse(value)
  const refName = parsed && typeof parsed.$ref === 'string' && parsed.$ref.startsWith(REF_PREFIX)
    ? parsed.$ref.slice(REF_PREFIX.length)
    : null
  const isRef = refName !== null && schemas != null && refName in schemas
  const missingRef = refName !== null && !isRef

  // In ref mode we edit the component content, not the endpoint body.
  const effectiveValue = isRef ? schemas[refName] : value
  const emit = json => {
    if (isRef) onSchemasChange({ ...schemas, [refName]: json })
    else onChange(json)
  }

  const [fields, setFields] = useState(() => schemaToFields(safeParse(effectiveValue)))
  const [synced, setSynced] = useState(effectiveValue)

  // Resync the constructor when the edited schema changes from the outside
  // (another endpoint selected, component switched via the dropdown).
  useEffect(() => {
    if (effectiveValue !== synced) {
      setSynced(effectiveValue)
      setFields(schemaToFields(safeParse(effectiveValue)))
    }
  }, [effectiveValue])

  function handleFieldsChange(newFields) {
    setFields(newFields)
    const json = JSON.stringify(fieldsToSchema(newFields))
    setSynced(json)
    emit(json)
  }

  function handleRefSelect(e) {
    const name = e.target.value
    if (!name) {
      // Back to inline: keep the current component content as a starting point.
      onChange(effectiveValue || EMPTY_SCHEMA)
    } else {
      onChange(JSON.stringify({ $ref: REF_PREFIX + name }))
    }
  }

  function saveAsComponent() {
    const name = window.prompt('Имя компонента (например, ErrorResponse400):')
    if (!name || !name.trim()) return
    const key = name.trim()
    const json = safeParse(effectiveValue) ? effectiveValue : EMPTY_SCHEMA
    onSchemasChange({ ...(schemas || {}), [key]: json })
    onChange(JSON.stringify({ $ref: REF_PREFIX + key }))
  }

  const hasComponents = (schemas && Object.keys(schemas).length > 0) || refName !== null

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">JSON Schema</span>
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showRaw ? 'Конструктор' : 'Raw JSON'}
        </button>
      </div>

      {hasComponents && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <label className="text-xs text-gray-500 whitespace-nowrap">Схема-компонент:</label>
          <select
            value={isRef ? refName : ''}
            onChange={handleRefSelect}
            className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">— нет (inline-схема) —</option>
            {missingRef && <option value={refName}>{refName} (нет в проекте)</option>}
            {Object.keys(schemas || {}).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {isRef && (
            <span className="text-[11px] text-blue-600">
              редактируется компонент «{refName}» — изменения затронут все эндпоинты со ссылкой на него
            </span>
          )}
          {!isRef && !missingRef && value && (
            <button
              type="button"
              onClick={saveAsComponent}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              сохранить как компонент
            </button>
          )}
        </div>
      )}

      {missingRef ? (
        <div>
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
            Компонент «{refName}» не найден в проекте. Ссылка сохранится как есть; ниже можно отредактировать её вручную.
          </p>
          <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
        </div>
      ) : showRaw ? (
        <textarea
          value={effectiveValue || ''}
          onChange={e => {
            emit(e.target.value)
            try {
              setFields(schemaToFields(JSON.parse(e.target.value)))
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
