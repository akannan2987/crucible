import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon, TableCellsIcon, BeakerIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { uploadChemicalsSDF, uploadChemicalsExcel, createChemical } from '../services/api'

export default function ChemicalsUpload() {
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadMode, setUploadMode] = useState('excel') // 'excel', 'sdf', or 'manual'
  const [manualData, setManualData] = useState({
    chemical_id: '',
    name: '',
    cas_number: '',
    molecular_formula: '',
    molecular_weight: '',
    smiles: '',
    inchi: '',
    inchi_key: '',
    supplier: '',
    purity: '',
    storage_conditions: '',
    hazard_info: ''
  })

  const getAcceptedExtensions = () => {
    if (uploadMode === 'excel') return '.xlsx,.xls,.csv'
    if (uploadMode === 'sdf') return '.sdf'
    return ''
  }

  const isValidFile = (fileName) => {
    if (uploadMode === 'excel') {
      return fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')
    }
    if (uploadMode === 'sdf') {
      return fileName.endsWith('.sdf')
    }
    return false
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
      if (isValidFile(droppedFile.name)) {
        setFile(droppedFile)
        setUploadResult(null)
      } else {
        toast.error(`Please upload a valid ${uploadMode === 'excel' ? 'Excel (.xlsx, .xls, .csv)' : 'SDF'} file`)
      }
    }
  }, [uploadMode])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (isValidFile(selectedFile.name)) {
        setFile(selectedFile)
        setUploadResult(null)
      } else {
        toast.error(`Please upload a valid ${uploadMode === 'excel' ? 'Excel (.xlsx, .xls, .csv)' : 'SDF'} file`)
      }
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
      const response = uploadMode === 'excel'
        ? await uploadChemicalsExcel(formData)
        : await uploadChemicalsSDF(formData)
      setUploadResult(response.data)
      const msg = response.data.updated
        ? `Successfully processed ${response.data.total} chemicals (${response.data.inserted} new, ${response.data.updated} updated)`
        : `Successfully uploaded ${response.data.inserted} chemicals`
      toast.success(msg)
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

    if (!manualData.chemical_id || !manualData.name) {
      toast.error('Chemical ID and Name are required')
      return
    }

    try {
      await createChemical({
        ...manualData,
        molecular_weight: manualData.molecular_weight ? parseFloat(manualData.molecular_weight) : null
      })
      toast.success('Chemical added successfully')
      navigate('/chemicals')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add chemical')
    }
  }

  const handleModeChange = (mode) => {
    setUploadMode(mode)
    setFile(null)
    setUploadResult(null)
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Upload Chemicals - ELN</h1>
        <p className="text-gray-500">Electronic Lab Notebook - Import chemical data</p>
      </div>

      {/* Upload Options */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => handleModeChange('excel')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${uploadMode === 'excel' ? 'bg-pandora-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          <TableCellsIcon className="h-5 w-5" />
          Excel Upload
        </button>
        <button
          onClick={() => handleModeChange('sdf')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${uploadMode === 'sdf' ? 'bg-pandora-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          <DocumentIcon className="h-5 w-5" />
          SDF Upload
        </button>
        <button
          onClick={() => handleModeChange('manual')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${uploadMode === 'manual' ? 'bg-pandora-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          Manual Entry
        </button>
      </div>

      {uploadMode !== 'manual' ? (
        /* File Upload Section */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {uploadMode === 'excel' ? 'Upload Excel File' : 'Upload SDF File'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {uploadMode === 'excel'
              ? 'Upload your chemicals in Excel format (.xlsx, .xls, .csv). No upload limit — optimized for 15,000+ chemicals.'
              : 'Upload your chemicals in SDF (Structure Data File) format. No upload limit — optimized for 15,000+ chemicals.'}
          </p>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${dragActive ? 'border-pandora-500 bg-pandora-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-green-50 border-green-400' : ''}
            `}
          >
            <input
              type="file"
              accept={getAcceptedExtensions()}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {file ? (
              <div className="flex flex-col items-center">
                {uploadMode === 'excel' ? (
                  <TableCellsIcon className="h-12 w-12 text-green-500 mb-3" />
                ) : (
                  <DocumentIcon className="h-12 w-12 text-green-500 mb-3" />
                )}
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
                  Drag and drop your {uploadMode === 'excel' ? 'Excel' : 'SDF'} file here
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">
                  {uploadMode === 'excel' ? 'Supported: .xlsx, .xls, .csv' : 'Supported: .sdf'}
                </p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="inline-flex items-center px-6 py-3 bg-pandora-600 text-white rounded-lg font-medium
                       hover:bg-pandora-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  Upload Chemicals
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
                  {uploadResult.summary && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-gray-800">{uploadResult.summary.recordsInFile}</p>
                        <p className="text-xs text-gray-500">Records in File</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">{uploadResult.inserted || 0}</p>
                        <p className="text-xs text-gray-500">New Chemicals</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{uploadResult.updated || 0}</p>
                        <p className="text-xs text-gray-500">Updated</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-600">{(uploadResult.summary.parseErrors || 0) + (uploadResult.summary.insertErrors || 0)}</p>
                        <p className="text-xs text-gray-500">Errors</p>
                      </div>
                    </div>
                  )}
                  {!uploadResult.summary && uploadResult.inserted !== undefined && (
                    <div className="mt-2 text-sm text-green-600">
                      <p>• New chemicals added: {uploadResult.inserted}</p>
                      {uploadResult.updated !== undefined && <p>• Existing chemicals updated: {uploadResult.updated}</p>}
                    </div>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-orange-600 font-medium">Some records had issues:</p>
                      <ul className="text-sm text-orange-600 list-disc list-inside mt-1">
                        {uploadResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>{err.molecule || err.row || err.chemical}: {err.error}</li>
                        ))}
                        {uploadResult.errors.length > 10 && (
                          <li>...and {uploadResult.errors.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/chemicals')}
                    className="mt-4 text-pandora-600 hover:text-pandora-700 font-medium"
                  >
                    View uploaded chemicals →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Manual Entry Form */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Manual Chemical Entry</h2>
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Chemical ID *</label>
                <input
                  type="text"
                  value={manualData.chemical_id}
                  onChange={(e) => setManualData({ ...manualData, chemical_id: e.target.value })}
                  className="form-input"
                  placeholder="e.g., CHEM-001"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  value={manualData.name}
                  onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                  className="form-input"
                  placeholder="Chemical name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">CAS Number</label>
                <input
                  type="text"
                  value={manualData.cas_number}
                  onChange={(e) => setManualData({ ...manualData, cas_number: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 7732-18-5"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Molecular Formula</label>
                <input
                  type="text"
                  value={manualData.molecular_formula}
                  onChange={(e) => setManualData({ ...manualData, molecular_formula: e.target.value })}
                  className="form-input"
                  placeholder="e.g., H2O"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Molecular Weight (g/mol)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualData.molecular_weight}
                  onChange={(e) => setManualData({ ...manualData, molecular_weight: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 18.015"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <input
                  type="text"
                  value={manualData.supplier}
                  onChange={(e) => setManualData({ ...manualData, supplier: e.target.value })}
                  className="form-input"
                  placeholder="Supplier name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Purity</label>
                <input
                  type="text"
                  value={manualData.purity}
                  onChange={(e) => setManualData({ ...manualData, purity: e.target.value })}
                  className="form-input"
                  placeholder="e.g., 99.5%"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Storage Conditions</label>
                <input
                  type="text"
                  value={manualData.storage_conditions}
                  onChange={(e) => setManualData({ ...manualData, storage_conditions: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Room temperature, dry"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">SMILES</label>
              <input
                type="text"
                value={manualData.smiles}
                onChange={(e) => setManualData({ ...manualData, smiles: e.target.value })}
                className="form-input font-mono"
                placeholder="e.g., O"
              />
            </div>
            <div className="form-group">
              <label className="form-label">InChI</label>
              <input
                type="text"
                value={manualData.inchi}
                onChange={(e) => setManualData({ ...manualData, inchi: e.target.value })}
                className="form-input font-mono text-sm"
                placeholder="InChI string"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hazard Information</label>
              <textarea
                value={manualData.hazard_info}
                onChange={(e) => setManualData({ ...manualData, hazard_info: e.target.value })}
                className="form-input"
                rows="2"
                placeholder="Safety and hazard notes"
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/chemicals')}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-pandora-600 text-white rounded-lg hover:bg-pandora-700"
              >
                Add Chemical
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Help Section */}
      {uploadMode === 'excel' ? (
        <div className="bg-green-50 rounded-xl p-6">
          <h3 className="font-semibold text-green-900 mb-2">Excel File Format</h3>
          <p className="text-sm text-green-800 mb-3">
            Your Excel file should have the following columns (headers in first row):
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm text-green-700 w-full">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="text-left py-2 pr-4 font-medium">Column Name</th>
                  <th className="text-left py-2 pr-4 font-medium">Description</th>
                  <th className="text-left py-2 font-medium">Required</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-green-100">
                  <td className="py-2 pr-4 font-mono text-xs">DTX_ID</td>
                  <td className="py-2 pr-4">Unique chemical identifier (Chemical ID)</td>
                  <td className="py-2">Optional (auto-generated if missing)</td>
                </tr>
                <tr className="border-b border-green-100">
                  <td className="py-2 pr-4 font-mono text-xs">NESTLE_ID</td>
                  <td className="py-2 pr-4">Nestle internal identifier</td>
                  <td className="py-2">Optional</td>
                </tr>
                <tr className="border-b border-green-100">
                  <td className="py-2 pr-4 font-mono text-xs">CHEMICAL_NAME</td>
                  <td className="py-2 pr-4">Name of the chemical</td>
                  <td className="py-2">Required</td>
                </tr>
                <tr className="border-b border-green-100">
                  <td className="py-2 pr-4 font-mono text-xs">CAS_NO</td>
                  <td className="py-2 pr-4">CAS Registry Number</td>
                  <td className="py-2">Optional</td>
                </tr>
                <tr className="border-b border-green-100">
                  <td className="py-2 pr-4 font-mono text-xs">MOL_WEIGHT_ORIG</td>
                  <td className="py-2 pr-4">Molecular weight (g/mol)</td>
                  <td className="py-2">Optional</td>
                </tr>
                <tr className="border-b border-green-100">
                  <td className="py-2 pr-4 font-mono text-xs">MOL_FORMULA</td>
                  <td className="py-2 pr-4">Molecular formula</td>
                  <td className="py-2">Optional</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">Supplier_ref</td>
                  <td className="py-2 pr-4">Supplier reference number</td>
                  <td className="py-2">Optional</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-green-600 mt-3">
            💡 Tip: If a chemical with the same DTX_ID already exists, it will be updated with the new data.
          </p>
        </div>
      ) : uploadMode === 'sdf' ? (
        <div className="space-y-4">
          {/* SDF Format Guide */}
          <div className="bg-blue-50 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <BeakerIcon className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">SDF File Format (Structure Data File)</h3>
                <p className="text-sm text-blue-800 mb-3">
                  SDF files store chemical structures with their 2D/3D coordinates and associated data properties.
                  Both <span className="font-mono font-medium">V2000</span> and <span className="font-mono font-medium">V3000</span> molfile formats are supported.
                </p>

                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">What gets extracted from each molecule:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                      <span>Molecular structure (MOL block with atom/bond tables)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                      <span>Molecular formula (computed from atom block)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                      <span>Molecular weight (computed from atoms)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                      <span>Name (from header line 1 or property fields)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                      <span>All data items ({'>'} &lt;FIELD_NAME&gt; blocks)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
                      <span>SMILES, InChI, InChIKey (if present)</span>
                    </div>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-blue-800 mb-2">Recognized SDF Property Names:</h4>
                <div className="overflow-x-auto">
                  <table className="text-sm text-blue-700 w-full">
                    <thead>
                      <tr className="border-b border-blue-200">
                        <th className="text-left py-1.5 pr-4 font-medium">Pandora Field</th>
                        <th className="text-left py-1.5 font-medium">Accepted SDF Property Names</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">Chemical ID</td>
                        <td className="py-1.5 font-mono text-xs">chemical_id, compound_id, DTX_ID, DTXSID, PUBCHEM_COMPOUND_CID, CHEMBL_ID, Unique_ID</td>
                      </tr>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">Name</td>
                        <td className="py-1.5 font-mono text-xs">COMPOUND_NAME, CHEMICAL_NAME, Name, IUPAC_NAME, PREFERRED_NAME</td>
                      </tr>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">CAS Number</td>
                        <td className="py-1.5 font-mono text-xs">CAS_NUMBER, CAS_NO, CAS, CASRN</td>
                      </tr>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">Mol. Formula</td>
                        <td className="py-1.5 font-mono text-xs">MOLECULAR_FORMULA, MOL_FORMULA, Formula <span className="text-blue-500">(or auto-computed)</span></td>
                      </tr>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">Mol. Weight</td>
                        <td className="py-1.5 font-mono text-xs">MOLECULAR_WEIGHT, MOL_WEIGHT, MW, EXACT_MASS <span className="text-blue-500">(or auto-computed)</span></td>
                      </tr>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">SMILES</td>
                        <td className="py-1.5 font-mono text-xs">SMILES, CANONICAL_SMILES, ISOMERIC_SMILES</td>
                      </tr>
                      <tr className="border-b border-blue-100">
                        <td className="py-1.5 pr-4">InChI / InChIKey</td>
                        <td className="py-1.5 font-mono text-xs">InChI, STANDARD_INCHI, InChIKey, STANDARD_INCHIKEY</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-4">Supplier</td>
                        <td className="py-1.5 font-mono text-xs">Supplier, Vendor, SOURCE, Manufacturer</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* SDF Structure Reference */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="h-6 w-6 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-700 mb-2">SDF File Structure Reference</h3>
                <pre className="text-xs bg-white rounded-lg p-3 overflow-x-auto text-gray-600 font-mono leading-5">{`Molecule Name                          ← Header line 1: molecule name
  Program  timestamp  2D/3D            ← Header line 2: source info
Comment text                           ← Header line 3: comment
 10  9  0  0  0  0  0  0  0  0  V2000  ← Counts line: atoms, bonds, version
    1.3051    0.6772    0.0000 C  ...   ← Atom block (x, y, z, element, ...)
    0.0000   -0.0763    0.0000 C  ...
   -0.0000   -1.2839    0.0000 O  ...
  ...
  1  2  1  0  0  0  0                  ← Bond block (atom1, atom2, type, ...)
  2  3  2  0  0  0  0
  ...
M  END                                 ← End of connection table
> <CHEMICAL_NAME>                       ← Data item header
Acetone                                ← Data item value
                                       ← Blank line terminates value
> <CAS_NUMBER>
67-64-1

> <MOLECULAR_WEIGHT>
58.08

$$$$                                   ← Record delimiter (next molecule)`}</pre>
                <p className="text-xs text-gray-500 mt-2">
                  💡 All unrecognized property fields are stored in the metadata field and accessible in the chemical record.
                  The parser automatically computes molecular formula and weight from the atom block when not provided as properties.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
