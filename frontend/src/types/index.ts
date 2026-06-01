export interface Member {
  id: number
  name: string
  email: string
  role: 'Lead' | 'Senior' | 'Junior' | 'Intern'
  created_at: string
  task_count: number
}

export interface Label {
  id: number
  name: string
  color: string
}

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'near_deadline'
  | 'overdue'
  | 'completed'

export type TaskType = 'bug' | 'feature'

export type TaskColor = 'gray' | 'blue' | 'orange' | 'red' | 'green'

export interface Task {
  id: number
  portal_task_id: string | null
  title: string
  description: string | null
  task_type: TaskType
  assignee_id: number | null
  assignee: Member | null
  priority: number | null
  status: TaskStatus
  start_date: string | null
  end_date: string | null
  color: TaskColor
  labels: Label[]
  created_at: string
  updated_at: string
}

export interface TaskDetail extends Task {
  comments: Comment[]
  attachments: Attachment[]
}

export interface Comment {
  id: number
  task_id: number
  content: string
  author: string
  created_at: string
}

export interface Attachment {
  id: number
  task_id: number
  filename: string
  created_at: string
}

export interface MantisIssue {
  portal_task_id: string
  title: string
  description: string | null
  reporter: string | null
  severity: string | null
  portal_status: string | null
}

export interface DashboardData {
  total_tasks: number
  by_status: Record<string, number>
  due_today: number
  due_this_week: number
  overdue: number
  workload: { id: number; name: string; role: string; active_tasks: number }[]
}

export type RelationType = 'duplicate' | 'parent' | 'child' | 'blocks' | 'blocked_by' | 'related_to'

export interface TaskRelation {
  id: number
  from_task_id: number
  to_task_id: number
  relation_type: RelationType
  related_task_id: number
  related_task_title: string
  related_task_portal_id: string | null
  created_at: string
}

export interface TaskFilters {
  assignee_id?: number
  status?: string
  task_type?: string
  label_ids?: number[]
  start_date_from?: string
  start_date_to?: string
  end_date_from?: string
  end_date_to?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
