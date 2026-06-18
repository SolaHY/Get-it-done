import './style.css'
import type { AppState, Note, QuickLink, Tab, Task } from './types'
import { loadTechNews, renderNewsPage } from './tech-news'
import { loadState, mergeDefaultLinks, saveState } from './storage'
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  generateId,
  isOverdue,
  isToday,
} from './utils'

const saved = loadState()

let state: AppState = {
  links: mergeDefaultLinks(saved.links),
  tasks: saved.tasks ?? [],
  notes: saved.notes ?? [],
  activeTab: 'home',
  taskFilter: 'active',
  noteSearch: '',
  selectedNoteId: null,
  newsFeed: null,
  newsLoading: false,
  newsError: null,
}

const app = document.querySelector<HTMLDivElement>('#app')!

function persist(): void {
  saveState(state)
}

function setTab(tab: Tab): void {
  state.activeTab = tab
  if (tab === 'news') {
    void ensureNewsLoaded()
    return
  }
  render()
}

async function ensureNewsLoaded(force = false): Promise<void> {
  if (state.newsLoading) return
  if (!force && state.newsFeed) {
    render()
    return
  }

  state.newsLoading = true
  state.newsError = null
  render()

  try {
    state.newsFeed = await loadTechNews()
  } catch (error) {
    state.newsError = error instanceof Error ? error.message : 'ニュースの取得に失敗しました'
  } finally {
    state.newsLoading = false
    render()
  }
}

function addTask(title: string, priority: Task['priority'], dueDate?: string, description?: string): void {
  state.tasks.unshift({
    id: generateId(),
    title,
    description,
    completed: false,
    priority,
    dueDate,
    createdAt: new Date().toISOString(),
  })
  persist()
  render()
}

function toggleTask(id: string): void {
  const task = state.tasks.find((t) => t.id === id)
  if (!task) return
  task.completed = !task.completed
  task.completedAt = task.completed ? new Date().toISOString() : undefined
  persist()
  render()
}

function deleteTask(id: string): void {
  state.tasks = state.tasks.filter((t) => t.id !== id)
  persist()
  render()
}

function addNote(title: string, content: string, tags: string[]): void {
  const now = new Date().toISOString()
  const note: Note = {
    id: generateId(),
    title,
    content,
    tags,
    createdAt: now,
    updatedAt: now,
  }
  state.notes.unshift(note)
  state.selectedNoteId = note.id
  persist()
  render()
}

function updateNote(id: string, title: string, content: string, tags: string[]): void {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  note.title = title
  note.content = content
  note.tags = tags
  note.updatedAt = new Date().toISOString()
  persist()
  render()
}

function deleteNote(id: string): void {
  state.notes = state.notes.filter((n) => n.id !== id)
  if (state.selectedNoteId === id) {
    state.selectedNoteId = state.notes[0]?.id ?? null
  }
  persist()
  render()
}

function addLink(title: string, url: string, description: string, icon: string, category: string): void {
  state.links.push({
    id: generateId(),
    title,
    url,
    description,
    icon,
    category,
  })
  persist()
  render()
}

function deleteLink(id: string): void {
  state.links = state.links.filter((l) => l.id !== id)
  persist()
  render()
}

function priorityLabel(p: Task['priority']): string {
  return { low: '低', medium: '中', high: '高' }[p]
}

const NAV_ICONS: Record<Tab, string> = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`,
  tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  notes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
  news: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>`,
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'おはようございます'
  if (h < 18) return 'こんにちは'
  return 'お疲れさまです'
}

function getCategoryClass(category: string): string {
  if (category.includes('プロジェクト')) return 'cat-project'
  if (category.includes('ドキュメント')) return 'cat-doc'
  if (category.toLowerCase().includes('cytech')) return 'cat-cytech'
  if (category.toLowerCase().includes('salesforce')) return 'cat-salesforce'
  if (category.includes('学習')) return 'cat-learning'
  return 'cat-other'
}

function getCategoryDot(category: string): string {
  const cls = getCategoryClass(category)
  const colors: Record<string, string> = {
    'cat-project': '#4f8fff',
    'cat-doc': '#a855f7',
    'cat-cytech': '#4fd1ff',
    'cat-salesforce': '#6366f1',
    'cat-learning': '#22c55e',
    'cat-other': '#7c6cff',
  }
  return colors[cls] ?? colors['cat-other']
}

function renderSidebar(): string {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'ホーム' },
    { id: 'tasks', label: 'タスク' },
    { id: 'notes', label: 'ナレッジ' },
    { id: 'news', label: 'テックニュース' },
  ]

  const activeTasks = state.tasks.filter((t) => !t.completed).length
  const todayTasks = state.tasks.filter(
    (t) => !t.completed && t.dueDate && isToday(t.dueDate),
  ).length

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>
        <div>
          <h1 class="app-title">Work Portal</h1>
          <p class="app-subtitle">業務ポータル</p>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${tabs
          .map(
            (tab) => `
          <button class="nav-item ${state.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            <span class="nav-icon">${NAV_ICONS[tab.id]}</span>
            <span>${tab.label}</span>
            ${tab.id === 'tasks' && activeTasks > 0 ? `<span class="badge">${activeTasks}</span>` : ''}
          </button>
        `,
          )
          .join('')}
      </nav>
      <div class="sidebar-stats">
        <div class="stat-card">
          <div class="stat-icon tasks">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${activeTasks}</span>
            <span class="stat-label">未完了タスク</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon today">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${todayTasks}</span>
            <span class="stat-label">今日の期限</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">${state.notes.length}</span>
            <span class="stat-label">ナレッジ</span>
          </div>
        </div>
      </div>
    </aside>
  `
}

function renderHome(): string {
  const categories = [...new Set(state.links.map((l) => l.category))]
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return `
    <div class="hero-banner">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-top">
        <p class="hero-greeting">${getGreeting()}</p>
        <span class="hero-pill">${today}</span>
      </div>
      <h2 class="hero-title"><span class="gradient-text">Work Portal</span></h2>
      <p class="hero-sub">業務ツール・タスク・ナレッジを、ひとつの場所から。</p>
    </div>

    <div class="page-header">
      <div>
        <h2>クイックリンク</h2>
        <p>よく使うツール・画面へすぐアクセス</p>
      </div>
      <button class="btn btn-primary" id="add-link-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        リンク追加
      </button>
    </div>

    <div id="add-link-form" class="form-card hidden">
      <h3>新しいリンクを追加</h3>
      <div class="form-grid">
        <input type="text" id="link-title" placeholder="タイトル" />
        <input type="url" id="link-url" placeholder="URL (https://...)" />
        <input type="text" id="link-desc" placeholder="説明（任意）" />
        <input type="text" id="link-icon" placeholder="アイコン（絵文字）" value="🔗" />
        <input type="text" id="link-category" placeholder="カテゴリ" value="その他" />
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" id="cancel-link-btn">キャンセル</button>
        <button class="btn btn-primary" id="save-link-btn">保存</button>
      </div>
    </div>

    ${categories
      .map((category) => {
        const links = state.links.filter((l) => l.category === category)
        return `
        <section class="link-section">
          <div class="section-header">
            <span class="section-dot" style="background:${getCategoryDot(category)}"></span>
            <h3 class="section-title">${escapeHtml(category)}</h3>
            <span class="section-count">${links.length}</span>
          </div>
          <div class="link-grid">
            ${links.map((link) => renderLinkCard(link)).join('')}
          </div>
        </section>
      `
      })
      .join('')}
  `
}

function renderLinkCard(link: QuickLink): string {
  const cat = getCategoryClass(link.category)
  return `
    <div class="link-card-wrapper">
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-card ${cat}">
        <div class="link-icon-wrap">${link.icon}</div>
        <div class="link-info">
          <span class="link-title">${escapeHtml(link.title)}</span>
          ${link.description ? `<span class="link-desc">${escapeHtml(link.description)}</span>` : ''}
        </div>
        <span class="link-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
        </span>
      </a>
      <button class="link-delete" data-link-id="${link.id}" title="削除">×</button>
    </div>
  `
}

function renderTasks(): string {
  const filtered = state.tasks.filter((t) => {
    if (state.taskFilter === 'active') return !t.completed
    if (state.taskFilter === 'completed') return t.completed
    return true
  })

  return `
    <div class="page-header">
      <div>
        <h2>タスク管理</h2>
        <p>日々の業務タスクを管理</p>
      </div>
    </div>

    <div class="form-card">
      <h3>新しいタスク</h3>
      <div class="task-form">
        <input type="text" id="task-title" placeholder="タスク名" class="task-input-title" />
        <select id="task-priority">
          <option value="low">優先度: 低</option>
          <option value="medium" selected>優先度: 中</option>
          <option value="high">優先度: 高</option>
        </select>
        <input type="date" id="task-due" />
        <button class="btn btn-primary" id="add-task-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          追加
        </button>
      </div>
      <textarea id="task-desc" placeholder="詳細メモ（任意）" rows="2"></textarea>
    </div>

    <div class="filter-bar">
      ${(['active', 'all', 'completed'] as const)
        .map(
          (f) => `
        <button class="filter-btn ${state.taskFilter === f ? 'active' : ''}" data-filter="${f}">
          ${f === 'active' ? '未完了' : f === 'completed' ? '完了済み' : 'すべて'}
        </button>
      `,
        )
        .join('')}
      <span class="filter-count">${filtered.length} 件</span>
    </div>

    <div class="task-list">
      ${
        filtered.length === 0
          ? '<div class="empty-state"><div class="empty-icon">📭</div><p>タスクがありません</p></div>'
          : filtered.map((task) => renderTaskItem(task)).join('')
      }
    </div>
  `
}

function renderTaskItem(task: Task): string {
  const overdue = !task.completed && task.dueDate && isOverdue(task.dueDate)
  const dueToday = !task.completed && task.dueDate && isToday(task.dueDate)

  return `
    <div class="task-item ${task.completed ? 'completed' : ''} priority-${task.priority}">
      <label class="task-check">
        <input type="checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''} />
        <span class="checkmark"></span>
      </label>
      <div class="task-content">
        <span class="task-title">${escapeHtml(task.title)}</span>
        ${task.description ? `<span class="task-desc">${escapeHtml(task.description)}</span>` : ''}
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${priorityLabel(task.priority)}</span>
          ${task.dueDate ? `<span class="due-date ${overdue ? 'overdue' : ''} ${dueToday ? 'today' : ''}">📅 ${formatDate(task.dueDate)}</span>` : ''}
          ${task.completed && task.completedAt ? `<span class="completed-at">完了: ${formatDateTime(task.completedAt)}</span>` : ''}
        </div>
      </div>
      <button class="btn-icon delete-task" data-task-id="${task.id}" title="削除">🗑️</button>
    </div>
  `
}

function renderNotes(): string {
  const search = state.noteSearch.toLowerCase()
  const filtered = state.notes.filter(
    (n) =>
      !search ||
      n.title.toLowerCase().includes(search) ||
      n.content.toLowerCase().includes(search) ||
      n.tags.some((t) => t.toLowerCase().includes(search)),
  )

  const selected = state.notes.find((n) => n.id === state.selectedNoteId)

  return `
    <div class="page-header">
      <div>
        <h2>ナレッジ・メモ</h2>
        <p>業務知識やメモを蓄積</p>
      </div>
      <button class="btn btn-primary" id="new-note-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        新規メモ
      </button>
    </div>

    <div class="notes-layout">
      <div class="notes-sidebar">
        <input type="search" id="note-search" placeholder="🔍 検索..." value="${escapeHtml(state.noteSearch)}" />
        <div class="notes-list">
          ${
            filtered.length === 0
              ? '<div class="empty-state small"><p>メモがありません</p></div>'
              : filtered
                  .map(
                    (note) => `
              <button class="note-item ${state.selectedNoteId === note.id ? 'active' : ''}" data-note-id="${note.id}">
                <span class="note-item-title">${escapeHtml(note.title)}</span>
                <span class="note-item-date">${formatDate(note.updatedAt)}</span>
                ${note.tags.length > 0 ? `<div class="note-tags">${note.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              </button>
            `,
                  )
                  .join('')
          }
        </div>
      </div>

      <div class="notes-editor">
        ${
          selected
            ? `
          <div class="editor-header">
            <input type="text" id="note-title" value="${escapeHtml(selected.title)}" placeholder="タイトル" />
            <div class="editor-actions">
              <button class="btn btn-danger" id="delete-note-btn">削除</button>
              <button class="btn btn-primary" id="save-note-btn">保存</button>
            </div>
          </div>
          <input type="text" id="note-tags" value="${escapeHtml(selected.tags.join(', '))}" placeholder="タグ（カンマ区切り）" class="tags-input" />
          <textarea id="note-content" placeholder="メモ内容を入力...">${escapeHtml(selected.content)}</textarea>
          <div class="editor-footer">
            <span>作成: ${formatDateTime(selected.createdAt)}</span>
            <span>更新: ${formatDateTime(selected.updatedAt)}</span>
          </div>
        `
            : `
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <p>メモを選択するか、新規作成してください</p>
          </div>
        `
        }
      </div>
    </div>
  `
}

function render(): void {
  const content =
    state.activeTab === 'home'
      ? renderHome()
      : state.activeTab === 'tasks'
        ? renderTasks()
        : state.activeTab === 'notes'
          ? renderNotes()
          : renderNewsPage(state.newsFeed, state.newsLoading, state.newsError)

  app.innerHTML = `
    <div class="layout">
      ${renderSidebar()}
      <main class="main-content">
        ${content}
      </main>
    </div>
  `

  bindEvents()
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab as Tab))
  })

  if (state.activeTab === 'home') bindHomeEvents()
  if (state.activeTab === 'tasks') bindTaskEvents()
  if (state.activeTab === 'notes') bindNoteEvents()
  if (state.activeTab === 'news') bindNewsEvents()
}

function bindHomeEvents(): void {
  const form = document.getElementById('add-link-form')!
  const addBtn = document.getElementById('add-link-btn')
  const cancelBtn = document.getElementById('cancel-link-btn')
  const saveBtn = document.getElementById('save-link-btn')

  addBtn?.addEventListener('click', () => form.classList.remove('hidden'))
  cancelBtn?.addEventListener('click', () => form.classList.add('hidden'))

  saveBtn?.addEventListener('click', () => {
    const title = (document.getElementById('link-title') as HTMLInputElement).value.trim()
    const url = (document.getElementById('link-url') as HTMLInputElement).value.trim()
    const desc = (document.getElementById('link-desc') as HTMLInputElement).value.trim()
    const icon = (document.getElementById('link-icon') as HTMLInputElement).value.trim() || '🔗'
    const category = (document.getElementById('link-category') as HTMLInputElement).value.trim() || 'その他'

    if (!title || !url) return
    addLink(title, url, desc, icon, category)
    form.classList.add('hidden')
  })

  document.querySelectorAll<HTMLButtonElement>('.link-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (confirm('このリンクを削除しますか？')) {
        deleteLink(btn.dataset.linkId!)
      }
    })
  })
}

function bindTaskEvents(): void {
  document.getElementById('add-task-btn')?.addEventListener('click', () => {
    const title = (document.getElementById('task-title') as HTMLInputElement).value.trim()
    const priority = (document.getElementById('task-priority') as HTMLSelectElement).value as Task['priority']
    const dueDate = (document.getElementById('task-due') as HTMLInputElement).value || undefined
    const description = (document.getElementById('task-desc') as HTMLTextAreaElement).value.trim() || undefined

    if (!title) return
    addTask(title, priority, dueDate, description)
  })

  document.querySelectorAll<HTMLInputElement>('[data-task-id]').forEach((cb) => {
    if (cb.type === 'checkbox') {
      cb.addEventListener('change', () => toggleTask(cb.dataset.taskId!))
    }
  })

  document.querySelectorAll<HTMLButtonElement>('.delete-task').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('このタスクを削除しますか？')) {
        deleteTask(btn.dataset.taskId!)
      }
    })
  })

  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.taskFilter = btn.dataset.filter as AppState['taskFilter']
      render()
    })
  })

  const titleInput = document.getElementById('task-title') as HTMLInputElement
  titleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('add-task-btn')?.click()
    }
  })
}

function bindNoteEvents(): void {
  document.getElementById('new-note-btn')?.addEventListener('click', () => {
    addNote('新しいメモ', '', [])
  })

  document.getElementById('note-search')?.addEventListener('input', (e) => {
    state.noteSearch = (e.target as HTMLInputElement).value
    render()
    const searchInput = document.getElementById('note-search') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length)
    }
  })

  document.querySelectorAll<HTMLButtonElement>('[data-note-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedNoteId = btn.dataset.noteId!
      render()
    })
  })

  document.getElementById('save-note-btn')?.addEventListener('click', () => {
    if (!state.selectedNoteId) return
    const title = (document.getElementById('note-title') as HTMLInputElement).value.trim()
    const content = (document.getElementById('note-content') as HTMLTextAreaElement).value
    const tagsRaw = (document.getElementById('note-tags') as HTMLInputElement).value
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (!title) return
    updateNote(state.selectedNoteId, title, content, tags)
  })

  document.getElementById('delete-note-btn')?.addEventListener('click', () => {
    if (!state.selectedNoteId) return
    if (confirm('このメモを削除しますか？')) {
      deleteNote(state.selectedNoteId)
    }
  })
}

function bindNewsEvents(): void {
  document.getElementById('reload-news-btn')?.addEventListener('click', () => {
    void ensureNewsLoaded(true)
  })
}

render()
