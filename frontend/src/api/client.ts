import axios from 'axios'
import type {
  Member, Task, TaskDetail, Label, Comment, Attachment,
  MantisIssue, DashboardData, TaskFilters, TaskRelation, RelationType,
} from '../types'

const api = axios.create({ baseURL: '/api' })

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getDashboard = () =>
  api.get<DashboardData>('/dashboard').then(r => r.data)

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

export const createTask = (data: {
  title: string
  description?: string
  task_type: string
  portal_task_id?: string
  start_date?: string
  end_date?: string
  status?: string
  assignee_id?: number
  priority?: number
  label_ids?: number[]
}) => api.post<Task>('/tasks', data).then(r => r.data)

export const updateTask = (id: number, data: Partial<{
  title: string
  description: string
  task_type: string
  portal_task_id: string
  start_date: string
  end_date: string
  status: string
  assignee_id: number
  priority: number
  label_ids: number[]
}>) => api.put<Task>(`/tasks/${id}`, data).then(r => r.data)

export const deleteTask = (id: number) =>
  api.delete(`/tasks/${id}`)

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

// ── Todos ──────────────────────────────────────────────────────
export interface TodoItem { id: number; thread_id: number; text: string; done: boolean; position: number; created_at: string }
export interface TodoThread { id: number; heading: string; description?: string; meeting?: string; status: string; created_at: string; updated_at: string; items: TodoItem[] }

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

export const updateTodoItem = (itemId: number, data: Partial<{ text: string; done: boolean }>) =>
  api.put<TodoItem>(`/todo-items/${itemId}`, data).then(r => r.data)

export const deleteTodoItem = (itemId: number) =>
  api.delete(`/todo-items/${itemId}`)
