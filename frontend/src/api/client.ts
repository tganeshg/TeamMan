import axios from 'axios'
import type {
  Member, Task, TaskDetail, Label, Comment, Attachment,
  MantisIssue, DashboardData, TaskFilters, TaskRelation, RelationType,
  Release, ReleaseReport,
} from '../types'

const api = axios.create({ baseURL: '/api' })

// ── Auth token ─────────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('pd_token')
export const setToken = (t: string) => localStorage.setItem('pd_token', t)
export const clearToken = () => localStorage.removeItem('pd_token')

// Attach token to every request
api.interceptors.request.use(cfg => {
  const token = getToken()
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`
  return cfg
})

// On 401 → clear token (will trigger redirect via React)
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) clearToken()
    return Promise.reject(err)
  }
)

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getDashboard = () =>
  api.get<DashboardData>('/dashboard').then(r => r.data)

export interface ActivityItem {
  id: number
  title: string
  status: string
  updated_at: string | null
  assignee: string | null
}

export const getDashboardActivity = () =>
  api.get<ActivityItem[]>('/dashboard/activity').then(r => r.data)

// ── Members ────────────────────────────────────────────────────────────────
export const getMembers = () =>
  api.get<Member[]>('/members').then(r => r.data)

export const createMember = (data: Omit<Member, 'id' | 'created_at' | 'task_count'>) =>
  api.post<Member>('/members', data).then(r => r.data)

export const updateMember = (id: number, data: Partial<Member>) =>
  api.put<Member>(`/members/${id}`, data).then(r => r.data)

export const deleteMember = (id: number) =>
  api.delete(`/members/${id}`)

// ── Labels ─────────────────────────────────────────────────────────────────
export const getLabels = () =>
  api.get<Label[]>('/labels').then(r => r.data)

export const createLabel = (data: { name: string; color: string }) =>
  api.post<Label>('/labels', data).then(r => r.data)

export const updateLabel = (id: number, data: { name: string; color: string }) =>
  api.put<Label>(`/labels/${id}`, data).then(r => r.data)

export const deleteLabel = (id: number) =>
  api.delete(`/labels/${id}`)

// ── Tasks ──────────────────────────────────────────────────────────────────
export const getTasks = (filters?: TaskFilters) => {
  const params: Record<string, string> = {}
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        if (Array.isArray(v)) {
          if (v.length > 0) params[k] = v.join(',')
        } else {
          params[k] = String(v)
        }
      }
    })
  }
  return api.get<Task[]>('/tasks', { params }).then(r => r.data)
}

export const getTask = (id: number) =>
  api.get<TaskDetail>(`/tasks/${id}`).then(r => r.data)

// Build a download URL for the xlsx export (filters optional → all tasks)
export const taskExportXlsxUrl = (filters?: TaskFilters) => {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        if (Array.isArray(v)) { if (v.length > 0) params.set(k, v.join(',')) }
        else params.set(k, String(v))
      }
    })
  }
  const qs = params.toString()
  return `/api/tasks/export/xlsx${qs ? `?${qs}` : ''}`
}

export interface ChecklistItemInput { id?: number; text: string; done: boolean }

export const createTask = (data: {
  title: string
  description?: string
  task_type: string
  portal_task_id?: string
  start_date?: string
  end_date?: string
  status?: string
  progress?: number
  assignee_id?: number
  priority?: number
  label_ids?: number[]
  checklist?: ChecklistItemInput[]
}) => api.post<Task>('/tasks', data).then(r => r.data)

export const updateTask = (id: number, data: Partial<{
  title: string
  description: string
  task_type: string
  portal_task_id: string
  start_date: string
  end_date: string
  status: string
  progress: number
  assignee_id: number
  priority: number
  label_ids: number[]
  release_id: number | null
  checklist: ChecklistItemInput[]
}>) => api.put<Task>(`/tasks/${id}`, data).then(r => r.data)

export const deleteTask = (id: number) =>
  api.delete(`/tasks/${id}`)

export const bulkUpdateTasks = (task_ids: number[], patch: Record<string, any>) =>
  api.post<{ updated: number }>('/tasks/bulk-update', { task_ids, patch }).then(r => r.data)

export const assignTask = (id: number, assignee_id: number, priority: number) =>
  api.post<Task>(`/tasks/${id}/assign`, { assignee_id, priority }).then(r => r.data)

export const addLabelToTask = (taskId: number, labelId: number) =>
  api.post<Task>(`/tasks/${taskId}/labels/${labelId}`).then(r => r.data)

export const removeLabelFromTask = (taskId: number, labelId: number) =>
  api.delete<Task>(`/tasks/${taskId}/labels/${labelId}`).then(r => r.data)

// ── Comments ───────────────────────────────────────────────────────────────
export const getComments = (taskId: number) =>
  api.get<Comment[]>(`/tasks/${taskId}/comments`).then(r => r.data)

export const addComment = (taskId: number, content: string, author = 'Project Lead') =>
  api.post<Comment>(`/tasks/${taskId}/comments`, { content, author }).then(r => r.data)

// ── Attachments ────────────────────────────────────────────────────────────
export const getAttachments = (taskId: number) =>
  api.get<Attachment[]>(`/tasks/${taskId}/attachments`).then(r => r.data)

export const uploadAttachment = (taskId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<Attachment>(`/tasks/${taskId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const deleteAttachment = (id: number) =>
  api.delete(`/attachments/${id}`)

export const downloadUrl = (id: number) => `/api/attachments/${id}/download`

// ── Relations ──────────────────────────────────────────────────────────────
export const getRelations = (taskId: number) =>
  api.get<TaskRelation[]>(`/tasks/${taskId}/relations`).then(r => r.data)

export const addRelation = (taskId: number, to_task_id: number, relation_type: RelationType) =>
  api.post<TaskRelation>(`/tasks/${taskId}/relations`, { to_task_id, relation_type }).then(r => r.data)

export const deleteRelation = (taskId: number, relationId: number) =>
  api.delete(`/tasks/${taskId}/relations/${relationId}`)

// ── Portal ─────────────────────────────────────────────────────────────────
export const getPortalStatus = () =>
  api.get<{ configured: boolean; portal_url?: string }>('/portal/credentials').then(r => r.data)

export const savePortalCredentials = (portal_url: string, api_token: string) =>
  api.post('/portal/credentials', { portal_url, api_token }).then(r => r.data)

export const fetchMantisIssue = (issueId: string) =>
  api.get<MantisIssue>(`/portal/fetch/${issueId}`).then(r => r.data)

export const testPortalConnection = () =>
  api.get<{ ok: boolean; status: number }>('/portal/test').then(r => r.data)

// ── Config ─────────────────────────────────────────────────────
export const getReleaseDate = () =>
  api.get<{ release_date: string | null }>('/config/release-date').then(r => r.data)

export const setReleaseDate = (release_date: string | null) =>
  api.post<{ release_date: string | null }>('/config/release-date', { release_date }).then(r => r.data)

// ── Releases ───────────────────────────────────────────────────
export const getReleases = () =>
  api.get<Release[]>('/releases').then(r => r.data)

export const createRelease = (name: string, release_date: string) =>
  api.post<Release>('/releases', { name, release_date }).then(r => r.data)

export const updateRelease = (id: number, data: Partial<{ name: string; release_date: string; status: string }>) =>
  api.put<Release>(`/releases/${id}`, data).then(r => r.data)

export const deleteRelease = (id: number) =>
  api.delete(`/releases/${id}`)

// ── Reports ────────────────────────────────────────────────────
export const getReport = (releaseId: number) =>
  api.get<ReleaseReport>(`/reports/${releaseId}`).then(r => r.data)

export const exportDocxUrl = (releaseId: number) =>
  `/api/reports/${releaseId}/export/docx`

export const exportPdfUrl = (releaseId: number) =>
  `/api/reports/${releaseId}/export/pdf`

// ── Todos ──────────────────────────────────────────────────────
export interface TodoItem { id: number; thread_id: number; text: string; done: boolean; position: number; created_at: string }
export interface TodoThread { id: number; heading: string; description?: string; meeting?: string; status: string; position: number; created_at: string; updated_at: string; items: TodoItem[] }

export const getTodoThreads = () =>
  api.get<TodoThread[]>('/todos').then(r => r.data)

export const createTodoThread = (data: { heading: string; description?: string; meeting?: string }) =>
  api.post<TodoThread>('/todos', data).then(r => r.data)

export const updateTodoThread = (id: number, data: Partial<{ heading: string; description: string; meeting: string; status: string }>) =>
  api.put<TodoThread>(`/todos/${id}`, data).then(r => r.data)

export const deleteTodoThread = (id: number) =>
  api.delete(`/todos/${id}`)

export const addTodoItem = (threadId: number, text: string) =>
  api.post<TodoItem>(`/todos/${threadId}/items`, { text }).then(r => r.data)

export const bulkAddTodoItems = (threadId: number, items: string[]) =>
  api.post<TodoItem[]>(`/todos/${threadId}/items/bulk`, { items }).then(r => r.data)

export const updateTodoItem = (itemId: number, data: Partial<{ text: string; done: boolean; position: number; thread_id: number }>) =>
  api.put<TodoItem>(`/todo-items/${itemId}`, data).then(r => r.data)

export const deleteTodoItem = (itemId: number) =>
  api.delete(`/todo-items/${itemId}`)

export const reorderTodoThreads = (orderedIds: number[]) =>
  api.put('/todos/reorder', { ordered_ids: orderedIds })

export const reorderTodoItems = (orderedIds: number[]) =>
  api.put('/todo-items/reorder', { ordered_ids: orderedIds })

// ── Auth ────────────────────────────────────────────────────────────────────
export interface AuthUser { id: number | null; email: string; name: string; role: 'lead' | 'member' }

export const login = (email: string, password: string) =>
  api.post<{ access_token: string; token_type: string; role: string; name: string; id: number | null } | { first_login: true; email: string }>('/auth/login', { email, password }).then(r => r.data)

export const setPasswordApi = (email: string, new_password: string) =>
  api.post<{ access_token: string; token_type: string; role: string; name: string; id: number | null }>('/auth/set-password', { email, new_password }).then(r => r.data)

export const changePasswordApi = (old_password: string, new_password: string) =>
  api.post<{ ok: boolean }>('/auth/change-password', { old_password, new_password }).then(r => r.data)

export const getMe = () =>
  api.get<AuthUser>('/auth/me').then(r => r.data)

export const leadSetPasswordApi = (new_password: string) =>
  api.post<{ ok: boolean }>('/auth/lead-set-password', { new_password }).then(r => r.data)

export const leadInitPasswordApi = (new_password: string) =>
  api.post<{ ok: boolean }>('/auth/lead-init-password', { new_password }).then(r => r.data)

export const changeLeadName = (name: string) =>
  api.put<{ ok: boolean; name: string }>('/auth/lead-name', { name }).then(r => r.data)
