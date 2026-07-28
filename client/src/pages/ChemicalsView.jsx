import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon, EyeIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { getChemicals, deleteChemical, bulkDeleteChemicals, bulkUpdateChemicals, clearAllChemicals } from '../services/api'
import MoleculeViewer from '../components/MoleculeViewer'

export default function ChemicalsView() {
  const [chemicals, setChemicals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedChemical, setSelectedChemical] = useState(null)
  const [detailTab, setDetailTab] = useState('identity')
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditData, setBulkEditData] = useState({
    supplier: '',
    cas_number: '',
    molecular_formula: '',
    molecular_weight: ''
  })

  useEffect(() => {
    loadChemicals()
  }, [pagination.page, search])

  const loadChemicals = async () => {
    setLoading(true)
    try {
      const response = await getChemicals({
        page: pagination.page,
        limit: pagination.limit,
        search: search
      })
      setChemicals(response.data.data)
      setPagination(prev => ({ ...prev, ...response.data.pagination }))
    } catch (error) {
      toast.error('Failed to load chemicals')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadChemicals()
  }

  const handleDelete = async (chemicalId) => {
    if (!confirm('Are you sure you want to delete this chemical?')) return
    
    try {
      await deleteChemical(chemicalId)
      toast.success('Chemical deleted successfully')
      loadChemicals()
    } catch (error) {
      toast.error('Failed to delete chemical')
    }
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(chemicals.map(c => c.chemical_id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (chemicalId) => {
    setSelectedIds(prev => {
      if (prev.includes(chemicalId)) {
        return prev.filter(id => id !== chemicalId)
      } else {
        return [...prev, chemicalId]
      }
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('No chemicals selected')
      return
    }
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} chemicals?`)) return

    try {
      const response = await bulkDeleteChemicals(selectedIds)
      toast.success(response.data.message)
      setSelectedIds([])
      loadChemicals()
    } catch (error) {
      toast.error('Failed to delete chemicals')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to DELETE ALL chemicals? This cannot be undone!')) return
    if (!confirm('This will permanently delete ALL chemicals in the database. Type "yes" to confirm.')) return

    try {
      const response = await clearAllChemicals()
      toast.success(response.data.message)
      setSelectedIds([])
      loadChemicals()
    } catch (error) {
      toast.error('Failed to clear chemicals')
    }
  }

  const handleBulkEdit = async () => {
    if (selectedIds.length === 0) {
      toast.error('No chemicals selected')
      return
    }

    // Filter out empty fields
    const updates = {}
    if (bulkEditData.supplier) updates.supplier = bulkEditData.supplier
    if (bulkEditData.cas_number) updates.cas_number = bulkEditData.cas_number
    if (bulkEditData.molecular_formula) updates.molecular_formula = bulkEditData.molecular_formula
    if (bulkEditData.molecular_weight) updates.molecular_weight = parseFloat(bulkEditData.molecular_weight)

    if (Object.keys(updates).length === 0) {
      toast.error('No fields to update')
      return
    }

    try {
      const response = await bulkUpdateChemicals(selectedIds, updates)
      toast.success(response.data.message)
      setShowBulkEdit(false)
      setBulkEditData({ supplier: '', cas_number: '', molecular_formula: '', molecular_weight: '' })
      loadChemicals()
    } catch (error) {
      toast.error('Failed to update chemicals')
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chemicals</h1>
          <p className="text-gray-500">View and manage your chemical database</p>
        </div>
        <Link
          to="/chemicals/upload"
          className="inline-flex items-center px-4 py-2 bg-pandora-600 text-white rounded-lg hover:bg-pandora-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Upload Chemicals
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or CAS number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pandora-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Results Count and Bulk Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-gray-500">
          Showing {chemicals.length} of {pagination.total.toLocaleString()} chemicals
          {selectedIds.length > 0 && (
            <span className="ml-2 text-pandora-600 font-medium">({selectedIds.length} selected)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => setShowBulkEdit(true)}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PencilSquareIcon className="h-4 w-4 mr-1" />
                Edit Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete Selected
              </button>
            </>
          )}
          {pagination.total > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full m-4">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Bulk Edit {selectedIds.length} Chemicals</h2>
                <button
                  onClick={() => setShowBulkEdit(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Only filled fields will be updated</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={bulkEditData.supplier}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pandora-500"
                  placeholder="Leave empty to skip"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CAS Number</label>
                <input
                  type="text"
                  value={bulkEditData.cas_number}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, cas_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pandora-500"
                  placeholder="Leave empty to skip"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Molecular Formula</label>
                <input
                  type="text"
                  value={bulkEditData.molecular_formula}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, molecular_formula: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pandora-500"
                  placeholder="Leave empty to skip"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Molecular Weight (g/mol)</label>
                <input
                  type="number"
                  step="0.01"
                  value={bulkEditData.molecular_weight}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, molecular_weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pandora-500"
                  placeholder="Leave empty to skip"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkEdit(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEdit}
                className="px-4 py-2 bg-pandora-600 text-white rounded-lg hover:bg-pandora-700"
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pandora-600"></div>
          </div>
        ) : chemicals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No chemicals found</p>
            <Link to="/chemicals/upload" className="text-pandora-600 hover:text-pandora-700 mt-2 inline-block">
              Upload your first chemicals →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10 sticky left-0 z-10 bg-gray-50">
                    <input
                      type="checkbox"
                      checked={chemicals.length > 0 && selectedIds.length === chemicals.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-pandora-600 rounded border-gray-300 focus:ring-pandora-500"
                    />
                  </th>
                  <th>DTX_ID</th>
                  <th>Name</th>
                  <th>CAS Number</th>
                  <th>Synonyms</th>
                  <th>Molecular Formula</th>
                  <th>Mol. Weight</th>
                  <th>SMILES</th>
                  <th>Presence</th>
                  <th>EU PM Code</th>
                  <th>US FCS Code</th>
                  <th>Role / Usage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {chemicals.map((chemical) => {
                  const meta = chemical.metadata || {}
                  const presenceTags = []
                  if (meta['Present in PLASTIC']) presenceTags.push('PLA')
                  if (meta['Present in COATING']) presenceTags.push('COA')
                  if (meta['Present in INK']) presenceTags.push('INK')
                  if (meta['Present in PAPER and BOARD']) presenceTags.push('P&B')
                  if (meta['Present in RUBBER']) presenceTags.push('RUB')
                  if (meta['Present in ADHESIVE']) presenceTags.push('ADH')
                  if (meta['Present as NIAS']) presenceTags.push('NIAS')

                  return (
                  <tr key={chemical.chemical_id} className={selectedIds.includes(chemical.chemical_id) ? 'bg-pandora-50' : ''}>
                    <td className="sticky left-0 z-10 bg-white">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(chemical.chemical_id)}
                        onChange={() => handleSelectOne(chemical.chemical_id)}
                        className="h-4 w-4 text-pandora-600 rounded border-gray-300 focus:ring-pandora-500"
                      />
                    </td>
                    <td className="font-mono text-xs text-blue-700 whitespace-nowrap">{chemical.chemical_id}</td>
                    <td className="font-medium max-w-[200px] truncate" title={chemical.name}>{chemical.name}</td>
                    <td className="whitespace-nowrap">{chemical.cas_number || '-'}</td>
                    <td className="text-xs text-gray-500 max-w-[150px] truncate" title={meta['Synonyms / Composition'] || ''}>{meta['Synonyms / Composition'] || '-'}</td>
                    <td className="font-mono text-sm whitespace-nowrap">{chemical.molecular_formula || '-'}</td>
                    <td className="whitespace-nowrap">{chemical.molecular_weight ? `${chemical.molecular_weight}` : '-'}</td>
                    <td className="font-mono text-xs max-w-[120px] truncate" title={chemical.smiles || ''}>{chemical.smiles || '-'}</td>
                    <td className="whitespace-nowrap">
                      {presenceTags.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {presenceTags.map(tag => (
                            <span key={tag} className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700">{tag}</span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="text-xs whitespace-nowrap">{meta['EU PM substance code'] || '-'}</td>
                    <td className="text-xs whitespace-nowrap">{meta['US FCS code'] || '-'}</td>
                    <td className="text-xs max-w-[120px] truncate" title={meta['Role / Usage / Source / NIAS'] || ''}>{meta['Role / Usage / Source / NIAS'] || '-'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedChemical(chemical); setDetailTab('identity'); }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View details"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(chemical.chemical_id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-1 text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedChemical && (() => {
        const meta = selectedChemical.metadata || {}
        const m = (key) => meta[key] || null
        const presenceKeys = [
          ['Present in PLASTIC', 'Plastic'], ['Present in COATING', 'Coating'],
          ['Present in INK', 'Ink'], ['Present in PAPER and BOARD', 'Paper & Board'],
          ['Present in RUBBER', 'Rubber'], ['Present in ADHESIVE', 'Adhesive'],
          ['Present as NIAS', 'NIAS']
        ]
        // Collect keys already shown in structured tabs so we can exclude them from "All Properties"
        const shownKeys = new Set([
          'INPUT', 'FOUND_BY', 'DTXSID', 'PREFERRED_NAME', 'SMILES', 'MS_READY_SMILES',
          'MOLECULAR_FORMULA', 'MONOISOTOPIC_MASS', 'INCHI_STRING',
          'CAS Number', 'Chemical name', 'Synonyms / Composition', 'Exact Molecular Weight',
          'Molecular Formula', 'Color Index Code', 'Used as EU food additive',
          'Present in PLASTIC', 'Present in COATING', 'Present in INK',
          'Present in PAPER and BOARD', 'Present in RUBBER', 'Present in ADHESIVE', 'Present as NIAS',
          'Role / Usage / Source / NIAS',
          'EU FCM substance code', 'EU PM substance code',
          'Listed / Updated in EU plastic regulation',
          'Restrictions and Specifications in EU plastic regulation',
          'ADI/TDI (mg/kg bw /day)', 'EFSA Opinions',
          'Substance ID. n\u00ba', 'Listed in part A or B',
          'Restrictions and Specifications (SML in mg/kg)',
          'Changes and Reasons', 'Additive code (FCA)',
          'Scope as Additive (link to restrictions)',
          'Generic name of Base material', 'Scope as Base material (link to restrictions)',
          'US FCS code', 'US FCN + TOR codes', 'US 21 CFR REGNum (list of articles)',
          'Nestle policy (St-80.008 and ink guidance note)',
          'Nestle safety-based level SBL (mg/kg food)',
          'Other information (SVHC, ACGIH, OSHA, DL50\u00b0)',
          'Approval for rubber in countries',
          'Safety or quality risk in printing inks', 'Safety issue in printing inks',
          'Quality issue in printing inks', 'Frequency in printing inks',
          'log P(o/w) (25\u00b0C)', 'RI from compilation (DB-5)', 'Column for ad-hoc selection'
        ])
        const extraKeys = Object.keys(meta).filter(k => !shownKeys.has(k) && meta[k] && String(meta[k]).trim())

        const tabs = [
          { id: 'identity', label: 'Identity' },
          { id: 'presence', label: 'Presence & Role' },
          { id: 'regulatory', label: 'EU / US Regulatory' },
          { id: 'safety', label: 'Safety & Nestlé' },
          { id: 'all', label: 'All Properties' },
        ]

        // Helper for a detail row
        const Row = ({ label, value, mono, full }) => {
          const v = value && String(value).trim()
          if (!v) return null
          return (
            <div className={full ? 'col-span-2' : ''}>
              <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
              <dd className={`text-sm text-gray-800 mt-0.5 ${mono ? 'font-mono text-xs break-all' : ''}`}>{v}</dd>
            </div>
          )
        }

        // Presence badge
        const Badge = ({ on, label }) => (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${on ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'}`}>
            {on ? '✓' : '–'} {label}
          </span>
        )

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col m-4">
            {/* Header */}
            <div className="p-5 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedChemical.name}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{selectedChemical.chemical_id}</span>
                    {selectedChemical.cas_number && (
                      <span className="text-xs text-gray-500">CAS: {selectedChemical.cas_number}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedChemical(null)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Structure + Quick Info row */}
            <div className="flex flex-col md:flex-row gap-4 p-5 border-b flex-shrink-0">
              <div className="flex-shrink-0">
                <MoleculeViewer molBlock={selectedChemical.mol_block} smiles={selectedChemical.smiles} width={240} height={180} />
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 content-start text-sm">
                <div><span className="text-[11px] text-gray-400 block">Formula</span><span className="font-mono text-xs">{selectedChemical.molecular_formula || '—'}</span></div>
                <div><span className="text-[11px] text-gray-400 block">Mol. Weight</span><span>{selectedChemical.molecular_weight ? `${selectedChemical.molecular_weight} g/mol` : '—'}</span></div>
                <div><span className="text-[11px] text-gray-400 block">Exact Mass</span><span className="font-mono text-xs">{m('MONOISOTOPIC_MASS') || m('Exact Molecular Weight') || '—'}</span></div>
                <div><span className="text-[11px] text-gray-400 block">SMILES</span><span className="font-mono text-[10px] break-all line-clamp-2" title={selectedChemical.smiles}>{selectedChemical.smiles || '—'}</span></div>
                <div><span className="text-[11px] text-gray-400 block">Synonyms</span><span className="text-xs line-clamp-2" title={m('Synonyms / Composition')}>{m('Synonyms / Composition') || '—'}</span></div>
                <div><span className="text-[11px] text-gray-400 block">Color Index</span><span className="text-xs">{m('Color Index Code') || '—'}</span></div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b flex-shrink-0">
              <div className="flex overflow-x-auto px-5">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      detailTab === tab.id
                        ? 'border-pandora-600 text-pandora-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ─── Identity Tab ─── */}
              {detailTab === 'identity' && (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Row label="Chemical Name" value={selectedChemical.name} />
                  <Row label="Preferred Name (EPA)" value={m('PREFERRED_NAME')} />
                  <Row label="CAS Number" value={selectedChemical.cas_number} />
                  <Row label="DTXSID" value={m('DTXSID')} mono />
                  <Row label="Nestlé ID" value={selectedChemical.nestle_id} mono />
                  <Row label="Substance ID №" value={m('Substance ID. n\u00ba') || m('Substance ID. n\ufffd')} />
                  <Row label="Synonyms / Composition" value={m('Synonyms / Composition')} full />
                  <Row label="Molecular Formula" value={selectedChemical.molecular_formula} mono />
                  <Row label="Molecular Weight" value={selectedChemical.molecular_weight ? `${selectedChemical.molecular_weight} g/mol` : null} />
                  <Row label="Exact / Monoisotopic Mass" value={m('MONOISOTOPIC_MASS') || m('Exact Molecular Weight')} mono />
                  <Row label="SMILES" value={selectedChemical.smiles} mono full />
                  <Row label="MS-Ready SMILES" value={m('MS_READY_SMILES')} mono full />
                  <Row label="InChI" value={selectedChemical.inchi || m('INCHI_STRING')} mono full />
                  <Row label="InChIKey" value={selectedChemical.inchi_key} mono />
                  <Row label="Color Index Code" value={m('Color Index Code')} />
                  <Row label="log P (o/w) 25°C" value={m('log P(o/w) (25\u00b0C)') || m('log P(o/w) (25\ufffdC)')} />
                  <Row label="RI from compilation (DB-5)" value={m('RI from compilation (DB-5)')} />
                  <Row label="Supplier" value={selectedChemical.supplier} />
                  <Row label="Purity" value={selectedChemical.purity} />
                </dl>
              )}

              {/* ─── Presence & Role Tab ─── */}
              {detailTab === 'presence' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Material Presence Matrix</h4>
                    <div className="flex flex-wrap gap-2">
                      {presenceKeys.map(([key, label]) => (
                        <Badge key={key} on={!!m(key)} label={label} />
                      ))}
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <Row label="Role / Usage / Source / NIAS" value={m('Role / Usage / Source / NIAS')} full />
                    <Row label="Used as EU Food Additive" value={m('Used as EU food additive')} />
                    <Row label="Generic Name of Base Material" value={m('Generic name of Base material')} />
                  </dl>
                </div>
              )}

              {/* ─── EU / US Regulatory Tab ─── */}
              {detailTab === 'regulatory' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">EU Regulations</h4>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <Row label="EU FCM Substance Code" value={m('EU FCM substance code')} />
                      <Row label="EU PM Substance Code" value={m('EU PM substance code')} />
                      <Row label="Listed / Updated in EU Plastic Reg." value={m('Listed / Updated in EU plastic regulation')} />
                      <Row label="Restrictions & Specs (EU Plastic Reg.)" value={m('Restrictions and Specifications in EU plastic regulation')} full />
                      <Row label="ADI / TDI (mg/kg bw/day)" value={m('ADI/TDI (mg/kg bw /day)')} />
                      <Row label="EFSA Opinions" value={m('EFSA Opinions')} full />
                      <Row label="Listed in Part A or B" value={m('Listed in part A or B')} />
                      <Row label="Restrictions & Specs (SML mg/kg)" value={m('Restrictions and Specifications (SML in mg/kg)')} full />
                      <Row label="Changes and Reasons" value={m('Changes and Reasons')} full />
                      <Row label="Additive Code (FCA)" value={m('Additive code (FCA)')} />
                      <Row label="Scope as Additive" value={m('Scope as Additive (link to restrictions)')} full />
                      <Row label="Scope as Base Material" value={m('Scope as Base material (link to restrictions)')} full />
                    </dl>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">US Regulations</h4>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <Row label="US FCS Code" value={m('US FCS code')} />
                      <Row label="US FCN + TOR Codes" value={m('US FCN + TOR codes')} />
                      <Row label="US 21 CFR REGNum (Articles)" value={m('US 21 CFR REGNum (list of articles)')} full />
                    </dl>
                  </div>
                </div>
              )}

              {/* ─── Safety & Nestlé Tab ─── */}
              {detailTab === 'safety' && (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Row label="Nestlé Policy (St-80.008 / Ink Guidance)" value={m('Nestle policy (St-80.008 and ink guidance note)')} full />
                  <Row label="Nestlé Safety-Based Level SBL (mg/kg food)" value={m('Nestle safety-based level SBL (mg/kg food)')} />
                  <Row label="Other Info (SVHC, ACGIH, OSHA, DL50…)" value={m('Other information (SVHC, ACGIH, OSHA, DL50\u00b0)') || m('Other information (SVHC, ACGIH, OSHA, DL50\ufffd)')} full />
                  <Row label="Approval for Rubber in Countries" value={m('Approval for rubber in countries')} full />
                  <Row label="Safety or Quality Risk in Printing Inks" value={m('Safety or quality risk in printing inks')} full />
                  <Row label="Safety Issue in Printing Inks" value={m('Safety issue in printing inks')} full />
                  <Row label="Quality Issue in Printing Inks" value={m('Quality issue in printing inks')} full />
                  <Row label="Frequency in Printing Inks" value={m('Frequency in printing inks')} />
                  <Row label="Hazard Information" value={selectedChemical.hazard_info} full />
                  <Row label="Storage Conditions" value={selectedChemical.storage_conditions} full />
                </dl>
              )}

              {/* ─── All Properties Tab ─── */}
              {detailTab === 'all' && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 mb-3">All {Object.keys(meta).length} properties from the SDF file</p>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-1/3">Property</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(meta).map(([key, value]) => (
                          <tr key={key} className="border-b border-gray-100 hover:bg-white transition-colors">
                            <td className="px-3 py-1.5 text-xs font-medium text-gray-600 align-top">{key}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-800 break-all font-mono">{value && String(value).trim() ? String(value) : <span className="text-gray-300 italic">empty</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 flex-shrink-0">
              <Link to={`/screening?chemical_id=${selectedChemical.chemical_id}`} className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm">
                View Screening Data
              </Link>
              <Link to={`/toxicology?chemical_id=${selectedChemical.chemical_id}`} className="px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg text-sm">
                View Toxicology Data
              </Link>
              <button onClick={() => setSelectedChemical(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
