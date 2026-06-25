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

export interface ChecklistItem {
  id: number
  text: string
  done: boolean
  position: number
}

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
  release_id: number | null
  closed_at: string | null
  checklist_total: number
  checklist_done: number
  created_at: string
  updated_at: string
}

export interface TaskDetail extends Task {
  comments: Comment[]
  attachments: Attachment[]
  checklist: ChecklistItem[]
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
  closed: number
  workload: { id: number; name: string; role: string; active_tasks: number }[]
}

export interface Release {
  id: number
  name: string
  release_date: string
  status: 'active' | 'completed'
  created_at: string
}

export interface MemberReportRow {
  member_id: number
  member_name: string
  member_role: string
  total_assigned: number
  closed: number
  on_time: number
  early: number
  overdue_closed: number
  still_open: number
  in_progress: number
}

export interface ReportTaskRow {
  task_id: number
  portal_task_id: string | null
  title: string
  task_type: string
  assignee_name: string | null
  status: string
  end_date: string | null
  closed_at: string | null
  timing: string
}

export interface ReleaseReport {
  release_id: number
  release_name: string
  release_date: string
  release_status: string
  generated_on: string
  total_tasks: number
  total_closed: number
  total_on_time: number
  total_early: number
  total_overdue_closed: number
  total_still_open: number
  total_in_progress: number
  members: MemberReportRow[]
  tasks: ReportTaskRow[]
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
  active?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  search?: string
}
