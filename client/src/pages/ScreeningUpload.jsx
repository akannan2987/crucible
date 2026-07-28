import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon, BeakerIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { uploadScreeningExcel, createScreening, getChemicalsDropdown } from '../services/api'

export default function ScreeningUpload() {
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [chemicals, setChemicals] = useState([])
  const [manualData, setManualData] = useState({
    screening_id: '',
    chemical_id: '',
    assay_name: '',
    assay_type: '',
    target: '',
    result_value: '',
    result_unit: '',
    result_qualifier: '',
    activity: '',
    concentration: '',
    concentration_unit: '',
    plate_id: '',
    well_position: '',
    experiment_date: '',
    operator: '',
    notes: ''
  })

  useEffect(() => {
    loadChemicals()
  }, [])

  const loadChemicals = async () => {
    try {
      const response = await getChemicalsDropdown()
      setChemicals(response.data)
    } catch (error) {
      console.error('Error loading chemicals:', error)
    }
  }

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const validExtensions = ['.xlsx', '.xls', '.xlsm']
      const fileExt = droppedFile.name.substring(droppedFile.name.lastIndexOf('.')).toLowerCase()
      
      if (validExtensions.includes(fileExt)) {
        setFile(droppedFile)
        setUploadResult(null)
      } else {
        toast.error('Please upload an Excel file (.xlsx, .xls, .xlsm)')
      }
    }
  }, [])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await uploadScreeningExcel(formData)
      setUploadResult(response.data)
      toast.success(`Successfully uploaded ${response.data.inserted} screening records`)
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Upload failed'
      toast.error(errorMsg)
      setUploadResult({ error: errorMsg })
    } finally {
      setUploading(false)
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    
    if (!manualData.chemical_id || !manualData.assay_name) {
      toast.error('Chemical and Assay Name are required')
      return
    }

    try {
      await createScreening({
        ...manualData,
        result_value: manualData.result_value ? parseFloat(manualData.result_value) : null,
        concentration: manualData.concentration ? parseFloat(manualData.concentration) : null
      })
      toast.success('Screening record added successfully')
      navigate('/screening')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add screening record')
    }
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Upload Screening Data - ELN</h1>
        <p className="text-gray-500">Electronic Lab Notebook - Import screening data linked to chemicals</p>
      </div>

      {/* Important Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-start">
          <BeakerIcon className="h-6 w-6 text-purple-600 mr-3 mt-0.5" />
          <div>
            <h3 className="font-medium text-purple-900">Screening Data Links to Chemicals</h3>
            <p className="text-sm text-purple-700 mt-1">
              Each screening record must be associated with an existing chemical. Make sure to upload your chemicals first before adding screening data.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Options */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setShowManualForm(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !showManualForm ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          File Upload (Excel)
        </button>
        <button
          onClick={() => setShowManualForm(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showManualForm ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {!showManualForm ? (
        /* File Upload Section */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload Excel File</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload screening data in Excel format. Each row must include a valid chemical_id.
          </p>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-purple-50 border-purple-400' : ''}
            `}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {file ? (
              <div className="flex flex-col items-center">
                <DocumentIcon className="h-12 w-12 text-purple-500 mb-3" />
                <p className="text-lg font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setUploadResult(null)
                  }}
                  className="mt-3 text-red-600 hover:text-red-700 flex items-center"
                >
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-lg font-medium text-gray-700">
                  Drag and drop your Excel file here
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg font-medium
                       hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  Upload Screening Data
                </>
              )}
            </button>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`mt-6 p-4 rounded-lg ${uploadResult.error ? 'bg-red-50' : 'bg-green-50'}`}>
              {uploadResult.error ? (
                <p className="text-red-700">{uploadResult.error}</p>
              ) : (
                <div>
                  <div className="flex items-center text-green-700">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">{uploadResult.message}</span>
                  </div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-orange-600 font-medium">Some records had issues:</p>
                      <ul className="text-sm text-orange-600 list-disc list-inside mt-1">
                        {uploadResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err.record}: {err.error}</li>
                        ))}
                        {uploadResult.errors.length > 5 && (
                          <li>...and {uploadResult.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/screening')}
                    className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    View screening data →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Manual Entry Form */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Manual Screening Entry</h2>
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group md:col-span-2">
                <label className="form-label">Chemical *</label>
                <select
                  value={manualData.chemical_id}
                  onChange={(e) => setManualData({ ...manualData, chemical_id: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Select a chemical...</option>
                  {chemicals.map((chem) => (
                    <option key={chem.chemical_id} value={chem.chemical_id}>
                      {chem.name} ({chem.chemical_id})
                    </option>
                  ))}
                </select>
                {chemicals.length === 0 && (
                  <p className="text-sm text-orange-600 mt-1">
                    No chemicals found. <a href="/chemicals/upload" className="underline">Upload chemicals first</a>.
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Assay Name *</label>
                <input
                  type="text"
                  value={manualData.assay_name}
                  onChange={(e) => setManualData({ ...manualData, assay_name: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Cell Viability Assay"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assay Type</label>
                <input
                  type="text"
                  value={manualData.assay_type}
                  onChange={(e) => setManualData({ ...manualData, assay_type: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Biochemical, Cell-based"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target</label>
                <input
                  type="text"
                  value={manualData.target}
                  onChange={(e) => setManualData({ ...manualData, target: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Kinase, Receptor"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Activity</label>
                <select
                  value={manualData.activity}
                  onChange={(e) => setManualData({ ...manualData, activity: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select...</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Inconclusive">Inconclusive</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Result Value</label>
                <input
                  type="number"
                  step="any"
                  value={manualData.result_value}
                  onChange={(e) => setManualData({ ...manualData, result_value: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 50"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Result Unit</label>
                <input
                  type="text"
                  value={manualData.result_unit}
                  onChange={(e) => setManualData({ ...manualData, result_unit: e.target.value })}
                  className="form-input"
                  placeholder="e.g., %, nM, µM"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Concentration</label>
                <input
                  type="number"
                  step="any"
                  value={manualData.concentration}
                  onChange={(e) => setManualData({ ...manualData, concentration: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Concentration Unit</label>
                <input
                  type="text"
                  value={manualData.concentration_unit}
                  onChange={(e) => setManualData({ ...manualData, concentration_unit: e.target.value })}
                  className="form-input"
                  placeholder="e.g., µM"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plate ID</label>
                <input
                  type="text"
                  value={manualData.plate_id}
                  onChange={(e) => setManualData({ ...manualData, plate_id: e.target.value })}
                  className="form-input"
                  placeholder="e.g., PLATE-001"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Well Position</label>
                <input
                  type="text"
                  value={manualData.well_position}
                  onChange={(e) => setManualData({ ...manualData, well_position: e.target.value })}
                  className="form-input"
                  placeholder="e.g., A1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Experiment Date</label>
                <input
                  type="date"
                  value={manualData.experiment_date}
                  onChange={(e) => setManualData({ ...manualData, experiment_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Operator</label>
                <input
                  type="text"
                  value={manualData.operator}
                  onChange={(e) => setManualData({ ...manualData, operator: e.target.value })}
                  className="form-input"
                  placeholder="Researcher name"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                value={manualData.notes}
                onChange={(e) => setManualData({ ...manualData, notes: e.target.value })}
                className="form-input"
                rows="2"
                placeholder="Additional notes"
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/screening')}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Screening Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-purple-50 rounded-xl p-6">
        <h3 className="font-semibold text-purple-900 mb-2">Excel File Format</h3>
        <p className="text-sm text-purple-800 mb-3">
          Your Excel file must include a chemical_id column. Supported columns:
        </p>
        <ul className="text-sm text-purple-700 list-disc list-inside space-y-1 grid grid-cols-2 gap-1">
          <li>chemical_id (required)</li>
          <li>assay_name (required)</li>
          <li>assay_type</li>
          <li>target</li>
          <li>result_value</li>
          <li>result_unit</li>
          <li>result_qualifier</li>
          <li>activity</li>
          <li>concentration</li>
          <li>concentration_unit</li>
          <li>plate_id</li>
          <li>well_position</li>
          <li>experiment_date</li>
          <li>operator</li>
          <li>notes</li>
        </ul>
      </div>
    </div>
  )
}
