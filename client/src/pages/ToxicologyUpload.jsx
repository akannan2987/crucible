import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { uploadToxicologyExcel, createToxicology, getChemicalsDropdown } from '../services/api'

export default function ToxicologyUpload() {
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [chemicals, setChemicals] = useState([])
  const [manualData, setManualData] = useState({
    tox_id: '',
    chemical_id: '',
    study_type: '',
    species: '',
    route_of_exposure: '',
    dose: '',
    dose_unit: '',
    duration: '',
    endpoint: '',
    effect: '',
    noael: '',
    noael_unit: '',
    loael: '',
    loael_unit: '',
    ld50: '',
    ld50_unit: '',
    reference: '',
    study_date: '',
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
      const response = await uploadToxicologyExcel(formData)
      setUploadResult(response.data)
      toast.success(`Successfully uploaded ${response.data.inserted} toxicology records`)
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
    
    if (!manualData.chemical_id || !manualData.study_type) {
      toast.error('Chemical and Study Type are required')
      return
    }

    try {
      await createToxicology({
        ...manualData,
        dose: manualData.dose ? parseFloat(manualData.dose) : null,
        noael: manualData.noael ? parseFloat(manualData.noael) : null,
        loael: manualData.loael ? parseFloat(manualData.loael) : null,
        ld50: manualData.ld50 ? parseFloat(manualData.ld50) : null
      })
      toast.success('Toxicology record added successfully')
      navigate('/toxicology')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add toxicology record')
    }
  }

  const studyTypes = [
    'Acute Toxicity',
    'Subacute Toxicity',
    'Subchronic Toxicity',
    'Chronic Toxicity',
    'Carcinogenicity',
    'Mutagenicity',
    'Genotoxicity',
    'Reproductive Toxicity',
    'Developmental Toxicity',
    'Neurotoxicity',
    'Immunotoxicity',
    'Dermal Toxicity',
    'Inhalation Toxicity',
    'Other'
  ]

  const routesOfExposure = [
    'Oral',
    'Dermal',
    'Inhalation',
    'Intravenous',
    'Intraperitoneal',
    'Subcutaneous',
    'Intramuscular',
    'Other'
  ]

  const species = [
    'Rat',
    'Mouse',
    'Rabbit',
    'Guinea pig',
    'Dog',
    'Monkey',
    'Human',
    'Other'
  ]

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Upload Toxicology Data - ELN</h1>
        <p className="text-gray-500">Electronic Lab Notebook - Import toxicology data linked to chemicals</p>
      </div>

      {/* Important Notice */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 mr-3 mt-0.5" />
          <div>
            <h3 className="font-medium text-orange-900">Toxicology Data Links to Chemicals</h3>
            <p className="text-sm text-orange-700 mt-1">
              Each toxicology record must be associated with an existing chemical. Make sure to upload your chemicals first before adding toxicology data.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Options */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setShowManualForm(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !showManualForm ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          File Upload (Excel)
        </button>
        <button
          onClick={() => setShowManualForm(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showManualForm ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
            Upload toxicology data in Excel format. Each row must include a valid chemical_id.
          </p>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${dragActive ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-orange-50 border-orange-400' : ''}
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
                <DocumentIcon className="h-12 w-12 text-orange-500 mb-3" />
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
              className="inline-flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg font-medium
                       hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  Upload Toxicology Data
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
                    onClick={() => navigate('/toxicology')}
                    className="mt-4 text-orange-600 hover:text-orange-700 font-medium"
                  >
                    View toxicology data →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Manual Entry Form */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Manual Toxicology Entry</h2>
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
              </div>
              <div className="form-group">
                <label className="form-label">Study Type *</label>
                <select
                  value={manualData.study_type}
                  onChange={(e) => setManualData({ ...manualData, study_type: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Select...</option>
                  {studyTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Species</label>
                <select
                  value={manualData.species}
                  onChange={(e) => setManualData({ ...manualData, species: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select...</option>
                  {species.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Route of Exposure</label>
                <select
                  value={manualData.route_of_exposure}
                  onChange={(e) => setManualData({ ...manualData, route_of_exposure: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select...</option>
                  {routesOfExposure.map((route) => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <input
                  type="text"
                  value={manualData.duration}
                  onChange={(e) => setManualData({ ...manualData, duration: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 28 days, 90 days"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dose</label>
                <input
                  type="number"
                  step="any"
                  value={manualData.dose}
                  onChange={(e) => setManualData({ ...manualData, dose: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 100"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dose Unit</label>
                <input
                  type="text"
                  value={manualData.dose_unit}
                  onChange={(e) => setManualData({ ...manualData, dose_unit: e.target.value })}
                  className="form-input"
                  placeholder="e.g., mg/kg/day"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Endpoint</label>
                <input
                  type="text"
                  value={manualData.endpoint}
                  onChange={(e) => setManualData({ ...manualData, endpoint: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Mortality, Body weight"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Effect</label>
                <input
                  type="text"
                  value={manualData.effect}
                  onChange={(e) => setManualData({ ...manualData, effect: e.target.value })}
                  className="form-input"
                  placeholder="Observed effect"
                />
              </div>
            </div>

            {/* Toxicological Endpoints */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-800 mb-4">Toxicological Endpoints</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <label className="form-label text-green-800">NOAEL</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      value={manualData.noael}
                      onChange={(e) => setManualData({ ...manualData, noael: e.target.value })}
                      className="form-input flex-1"
                      placeholder="Value"
                    />
                    <input
                      type="text"
                      value={manualData.noael_unit}
                      onChange={(e) => setManualData({ ...manualData, noael_unit: e.target.value })}
                      className="form-input w-24"
                      placeholder="Unit"
                    />
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <label className="form-label text-yellow-800">LOAEL</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      value={manualData.loael}
                      onChange={(e) => setManualData({ ...manualData, loael: e.target.value })}
                      className="form-input flex-1"
                      placeholder="Value"
                    />
                    <input
                      type="text"
                      value={manualData.loael_unit}
                      onChange={(e) => setManualData({ ...manualData, loael_unit: e.target.value })}
                      className="form-input w-24"
                      placeholder="Unit"
                    />
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <label className="form-label text-red-800">LD50</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      value={manualData.ld50}
                      onChange={(e) => setManualData({ ...manualData, ld50: e.target.value })}
                      className="form-input flex-1"
                      placeholder="Value"
                    />
                    <input
                      type="text"
                      value={manualData.ld50_unit}
                      onChange={(e) => setManualData({ ...manualData, ld50_unit: e.target.value })}
                      className="form-input w-24"
                      placeholder="Unit"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Study Date</label>
                <input
                  type="date"
                  value={manualData.study_date}
                  onChange={(e) => setManualData({ ...manualData, study_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input
                  type="text"
                  value={manualData.reference}
                  onChange={(e) => setManualData({ ...manualData, reference: e.target.value })}
                  className="form-input"
                  placeholder="Citation or reference"
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
                onClick={() => navigate('/toxicology')}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Add Toxicology Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-orange-50 rounded-xl p-6">
        <h3 className="font-semibold text-orange-900 mb-2">Excel File Format</h3>
        <p className="text-sm text-orange-800 mb-3">
          Your Excel file must include a chemical_id column. Supported columns:
        </p>
        <ul className="text-sm text-orange-700 list-disc list-inside space-y-1 grid grid-cols-2 gap-1">
          <li>chemical_id (required)</li>
          <li>study_type (required)</li>
          <li>species</li>
          <li>route_of_exposure</li>
          <li>dose</li>
          <li>dose_unit</li>
          <li>duration</li>
          <li>endpoint</li>
          <li>effect</li>
          <li>noael / noael_unit</li>
          <li>loael / loael_unit</li>
          <li>ld50 / ld50_unit</li>
          <li>reference</li>
          <li>study_date</li>
          <li>notes</li>
        </ul>
      </div>
    </div>
  )
}
