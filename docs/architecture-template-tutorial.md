# Step-by-Step Tutorial: Build an Interactive Architecture Page

A complete reproducible guide to creating a **Glassmorphic Animated Architecture One-Pager** — a self-contained single HTML file with animated data flow diagrams, clickable components, and tabbed sections — for any tool, application, or data product.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Template Overview](#template-overview)
- [Step 1: Prepare Your Architecture Brief](#step-1-prepare-your-architecture-brief)
- [Step 2: Generate the Skeleton (Prompt 1)](#step-2-generate-the-skeleton-prompt-1)
- [Step 3: Build the Animated Data Flow Diagram (Prompt 2)](#step-3-build-the-animated-data-flow-diagram-prompt-2)
- [Step 4: Add the Layers Tab (Prompt 3)](#step-4-add-the-layers-tab-prompt-3)
- [Step 5: Add the Tech Stack Tab (Prompt 4)](#step-5-add-the-tech-stack-tab-prompt-4)
- [Step 6: Add Data Model, Security, Deployment (Prompt 5)](#step-6-add-data-model-security-deployment-prompt-5)
- [Step 7: Polish and Test (Prompt 6)](#step-7-polish-and-test-prompt-6)
- [Summary](#summary)
- [Tips for Success](#tips-for-success)
- [Adapting for Different Projects](#adapting-for-different-projects)

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **LLM** | Claude Opus 4.6 (via GitHub Copilot in VS Code, Agent mode with file editing enabled) |
| **Editor** | VS Code with GitHub Copilot Chat |
| **Mode** | Agent mode (so the AI can create and edit files directly) |
| **Knowledge** | Your system's architecture facts (components, technologies, data flow) |
| **Time** | ~1.5–2 hours for a complete page |

---

## Template Overview

### What You'll Build

A single `.html` file (~1,070 lines) containing:

- **Dark glassmorphism design** — frosted-glass cards, neon glow, gradient text
- **Animated SVG data flow diagram** — particles travelling along Bézier paths between components
- **6 tabbed sections** — Data Flow, Layers, Tech Stack, Data Model, Security, Deployment
- **Full interactivity** — clickable nodes, expandable panels, simulate buttons
- **Zero dependencies** — no build step, no npm, just one HTML file and a Tailwind CDN link

### Design Patterns Used

| Pattern | What It Provides |
|---------|-----------------|
| **Glassmorphism** | Frosted-glass cards (`backdrop-filter: blur`, semi-transparent backgrounds) |
| **Dark gradient dashboard** | Radial gradient body, glowing accents, neon-style borders |
| **Single-file SPA** | Everything (HTML + CSS + JS) in one `.html` file, no build step |
| **Animated SVG data flow** | Particle animations along SVG paths showing system connections |
| **Tabbed sections** | Navigation tabs that show/hide content sections |
| **Reveal-on-scroll** | Fade-in animations using IntersectionObserver |

---

## Step 1: Prepare Your Architecture Brief

> **This is the most important step.** The quality of the output depends entirely on how detailed your brief is.

Before prompting the AI, write a plain-text document with ALL of your system's architecture details. Use this template:

```
PROJECT: [Your Project Name]
ORG: [Your Organization / Team]
URL: [Production URL if any]

COMPONENTS:
- Frontend: [Framework] v[X] + [Bundler] + [CSS framework]
- Backend: [Framework] v[X] on [Runtime]
- Database: [Type and name]
- External APIs: [List any third-party services]
- Auth: [Authentication method]

DATA FLOW:
1. User does [action] in browser
2. Frontend sends [HTTP method] to [endpoint]
3. Backend [validates/processes/queries]
4. Database [reads/writes]
5. Response returns to UI

TECH STACK (with versions):
Frontend: [lib1 vX, lib2 vX, lib3 vX, ...]
Backend: [lib1 vX, lib2 vX, lib3 vX, ...]
DevOps: [tool1, tool2, tool3, ...]

DATA MODEL:
- Collection1: { field1, field2, field3 }
- Collection2: { field1, field2, fk→Collection1 }
- [Describe relationships between entities]

SECURITY:
- [TLS/HTTPS details]
- [Auth method]
- [Input validation approach]
- [File upload limits]
- [Any other security measures]

DEPLOYMENT:
- Host: [Server/cloud/platform]
- Port: [Number]
- Container: [Yes/no, which runtime]
- Volumes: [What data is persisted]
- Health checks: [Method and frequency]

CAPACITY:
- [Max records supported]
- [Concurrent users]
- [Upload size limits]
- [Any other limits]
```

**Save this as `architecture-brief.txt`** — you'll paste sections of it into each prompt.

---

## Step 2: Generate the Skeleton (Prompt 1)

### What This Builds

- HTML file with Tailwind CDN
- All CSS animations and glassmorphism styles
- Hero section with project identity
- Sticky tab navigation (6 tabs)
- Empty sections that toggle on tab click
- Footer

### The Prompt

Copy and paste this into Copilot Chat (Agent mode), replacing all `[PLACEHOLDERS]`:

---

```
Create a single self-contained HTML file at `docs/architecture-interactive.html` for **[PROJECT NAME]**.

Requirements:
- Single file, no build step. Load Tailwind via `<script src="https://cdn.tailwindcss.com"></script>`.
- **Dark glassmorphism design**: body background `radial-gradient(circle at 20% 10%, #1e1b4b 0%, #0f172a 40%, #020617 100%)`, color `#e2e8f0`, font Inter/system-ui.
- Cards use class `.glass`: `background: rgba(30,41,59,0.55); backdrop-filter: blur(12px); border: 1px solid rgba(148,163,184,0.18)`.
- `.glow`: `box-shadow: 0 0 25px rgba(139,92,246,0.35), 0 0 60px rgba(99,102,241,0.18)`.
- `.gradient-text`: linear-gradient 90deg #a5b4fc → #c4b5fd → #f9a8d4, background-clip text.
- `.lift`: hover translateY(-4px) with increased border-color and box-shadow transition.
- `.reveal`: opacity 0, translateY(24px), transitions to visible state.
- 3 decorative `.blob` divs (absolute positioned, border-radius 50%, filter blur(80px), opacity 0.35): indigo top-left, pink mid-right, emerald bottom-left.
- CSS keyframes:
  - `pulse-ring`: scale 0.85→1.6 with fade out, 2.4s
  - `float`: translateY 0→-6px→0, 4s ease-in-out infinite
  - `flow-path`: stroke-dashoffset to -28, 1.6s linear infinite
  - `travel`: offset-distance 0%→100% with opacity fade in/out, 3.2s linear infinite

**Hero header** (max-w-7xl mx-auto):
- Left side:
  - [EMOJI] icon in a floating glass+glow box
  - Org line "[ORG NAME]" in small caps indigo text
  - Project title "[PROJECT NAME]" with version number in gradient-text
  - Large heading "How [PROJECT] works, explained visually." with project name in gradient-text
  - Subtitle paragraph describing the system
  - Pill badges for key technologies: [LIST YOUR 4-6 KEY TECH BADGES]
- Right column: glass card "At a glance" with stats:
  [LIST YOUR 4-8 KEY METRICS WITH EMOJIS AND VALUES]

**Sticky nav bar** (backdrop-blur, bg-slate-950/70, border-y border-slate-800):
- 6 tab buttons with `data-tab` attributes: flow, layers, stack, data, security, deploy
- Labels: ⏩ Data Flow, 🏗️ Layers, 🧰 Tech Stack, 🗄️ Data Model, 🛡️ Security, 🚀 Deployment
- `.tab-btn.active` gets gradient background indigo→pink, white text

**Main** with 6 `<section>` elements (id="tab-flow" through "tab-deploy"), all have class `reveal`, all except first have class `hidden`.

**Footer**: centered text "[PROJECT NAME] · [ORG] · Interactive architecture · v1.0"

**JavaScript** (bottom of file):
- Tab switching: click toggles `.active` on buttons, shows matching section, hides others
- IntersectionObserver: adds `.visible` class to `.reveal` elements at threshold 0.1

No content inside the 6 sections yet — just make the skeleton with tabs working correctly.
```

---

### ✅ Checkpoint

Open the file in a browser. Verify:
- [ ] Hero renders with floating icon, gradient text, pill badges, stats card
- [ ] Background has colored blobs and gradient
- [ ] 6 tabs in sticky nav bar
- [ ] Clicking tabs toggles sections (all empty, but switching works)
- [ ] No console errors

---

## Step 3: Build the Animated Data Flow Diagram (Prompt 2)

### What This Builds

- Animated SVG with component boxes and particle paths
- Clickable nodes with detail panels
- Step-explainer cards
- Simulate buttons that animate scenarios

### The Prompt

```
In the `#tab-flow` section of `docs/architecture-interactive.html`, add the complete Data Flow tab:

**Header area:**
- h3: "⏩ Request–Response Pipeline"
- Subtitle: "Directed data flow: [describe your flow pattern]."
- 3 buttons (glass, lift, right-aligned): "📥 Simulate Read", "📤 Simulate Write", "📂 Simulate [Third Action]"

**Simulate button logic** (inline <script> immediately after the buttons):
- Define scenario data for each button:
  - read: 4 step labels + 4 step descriptions showing a read operation
  - write: 4 step labels + 4 step descriptions showing a write operation
  - [third]: 4 step labels + 4 step descriptions showing your third operation
- Default labels: ['User Interaction', 'Secure API Call', 'Business Logic', 'UI Updates']
- On click: sequentially highlight step-card-1 through 4 (500ms delay each), apply indigo glow, update text, restore after 4.5s

**SVG diagram** (viewBox="0 0 1000 560") inside a `glass rounded-3xl p-6 md:p-10` card:
- Tip text: "💡 Click any box or numbered step below for a deeper explanation."
- <defs>: gradient `gflow` (indigo→violet→pink), `gflow-back` (emerald→indigo), arrow markers
- Optional: dashed container rectangle showing your deployment boundary
- **Clickable boxes** (as `<g class="node" data-info="[id]" style="cursor:pointer">`):
  [LIST EACH COMPONENT WITH:]
  - Position (x, y, width, height)
  - Fill color and stroke color
  - Emoji, label text, subtitle text
- **Bézier paths** connecting boxes:
  [DESCRIBE EACH CONNECTION:]
  - From [Component A] to [Component B]: approximate path
  - All paths use class `flow-path`, stroke gradient, arrow markers
- **Particles**: circle elements (r=5-6) on each path using CSS `offset-path` matching the path's `d` attribute, with staggered animation delays
- **Step labels**: text elements along paths ("1. [action]", "2. [action]", etc.)

**Detail panel** (hidden div, glass style, below SVG):
- Shows when a node is clicked
- Has title + body text + close button (✕)
- Content for each node:
  [WRITE 2-3 SENTENCE DESCRIPTION FOR EACH COMPONENT]

**4 step-explainer cards** (grid md:grid-cols-4, below detail panel):
- Each card: id `step-card-N`, circled number ①②③④, label `step-label-N`, description `step-desc-N`
- Clickable to show expanded explanation

**Expanded step panel** (hidden, different border color):
- Detailed explanation for each step (what happens technically)
- [WRITE DETAILED EXPLANATION FOR EACH OF THE 4 STEPS]

**JavaScript** for interactivity:
- Click node → show detail panel with that node's info
- Click step card → show expanded step explanation
- Hover on node → increase stroke-width
- Close buttons hide panels
```

---

### ✅ Checkpoint

- [ ] Particles animate smoothly along paths between boxes
- [ ] Clicking any box shows its description panel
- [ ] Clicking step cards shows expanded explanations
- [ ] Simulate buttons highlight cards sequentially with scenario text
- [ ] Animations don't jitter or overlap

---

## Step 4: Add the Layers Tab (Prompt 3)

### What This Builds

- 3–5 stacked cards representing your architecture layers

### The Prompt

```
In the `#tab-layers` section of `docs/architecture-interactive.html`, add:

Heading: "🏗️ The [N] layers of [PROJECT NAME]"
Subtitle: "Like floors in a building — each layer has one clear job."

[N] stacked cards. Each card is: `glass rounded-2xl p-6 lift border-l-4` with a unique border color.

Each card contains:
- Left: Large emoji (text-3xl)
- Center (flex-1):
  - Small caps label: "Layer N · [Layer Name]" in colored text matching the border
  - Bold title (font-semibold text-lg): one-sentence summary of what this layer does
  - Paragraph description (text-slate-300 text-sm)
  - Bullet list (text-slate-400 text-xs, 4-6 items) of specific responsibilities
- Right: small label showing the file path/directory (hidden on mobile)

My layers:
1. [COLOR: sky #60a5fa] [EMOJI] [Layer name] — [Title]. [Description]. Bullets: [list]
2. [COLOR: violet #a78bfa] [EMOJI] [Layer name] — [Title]. [Description]. Bullets: [list]
3. [COLOR: pink #f472b6] [EMOJI] [Layer name] — [Title]. [Description]. Bullets: [list]
4. [COLOR: emerald #34d399] [EMOJI] [Layer name] — [Title]. [Description]. Bullets: [list]
```

---

### ✅ Checkpoint

- [ ] Switch to Layers tab — 4 cards render with colored left borders
- [ ] Cards lift on hover
- [ ] Content is readable and well-spaced
- [ ] Mobile: single column layout

---

## Step 5: Add the Tech Stack Tab (Prompt 4)

### What This Builds

- Grid of technology cards grouped by category
- Clickable "Why this?" reveal panels for each technology

### The Prompt

```
In the `#tab-stack` section of `docs/architecture-interactive.html`, add:

Heading: "🧰 The toolbox behind the Toolbox"
Subtitle: "Every piece chosen to be modern, lightweight, and easy to maintain."

2-column grid (`grid md:grid-cols-2 gap-6`) of glass cards:

**Card 1: "[EMOJI] [Category 1]"** (e.g., Frontend)
Contains a vertical list of technology sub-cards. Each sub-card:
- Is a `glass rounded-lg p-3 lift cursor-pointer` div
- Has `onclick="document.getElementById('[tech]-why').classList.toggle('hidden')"`
- Shows: emoji + name + version in bold, one-line purpose in slate-400
- Below it: a hidden div (id="[tech]-why") with "Why [tech]?" title and 2-3 sentence explanation

Technologies in this card:
[LIST EACH: emoji, name, version, purpose, why-explanation]

**Card 2: "[EMOJI] [Category 2]"** (e.g., Backend)
Same format. Technologies:
[LIST EACH]

**Card 3: "[EMOJI] [Category 3]"** (e.g., DevOps) — spans 2 columns (md:col-span-2)
Same format. Technologies:
[LIST EACH]

**Summary card** (md:col-span-2, border border-indigo-400/20):
Title: "💡 Why this combination?"
3-4 bullet points explaining the overall stack philosophy.
[LIST YOUR PHILOSOPHY BULLETS]
```

---

### ✅ Checkpoint

- [ ] Tech Stack tab shows grid of categorized cards
- [ ] Clicking any technology reveals its "Why?" explanation
- [ ] Clicking again hides it (toggle behavior)
- [ ] Summary card at bottom explains overall philosophy

---

## Step 6: Add Data Model, Security, Deployment (Prompt 5)

### What This Builds

- Data Model: SVG entity-relationship diagram
- Security: Grid of security measure cards
- Deployment: SVG infrastructure diagram

### The Prompt

```
In `docs/architecture-interactive.html`, fill the remaining 3 tabs:

**`#tab-data` — Data Model:**
- Heading: "🗄️ How the data is organised"
- Subtitle: "[Describe the central relationship in your data]"
- SVG diagram (viewBox="0 0 900 420") inside a glass card:
  - Entity boxes (rounded rects with colored borders):
    [LIST EACH ENTITY WITH: position, color, field names listed as text inside]
  - Relationship lines connecting entities:
    [DESCRIBE WHICH ENTITIES CONNECT AND BY WHICH FIELD]
  - Labels on relationship lines showing the foreign key
- Below SVG: 2-column grid with short explanations of design choices

**`#tab-security` — Security:**
- Heading: "🛡️ Keeping data safe"
- Subtitle: "Defense in depth — multiple layers, simple to explain."
- 3-column grid (`grid md:grid-cols-3 gap-4`) of glass cards (lift):
  [LIST EACH SECURITY MEASURE:]
  - Emoji + bold title
  - 1-2 sentence description
- Last card: dashed amber border for "Planned" future enhancements

**`#tab-deploy` — Deployment:**
- Heading: "🚀 Where [PROJECT] lives"
- Subtitle: "[One-line summary of deployment approach]"
- SVG diagram (viewBox="0 0 1000 460") inside a glass card:
  - Outer box: your host/server
  - Inner box: container/runtime (dashed border)
  - Inside: application process, data storage, certificates/secrets
  - External elements: health monitor, user access point
  - Arrows showing connections with labels
- Below SVG: 3-column grid with deployment facts (host, auto-healing, persistence)
```

---

### ✅ Checkpoint

- [ ] Data Model tab: SVG shows entities with fields, connected by lines
- [ ] Security tab: 6 cards in a grid, last one has dashed border
- [ ] Deployment tab: SVG shows infrastructure with labeled arrows
- [ ] All 3 tabs render correctly when switched to

---

## Step 7: Polish and Test (Prompt 6)

### The Prompt

```
Review `docs/architecture-interactive.html` and fix any issues:

1. Verify all 6 tabs show/hide correctly (only one section visible at a time)
2. Ensure the 3 simulate buttons animate step cards sequentially with correct text
3. Confirm all SVG nodes are clickable and show their detail panels
4. Confirm step cards are clickable and show expanded explanations
5. Check the footer text is correct
6. Verify `.reveal` fade-in animations trigger on scroll
7. Test mobile responsiveness:
   - Tab bar scrolls horizontally on narrow screens
   - Grids collapse to single column
   - SVGs scale via viewBox (no horizontal overflow)
8. Check for any console errors
9. Ensure consistent spacing and typography throughout
```

---

### ✅ Final Verification Checklist

- [ ] Page loads without errors
- [ ] Hero section: floating icon, gradient text, stats card all render
- [ ] All 6 tabs switch correctly
- [ ] Data Flow: particles animate, nodes clickable, simulate buttons work
- [ ] Layers: cards render with colored borders, lift on hover
- [ ] Tech Stack: all technologies listed, "why" panels toggle
- [ ] Data Model: SVG entities visible with relationship lines
- [ ] Security: 6 cards in grid
- [ ] Deployment: SVG diagram with host/container/volumes
- [ ] Mobile: no horizontal overflow, single-column grids
- [ ] Footer renders at bottom

---

## Summary

| Prompt | What It Builds | Approx. Lines |
|--------|---------------|---------------|
| 1 | Skeleton + CSS + Hero + Tabs | ~150 |
| 2 | Animated SVG Data Flow + Interactivity | ~350 |
| 3 | Layers Tab | ~100 |
| 4 | Tech Stack Tab | ~200 |
| 5 | Data Model + Security + Deployment Tabs | ~250 |
| 6 | Polish + Bug Fixes | ~20 |
| **Total** | **Complete interactive architecture page** | **~1,070** |

---

## Tips for Success

### Do's

1. **Always verify between prompts** — Open the file in a browser after each step. Fix issues before moving on.
2. **Be specific about SVG coordinates** — Tell the AI exactly where boxes should go (x, y, width, height). Vague positioning leads to overlapping elements.
3. **Provide real content** — The more detailed your architecture brief, the better the output. Don't leave placeholders for the AI to guess.
4. **Use Agent mode** — The AI needs file editing permissions to create and modify the HTML file directly.
5. **Iterate on the SVG** — The data flow diagram (Prompt 2) is the hardest part. You may need 1-2 follow-up prompts to adjust coordinates or fix particle paths.

### Don'ts

1. **Don't try to generate everything in one prompt** — The file is too large (~1,000+ lines). Breaking it into 6 prompts ensures quality.
2. **Don't skip the architecture brief** — Without clear input data, the AI will invent generic placeholder content.
3. **Don't worry about exact coordinates on first try** — SVG positions often need minor tweaking. It's normal to say "move the Database box 50px to the right" in a follow-up.
4. **Don't add framework build steps** — The whole point is a zero-dependency single file. Resist the urge to add React/webpack/etc.

---

## Adapting for Different Projects

### What Stays the Same (reuse verbatim)

- The entire `<style>` block (glassmorphism, keyframes, animations)
- The blob background elements
- The tab switching JavaScript pattern
- The IntersectionObserver reveal logic
- The detail panel show/hide pattern
- The step-card animation logic

### What Changes Per Project

| Section | What to customize |
|---------|------------------|
| Hero | Project name, org, emoji, badges, stats |
| Data Flow SVG | Box labels, positions, path connections, descriptions |
| Layers | Number of layers, names, responsibilities |
| Tech Stack | Your actual libraries with versions and rationale |
| Data Model | Your entities, fields, and relationships |
| Security | Your specific security measures |
| Deployment | Your infrastructure (cloud, container, serverless, etc.) |

### Alternative Architectures This Works For

- **Microservices** — More boxes in the SVG, more paths between them
- **Serverless** — Lambda/Cloud Functions as boxes, API Gateway in the middle
- **Data Pipelines** — ETL stages as boxes, data flowing left-to-right
- **ML Systems** — Training pipeline + inference pipeline as two flow paths
- **Mobile Apps** — App → API → Backend → Database + Push Notifications

---

## LLM Recommendations

| LLM | Suitability | Notes |
|-----|-------------|-------|
| **Claude Opus 4.6** | ⭐⭐⭐⭐⭐ | Handles large single-file generation well. Maintains consistent style across prompts. Best at SVG coordinate math. |
| GPT-4o | ⭐⭐⭐⭐ | Works well but may need more coordinate corrections in SVG paths. |
| Gemini 2.5 Pro | ⭐⭐⭐⭐ | Good at long outputs. Sometimes adds unnecessary complexity. |
| Claude Sonnet 4 | ⭐⭐⭐ | Faster but may truncate complex SVG sections. Use for simpler diagrams. |

**Recommended setup**: Claude Opus 4.6 via GitHub Copilot Chat in VS Code Agent mode.

---

*Last Updated: May 2026*
