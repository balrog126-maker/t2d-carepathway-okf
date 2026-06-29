import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { concepts, findById } from '../data/bundleParser.js'

// ─── Same type → color mapping as Explorer ───────────────────────────────────
const TYPE_COLORS = {
  condition:   '#1a6b8a',
  comorbidity: '#8a1a1a',
  assessment:  '#5a1a8a',
  monitoring:  '#8a5a1a',
  lifestyle:   '#1a7a4a',
  medication:  '#1a4a8a',
  concept:     '#4a4a5a',
}
function nodeColor(type) { return TYPE_COLORS[type] || TYPE_COLORS.concept }

// ─── Build graph data once ────────────────────────────────────────────────────
function buildGraph() {
  const nodeMap = {}
  const nodes = concepts.map(c => {
    const n = {
      id: c.id,
      title: c.frontmatter.title || c.id,
      type: c.displayType,
      description: c.frontmatter.description || '',
      linkCount: c.links.length,
    }
    nodeMap[c.id] = n
    return n
  })

  const linkSet = new Set()
  const links = []
  concepts.forEach(c => {
    c.linkIds.forEach(tid => {
      if (!nodeMap[tid]) return
      const key = [c.id, tid].sort().join('||')
      if (!linkSet.has(key)) {
        linkSet.add(key)
        links.push({ source: c.id, target: tid })
      }
    })
  })

  return { nodes, links }
}

const GRAPH_DATA = buildGraph()

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ nodeId, onOpenInExplorer, onClose }) {
  const concept = findById(nodeId)
  if (!concept) return null
  const col = nodeColor(concept.displayType)

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, width: 280,
      background: '#fff', border: `1px solid ${col}`,
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      zIndex: 10, overflow: 'hidden',
    }}>
      <div style={{ background: col, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
          {concept.frontmatter.title}
        </span>
        <span
          onClick={onClose}
          style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >×</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8a9a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {concept.displayType} · {concept.links.length} outbound links
        </div>
        <p style={{ fontSize: 13, color: '#2a3a4a', lineHeight: 1.5, margin: '0 0 12px' }}>
          {concept.frontmatter.description}
        </p>
        <button
          onClick={() => onOpenInExplorer(nodeId)}
          style={{
            background: col, color: '#fff', border: 'none',
            borderRadius: 6, padding: '7px 14px', fontSize: 12,
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          Open in Explorer →
        </button>
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  const entries = Object.entries(TYPE_COLORS)
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16,
      background: 'rgba(255,255,255,0.92)',
      border: '1px solid #d8e0ec', borderRadius: 8,
      padding: '10px 14px', zIndex: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: '#7a8a9a', marginBottom: 8, textTransform: 'uppercase' }}>
        Concept Type
      </div>
      {entries.map(([type, color]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#2a3a4a', textTransform: 'capitalize' }}>{type}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e8ecf4', fontSize: 11, color: '#7a8a9a' }}>
        ◉ Large node = hub (8+ links)
      </div>
    </div>
  )
}

// ─── Main GraphView ───────────────────────────────────────────────────────────
export default function GraphView({ selectedConceptId, onSelect, onOpenInExplorer }) {
  const svgRef = useRef(null)
  const simRef = useRef(null)
  const [activeNode, setActiveNode] = useState(selectedConceptId || null)
  const [dims, setDims] = useState({ w: 800, h: 600 })

  // Track container size
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { w, h } = dims
    const { nodes, links } = GRAPH_DATA

    // Clone so D3 can mutate positions
    const nodeData = nodes.map(n => ({ ...n }))
    const nodeById = Object.fromEntries(nodeData.map(n => [n.id, n]))

    const linkData = links.map(l => ({
      source: nodeById[l.source] || l.source,
      target: nodeById[l.target] || l.target,
    }))

    // Simulation
    const sim = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink(linkData).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide(20))
    simRef.current = sim

    // Zoom container
    const g = svg.append('g')
    svg.call(
      d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', e => g.attr('transform', e.transform))
    )

    // Edges
    const edgeG = g.append('g').attr('class', 'edges')
    const edgeSel = edgeG
      .selectAll('line')
      .data(linkData)
      .join('line')
      .attr('stroke', '#c8d0dc')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1)

    // Node groups
    const nodeG = g.append('g').attr('class', 'nodes')
    const nodeSel = nodeG
      .selectAll('g')
      .data(nodeData)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        setActiveNode(prev => prev === d.id ? null : d.id)
        onSelect(d.id)
      })

    // Circles
    nodeSel.append('circle')
      .attr('r', d => d.linkCount >= 8 ? 12 : 8)
      .attr('fill', d => nodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)

    // Labels — always show for hubs, hover for others
    nodeSel.append('text')
      .attr('dy', d => (d.linkCount >= 8 ? -15 : -11))
      .attr('text-anchor', 'middle')
      .attr('font-size', d => (d.linkCount >= 8 ? 11 : 10))
      .attr('font-weight', d => (d.linkCount >= 8 ? 700 : 400))
      .attr('fill', '#1a2a3a')
      .attr('pointer-events', 'none')
      .attr('opacity', d => (d.linkCount >= 8 ? 1 : 0))
      .text(d => d.title)
      .attr('class', 'node-label')

    // Hover → show label
    nodeSel
      .on('mouseenter', function(event, d) {
        if (d.linkCount < 8) {
          d3.select(this).select('.node-label').attr('opacity', 1)
        }
        d3.select(this).select('circle').attr('stroke', '#f0a050').attr('stroke-width', 2.5)
      })
      .on('mouseleave', function(event, d) {
        if (d.linkCount < 8) {
          d3.select(this).select('.node-label').attr('opacity', 0)
        }
        const isActive = d.id === activeNode
        d3.select(this).select('circle')
          .attr('stroke', isActive ? '#f0a050' : '#fff')
          .attr('stroke-width', isActive ? 3 : 1.5)
      })

    // Click background → deselect
    svg.on('click', () => setActiveNode(null))

    // Tick
    sim.on('tick', () => {
      edgeSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop() }
  }, [dims])

  // React to active node selection for highlighting
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    if (!svg.node()) return

    const neighborIds = new Set()
    if (activeNode) {
      GRAPH_DATA.links.forEach(l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source
        const tid = typeof l.target === 'object' ? l.target.id : l.target
        if (sid === activeNode) neighborIds.add(tid)
        if (tid === activeNode) neighborIds.add(sid)
      })
    }

    const col = activeNode ? nodeColor(findById(activeNode)?.displayType || 'concept') : '#c8d0dc'

    svg.selectAll('.edges line')
      .attr('stroke', d => {
        if (!activeNode) return '#c8d0dc'
        const sid = typeof d.source === 'object' ? d.source.id : d.source
        const tid = typeof d.target === 'object' ? d.target.id : d.target
        return (sid === activeNode || tid === activeNode) ? col : '#c8d0dc'
      })
      .attr('stroke-opacity', d => {
        if (!activeNode) return 0.5
        const sid = typeof d.source === 'object' ? d.source.id : d.source
        const tid = typeof d.target === 'object' ? d.target.id : d.target
        return (sid === activeNode || tid === activeNode) ? 0.9 : 0.1
      })
      .attr('stroke-width', d => {
        if (!activeNode) return 1
        const sid = typeof d.source === 'object' ? d.source.id : d.source
        const tid = typeof d.target === 'object' ? d.target.id : d.target
        return (sid === activeNode || tid === activeNode) ? 2 : 1
      })

    svg.selectAll('.nodes g circle')
      .attr('stroke', function(d) {
        if (d.id === activeNode) return '#f0a050'
        if (neighborIds.has(d.id)) return '#f0a050'
        return '#fff'
      })
      .attr('stroke-width', function(d) {
        if (d.id === activeNode) return 3.5
        if (neighborIds.has(d.id)) return 2
        return 1.5
      })
      .attr('opacity', d => {
        if (!activeNode) return 1
        return (d.id === activeNode || neighborIds.has(d.id)) ? 1 : 0.25
      })

    svg.selectAll('.nodes g .node-label')
      .attr('opacity', function(d) {
        if (d.linkCount >= 8) return 1
        if (!activeNode) return 0
        return (d.id === activeNode || neighborIds.has(d.id)) ? 1 : 0
      })
  }, [activeNode])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f0f4fa' }}>
      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        style={{ display: 'block' }}
      />
      {activeNode && (
        <SummaryCard
          nodeId={activeNode}
          onOpenInExplorer={onOpenInExplorer}
          onClose={() => setActiveNode(null)}
        />
      )}
      <Legend />
    </div>
  )
}
