import { useState, useEffect } from 'react'

const TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object']
const REF_PREFIX = '#/components/schemas/'
const EMPTY_SCHEMA = '{"type":"object","properties":{}}'

function safeParse(v) {
  try { return v ? JSON.parse(v) : null } catch { return null }
}

/** Text input with a filterable dropdown list (custom replacement for input+datalist) */
function ComboInput({ value, onChange, options, placeholder, className = '', plain = false }) {
  const [open, setOpen] = useState(false)
  const filtered = options.filter(o => !value || o.toLowerCase().includes(String(value).toLowerCase()))
  const tone = plain
    ? 'border-gray-300 bg-white'
    : 'border-blue-300 bg-blue-50'
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`w-full px-2 py-1 border rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${tone}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 left-0 top-full mt-1 w-72 max-h-52 overflow-y-auto bg-white border border-gray-300 rounded shadow-md text-xs font-mono">
          {filtered.map(o => (
            <li
              key={o}
              onMouseDown={() => { onChange(o); setOpen(false) }}
              className={`px-2 py-1 cursor-pointer hover:bg-blue-50 ${o === value ? 'bg-blue-100' : ''}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FieldRow({ field, onChange, onRemove, schemas, depth = 0 }) {
  const indent = depth * 16
  const componentNames = Object.keys(schemas || {}).sort((a, b) => a.localeCompare(b))
  const refNameOf = ref => (ref || '').startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : ''
  const [showRefPreview, setShowRefPreview] = useState(false)

  return (
    <div style={{ marginLeft: indent }}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <input
          type="text"
          value={field.name}
          onChange={e => onChange({ ...field, name: e.target.value })}
          placeholder="field name"
          className="w-40 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <select
          value={field.type}
          onChange={e => onChange({ ...field, type: e.target.value })}
          className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          <option value="$ref">→ ссылка ($ref)</option>
        </select>
        {field.type === '$ref' && (
          <>
            <ComboInput
              value={field.ref || ''}
              onChange={v => onChange({ ...field, ref: v })}
              options={componentNames}
              placeholder="имя компонента…"
              className="w-44 shrink-0"
            />
            {field.ref && schemas && field.ref in schemas && (
              <button
                type="button"
                onClick={() => setShowRefPreview(v => !v)}
                className="text-[11px] text-blue-600 hover:underline shrink-0"
              >
                {showRefPreview ? 'скрыть' : 'структура'}
              </button>
            )}
          </>
        )}
        <textarea
          value={field.description || ''}
          onChange={e => onChange({ ...field, description: e.target.value })}
          placeholder="description (Markdown supported)"
          rows={1}
          className="flex-1 min-w-36 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y min-h-[26px]"
        />
        <input
          type="text"
          value={field.example || ''}
          onChange={e => onChange({ ...field, example: e.target.value })}
          placeholder="example"
          className="w-24 shrink-0 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap shrink-0">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={e => onChange({ ...field, required: e.target.checked })}
          />
          req
        </label>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs px-1 shrink-0">✕</button>
      </div>

      {field.type === 'object' && (
        <ObjectFields
          fields={field.properties || []}
          onChange={props => onChange({ ...field, properties: props })}
          schemas={schemas}
          depth={depth + 1}
        />
      )}

      {field.type === 'array' && (
        <div style={{ marginLeft: (depth + 1) * 16 }} className="mb-1 flex items-center gap-2">
          <span className="text-xs text-gray-500">items:</span>
          <ComboInput
            value={field.items?.$ref || field.items?.type || 'string'}
            onChange={v => onChange({ ...field, items: v.startsWith(REF_PREFIX) ? { $ref: v } : { type: v } })}
            options={[...TYPES, ...componentNames.map(n => REF_PREFIX + n)]}
            className="w-44 shrink-0"
          />
        </div>
      )}

      {showRefPreview && field.type === '$ref' && field.ref && schemas?.[field.ref] && (
        <div className="border border-blue-100 rounded bg-white px-2 py-1 mb-1">
          <PreviewFields fields={schemaToFields(safeParse(schemas[field.ref]))} schemas={schemas} />
        </div>
      )}
    </div>
  )
}

function ObjectFields({ fields, onChange, schemas, depth }) {
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
          schemas={schemas}
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

/** Read-only recursive preview of a component's field tree; nested $refs are expandable */
function RefNode({ name, schemas, depth, visited }) {
  const [open, setOpen] = useState(false)
  const json = schemas?.[name]
  if (name === undefined || name === '' || json === undefined) {
    return <span className="text-gray-500">→ {name || '?'}</span>
  }
  const cycle = visited.includes(name)
  return (
    <span>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-blue-600 hover:underline font-mono"
        title={cycle ? 'Циклическая ссылка' : 'Показать/скрыть состав компонента'}
      >
        {open ? '▾' : '▸'} {name}{cycle ? ' ↺' : ''}
      </button>
      {open && !cycle && (
        <div style={{ marginLeft: (depth + 1) * 14 }}>
          <PreviewFields
            fields={schemaToFields(safeParse(json))}
            schemas={schemas}
            depth={depth + 1}
            visited={[...visited, name]}
          />
        </div>
      )}
    </span>
  )
}

function PreviewFields({ fields, schemas, depth = 0, visited = [] }) {
  if (!fields?.length) return <div className="text-[11px] text-gray-400 italic">(пустая схема)</div>
  return fields.map((f, i) => (
    <div key={i} style={{ marginLeft: depth * 14 }} className="text-[11px] leading-5">
      <span className="font-mono text-gray-800">{f.name || '?'}</span>
      <span className="text-gray-500">{' : '}</span>
      {f.type === '$ref' ? (
        <RefNode name={f.ref} schemas={schemas} depth={depth} visited={visited} />
      ) : (
        <span className="text-gray-500">{f.type}{f.required ? ' *' : ''}</span>
      )}
      {f.type === '$ref' && f.required && <span className="text-gray-500"> *</span>}
      {f.description && <span className="text-gray-400"> — {f.description}</span>}
      {f.type === 'object' && f.properties?.length > 0 && (
        <PreviewFields fields={f.properties} schemas={schemas} depth={depth + 1} visited={visited} />
      )}
      {f.type === 'array' && f.items && (
        <div style={{ marginLeft: (depth + 1) * 14 }} className="text-gray-500">
          items: {f.items.$ref
            ? <RefNode
                name={(f.items.$ref || '').startsWith(REF_PREFIX) ? f.items.$ref.slice(REF_PREFIX.length) : f.items.$ref}
                schemas={schemas}
                depth={depth + 1}
                visited={visited}
              />
            : f.items.type || 'string'}
        </div>
      )}
    </div>
  ))
}

function schemaSummary(json) {
  const fields = schemaToFields(safeParse(json))
  if (!fields.length) return '(пустая схема)'
  const head = fields.slice(0, 3)
    .map(f => `${f.name}: ${f.type === '$ref' ? '→ ' + (f.ref || '?') : f.type}`)
  const rest = fields.length > 3 ? ` … (+${fields.length - 3})` : ''
  return head.join(', ') + rest
}

/** Converts our internal fields array to a JSON Schema map */
function fieldsToSchema(fields) {
  const properties = {}
  const required = []

  for (const f of fields) {
    if (!f.name) continue
    if (f.type === '$ref') {
      properties[f.name] = { $ref: REF_PREFIX + (f.ref || '') }
      if (f.required) required.push(f.name)
      continue
    }
    const prop = { type: f.type }
    if (f.description) prop.description = f.description
    if (f.example) {
      try { prop.example = JSON.parse(f.example) } catch { prop.example = f.example }
    }
    if (f.type === 'array') {
      prop.items = f.items?.$ref ? { $ref: f.items.$ref } : (f.items || { type: 'string' })
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
    if (prop.$ref) {
      return {
        name,
        type: '$ref',
        ref: prop.$ref.startsWith(REF_PREFIX) ? prop.$ref.slice(REF_PREFIX.length) : '',
        description: prop.description || '',
        required: required.includes(name),
      }
    }
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
  const [view, setView] = useState('builder')

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

  function handleRefSelect(name) {
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
  const sortedNames = Object.keys(schemas || {}).sort((a, b) => a.localeCompare(b))
  const [query, setQuery] = useState('')
  const filteredNames = sortedNames.filter(n => !query || n.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">JSON Schema</span>
        <div className="flex items-center gap-3">
          {['builder', 'raw', 'components'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`text-xs hover:underline ${view === v ? 'text-blue-800 font-semibold' : 'text-blue-600'}`}
            >
              {v === 'builder' ? 'Конструктор' : v === 'raw' ? 'Raw JSON' : 'Компоненты'}
            </button>
          ))}
        </div>
      </div>

      {hasComponents && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <label className="text-xs text-gray-500 whitespace-nowrap">Схема-компонент:</label>
          <ComboInput
            value={isRef || missingRef ? refName : ''}
            onChange={handleRefSelect}
            options={sortedNames}
            placeholder="— нет (inline-схема) —"
            className="w-64"
            plain
          />
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
      ) : view === 'raw' ? (
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
      ) : view === 'components' ? (
        <div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск компонента…"
            className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          {filteredNames.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              {sortedNames.length === 0 ? 'В проекте пока нет компонентов схем.' : 'Ничего не найдено.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filteredNames.map(n => (
                <div key={n} className="border border-gray-200 rounded bg-white px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-800 truncate">{n}</span>
                    <button
                      type="button"
                      onClick={() => { onChange(JSON.stringify({ $ref: REF_PREFIX + n })); setView('builder') }}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      выбрать
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{schemaSummary(schemas[n])}</div>
                  <details className="mt-1">
                    <summary className="text-[11px] text-blue-600 cursor-pointer hover:underline">структура</summary>
                    <div className="mt-1 pb-1">
                      <PreviewFields fields={schemaToFields(safeParse(schemas[n]))} schemas={schemas} />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ObjectFields fields={fields} onChange={handleFieldsChange} schemas={schemas} depth={0} />
      )}
    </div>
  )
}
