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
  // Width grows with the value so full component names are always visible
  // (a truncated input would also trigger the browser's native value tooltip).
  const widthCh = Math.max(12, String(value || '').length + 3)
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: `${widthCh}ch`, maxWidth: '100%' }}
        className={`px-2 py-1 border rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${tone}`}
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

function FieldRow({ field, onChange, onRemove, schemas, onSchemasChange, depth = 0 }) {
  const indent = depth * 16
  const componentNames = Object.keys(schemas || {}).sort((a, b) => a.localeCompare(b))
  const refNameOf = ref => (ref || '').startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : ''
  const [showRefPreview, setShowRefPreview] = useState(false)
  const [showItemsPreview, setShowItemsPreview] = useState(false)
  const itemsRefName = (field.items?.$ref || '').startsWith(REF_PREFIX)
    ? field.items.$ref.slice(REF_PREFIX.length)
    : (field.items?.$ref || '')

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
              className="shrink-0"
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
          onSchemasChange={onSchemasChange}
          depth={depth + 1}
        />
      )}

      {field.type === 'array' && (
        <div style={{ marginLeft: (depth + 1) * 16 }} className="mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">items:</span>
            <ComboInput
              value={field.items?.$ref || field.items?.type || 'string'}
              onChange={v => onChange({ ...field, items: v.startsWith(REF_PREFIX) ? { $ref: v } : { type: v } })}
              options={[...TYPES, ...componentNames.map(n => REF_PREFIX + n)]}
              className="shrink-0"
            />
            {field.items && !field.items.$ref && field.items.type === 'object' && onSchemasChange && (
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('Имя компонента для элементов массива (например, Product):')
                  if (!name || !name.trim()) return
                  const key = name.trim()
                  if (schemas?.[key] && !confirm(`Компонент «${key}» уже существует. Перезаписать?`)) return
                  onSchemasChange({ ...(schemas || {}), [key]: JSON.stringify(field.items) })
                  onChange({ ...field, items: { $ref: REF_PREFIX + key } })
                }}
                className="text-[11px] text-blue-600 hover:underline shrink-0"
              >
                сохранить как компонент
              </button>
            )}
            {field.items?.$ref && itemsRefName && schemas?.[itemsRefName] && (
              <button
                type="button"
                onClick={() => setShowItemsPreview(v => !v)}
                className="text-[11px] text-blue-600 hover:underline shrink-0"
              >
                {showItemsPreview ? 'скрыть' : 'структура'}
              </button>
            )}
          </div>
          {showItemsPreview && field.items?.$ref && itemsRefName && schemas?.[itemsRefName] && (
            <div className="border border-blue-100 rounded bg-white px-2 py-1 mb-1">
              <PreviewFields fields={schemaToFields(safeParse(schemas[itemsRefName]))} schemas={schemas} />
            </div>
          )}
          {field.items && !field.items.$ref && field.items.type === 'object' && (
            <ObjectFields
              fields={schemaToFields(field.items)}
              onChange={props => onChange({ ...field, items: fieldsToSchema(props) })}
              schemas={schemas}
              onSchemasChange={onSchemasChange}
              depth={depth + 1}
            />
          )}
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

/** Infers a JSON Schema (our subset) from an example JSON value */
function jsonValueToSchema(value) {
  if (value === null) return { type: 'string' }
  if (Array.isArray(value)) {
    return { type: 'array', items: value.length ? jsonValueToSchema(value[0]) : { type: 'string' } }
  }
  switch (typeof value) {
    case 'string':
      return value ? { type: 'string', example: value } : { type: 'string' }
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number', example: value }
    case 'boolean':
      return { type: 'boolean', example: value }
    case 'object': {
      const properties = {}
      for (const [k, v] of Object.entries(value)) properties[k] = jsonValueToSchema(v)
      return { type: 'object', properties }
    }
    default:
      return { type: 'string' }
  }
}

function ObjectFields({ fields, onChange, schemas, onSchemasChange, depth }) {
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
          onSchemasChange={onSchemasChange}
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
    // Property names are identifiers in the spec: strip any whitespace the user typed.
    const name = (f.name || '').replace(/\s+/g, '')
    if (!name) continue
    if (f.type === '$ref') {
      properties[name] = { $ref: REF_PREFIX + (f.ref || '') }
      if (f.required) required.push(name)
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
    properties[name] = prop
    if (f.required) required.push(name)
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
  const [formatRaw, setFormatRaw] = useState(false)
  const [showExampleImport, setShowExampleImport] = useState(false)
  const [exampleJson, setExampleJson] = useState('')

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

  function applyExampleJson() {
    let parsed
    try {
      parsed = JSON.parse(exampleJson)
    } catch {
      alert('Невалидный JSON. Проверьте, что вставлен полный JSON-объект (с кавычками у ключей).')
      return
    }
    if (fields.length > 0 && !confirm('Текущие поля схемы будут заменены полями из примера. Продолжить?')) return
    handleFieldsChange(schemaToFields(jsonValueToSchema(parsed)))
    setShowExampleImport(false)
    setExampleJson('')
  }

  function readExampleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setExampleJson(String(reader.result || ''))
    reader.readAsText(file)
    e.target.value = ''
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
        <div>
          <label className="flex items-center gap-1.5 mb-1 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              checked={formatRaw}
              onChange={e => {
                const on = e.target.checked
                setFormatRaw(on)
                if (on && effectiveValue) {
                  // One-shot pretty-print of the current content; invalid JSON is left as-is.
                  try {
                    const pretty = JSON.stringify(JSON.parse(effectiveValue), null, 2)
                    if (pretty !== effectiveValue) emit(pretty)
                  } catch {}
                }
              }}
            />
            форматировать (отступы и переносы)
          </label>
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
        </div>
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
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => setShowExampleImport(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              ↑ загрузить пример JSON
            </button>
          </div>
          {showExampleImport && (
            <div className="border border-blue-200 rounded bg-white p-2 mb-2">
              <textarea
                value={exampleJson}
                onChange={e => setExampleJson(e.target.value)}
                rows={6}
                placeholder='Вставьте пример тела запроса/ответа: {"id": 1, "name": "Иван"}'
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={applyExampleJson}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Применить
                </button>
                <label className="text-xs text-blue-600 hover:underline cursor-pointer">
                  или выбрать файл…
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={readExampleFile}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setShowExampleImport(false); setExampleJson('') }}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
          <ObjectFields fields={fields} onChange={handleFieldsChange} schemas={schemas} onSchemasChange={onSchemasChange} depth={0} />
        </div>
      )}
    </div>
  )
}
