import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { uploadSamplesExcel, createSample, SAMPLE_TEMPLATE_URL } from '../services/api'

export default function SamplesUpload() {
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualData, setManualData] = useState({
    sample_id: '',
    identification: '',
    content_type: '',
    material_type: '',
    responsible_person: '',
    group_name: '',
    project_number: '',
    reception_date: '',
    status: 'available',
    description: ''
  })

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
      const response = await uploadSamplesExcel(formData)
      setUploadResult(response.data)
      const { inserted = 0, updated = 0 } = response.data
      toast.success(`Processed ${inserted + updated} samples (${inserted} new, ${updated} updated)`)
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

    if (!manualData.sample_id) {
      toast.error('Sample ID (Barcode) is required')
      return
    }

    try {
      await createSample({ ...manualData, name: manualData.identification || manualData.sample_id })
      toast.success('Sample added successfully')
      navigate('/samples')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add sample')
    }
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Upload Samples - ELN</h1>
          <p className="text-gray-500">Electronic Lab Notebook - Import SLIMS sample data</p>
        </div>
        <a
          href={SAMPLE_TEMPLATE_URL}
          className="inline-flex items-center px-4 py-2 bg-white border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
        >
          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
          Download Template
        </a>
      </div>

      {/* Upload Options */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setShowManualForm(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !showManualForm ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          File Upload (Excel)
        </button>
        <button
          onClick={() => setShowManualForm(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showManualForm ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {!showManualForm ? (
        /* File Upload Section */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload SLIMS Sample File</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload the SLIMS sample export (.xlsx, .xls, .xlsm). The 3-row SLIMS header is
            detected automatically. Re-uploading a sample preserves any chemical links you
            added in the app.
          </p>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-green-50 border-green-400' : ''}
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
                <DocumentIcon className="h-12 w-12 text-green-500 mb-3" />
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
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium
                       hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  Upload Samples
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
                    <div className="mt-3 text-sm text-amber-700">
                      <p className="font-medium">{uploadResult.errors.length} row warning(s):</p>
                      <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                        {uploadResult.errors.slice(0, 10).map((er, i) => (
                          <li key={i}>Row {er.row ?? '?'}: {er.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/samples')}
                    className="mt-4 text-green-600 hover:text-green-700 font-medium"
                  >
                    View uploaded samples →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Manual Entry Form */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Manual Sample Entry</h2>
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Sample ID (Barcode) *</label>
                <input
                  type="text"
                  value={manualData.sample_id}
                  onChange={(e) => setManualData({ ...manualData, sample_id: e.target.value })}
                  className="form-input"
                  placeholder="e.g., PIPM00617"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Identification</label>
                <input
                  type="text"
                  value={manualData.identification}
                  onChange={(e) => setManualData({ ...manualData, identification: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Ulterion 529HS coated on Alu"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Content Type</label>
                <input
                  type="text"
                  value={manualData.content_type}
                  onChange={(e) => setManualData({ ...manualData, content_type: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Packaging"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Material Type</label>
                <input
                  type="text"
                  value={manualData.material_type}
                  onChange={(e) => setManualData({ ...manualData, material_type: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Polymer"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Responsible Person</label>
                <input
                  type="text"
                  value={manualData.responsible_person}
                  onChange={(e) => setManualData({ ...manualData, responsible_person: e.target.value })}
                  className="form-input"
                  placeholder="e.g., RDKosterSa"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Group Name</label>
                <input
                  type="text"
                  value={manualData.group_name}
                  onChange={(e) => setManualData({ ...manualData, group_name: e.target.value })}
                  className="form-input"
                  placeholder="e.g., NIPS - Advanced Packaging Sciences"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project Number</label>
                <input
                  type="text"
                  value={manualData.project_number}
                  onChange={(e) => setManualData({ ...manualData, project_number: e.target.value })}
                  className="form-input"
                  placeholder="e.g., DUND-103291 Buddy"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reception Date</label>
                <input
                  type="date"
                  value={manualData.reception_date}
                  onChange={(e) => setManualData({ ...manualData, reception_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={manualData.status}
                  onChange={(e) => setManualData({ ...manualData, status: e.target.value })}
                  className="form-input"
                >
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="consumed">Consumed</option>
                  <option value="expired">Expired</option>
                  <option value="discarded">Discarded</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={manualData.description}
                onChange={(e) => setManualData({ ...manualData, description: e.target.value })}
                className="form-input"
                rows="3"
                placeholder="Sample description and notes"
              />
            </div>
            <p className="text-xs text-gray-500">
              Chemicals can be linked to this sample after creation, from the sample details view.
            </p>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/samples')}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Sample
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-green-50 rounded-xl p-6">
        <h3 className="font-semibold text-green-900 mb-2">SLIMS Sample Template Format</h3>
        <p className="text-sm text-green-800 mb-3">
          The file is the SLIMS &quot;Content record&quot; export. Row 2 holds the machine keys
          (<code>cntn_barCode</code>, <code>cntn_id</code>, …), row 3 the human labels, and data
          starts at row 4. Key columns map to these fields (every other column is preserved
          under <em>metadata</em>):
        </p>
        <ul className="text-sm text-green-700 list-disc list-inside space-y-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
          <li>Barcode → <b>sample_id</b></li>
          <li>Id → <b>identification</b></li>
          <li>Category → <b>content_type</b></li>
          <li>Sample Subtype → <b>material_type</b></li>
          <li>Responsible → <b>responsible_person</b></li>
          <li>Owner Group → <b>group_name</b></li>
          <li>NPDI Project → <b>project_number</b></li>
          <li>Description → <b>description</b></li>
          <li>Reception Date → <b>reception_date</b></li>
          <li>Status → <b>status</b></li>
        </ul>
      </div>
    </div>
  )
}
