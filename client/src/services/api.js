import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Statistics
export const getStats = () => api.get('/stats');

// Chemicals
export const getChemicals = (params) => api.get('/chemicals', { params });
export const getChemical = (id) => api.get(`/chemicals/${id}`);
export const createChemical = (data) => api.post('/chemicals', data);
export const updateChemical = (id, data) => api.put(`/chemicals/${id}`, data);
export const deleteChemical = (id) => api.delete(`/chemicals/${id}`);
export const uploadChemicalsSDF = (formData) => 
  api.post('/chemicals/upload/sdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const uploadChemicalsExcel = (formData) =>
  api.post('/chemicals/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getChemicalsDropdown = () => api.get('/chemicals/list/dropdown');
export const bulkDeleteChemicals = (chemical_ids) => api.post('/chemicals/bulk/delete', { chemical_ids });
export const bulkUpdateChemicals = (chemical_ids, updates) => api.post('/chemicals/bulk/update', { chemical_ids, updates });
export const clearAllChemicals = () => api.delete('/chemicals/all/clear');

// Samples
export const getSamples = (params) => api.get('/samples', { params });
export const getSample = (id) => api.get(`/samples/${id}`);
export const createSample = (data) => api.post('/samples', data);
export const updateSample = (id, data) => api.put(`/samples/${id}`, data);
export const deleteSample = (id) => api.delete(`/samples/${id}`);
export const uploadSamplesExcel = (formData) =>
  api.post('/samples/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const linkSampleChemicals = (sampleId, chemical_ids) =>
  api.put(`/samples/${sampleId}/chemicals`, { chemical_ids });
export const bulkDeleteSamples = (sample_ids) => api.post('/samples/bulk/delete', { sample_ids });
export const clearAllSamples = () => api.delete('/samples/all/clear');
// Direct download URL for the SLIMS sample template (used by an <a> tag).
export const SAMPLE_TEMPLATE_URL = `${API_BASE}/samples/template/download`;

// Screening
export const getScreening = (params) => api.get('/screening', { params });
export const getScreeningRecord = (id) => api.get(`/screening/${id}`);
export const getScreeningByChemical = (chemicalId) => api.get(`/screening/chemical/${chemicalId}`);
export const createScreening = (data) => api.post('/screening', data);
export const updateScreening = (id, data) => api.put(`/screening/${id}`, data);
export const deleteScreening = (id) => api.delete(`/screening/${id}`);
export const uploadScreeningExcel = (formData) =>
  api.post('/screening/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Toxicology
export const getToxicology = (params) => api.get('/toxicology', { params });
export const getToxicologyRecord = (id) => api.get(`/toxicology/${id}`);
export const getToxicologyByChemical = (chemicalId) => api.get(`/toxicology/chemical/${chemicalId}`);
export const createToxicology = (data) => api.post('/toxicology', data);
export const updateToxicology = (id, data) => api.put(`/toxicology/${id}`, data);
export const deleteToxicology = (id) => api.delete(`/toxicology/${id}`);
export const uploadToxicologyExcel = (formData) =>
  api.post('/toxicology/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default api;
