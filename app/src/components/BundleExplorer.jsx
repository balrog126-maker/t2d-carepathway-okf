import { useState, useMemo, useEffect } from 'react'
import { marked } from 'marked'
import { concepts, byType, linkedBy, findById } from '../data/bundleParser.js'

// ─── Type color palette ───────────────────────────────────────────────────────
const TYPE_COLORS = {
  condition:   { bg: '#1a6b8a', light: '#e8f4f9', text: '#0d3d52' },
  comorbidity: { bg: '#8a1a1a', light: '#f9e8e8', text: '#521010' },
  assessment:  { bg: '#5a1a8a', light: '#f0e8f9', text: '#30084f' },
  monitoring:  { bg: '#8a5a1a', light: '#f9f0e8', text: '#523006' },
  lifestyle:   { bg: '#1a7a4a', light: '#e8f5ee', text: '#0a3d22' },
  medication:  { bg: '#1a4a8a', light: '#e8eff9', text: '#0a2347' },
  concept:     { bg: '#4a4a5a', light: '#eeeff4', text: '#252530' },
}
function typeColor(type) { return TYPE_COLORS[type] || TYPE_COLORS.concept }

// ─── Type display labels ──────────────────────────────────────────────────────
const TYPE_LABELS = {
  condition:   'Conditions',
  comorbidity: 'Comorbidities',
  assessment:  'Assessments',
  monitoring:  'Monitoring',
  lifestyle:   'Lifestyle',
  medication:  'Medications',
  concept:     'Concepts',
}

// Preferred render order
const TYPE_ORDER = ['condition','comorbidity','assessment','monitoring','lifestyle','medication','concept']

// ─── Frontmatter renderer ─────────────────────────────────────────────────────
function FrontmatterBlock({ fm }) {
  const entries = Object.entries(fm)
  return (
    <pre style={{
      background: '#0d1b2a',
      borderRadius: 8,
      padding: '14px 16px',
      fontSize: 12,
      lineHeight: 1.6,
      overflowX: 'auto',
      margin: 0,
    }}>
      <span style={{ color: '#5a7a9a' }}>---{'\n'}</span>
      {entries.map(([k, v]) => (
        <span key={k}>
          <span style={{ color: '#f0a050' }}>{k}</span>
          <span style={{ color: '#7aa8cc' }}>: </span>
          <span style={{ color: '#e0e8f0' }}>
            {Array.isArray(v) ? `[${v.join(', ')}]` : String(v)}
          </span>
          {'\n'}
        </span>
      ))}
      <span style={{ color: '#5a7a9a' }}>---</span>
    </pre>
  )
}

// ─── Chip component ───────────────────────────────────────────────────────────
function ConceptChip({ id, onNavigate }) {
  const concept = findById(id)
  if (!concept) return (
    <span style={{ fontSize: 12, color: '#999', padding: '3px 8px',
      border: '1px solid #ccc', borderRadius: 20, fontFamily: 'monospace' }}>
      {id}
    </span>
  )
  const col = typeColor(concept.displayType)
  return (
    <span
      onClick={() => onNavigate(id)}
      title={concept.frontmatter.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: col.light,
        border: `1px solid ${col.bg}`,
        color: col.text,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'filter 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.92)'}
      onMouseLeave={e => e.currentTarget.style.filter = ''}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: col.bg, flexShrink: 0,
      }} />
      {concept.frontmatter.title}
    </span>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MarkdownContent({ md }) {
  const html = useMemo(() => marked.parse(md || ''), [md])
  return (
    <div
      className="okf-md"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ lineHeight: 1.7, fontSize: 14, color: '#1a2a3a' }}
    />
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
      textTransform: 'uppercase', color: '#7a8a9a', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BundleExplorer({ selectedConceptId, onSelect }) {
  const [query, setQuery] = useState('')

  // Auto-select first concept
  useEffect(() => {
    if (!selectedConceptId && concepts.length > 0) onSelect(concepts[0].id)
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return byType
    const filteredConcepts = concepts.filter(c => {
      const title = (c.frontmatter.title || '').toLowerCase()
      const tags = Array.isArray(c.frontmatter.tags)
        ? c.frontmatter.tags.join(' ').toLowerCase()
        : ''
      return title.includes(q) || tags.includes(q)
    })
    return filteredConcepts.reduce((acc, c) => {
      if (!acc[c.displayType]) acc[c.displayType] = []
      acc[c.displayType].push(c)
      return acc
    }, {})
  }, [query])

  const selected = selectedConceptId ? findById(selectedConceptId) : null
  const inbound = selected ? (linkedBy[selected.id] || []) : []
  const outbound = selected ? selected.links : []

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── LEFT SIDEBAR ── */}
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid #d8e0ec',
        background: '#fff', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #eef0f5' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title or tag…"
            style={{
              width: '100%', padding: '7px 10px', border: '1px solid #d0d8e8',
              borderRadius: 6, fontSize: 13, outline: 'none',
              background: '#f8f9fc', color: '#1a2a3a',
            }}
          />
        </div>

        {/* Concept list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {TYPE_ORDER.filter(t => filtered[t]?.length).map(type => {
            const col = typeColor(type)
            return (
              <div key={type}>
                <div style={{
                  padding: '7px 12px 5px',
                  background: col.bg,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}>
                  {TYPE_LABELS[type] || type} ({filtered[type].length})
                </div>
                {filtered[type].map(c => {
                  const isActive = c.id === selectedConceptId
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelect(c.id)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: isActive ? col.light : 'transparent',
                        borderLeft: isActive ? `3px solid ${col.bg}` : '3px solid transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f4f6fa' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{
                        fontSize: 13, fontWeight: isActive ? 600 : 400,
                        color: isActive ? col.text : '#1a2a3a',
                        lineHeight: 1.3,
                      }}>
                        {c.frontmatter.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#8a9ab0', marginTop: 2, fontFamily: 'monospace' }}>
                        {c.id}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {Object.keys(filtered).length === 0 && (
            <div style={{ padding: 20, color: '#8a9ab0', fontSize: 13, textAlign: 'center' }}>
              No concepts match "{query}"
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {!selected ? (
          <div style={{ color: '#8a9ab0', marginTop: 40, textAlign: 'center' }}>
            Select a concept from the sidebar
          </div>
        ) : (
          <div style={{ maxWidth: 820 }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  background: typeColor(selected.displayType).bg,
                  color: '#fff',
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  {selected.displayType}
                </span>
                <span style={{ fontSize: 11, color: '#8a9ab0', fontFamily: 'monospace' }}>
                  {selected.id}
                </span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0d1b2a' }}>
                {selected.frontmatter.title}
              </h1>
              {selected.frontmatter.description && (
                <p style={{ marginTop: 6, color: '#4a6a8a', fontSize: 14, lineHeight: 1.5 }}>
                  {selected.frontmatter.description}
                </p>
              )}
            </div>

            {/* 1. FRONTMATTER */}
            <div style={{
              background: '#fff', border: '1px solid #e0e5ec',
              borderRadius: 10, padding: 20, marginBottom: 20,
            }}>
              <SectionHeading>OKF Frontmatter</SectionHeading>
              <FrontmatterBlock fm={selected.frontmatter} />
            </div>

            {/* 2. CONTENT */}
            <div style={{
              background: '#fff', border: '1px solid #e0e5ec',
              borderRadius: 10, padding: 20, marginBottom: 20,
            }}>
              <SectionHeading>Content</SectionHeading>
              <MarkdownContent md={selected.body} />
            </div>

            {/* 3. CROSS-LINKS (outbound) */}
            {outbound.length > 0 && (
              <div style={{
                background: '#fff', border: '1px solid #e0e5ec',
                borderRadius: 10, padding: 20, marginBottom: 20,
              }}>
                <SectionHeading>Cross-Links ({outbound.length})</SectionHeading>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {outbound.map((link, i) => (
                    <ConceptChip key={i} id={link.targetId} onNavigate={onSelect} />
                  ))}
                </div>
              </div>
            )}

            {/* 4. LINKED BY (inbound) */}
            {inbound.length > 0 && (
              <div style={{
                background: '#fff', border: '1px solid #e0e5ec',
                borderRadius: 10, padding: 20, marginBottom: 20,
              }}>
                <SectionHeading>Linked By ({inbound.length})</SectionHeading>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {inbound.map(id => (
                    <ConceptChip key={id} id={id} onNavigate={onSelect} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline styles for markdown content */}
      <style>{`
        .okf-md h2 {
          font-size: 15px; font-weight: 700; color: #0d1b2a;
          margin: 20px 0 8px; padding-bottom: 4px;
          border-bottom: 1px solid #e8ecf4;
        }
        .okf-md h3 {
          font-size: 13px; font-weight: 700; color: #2a4a6a;
          margin: 14px 0 6px;
        }
        .okf-md p { margin: 0 0 10px; color: #2a3a4a; }
        .okf-md ul, .okf-md ol {
          margin: 0 0 10px 20px; color: #2a3a4a;
        }
        .okf-md li { margin-bottom: 3px; }
        .okf-md table {
          border-collapse: collapse; width: 100%; margin-bottom: 12px;
          font-size: 13px;
        }
        .okf-md th {
          background: #f0f4fa; padding: 7px 10px;
          border: 1px solid #d8e0ec; font-weight: 600; text-align: left;
          color: #1a2a3a;
        }
        .okf-md td {
          padding: 6px 10px; border: 1px solid #e0e8f0; color: #2a3a4a;
        }
        .okf-md tr:nth-child(even) td { background: #f8f9fc; }
        .okf-md code {
          background: #f0f4fa; padding: 1px 5px;
          border-radius: 3px; font-size: 12px; font-family: monospace;
        }
        .okf-md strong { font-weight: 700; color: #0d1b2a; }
        .okf-md a { color: #2a6ab0; text-decoration: none; }
        .okf-md a:hover { text-decoration: underline; }
        /* Hide the ## Related Concepts section — shown as chips above */
        /* We keep it in body for the full text search / AI context */
      `}</style>
    </div>
  )
}
