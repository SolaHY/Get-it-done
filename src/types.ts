export interface QuickLink {
  id: string
  title: string
  url: string
  description?: string
  icon: string
  category: string
}

export interface Task {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  createdAt: string
  completedAt?: string
}

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type Tab = 'home' | 'tasks' | 'notes'

export interface AppState {
  links: QuickLink[]
  tasks: Task[]
  notes: Note[]
  activeTab: Tab
  taskFilter: 'all' | 'active' | 'completed'
  noteSearch: string
  selectedNoteId: string | null
}
