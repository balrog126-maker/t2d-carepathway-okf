# T2D Care Pathway — OKF POC

A clinical knowledge explorer for Type 2 Diabetes care pathways, built on the **ADA Standards of Care in Diabetes — 2026**. This proof-of-concept demonstrates the **Open Knowledge Format (OKF)** — a structured, link-rich Markdown schema for clinical knowledge that can be explored visually, navigated as a graph, and queried by an AI agent.

---

## What It Does

The app has three main views:

### Bundle Explorer
A two-panel concept browser. The left sidebar lists all 35+ clinical concepts organized by type (Conditions, Comorbidities, Assessments, Monitoring, Lifestyle, Medications) with a live search. The right panel renders the selected concept's frontmatter metadata, full clinical content, outbound cross-links, and inbound back-references — all as clickable chips that navigate to related concepts.

### Graph View
A D3.js force-directed graph of the full knowledge network. Nodes are colored by concept type; edges represent explicit `[[wiki-link]]`-style cross-references. Clicking a node opens a summary card with a button to jump to the Bundle Explorer. Supports zoom, pan, and drag.

### AI Agent
A chat interface powered by Claude. The entire knowledge bundle is injected into the system prompt as structured context (~35 concepts, all content and metadata). The agent answers clinical questions (treatment selection, monitoring protocols, drug comparisons) citing specific concepts, which are rendered as clickable chips in the response that navigate to the Bundle Explorer.

---

## Knowledge Bundle

All clinical content lives in the [`bundle/`](bundle/) directory as structured Markdown files. The bundle is organized into concept types that map to the ADA 2026 care pathway sections:

```
bundle/
├── conditions/
│   ├── type-1-diabetes.md
│   ├── type-2-diabetes.md
│   ├── prediabetes.md
│   ├── diabetes-diagnosis-criteria.md
│   ├── diabetes-screening.md
│   └── comorbidities/
│       ├── autoimmune-comorbidities-t1d.md
│       ├── cardiovascular-risk.md
│       ├── ckd-nephropathy.md
│       └── bone-health-fracture-risk.md
├── assessments/
│   ├── comprehensive-medical-evaluation.md
│   ├── a1c-assessment.md
│   ├── cgm-metrics.md
│   ├── glycemic-goals.md
│   └── hypoglycemia-risk-assessment.md
├── monitoring/
│   ├── glucose-monitoring.md
│   ├── hypoglycemia-classification-treatment.md
│   └── hyperglycemic-crises.md
└── treatments/
    ├── lifestyle/
    │   ├── dsmes.md
    │   ├── medical-nutrition-therapy.md
    │   ├── eating-patterns.md
    │   ├── weight-management.md
    │   ├── physical-activity.md
    │   └── psychosocial-wellbeing.md
    └── medications/
        ├── metformin.md
        ├── glp1-receptor-agonists.md
        ├── sglt2-inhibitors.md
        ├── dpp4-inhibitors.md
        ├── insulin-therapy-t1d.md
        ├── insulin-therapy-t2d.md
        └── t2d-medication-algorithm.md
```

### OKF Frontmatter Schema

Every concept file begins with a YAML frontmatter block:

```yaml
---
type: concept               # Used for color coding; path-based displayType overrides
title: T2D Medication Algorithm
description: One-line clinical summary shown in the UI and agent context
tags: [T2D, algorithm, SGLT2i, GLP-1-RA]
source: ADA Standards of Care in Diabetes—2026
source_section: "Section 9: Pharmacologic Approaches to Glycemic Treatment"
source_url: https://diabetesjournals.org/...
timestamp: 2026-06-27
---
```

Cross-links between concepts are standard Markdown relative links in a `## Related Concepts` section at the bottom of each file:

```markdown
## Related Concepts
- [GLP-1 Receptor Agonists](../medications/glp1-receptor-agonists.md)
- [Cardiovascular Risk](../../conditions/comorbidities/cardiovascular-risk.md)
```

The parser resolves these at build time and builds a bidirectional link graph.

### Concept Types

| Display Type | Path Pattern | Color |
|---|---|---|
| `condition` | `conditions/*` | Teal |
| `comorbidity` | `conditions/comorbidities/*` | Red |
| `assessment` | `assessments/*` | Purple |
| `monitoring` | `monitoring/*` | Amber |
| `lifestyle` | `treatments/lifestyle/*` | Green |
| `medication` | `treatments/medications/*` | Blue |

---

## Source Material

Raw source documents used to author the bundle are in [`source-material/raw/`](source-material/raw/) as Obsidian-formatted Markdown. These are the original ADA 2026 Standards of Care sections:

- Section 2: Diagnosis and Classification
- Section 4: Comprehensive Medical Evaluation
- Section 5: Facilitating Positive Health Behaviors
- Section 6: Glycemic Goals, Hypoglycemia, and Hyperglycemic Crises
- Section 9: Pharmacologic Approaches to Glycemic Treatment
- Section 10: Cardiovascular Disease and Risk Management

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 + Vite 5 |
| Graph visualization | D3.js v7 (force simulation) |
| Markdown rendering | marked v12 |
| Bundle parsing | Custom Vite `import.meta.glob` pipeline |
| AI agent | Claude (via Anthropic API, direct browser fetch) |
| Styling | Inline React styles (no CSS framework) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An Anthropic API key (for the AI Agent tab)

### Install and run

```bash
cd app
npm install
```

Create a `.env` file in the `app/` directory:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for production

```bash
npm run build
npm run preview
```

The bundle files are inlined at build time via `import.meta.glob` — no server required for the knowledge graph. Only the AI Agent tab requires a network call.

---

## Architecture

### Bundle Parser ([`app/src/data/bundleParser.js`](app/src/data/bundleParser.js))

The parser runs at build time (eager import) and produces a fully resolved in-memory graph:

1. **`import.meta.glob`** loads all `bundle/**/*.md` files as raw strings
2. **`splitFrontmatter`** splits each file into YAML header + Markdown body
3. **`parseYAML`** parses the frontmatter (inline arrays, quoted strings, plain values)
4. **`extractLinks`** walks the Markdown body regex-extracting `[text](href)` links and resolves relative paths to concept IDs
5. **`displayType`** derives the UI concept type from the file path
6. **`linkedBy`** builds a reverse index: for each concept, which other concepts link to it
7. **`systemPromptContext`** serializes the entire bundle to a structured string for the AI system prompt

Exported: `concepts`, `byType`, `linkedBy`, `stats`, `findById`, `systemPromptContext`

### Components

| Component | File | Responsibility |
|---|---|---|
| `App` | [`app/src/App.jsx`](app/src/App.jsx) | Tab routing, cross-tab navigation state |
| `BundleExplorer` | [`app/src/components/BundleExplorer.jsx`](app/src/components/BundleExplorer.jsx) | Sidebar list + concept detail panel |
| `GraphView` | [`app/src/components/GraphView.jsx`](app/src/components/GraphView.jsx) | D3 force graph + summary cards |
| `AgentPanel` | [`app/src/components/AgentPanel.jsx`](app/src/components/AgentPanel.jsx) | Chat UI + Claude API integration |

Cross-tab navigation: the `GraphView` and `AgentPanel` can call `onOpenInExplorer(conceptId)` to switch to the Bundle Explorer with a specific concept selected.

---

## AI Agent Design

The agent is given the full bundle as a system prompt. Each concept is serialized as:

```
### {title} [{id}]
Type: {displayType} | Tags: {tags}
{full markdown body}
---
```

The agent is instructed to cite concepts using `[concept/id]` syntax. The `AgentPanel` parser detects these IDs in the response and renders them as clickable concept chips, creating a live link from the AI answer back into the knowledge graph.

The system prompt is built once at module load time (not per request) to avoid re-rendering cost. Token estimate is displayed in the UI (~4 chars per token heuristic).

---

## Example Questions (AI Agent)

- What is the first-line treatment for a T2D patient with early CKD?
- Which medications reduce cardiovascular risk beyond glucose control?
- When should insulin be initiated in T2D?
- What monitoring is required in the first year after T2D diagnosis?
- How do GLP-1 agonists and SGLT2 inhibitors differ in mechanism?

---

## Project Context

This is experiment `09` in the `07_claude_code_experiments` series — a proof of concept exploring whether a structured Markdown knowledge format (OKF) can serve as the backbone for a clinical decision support tool that combines browsable documentation, graph visualization, and AI-assisted querying from a single source of truth.

The OKF schema is deliberately simple: standard Markdown + YAML frontmatter + relative links. No database, no graph store, no proprietary format. The entire knowledge graph ships as static files and can be edited in any Markdown editor.
