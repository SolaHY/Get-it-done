import type { TechNewsFeed } from './types'
import { escapeHtml, formatDateTime } from './utils'

const NEWS_DATA_URL = `${import.meta.env.BASE_URL}data/tech-news.json`

export async function loadTechNews(): Promise<TechNewsFeed> {
  const res = await fetch(NEWS_DATA_URL, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error('テックニュースの読み込みに失敗しました')
  }
  return res.json() as Promise<TechNewsFeed>
}

function sourceClass(source: string): string {
  if (source.includes('Hacker News')) return 'source-hn'
  if (source.includes('Dev.to')) return 'source-devto'
  if (source.includes('Lobste.rs')) return 'source-lobsters'
  return 'source-other'
}

export function renderNewsPage(
  feed: TechNewsFeed | null,
  loading: boolean,
  error: string | null,
): string {
  const header = `
    <div class="page-header">
      <div>
        <h2>テックニュース</h2>
        <p>AI活用・Claude Code・AIエージェント運用を中心にテック記事を毎週ピックアップ</p>
      </div>
      ${loading ? '' : `<button class="btn btn-secondary" id="reload-news-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
        更新
      </button>`}
    </div>
  `

  if (loading) {
    return `
      ${header}
      <div class="news-loading">
        <div class="news-loading-spinner"></div>
        <p>ニュースを読み込み中…</p>
      </div>
    `
  }

  if (error) {
    return `
      ${header}
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>${escapeHtml(error)}</p>
      </div>
    `
  }

  if (!feed || feed.articles.length === 0) {
    return `
      ${header}
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <p>今週のニュースが見つかりませんでした</p>
      </div>
    `
  }

  return `
    ${header}

    <div class="news-meta-bar">
      <div class="news-week-pill">
        <span class="news-week-label">今週</span>
        <span class="news-week-range">${escapeHtml(feed.weekLabel)}</span>
      </div>
      <span class="news-meta-item">${feed.articleCount} 件</span>
      <span class="news-meta-item">過去 ${feed.retentionDays ?? 7} 日間 · 最大 ${feed.maxArticles ?? 30} 件</span>
      <span class="news-meta-item">最終更新: ${formatDateTime(feed.fetchedAt)}</span>
    </div>

    <div class="news-source-legend">
      <span class="source-chip source-hn">Hacker News</span>
      <span class="source-chip source-devto">Dev.to</span>
      <span class="source-chip source-lobsters">Lobste.rs</span>
    </div>

    <div class="news-list">
      ${feed.articles
        .map(
          (article) => `
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="news-card">
          <div class="news-card-header">
            <span class="source-chip ${sourceClass(article.source)}">${escapeHtml(article.source)}</span>
            ${article.category ? `<span class="news-category${article.category === 'AI活用' ? ' news-category-ai' : ''}">${escapeHtml(article.category)}</span>` : ''}
            <span class="news-date">${formatDateTime(article.publishedAt)}</span>
          </div>
          <h3 class="news-title">${escapeHtml(article.title)}</h3>
          <p class="news-summary">${escapeHtml(article.summary)}</p>
          <span class="news-link-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            記事を読む
          </span>
        </a>
      `,
        )
        .join('')}
    </div>

    <p class="news-footer-note">毎週月曜 0:00 UTC に自動更新 · AI活用・Claude Code・AIエージェント運用とエンジニアリング系の記事を収集</p>
  `
}
