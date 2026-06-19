import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../public/data/tech-news.json')

// 保持ポリシー: ファイルは毎回上書き。過去データは残さない。
const RETENTION_DAYS = 7
const MAX_ARTICLES = 30
// AI活用記事を優先的に確保する枠数(残りは一般のテック記事で埋める)
const AI_PRIORITY_SLOTS = 22

const WEEK_SECONDS = RETENTION_DAYS * 24 * 60 * 60
const weekAgoUnix = Math.floor(Date.now() / 1000) - WEEK_SECONDS
const weekAgoMs = Date.now() - WEEK_SECONDS * 1000

const USER_AGENT = 'WorkPortal/1.0 (Tech News Aggregator)'

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(now.getDate() + mondayOffset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const fmt = (date) =>
    date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })

  return { start: fmt(start), end: fmt(end), label: `${fmt(start)} – ${fmt(end)}` }
}

async function fetchHackerNews(query, limit = 10, category = 'Industry') {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${weekAgoUnix}&hitsPerPage=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hacker News request failed: ${query}`)

  const data = await res.json()
  return data.hits.map((hit) => ({
    id: `hn-${hit.objectID}`,
    title: hit.title,
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    source: 'Hacker News',
    category,
    summary: `${hit.points ?? 0} points · ${hit.num_comments ?? 0} comments`,
    publishedAt: new Date(hit.created_at).toISOString(),
    score: hit.points ?? 0,
  }))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url, options, label, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url, options)
    if (res.ok) return res
    // レート制限などの一時的なエラーはバックオフして再試行
    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
      await sleep(500 * (attempt + 1))
      continue
    }
    throw new Error(`${label} request failed: ${res.status}`)
  }
}

async function fetchDevToTag(tag, limit = 8, category = 'Tutorial') {
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${limit}`
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': USER_AGENT } }, `Dev.to ${tag}`)

  const data = await res.json()
  const label = tag.charAt(0).toUpperCase() + tag.slice(1)

  return data
    .filter((article) => new Date(article.published_at).getTime() >= weekAgoMs)
    .map((article) => ({
      id: `devto-${article.id}`,
      title: article.title,
      url: article.url,
      source: `Dev.to · ${label}`,
      category,
      summary: article.description
        ? `${article.description.slice(0, 140).trim()}…`
        : `${article.positive_reactions_count ?? 0} reactions · ${article.comments_count ?? 0} comments`,
      publishedAt: new Date(article.published_at).toISOString(),
      score: article.positive_reactions_count ?? 0,
    }))
}

async function fetchLobsters(limit = 15) {
  const url = 'https://lobste.rs/hottest.json'
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error('Lobste.rs request failed')

  const data = await res.json()
  const skillTags = new Set([
    'programming',
    'practices',
    'show',
    'go',
    'rust',
    'python',
    'javascript',
    'web',
    'devops',
    'performance',
    'networking',
    'security',
    'c',
    'java',
    'scala',
    'c++',
    'databases',
    'distributed',
    'historical',
  ])

  return data
    .filter((story) => new Date(story.created_at).getTime() >= weekAgoMs)
    .filter((story) => story.tags?.some((tag) => skillTags.has(tag)))
    .slice(0, limit)
    .map((story) => ({
      id: `lobsters-${story.short_id}`,
      title: story.title,
      url: story.url || story.comments_url,
      source: 'Lobste.rs',
      category: 'Engineering',
      summary: `${story.score ?? 0} points · ${story.comment_count ?? 0} comments · ${story.tags?.slice(0, 3).join(', ') ?? 'tech'}`,
      publishedAt: new Date(story.created_at).toISOString(),
      score: story.score ?? 0,
    }))
}

function dedupeAndSort(items) {
  const seen = new Set()
  const unique = []

  for (const item of items) {
    const key = item.url.replace(/\/$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  const byDate = (a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()

  const aiItems = unique.filter((item) => item.category === 'AI活用').sort(byDate)
  const otherItems = unique.filter((item) => item.category !== 'AI活用').sort(byDate)

  // AI活用を最優先(最大 AI_PRIORITY_SLOTS 件)。残り枠は一般のテック記事で埋める。
  const ai = aiItems.slice(0, AI_PRIORITY_SLOTS)
  const remaining = MAX_ARTICLES - ai.length
  const others = otherItems.slice(0, remaining)

  // AI枠が埋まりきらない場合は、余ったAI記事も後ろに追加する。
  const filler = aiItems.slice(AI_PRIORITY_SLOTS, AI_PRIORITY_SLOTS + (remaining - others.length))

  return [...ai, ...others, ...filler].slice(0, MAX_ARTICLES)
}

async function main() {
  const week = getWeekRange()
  const results = await Promise.allSettled([
    // AI活用・Claude Code・AIエージェントを従業員として使う系
    fetchHackerNews('Claude Code', 10, 'AI活用'),
    fetchHackerNews('AI agents', 10, 'AI活用'),
    fetchHackerNews('AI coding assistant', 10, 'AI活用'),
    fetchHackerNews('LLM workflow', 8, 'AI活用'),
    fetchHackerNews('AI automation', 8, 'AI活用'),
    fetchDevToTag('ai', 10, 'AI活用'),
    fetchDevToTag('llm', 8, 'AI活用'),
    fetchDevToTag('agents', 8, 'AI活用'),
    fetchDevToTag('chatgpt', 6, 'AI活用'),
    fetchDevToTag('copilot', 6, 'AI活用'),
    // 一般のテック・エンジニアリング系
    fetchHackerNews('programming'),
    fetchHackerNews('software engineering'),
    fetchHackerNews('typescript'),
    fetchHackerNews('system design'),
    fetchHackerNews('devops'),
    fetchDevToTag('programming'),
    fetchDevToTag('webdev'),
    fetchDevToTag('tutorial'),
    fetchDevToTag('career'),
    fetchDevToTag('typescript'),
    fetchLobsters(),
  ])

  const articles = []
  const errors = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    } else {
      errors.push(result.reason?.message ?? 'Unknown fetch error')
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    weekLabel: week.label,
    weekStart: week.start,
    weekEnd: week.end,
    retentionDays: RETENTION_DAYS,
    maxArticles: MAX_ARTICLES,
    articleCount: 0,
    articles: dedupeAndSort(articles),
    errors: errors.length > 0 ? errors : undefined,
  }

  payload.articleCount = payload.articles.length

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Saved ${payload.articleCount} tech news articles to ${OUT_PATH}`)
  if (errors.length > 0) {
    console.warn('Partial errors:', errors)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
