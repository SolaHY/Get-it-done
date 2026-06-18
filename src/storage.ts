import type { AppState, QuickLink } from './types'

const STORAGE_KEY = 'work-portal-state'

export const DEFAULT_LINKS: QuickLink[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    url: 'https://thenewgate.backlog.com/dashboard?from_globalbar',
    description: 'プロジェクト管理・課題管理',
    icon: '📋',
    category: 'プロジェクト管理',
  },
  {
    id: 'thenewgate-github',
    title: 'TheNewGate GitHub',
    url: 'https://github.com/thenewgate-inc',
    description: '株式会社TheNewGate GitHub Organization',
    icon: '🐙',
    category: 'プロジェクト管理',
  },
  {
    id: 'cytech-manual',
    title: 'CyTech IR 運用マニュアル',
    url: 'https://cytech-education.github.io/CyTech-Div-Manual/',
    description: 'IR運用マニュアル（要パスワード）',
    icon: '📖',
    category: 'ドキュメント',
  },
  {
    id: 'cytech-dashboard',
    title: 'CyTech Dashboard',
    url: 'https://tng-cytech-dashboard.com/home',
    description: 'CyTech ダッシュボード',
    icon: '📊',
    category: 'CyTech',
  },
  {
    id: 'cytech-engineer',
    title: 'CyTech Engineer 管理',
    url: 'https://engineer.cytech.online/admin/login',
    description: 'エンジニアマスター管理',
    icon: '⚙️',
    category: 'CyTech',
  },
  {
    id: 'salesforce-prod',
    title: 'Salesforce（本番）',
    url: 'https://thenewgate.lightning.force.com/lightning/page/home',
    description: 'Salesforce 本番環境',
    icon: '☁️',
    category: 'Salesforce',
  },
  {
    id: 'salesforce-staging',
    title: 'Salesforce（Staging）',
    url: 'https://thenewgate--staging.sandbox.my.salesforce.com/',
    description: 'Salesforce ステージング環境',
    icon: '🧪',
    category: 'Salesforce',
  },
  {
    id: 'salesforce-learner',
    title: 'Salesforce Learner',
    url: 'https://solahy.github.io/Salesforce-learner/',
    description: 'Salesforce 学習用アプリ',
    icon: '🎓',
    category: '学習',
  },
  {
    id: 'tng-learning',
    title: 'TNG Learning',
    url: 'https://thenewgate-inc.github.io/tng-its/tng-learning/',
    description: 'TNG 学習コンテンツ',
    icon: '📚',
    category: '学習',
  },
  {
    id: 'learning-app',
    title: 'Learning App',
    url: 'https://learning-app-836760798728.asia-northeast1.run.app/',
    description: '学習用アプリ',
    icon: '🧠',
    category: '学習',
  },
]

const DEFAULT_LINK_MAP = new Map(DEFAULT_LINKS.map((link) => [link.id, link]))

export function mergeDefaultLinks(savedLinks?: QuickLink[]): QuickLink[] {
  const customLinks = (savedLinks ?? []).filter((link) => !DEFAULT_LINK_MAP.has(link.id))
  const mergedDefaults = DEFAULT_LINKS.map((defaultLink) => {
    const saved = savedLinks?.find((link) => link.id === defaultLink.id)
    return saved ? { ...saved, ...defaultLink } : defaultLink
  })

  return [...mergedDefaults, ...customLinks]
}

export function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveState(state: AppState): void {
  const { links, tasks, notes } = state
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ links, tasks, notes }))
}
