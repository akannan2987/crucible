import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon, EyeIcon, BeakerIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { getToxicology, deleteToxicology } from '../services/api'

export default function ToxicologyView() {
  const [searchParams] = useSearchParams()
  const [toxicology, setToxicology] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chemicalFilter, setChemicalFilter] = useState(searchParams.get('chemical_id') || '')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedRecord, setSelectedRecord] = useState(null)

  useEffect(() => {
    loadToxicology()
  }, [pagination.page, search, chemicalFilter])

  const loadToxicology = async () => {
    setLoading(true)
    try {
      const response = await getToxicology({
        page: pagination.page,
        limit: pagination.limit,
        search: search,
        chemical_id: chemicalFilter
      })
      setToxicology(response.data.data)
      setPagination(prev => ({ ...prev, ...response.data.pagination }))
    } catch (error) {
      toast.error('Failed to load toxicology data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadToxicology()
  }

  const handleDelete = async (toxId) => {
    if (!confirm('Are you sure you want to delete this toxicology record?')) return
    
    try {
      await deleteToxicology(toxId)
      toast.success('Toxicology record deleted successfully')
      loadToxicology()
    } catch (error) {
      toast.error('Failed to delete toxicology record')
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Toxicology Data</h1>
          <p className="text-gray-500">View and manage toxicology studies linked to chemicals</p>
        </div>
        <Link
          to="/toxicology/upload"
          className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Upload Toxicology Data
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by study type, ID, or endpoint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="sm:w-64">
            <input
              type="text"
              placeholder="Filter by Chemical ID"
              value={chemicalFilter}
              onChange={(e) => setChemicalFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Search
          </button>
          {chemicalFilter && (
            <button
              type="button"
              onClick={() => {
                setChemicalFilter('')
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-4 py-2 text-orange-600 hover:text-orange-700"
            >
              Clear Filter
            </button>
          )}
        </form>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {toxicology.length} of {pagination.total.toLocaleString()} toxicology records
          {chemicalFilter && <span className="text-orange-600"> (filtered by chemical: {chemicalFilter})</span>}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
          </div>
        ) : toxicology.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No toxicology records found</p>
            <Link to="/toxicology/upload" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
              Upload toxicology data →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tox ID</th>
                  <th>Chemical</th>
                  <th>Study Type</th>
                  <th>Species</th>
                  <th>Endpoint</th>
                  <th>NOAEL</th>
                  <th>LD50</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {toxicology.map((record) => (
                  <tr key={record.tox_id}>
                    <td className="font-mono text-sm">{record.tox_id}</td>
                    <td>
                      <Link 
                        to={`/chemicals?search=${record.chemical_id}`}
                        className="flex items-center text-blue-600 hover:text-blue-700"
                      >
                        <BeakerIcon className="h-4 w-4 mr-1" />
                        {record.chemical_name || record.chemical_id}
                      </Link>
                    </td>
                    <td className="font-medium">{record.study_type}</td>
                    <td>{record.species || '-'}</td>
                    <td>{record.endpoint || '-'}</td>
                    <td>
                      {record.noael !== null 
                        ? `${record.noael} ${record.noael_unit || ''}`
                        : '-'
                      }
                    </td>
                    <td>
                      {record.ld50 !== null 
                        ? `${record.ld50} ${record.ld50_unit || ''}`
                        : '-'
                      }
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View details"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.tox_id)}
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
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6 border-b bg-orange-50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">{selectedRecord.study_type}</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{selectedRecord.tox_id}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Chemical</label>
                  <p className="font-medium">{selectedRecord.chemical_name || selectedRecord.chemical_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Species</label>
                  <p>{selectedRecord.species || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Route of Exposure</label>
                  <p>{selectedRecord.route_of_exposure || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duration</label>
                  <p>{selectedRecord.duration || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Dose</label>
                  <p>
                    {selectedRecord.dose !== null 
                      ? `${selectedRecord.dose} ${selectedRecord.dose_unit || ''}`
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Endpoint</label>
                  <p>{selectedRecord.endpoint || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Effect</label>
                  <p>{selectedRecord.effect || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Study Date</label>
                  <p>{selectedRecord.study_date || '-'}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-800 mb-3">Toxicological Endpoints</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-sm font-medium text-gray-500">NOAEL</label>
                    <p className="text-lg font-semibold text-green-700">
                      {selectedRecord.noael !== null 
                        ? `${selectedRecord.noael} ${selectedRecord.noael_unit || ''}`
                        : '-'
                      }
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-sm font-medium text-gray-500">LOAEL</label>
                    <p className="text-lg font-semibold text-yellow-700">
                      {selectedRecord.loael !== null 
                        ? `${selectedRecord.loael} ${selectedRecord.loael_unit || ''}`
                        : '-'
                      }
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-sm font-medium text-gray-500">LD50</label>
                    <p className="text-lg font-semibold text-red-700">
                      {selectedRecord.ld50 !== null 
                        ? `${selectedRecord.ld50} ${selectedRecord.ld50_unit || ''}`
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {selectedRecord.reference && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Reference</label>
                  <p className="bg-gray-50 p-3 rounded">{selectedRecord.reference}</p>
                </div>
              )}
              {selectedRecord.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="bg-gray-50 p-3 rounded">{selectedRecord.notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
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
