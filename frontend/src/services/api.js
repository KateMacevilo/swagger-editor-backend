import axios from 'axios'

const BASE = '/api'

// Projects
export const getProjects = () => axios.get(`${BASE}/projects`).then(r => r.data)
export const getProject = (id) => axios.get(`${BASE}/projects/${id}`).then(r => r.data)
export const createProject = (data) => axios.post(`${BASE}/projects`, data).then(r => r.data)
export const updateProject = (id, data) => axios.put(`${BASE}/projects/${id}`, data).then(r => r.data)
export const deleteProject = (id) => axios.delete(`${BASE}/projects/${id}`)

// Spec preview
export const getSpecJson = (project) =>
  axios.post(`${BASE}/spec/json`, project, {
    headers: { 'Content-Type': 'application/json' }
  }).then(r => r.data)

export const getSpecYaml = (project) =>
  axios.post(`${BASE}/spec/yaml`, project, {
    headers: { 'Content-Type': 'application/json' }
  }).then(r => r.data)

// Import
export const importFile = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return axios.post(`${BASE}/import/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const importText = (text) =>
  axios.post(`${BASE}/import/text`, text, {
    headers: { 'Content-Type': 'text/plain' }
  }).then(r => r.data)
