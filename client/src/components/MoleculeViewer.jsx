import { useMemo } from 'react'

// ── Element colours (CPK / Jmol convention) ──
const ELEMENT_COLORS = {
  C:  '#374151',  // gray-700
  N:  '#1d4ed8',  // blue-700
  O:  '#dc2626',  // red-600
  S:  '#ca8a04',  // yellow-600
  P:  '#ea580c',  // orange-600
  F:  '#16a34a',  // green-600
  Cl: '#15803d',  // green-700
  Br: '#92400e',  // brown
  I:  '#7c3aed',  // violet-600
  Se: '#d97706',  // amber-600
  Si: '#6b7280',  // gray-500
  B:  '#f59e0b',  // amber-500
  H:  '#6b7280',  // gray-500
}
const DEFAULT_COLOR = '#6b7280'

// ── Bond rendering constants ──
const BOND_GAP = 3         // pixel gap between parallel lines in double/triple bonds
const BOND_STROKE = 1.8    // line width
const DASH_PATTERN = '3,2' // dashes for aromatic

/**
 * Parse a MOL block string into atoms and bonds.
 * Supports both V2000 and V3000 formats.
 */
function parseMolBlock(molBlock) {
  if (!molBlock) return null

  const lines = molBlock.split('\n')

  // Find the counts line (V2000 or V3000)
  let countsIdx = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (/V[23]000/.test(lines[i])) {
      countsIdx = i
      break
    }
  }
  if (countsIdx === -1) return null

  const isV3000 = lines[countsIdx].includes('V3000')

  if (isV3000) {
    return parseMolBlockV3000(lines)
  } else {
    return parseMolBlockV2000(lines, countsIdx)
  }
}

/**
 * Parse V2000 MOL block — fixed-width column format.
 */
function parseMolBlockV2000(lines, countsIdx) {
  const numAtoms = parseInt(lines[countsIdx].substring(0, 3).trim(), 10) || 0
  const numBonds = parseInt(lines[countsIdx].substring(3, 6).trim(), 10) || 0

  if (numAtoms === 0) return null

  const atoms = []
  for (let i = 0; i < numAtoms; i++) {
    const line = lines[countsIdx + 1 + i]
    if (!line) continue
    const x = parseFloat(line.substring(0, 10).trim())
    const y = parseFloat(line.substring(10, 20).trim())
    const symbol = line.substring(31, 34).trim()
    if (isNaN(x) || isNaN(y) || !symbol) continue
    atoms.push({ x, y, symbol })
  }

  const bonds = []
  for (let i = 0; i < numBonds; i++) {
    const line = lines[countsIdx + 1 + numAtoms + i]
    if (!line) continue
    const a1 = parseInt(line.substring(0, 3).trim(), 10) - 1
    const a2 = parseInt(line.substring(3, 6).trim(), 10) - 1
    const type = parseInt(line.substring(6, 9).trim(), 10) || 1
    if (a1 >= 0 && a2 >= 0 && a1 < atoms.length && a2 < atoms.length) {
      bonds.push({ a1, a2, type })
    }
  }

  return atoms.length > 0 ? { atoms, bonds } : null
}

/**
 * Parse V3000 MOL block — "M  V30" prefixed lines with space-separated fields.
 *
 * Atom line format:  M  V30 <index> <symbol> <x> <y> <z> <aamap> [keyword=value ...]
 * Bond line format:  M  V30 <index> <type> <atom1> <atom2> [keyword=value ...]
 */
function parseMolBlockV3000(lines) {
  // Locate BEGIN/END ATOM and BEGIN/END BOND sections
  let atomStart = -1, atomEnd = -1, bondStart = -1, bondEnd = -1

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === 'M  V30 BEGIN ATOM') atomStart = i + 1
    else if (t === 'M  V30 END ATOM') atomEnd = i
    else if (t === 'M  V30 BEGIN BOND') bondStart = i + 1
    else if (t === 'M  V30 END BOND') bondEnd = i
  }

  if (atomStart < 0 || atomEnd < 0) return null

  // Parse atoms
  const atoms = []
  // Build an index→position map because V3000 atom indices might not be sequential
  const indexMap = {}

  for (let i = atomStart; i < atomEnd; i++) {
    const raw = lines[i].replace(/^M\s+V30\s+/, '').trim()
    if (!raw) continue
    const parts = raw.split(/\s+/)
    // parts: [index, symbol, x, y, z, aamap, ...keyword=value]
    if (parts.length < 5) continue
    const idx = parseInt(parts[0], 10)
    const symbol = parts[1]
    const x = parseFloat(parts[2])
    const y = parseFloat(parts[3])
    if (isNaN(x) || isNaN(y) || !symbol) continue
    indexMap[idx] = atoms.length
    atoms.push({ x, y, symbol })
  }

  // Parse bonds
  const bonds = []
  if (bondStart >= 0 && bondEnd >= 0) {
    for (let i = bondStart; i < bondEnd; i++) {
      const raw = lines[i].replace(/^M\s+V30\s+/, '').trim()
      if (!raw) continue
      const parts = raw.split(/\s+/)
      // parts: [index, type, atom1, atom2, ...keyword=value]
      if (parts.length < 4) continue
      const type = parseInt(parts[1], 10) || 1
      const origA1 = parseInt(parts[2], 10)
      const origA2 = parseInt(parts[3], 10)
      const a1 = indexMap[origA1]
      const a2 = indexMap[origA2]
      if (a1 !== undefined && a2 !== undefined) {
        bonds.push({ a1, a2, type })
      }
    }
  }

  return atoms.length > 0 ? { atoms, bonds } : null
}

/**
 * Compute SVG elements for bonds.
 * Returns an array of <line> / <path> props.
 */
function buildBondLines(bonds, pts) {
  const elements = []
  for (let bi = 0; bi < bonds.length; bi++) {
    const { a1, a2, type } = bonds[bi]
    const p1 = pts[a1]
    const p2 = pts[a2]
    if (!p1 || !p2) continue

    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1

    // Perpendicular unit vector for offset
    const nx = -dy / len
    const ny = dx / len

    if (type === 1) {
      // Single bond
      elements.push({ key: `b${bi}`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
    } else if (type === 2) {
      // Double bond — two parallel lines
      const off = BOND_GAP / 2
      elements.push({ key: `b${bi}a`, x1: p1.x + nx * off, y1: p1.y + ny * off, x2: p2.x + nx * off, y2: p2.y + ny * off })
      elements.push({ key: `b${bi}b`, x1: p1.x - nx * off, y1: p1.y - ny * off, x2: p2.x - nx * off, y2: p2.y - ny * off })
    } else if (type === 3) {
      // Triple bond — three parallel lines
      elements.push({ key: `b${bi}a`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
      elements.push({ key: `b${bi}b`, x1: p1.x + nx * BOND_GAP, y1: p1.y + ny * BOND_GAP, x2: p2.x + nx * BOND_GAP, y2: p2.y + ny * BOND_GAP })
      elements.push({ key: `b${bi}c`, x1: p1.x - nx * BOND_GAP, y1: p1.y - ny * BOND_GAP, x2: p2.x - nx * BOND_GAP, y2: p2.y - ny * BOND_GAP })
    } else if (type === 4) {
      // Aromatic — solid + dashed
      elements.push({ key: `b${bi}a`, x1: p1.x + nx * BOND_GAP / 2, y1: p1.y + ny * BOND_GAP / 2, x2: p2.x + nx * BOND_GAP / 2, y2: p2.y + ny * BOND_GAP / 2 })
      elements.push({ key: `b${bi}b`, x1: p1.x - nx * BOND_GAP / 2, y1: p1.y - ny * BOND_GAP / 2, x2: p2.x - nx * BOND_GAP / 2, y2: p2.y - ny * BOND_GAP / 2, dash: true })
    } else {
      // Fallback: single bond
      elements.push({ key: `b${bi}`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
    }
  }
  return elements
}

/**
 * Decide which atoms get visible labels.
 * Standard cheminformatics convention: show heteroatoms (non-C) and terminal carbons.
 */
function shouldLabel(atom, index, atoms, bonds) {
  if (atom.symbol !== 'C') return true
  // Count bonds to this atom
  const bondCount = bonds.filter(b => b.a1 === index || b.a2 === index).length
  // Show terminal carbons (0 or 1 bond)
  return bondCount <= 1
}

/**
 * MoleculeViewer - renders a 2D chemical structure from a MOL block.
 *
 * Props:
 *   molBlock  {string}  - V2000 MOL block text
 *   smiles    {string}  - SMILES string (shown as fallback text if no molBlock)
 *   width     {number}  - SVG width  (default 320)
 *   height    {number}  - SVG height (default 240)
 *   className {string}  - additional CSS classes
 */
export default function MoleculeViewer({ molBlock, smiles, width = 320, height = 240, className = '' }) {
  const rendered = useMemo(() => {
    const parsed = parseMolBlock(molBlock)
    if (!parsed || parsed.atoms.length === 0) return null

    const { atoms, bonds } = parsed

    // Compute bounding box of coordinates
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const a of atoms) {
      if (a.x < minX) minX = a.x
      if (a.x > maxX) maxX = a.x
      if (a.y < minY) minY = a.y
      if (a.y > maxY) maxY = a.y
    }

    const rawW = maxX - minX || 1
    const rawH = maxY - minY || 1
    const PAD = 30

    const scaleX = (width - PAD * 2) / rawW
    const scaleY = (height - PAD * 2) / rawH
    const scale = Math.min(scaleX, scaleY, 60) // cap scale so single atoms aren't huge

    // Map MOL coordinates → SVG coordinates (flip Y since MOL Y goes up, SVG Y goes down)
    const cx = (maxX + minX) / 2
    const cy = (maxY + minY) / 2
    const pts = atoms.map(a => ({
      x: (a.x - cx) * scale + width / 2,
      y: -(a.y - cy) * scale + height / 2,
      symbol: a.symbol,
    }))

    const bondLines = buildBondLines(bonds, pts)

    const labels = atoms.map((atom, i) => ({
      ...pts[i],
      symbol: atom.symbol,
      show: shouldLabel(atom, i, atoms, bonds),
      color: ELEMENT_COLORS[atom.symbol] || DEFAULT_COLOR,
    }))

    return { bondLines, labels }
  }, [molBlock, width, height])

  // No renderable structure
  if (!rendered) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 ${className}`}
           style={{ width, height }}>
        <svg className="h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.43 1.43a2.25 2.25 0 000 3.182l1.768 1.768a2.25 2.25 0 003.182 0L10 19.4m-5-4.9l5 4.9m0 0l4.8-4.1m0 0l1.43-1.43a2.25 2.25 0 013.182 0l1.768 1.768a2.25 2.25 0 010 3.182L19 20.8" />
        </svg>
        {smiles ? (
          <p className="text-xs text-gray-400 text-center px-4 font-mono break-all">{smiles}</p>
        ) : (
          <p className="text-xs text-gray-400">No structure available</p>
        )}
      </div>
    )
  }

  const { bondLines, labels } = rendered
  const LABEL_R = 8 // radius of background circle behind labels

  return (
    <div className={className}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
           className="bg-white rounded-lg border border-gray-100">
        {/* Bonds */}
        {bondLines.map(l => (
          <line
            key={l.key}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#9ca3af"
            strokeWidth={BOND_STROKE}
            strokeLinecap="round"
            strokeDasharray={l.dash ? DASH_PATTERN : undefined}
          />
        ))}

        {/* Atom labels */}
        {labels.map((lbl, i) =>
          lbl.show ? (
            <g key={`a${i}`}>
              {/* White background to occlude bonds behind label */}
              <circle cx={lbl.x} cy={lbl.y} r={LABEL_R} fill="white" />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={lbl.color}
                fontSize="11"
                fontWeight="600"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {lbl.symbol}
              </text>
            </g>
          ) : null
        )}
      </svg>
    </div>
  )
}
