import { useState } from 'react'
import { stats } from './data/bundleParser.js'
import BundleExplorer from './components/BundleExplorer.jsx'
import GraphView from './components/GraphView.jsx'
import AgentPanel from './components/AgentPanel.jsx'

const TABS = ['Bundle Explorer', 'Graph View', 'AI Agent']

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    background: '#1a2a3a',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    height: 52,
    flexShrink: 0,
    userSelect: 'none',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontWeight: 700, fontSize: 16, letterSpacing: 0.3 },
  badge: {
    background: '#2a4a6a',
    border: '1px solid #3a6a9a',
    color: '#9ac8f0',
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 4,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerStats: { fontSize: 12, color: '#7aa8cc', fontVariantNumeric: 'tabular-nums' },
  tabBar: {
    display: 'flex',
    background: '#0f1e2d',
    borderBottom: '1px solid #1e3a54',
    padding: '0 12px',
    flexShrink: 0,
  },
  tab: (active) => ({
    padding: '10px 18px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? '#9ac8f0' : '#5a7a9a',
    borderBottom: active ? '2px solid #4a9ad4' : '2px solid transparent',
    transition: 'color 0.15s',
    userSelect: 'none',
  }),
  content: {
    flex: 1,
    overflow: 'hidden',
    background: '#f4f6fa',
  },
}

export default function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedConceptId, setSelectedConceptId] = useState(null)

  function openInExplorer(conceptId) {
    setSelectedConceptId(conceptId)
    setActiveTab(0)
  }

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.title}>T2D Care Pathway</span>
          <span style={s.badge}>OKF POC</span>
        </div>
        <span style={s.headerStats}>
          {stats.fileCount} concepts · {stats.linkCount} links · ADA 2026
        </span>
      </header>

      <nav style={s.tabBar}>
        {TABS.map((label, i) => (
          <div key={label} style={s.tab(activeTab === i)} onClick={() => setActiveTab(i)}>
            {label}
          </div>
        ))}
      </nav>

      <main style={s.content}>
        {activeTab === 0 && (
          <BundleExplorer
            selectedConceptId={selectedConceptId}
            onSelect={setSelectedConceptId}
          />
        )}
        {activeTab === 1 && (
          <GraphView
            selectedConceptId={selectedConceptId}
            onSelect={(id) => { setSelectedConceptId(id) }}
            onOpenInExplorer={openInExplorer}
          />
        )}
        {activeTab === 2 && (
          <AgentPanel onOpenInExplorer={openInExplorer} />
        )}
      </main>
    </div>
  )
}
