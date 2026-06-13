import axios from 'axios'

const BASE = '/api'

// Projects
export const getProjects = () => axios.get(`${BASE}/projects`).then(r => r.data)
export const getProject = (id) => axios.get(`${BASE}/projects/${id}`).then(r => r.data)
export const createProject = (data) => axios.post(`${BASE}/projects`, data).then(r => r.data)
export const updateProject = (id, data) => axios.put(`${BASE}/projects/${id}`, data).then(r => r.data)
export const deleteProject = (id) => axios.delete(`${BASE}/projects/${id}`)

// Endpoints
export const getEndpoints = (projectId) =>
  axios.get(`${BASE}/projects/${projectId}/endpoints`).then(r => r.data)

export const getEndpoint = (projectId, id) =>
  axios.get(`${BASE}/projects/${projectId}/endpoints/${id}`).then(r => r.data)

export const createEndpoint = (projectId, data) =>
  axios.post(`${BASE}/projects/${projectId}/endpoints`, data).then(r => r.data)

export const updateEndpoint = (projectId, id, data) =>
  axios.put(`${BASE}/projects/${projectId}/endpoints/${id}`, data).then(r => r.data)

export const deleteEndpoint = (projectId, id) =>
  axios.delete(`${BASE}/projects/${projectId}/endpoints/${id}`)

// Spec
export const getSpecJson = (projectId) =>
  axios.get(`${BASE}/projects/${projectId}/spec`).then(r => r.data)

export const downloadJson = (projectId) => {
  window.open(`${BASE}/projects/${projectId}/spec/download/json`, '_blank')
}

export const downloadYaml = (projectId) => {
  window.open(`${BASE}/projects/${projectId}/spec/download/yaml`, '_blank')
}

// Import
export const importFile = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return axios.post(`${BASE}/import/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}
