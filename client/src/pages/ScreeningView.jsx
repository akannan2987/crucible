import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon, EyeIcon, BeakerIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { getScreening, deleteScreening } from '../services/api'

export default function ScreeningView() {
  const [searchParams] = useSearchParams()
  const [screening, setScreening] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chemicalFilter, setChemicalFilter] = useState(searchParams.get('chemical_id') || '')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedRecord, setSelectedRecord] = useState(null)

  useEffect(() => {
    loadScreening()
  }, [pagination.page, search, chemicalFilter])

  const loadScreening = async () => {
    setLoading(true)
    try {
      const response = await getScreening({
        page: pagination.page,
        limit: pagination.limit,
        search: search,
        chemical_id: chemicalFilter
      })
      setScreening(response.data.data)
      setPagination(prev => ({ ...prev, ...response.data.pagination }))
    } catch (error) {
      toast.error('Failed to load screening data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadScreening()
  }

  const handleDelete = async (screeningId) => {
    if (!confirm('Are you sure you want to delete this screening record?')) return
    
    try {
      await deleteScreening(screeningId)
      toast.success('Screening record deleted successfully')
      loadScreening()
    } catch (error) {
      toast.error('Failed to delete screening record')
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Screening Data</h1>
          <p className="text-gray-500">View and manage screening results linked to chemicals</p>
        </div>
        <Link
          to="/screening/upload"
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Upload Screening Data
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by assay name, ID, or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="sm:w-64">
            <input
              type="text"
              placeholder="Filter by Chemical ID"
              value={chemicalFilter}
              onChange={(e) => setChemicalFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="px-4 py-2 text-purple-600 hover:text-purple-700"
            >
              Clear Filter
            </button>
          )}
        </form>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {screening.length} of {pagination.total.toLocaleString()} screening records
          {chemicalFilter && <span className="text-purple-600"> (filtered by chemical: {chemicalFilter})</span>}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : screening.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No screening records found</p>
            <Link to="/screening/upload" className="text-purple-600 hover:text-purple-700 mt-2 inline-block">
              Upload screening data →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Screening ID</th>
                  <th>Chemical</th>
                  <th>Assay Name</th>
                  <th>Target</th>
                  <th>Result</th>
                  <th>Activity</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {screening.map((record) => (
                  <tr key={record.screening_id}>
                    <td className="font-mono text-sm">{record.screening_id}</td>
                    <td>
                      <Link 
                        to={`/chemicals?search=${record.chemical_id}`}
                        className="flex items-center text-blue-600 hover:text-blue-700"
                      >
                        <BeakerIcon className="h-4 w-4 mr-1" />
                        {record.chemical_name || record.chemical_id}
                      </Link>
                    </td>
                    <td className="font-medium">{record.assay_name}</td>
                    <td>{record.target || '-'}</td>
                    <td>
                      {record.result_value !== null 
                        ? `${record.result_qualifier || ''}${record.result_value} ${record.result_unit || ''}`
                        : '-'
                      }
                    </td>
                    <td>
                      {record.activity && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          record.activity.toLowerCase() === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : record.activity.toLowerCase() === 'inactive'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.activity}
                        </span>
                      )}
                    </td>
                    <td>{record.experiment_date || '-'}</td>
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
                          onClick={() => handleDelete(record.screening_id)}
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
            <div className="p-6 border-b bg-purple-50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">{selectedRecord.assay_name}</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{selectedRecord.screening_id}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Chemical</label>
                  <p className="font-medium">{selectedRecord.chemical_name || selectedRecord.chemical_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Assay Type</label>
                  <p>{selectedRecord.assay_type || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Target</label>
                  <p>{selectedRecord.target || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Activity</label>
                  <p>{selectedRecord.activity || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Result</label>
                  <p className="font-mono">
                    {selectedRecord.result_value !== null 
                      ? `${selectedRecord.result_qualifier || ''}${selectedRecord.result_value} ${selectedRecord.result_unit || ''}`
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Concentration</label>
                  <p>
                    {selectedRecord.concentration 
                      ? `${selectedRecord.concentration} ${selectedRecord.concentration_unit || ''}`
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Plate ID</label>
                  <p>{selectedRecord.plate_id || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Well Position</label>
                  <p>{selectedRecord.well_position || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Experiment Date</label>
                  <p>{selectedRecord.experiment_date || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Operator</label>
                  <p>{selectedRecord.operator || '-'}</p>
                </div>
              </div>
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
