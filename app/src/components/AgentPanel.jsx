import { useState, useRef, useEffect } from 'react'
import { systemPromptContext, stats, findById } from '../data/bundleParser.js'

const ENV_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''

const SAMPLE_QUESTIONS = [
  'What is the first-line treatment for a T2D patient with early CKD?',
  'Which medications reduce cardiovascular risk beyond glucose control?',
  'When should insulin be initiated in T2D?',
  'What monitoring is required in the first year after T2D diagnosis?',
  'How do GLP-1 agonists and SGLT2 inhibitors differ in mechanism?',
]

// Build system prompt once (not on every render)
const BUNDLE_CONTEXT = systemPromptContext()
const SYSTEM_PROMPT = `You are a clinical decision support assistant specializing in diabetes management.
You have access to a curated knowledge graph based on the ADA Standards of Care in Diabetes—2026.

Use the following OKF (Open Knowledge Format) concept library as your knowledge base:

${BUNDLE_CONTEXT}

Guidelines:
- Answer questions using the knowledge base above as your primary source.
- When you reference a specific concept, write its ID in square brackets like [treatments/medications/metformin] so the UI can render it as a clickable link.
- Be precise and clinical. Cite relevant sections when appropriate.
- If a question falls outside the knowledge base, say so clearly.`

// Rough token estimate: ~4 chars per token
const TOKEN_ESTIMATE = Math.round(SYSTEM_PROMPT.length / 4).toLocaleString()

// ─── Parse concept chips from agent text ──────────────────────────────────────
function parseMessageParts(text) {
  const parts = []
  // Match [some/path/here] that looks like a concept id (no spaces, has /)
  const re = /\[([a-z][a-z0-9/_-]+)\]/g
  let last = 0, m

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: text.slice(last, m.index) })
    const id = m[1]
    const concept = findById(id)
    parts.push({ type: concept ? 'chip' : 'text', id, content: concept ? concept.frontmatter.title : m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) })
  return parts
}

// ─── Type colors (subset) ─────────────────────────────────────────────────────
const TYPE_COLORS = {
  condition: '#1a6b8a', comorbidity: '#8a1a1a', assessment: '#5a1a8a',
  monitoring: '#8a5a1a', lifestyle: '#1a7a4a', medication: '#1a4a8a', concept: '#4a4a5a',
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onOpenInExplorer }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div style={{
          background: '#1a3a5a', color: '#e8f0f8',
          borderRadius: '14px 14px 3px 14px',
          padding: '10px 15px', maxWidth: '72%', fontSize: 14, lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  const parts = parseMessageParts(msg.content)

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
      <div style={{
        background: '#fff', color: '#1a2a3a',
        border: '1px solid #e0e8f0',
        borderRadius: '14px 14px 14px 3px',
        padding: '10px 15px', maxWidth: '80%', fontSize: 14, lineHeight: 1.7,
      }}>
        {parts.map((part, i) =>
          part.type === 'chip' ? (
            <ConceptChip key={i} id={part.id} label={part.content} onNavigate={onOpenInExplorer} />
          ) : (
            <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part.content}</span>
          )
        )}
      </div>
    </div>
  )
}

function ConceptChip({ id, label, onNavigate }) {
  const concept = findById(id)
  const col = TYPE_COLORS[concept?.displayType] || '#4a4a5a'
  return (
    <span
      onClick={() => onNavigate(id)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: `${col}18`, border: `1px solid ${col}`,
        color: col, borderRadius: 12, padding: '1px 9px',
        fontSize: 12, cursor: 'pointer', fontWeight: 600,
        margin: '1px 3px', verticalAlign: 'middle',
        transition: 'filter 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.85)'}
      onMouseLeave={e => e.currentTarget.style.filter = ''}
    >
      ↗ {label}
    </span>
  )
}

// ─── Pulsing loading indicator ────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '10px 14px', alignItems: 'center' }}>
      <style>{`
        @keyframes okf-pulse { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        .okf-dot { width:8px;height:8px;border-radius:50%;background:#4a9ad4;
          animation:okf-pulse 1.2s ease-in-out infinite; }
        .okf-dot:nth-child(2){animation-delay:0.2s}
        .okf-dot:nth-child(3){animation-delay:0.4s}
      `}</style>
      <span style={{ fontSize: 12, color: '#7a9ab0', marginRight: 6 }}>Traversing OKF bundle</span>
      <span className="okf-dot" />
      <span className="okf-dot" />
      <span className="okf-dot" />
    </div>
  )
}

// ─── API key input (for GitHub Pages / no-env visitors) ──────────────────────
function ApiKeyGate({ onKey }) {
  const [draft, setDraft] = useState('')
  return (
    <div style={{
      margin: '20px', padding: '20px', borderRadius: 10,
      background: '#f8f6ff', border: '1px solid #c8b8e8',
    }}>
      <div style={{ fontWeight: 700, color: '#3a1a6a', marginBottom: 8, fontSize: 14 }}>
        Anthropic API Key Required
      </div>
      <div style={{ fontSize: 13, color: '#5a4a7a', marginBottom: 14, lineHeight: 1.6 }}>
        The AI Agent tab calls the Anthropic API directly from your browser.
        Your key is never stored — it lives only in memory for this session.{' '}
        Get one at{' '}
        <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer"
          style={{ color: '#6a3abf' }}>console.anthropic.com</a>.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="password"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && draft.startsWith('sk-ant') && onKey(draft)}
          placeholder="sk-ant-..."
          style={{
            flex: 1, padding: '9px 12px', border: '1px solid #c0a8e8',
            borderRadius: 7, fontSize: 13, fontFamily: 'monospace', outline: 'none',
          }}
        />
        <button
          onClick={() => draft.startsWith('sk-ant') && onKey(draft)}
          disabled={!draft.startsWith('sk-ant')}
          style={{
            background: draft.startsWith('sk-ant') ? '#5a3aaa' : '#c0b0d8',
            color: '#fff', border: 'none', borderRadius: 7,
            padding: '0 16px', cursor: draft.startsWith('sk-ant') ? 'pointer' : 'default',
            fontWeight: 700, fontSize: 14,
          }}
        >
          Use Key
        </button>
      </div>
    </div>
  )
}

// ─── Main AgentPanel ──────────────────────────────────────────────────────────
export default function AgentPanel({ onOpenInExplorer }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionKey, setSessionKey] = useState(ENV_API_KEY)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setError(null)

    const newMessages = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': sessionKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`API error ${res.status}: ${errBody}`)
      }

      const data = await res.json()
      const reply = data.content?.[0]?.text || '(no response)'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!sessionKey) {
    return <ApiKeyGate onKey={setSessionKey} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Banner ── */}
      <div style={{
        background: '#1a2a3a', color: '#9ac8f0',
        padding: '12px 20px', fontSize: 13, lineHeight: 1.5, flexShrink: 0,
        borderBottom: '1px solid #1e3a54',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>
          <strong style={{ color: '#e0f0ff' }}>Agent reads the full OKF bundle as context.</strong>
          {' '}No RAG. No embeddings. Curated knowledge graph.
        </span>
        <span style={{ fontSize: 11, color: '#5a8aaa', flexShrink: 0, marginLeft: 16 }}>
          {stats.fileCount} concepts loaded
        </span>
      </div>

      {/* ── Sample questions ── */}
      {messages.length === 0 && (
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #e8ecf4', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: '#7a8a9a', marginBottom: 10, textTransform: 'uppercase' }}>
            Sample Questions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SAMPLE_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => send(q)}
                style={{
                  textAlign: 'left', background: '#f0f4fa',
                  border: '1px solid #d8e0ec', borderRadius: 8,
                  padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                  color: '#1a3a5a', lineHeight: 1.4,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#e0eaf8'
                  e.currentTarget.style.borderColor = '#4a9ad4'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f0f4fa'
                  e.currentTarget.style.borderColor = '#d8e0ec'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat history ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} onOpenInExplorer={onOpenInExplorer} />
        ))}
        {loading && (
          <div style={{
            display: 'flex', justifyContent: 'flex-start', marginBottom: 14,
          }}>
            <div style={{
              background: '#fff', border: '1px solid #e0e8f0',
              borderRadius: '14px 14px 14px 3px',
            }}>
              <LoadingDots />
            </div>
          </div>
        )}
        {error && (
          <div style={{
            background: '#fff0f0', border: '1px solid #f0a0a0',
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: '#8a1a1a', marginBottom: 14,
          }}>
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 6, color: '#6a3a3a' }}>
              Check that your API key is valid and has available credits.
              You can{' '}
              <span
                onClick={() => { setSessionKey(''); setMessages([]); setError(null) }}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                enter a different key
              </span>.
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input row ── */}
      <div style={{
        borderTop: '1px solid #e0e8f0', background: '#fff',
        padding: '12px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Ask a clinical question… (Enter to send, Shift+Enter for newline)"
            rows={2}
            style={{
              flex: 1, padding: '10px 12px', border: '1px solid #d0d8e8',
              borderRadius: 8, fontSize: 13, resize: 'none',
              fontFamily: 'system-ui', outline: 'none',
              color: '#1a2a3a', lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? '#c0cdd8' : '#1a4a8a',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '0 18px', cursor: loading || !input.trim() ? 'default' : 'pointer',
              fontWeight: 700, fontSize: 14, flexShrink: 0, transition: 'background 0.2s',
            }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#8a9ab0', marginTop: 6 }}>
          Bundle context: ~{TOKEN_ESTIMATE} tokens loaded · claude-sonnet-4-6
        </div>
      </div>
    </div>
  )
}
