// Load all .md files from the bundle as raw strings at build time.
// Path is relative to THIS file: app/src/data/ → ../../../bundle/
const rawFiles = import.meta.glob('../../../bundle/**/*.md', { query: '?raw', import: 'default', eager: true })

// ─── YAML frontmatter parser ─────────────────────────────────────────────────
function parseYAML(yamlStr) {
  const result = {}
  const lines = yamlStr.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    // Match key: value (key can include underscores)
    const m = line.match(/^([\w]+):\s*(.*)$/)
    if (!m) { i++; continue }

    const key = m[1]
    let val = m[2].trim()

    // Inline array: [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      result[key] = val
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (val.startsWith('"') && val.endsWith('"')) {
      // Quoted string
      result[key] = val.slice(1, -1)
    } else {
      result[key] = val
    }
    i++
  }

  return result
}

// ─── Frontmatter splitter ─────────────────────────────────────────────────────
function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m)
  if (!match) return { yamlStr: '', body: raw }
  return { yamlStr: match[1], body: match[2] }
}

// ─── Path utilities ───────────────────────────────────────────────────────────
const BUNDLE_PREFIX = '../../../bundle/'

function vitepathToId(vitePath) {
  // '../../../bundle/conditions/type-1-diabetes.md' → 'conditions/type-1-diabetes'
  return vitePath
    .replace(BUNDLE_PREFIX, '')
    .replace(/\.md$/, '')
}

function resolveRelativeLink(sourceId, relHref) {
  // Strip .md extension and any fragment
  const cleaned = relHref.replace(/\.md$/, '').split('#')[0]

  // sourceId dir: 'conditions/comorbidities' from 'conditions/comorbidities/bone-health'
  const sourceDir = sourceId.split('/').slice(0, -1)
  const parts = cleaned.split('/')
  const stack = [...sourceDir]

  for (const part of parts) {
    if (part === '..') stack.pop()
    else if (part !== '.') stack.push(part)
  }

  return stack.join('/')
}

// ─── Link extractor ───────────────────────────────────────────────────────────
function extractLinks(body, sourceId) {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  const links = []
  let m

  while ((m = linkRe.exec(body)) !== null) {
    const [, text, href] = m
    if (href.startsWith('http') || href.startsWith('mailto')) continue
    // Only links in ## Related Concepts section matter for the graph,
    // but we collect all internal links.
    const targetId = resolveRelativeLink(sourceId, href)
    links.push({ text, href, targetId })
  }

  return links
}

// ─── Display type derived from path ──────────────────────────────────────────
function displayType(id) {
  if (id.startsWith('conditions/comorbidities/')) return 'comorbidity'
  if (id.startsWith('conditions/')) return 'condition'
  if (id.startsWith('assessments/')) return 'assessment'
  if (id.startsWith('monitoring/')) return 'monitoring'
  if (id.startsWith('treatments/lifestyle/')) return 'lifestyle'
  if (id.startsWith('treatments/medications/')) return 'medication'
  return 'concept'
}

// ─── Parse all files ──────────────────────────────────────────────────────────
const concepts = Object.entries(rawFiles).map(([vitePath, raw]) => {
  const id = vitepathToId(vitePath)
  const { yamlStr, body } = splitFrontmatter(raw)
  const frontmatter = parseYAML(yamlStr)
  const links = extractLinks(body, id)

  return {
    id,
    path: vitePath.replace(BUNDLE_PREFIX, ''),  // e.g. 'conditions/type-1-diabetes.md'
    displayType: displayType(id),
    frontmatter,
    body,
    links,                          // [{text, href, targetId}]
    linkIds: links.map(l => l.targetId),  // convenience: just the ids
  }
})

// Sort alphabetically within each type group
concepts.sort((a, b) => {
  if (a.displayType !== b.displayType) return a.displayType.localeCompare(b.displayType)
  return (a.frontmatter.title || a.id).localeCompare(b.frontmatter.title || b.id)
})

// ─── Grouped by display type ──────────────────────────────────────────────────
const byType = concepts.reduce((acc, c) => {
  const t = c.displayType
  if (!acc[t]) acc[t] = []
  acc[t].push(c)
  return acc
}, {})

// ─── Reverse index: who links TO each concept ─────────────────────────────────
const linkedBy = {}
concepts.forEach(c => {
  c.linkIds.forEach(tid => {
    if (!linkedBy[tid]) linkedBy[tid] = []
    if (!linkedBy[tid].includes(c.id)) linkedBy[tid].push(c.id)
  })
})

// ─── Stats ───────────────────────────────────────────────────────────────────
const totalLinks = concepts.reduce((n, c) => n + c.links.length, 0)
const types = Object.keys(byType)

const stats = {
  fileCount: concepts.length,
  linkCount: totalLinks,
  typeCount: types.length,
  types,
}

// ─── Console summary ─────────────────────────────────────────────────────────
console.log(
  `OKF Bundle: ${stats.fileCount} concepts · ${stats.linkCount} cross-links · ${stats.typeCount} concept types`
)

// ─── Exports ─────────────────────────────────────────────────────────────────
export { concepts, byType, linkedBy, stats }

export function findById(id) {
  return concepts.find(c => c.id === id)
}

export function systemPromptContext() {
  return concepts
    .map(c => {
      const tags = Array.isArray(c.frontmatter.tags)
        ? c.frontmatter.tags.join(', ')
        : c.frontmatter.tags || ''
      return `### ${c.frontmatter.title} [${c.id}]\nType: ${c.displayType} | Tags: ${tags}\n${c.body}\n---`
    })
    .join('\n\n')
}
