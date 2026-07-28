import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon, EyeIcon, BeakerIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { getSamples, deleteSample, bulkDeleteSamples, clearAllSamples, getChemicalsDropdown, linkSampleChemicals } from '../services/api'

export default function SamplesView() {
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedSample, setSelectedSample] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [chemicalOptions, setChemicalOptions] = useState([])
  const [linkedIds, setLinkedIds] = useState([])
  const [savingLinks, setSavingLinks] = useState(false)

  useEffect(() => {
    loadSamples()
  }, [pagination.page, search])

  // Load the chemical dropdown once (for the manual linking UI).
  useEffect(() => {
    getChemicalsDropdown()
      .then(res => setChemicalOptions(res.data || []))
      .catch(() => setChemicalOptions([]))
  }, [])

  // When a sample is opened, seed the linked-chemicals editor.
  useEffect(() => {
    setLinkedIds(selectedSample?.chemical_ids || [])
  }, [selectedSample])

  const loadSamples = async () => {
    setLoading(true)
    try {
      const response = await getSamples({
        page: pagination.page,
        limit: pagination.limit,
        search: search
      })
      setSamples(response.data.data)
      setPagination(prev => ({ ...prev, ...response.data.pagination }))
    } catch (error) {
      toast.error('Failed to load samples')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadSamples()
  }

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800',
      in_use: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      consumed: 'bg-orange-100 text-orange-800',
      expired: 'bg-red-100 text-red-800',
      discarded: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const toggleLinked = (chemId) => {
    setLinkedIds(prev =>
      prev.includes(chemId) ? prev.filter(id => id !== chemId) : [...prev, chemId]
    )
  }

  const handleSaveLinks = async () => {
    if (!selectedSample) return
    setSavingLinks(true)
    try {
      const res = await linkSampleChemicals(selectedSample.sample_id, linkedIds)
      toast.success(res.data.message || 'Chemical links saved')
      if (res.data.unknownChemicalIds?.length) {
        toast(`Note: ${res.data.unknownChemicalIds.length} id(s) not found in chemicals`, { icon: '⚠️' })
      }
      // Reflect the change locally.
      setSelectedSample(s => ({ ...s, chemical_ids: res.data.chemical_ids }))
      setSamples(list => list.map(s =>
        s.sample_id === selectedSample.sample_id ? { ...s, chemical_ids: res.data.chemical_ids } : s
      ))
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save links')
    } finally {
      setSavingLinks(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sample?')) return
    try {
      await deleteSample(id)
      toast.success('Sample deleted successfully')
      loadSamples()
    } catch (error) {
      toast.error('Failed to delete sample')
    }
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(samples.map(s => s.sample_id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('No samples selected')
      return
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} samples?`)) return
    try {
      const response = await bulkDeleteSamples(selectedIds)
      toast.success(response.data.message)
      setSelectedIds([])
      loadSamples()
    } catch (error) {
      toast.error('Failed to delete samples')
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to DELETE ALL samples? This cannot be undone!')) return
    if (!window.confirm('This will permanently delete ALL samples in the database. Confirm again to proceed.')) return
    try {
      const response = await clearAllSamples()
      toast.success(response.data.message)
      setSelectedIds([])
      loadSamples()
    } catch (error) {
      toast.error('Failed to clear samples')
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Samples</h1>
          <p className="text-gray-500">View and manage your sample database</p>
        </div>
        <Link
          to="/samples/upload"
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Upload Samples
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by barcode, identification, project, type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
          Showing {samples.length} of {pagination.total.toLocaleString()} samples
          {selectedIds.length > 0 && (
            <span className="ml-2 text-green-600 font-medium">({selectedIds.length} selected)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Delete Selected
            </button>
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
          </div>
        ) : samples.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No samples found</p>
            <Link to="/samples/upload" className="text-green-600 hover:text-green-700 mt-2 inline-block">
              Upload your first samples →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={samples.length > 0 && selectedIds.length === samples.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                  </th>
                  <th>Sample ID</th>
                  <th>Identification</th>
                  <th>Content Type</th>
                  <th>Material Type</th>
                  <th>Project</th>
                  <th>Reception Date</th>
                  <th>Chemicals</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((sample) => (
                  <tr key={sample.sample_id} className={selectedIds.includes(sample.sample_id) ? 'bg-green-50' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(sample.sample_id)}
                        onChange={() => handleSelectOne(sample.sample_id)}
                        className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                    </td>
                    <td className="font-mono text-sm">{sample.sample_id}</td>
                    <td className="font-medium">{sample.identification || sample.name || '-'}</td>
                    <td>{sample.content_type || '-'}</td>
                    <td>{sample.material_type || '-'}</td>
                    <td>{sample.project_number || '-'}</td>
                    <td>{sample.reception_date || '-'}</td>
                    <td>
                      {sample.chemical_ids && sample.chemical_ids.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {sample.chemical_ids.length}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">none</span>
                      )}
                    </td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(sample.status)}`}>
                        {sample.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSample(sample)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View details"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sample.sample_id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
      {selectedSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">{selectedSample.name}</h2>
                <button
                  onClick={() => setSelectedSample(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Sample ID (Barcode)</label>
                  <p className="font-mono">{selectedSample.sample_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedSample.status)}`}>
                      {selectedSample.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Identification</label>
                  <p>{selectedSample.identification || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Content Type</label>
                  <p>{selectedSample.content_type || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Material Type</label>
                  <p>{selectedSample.material_type || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Project Number</label>
                  <p>{selectedSample.project_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Responsible Person</label>
                  <p>{selectedSample.responsible_person || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Group Name</label>
                  <p>{selectedSample.group_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reception Date</label>
                  <p>{selectedSample.reception_date || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Expiry Date</label>
                  <p>{selectedSample.expiry_date || '-'}</p>
                </div>
              </div>
              {selectedSample.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="bg-gray-50 p-3 rounded whitespace-pre-line">{selectedSample.description}</p>
                </div>
              )}

              {/* Linked Chemicals — manual mapping */}
              <div className="border-t pt-4">
                <div className="flex items-center mb-2">
                  <BeakerIcon className="h-5 w-5 text-purple-600 mr-2" />
                  <label className="text-sm font-semibold text-gray-700">
                    Linked Chemicals ({linkedIds.length})
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  A sample can be linked to several chemicals. Select chemicals below and save.
                </p>
                {chemicalOptions.length === 0 ? (
                  <p className="text-sm text-gray-400">No chemicals available to link. Upload chemicals first.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {chemicalOptions.map((c) => (
                      <label
                        key={c.chemical_id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={linkedIds.includes(c.chemical_id)}
                          onChange={() => toggleLinked(c.chemical_id)}
                          className="h-4 w-4 text-purple-600 rounded"
                        />
                        <span className="text-sm text-gray-700">
                          <span className="font-mono text-xs text-gray-500">{c.chemical_id}</span>
                          {' — '}{c.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleSaveLinks}
                    disabled={savingLinks}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                  >
                    {savingLinks ? 'Saving…' : 'Save Chemical Links'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedSample(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
