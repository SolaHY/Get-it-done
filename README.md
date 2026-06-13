# Work Portal - 業務ポータル

日々の業務タスク管理、よく使うツールへのクイックアクセス、ナレッジ・メモの蓄積ができるポータルサイトです。

## 機能

- **ホーム** - よく使うツール・画面へのクイックリンク（カテゴリ別表示、リンク追加・削除）
- **タスク** - 日々の業務タスク管理（優先度、期限、完了管理）
- **ナレッジ** - 業務知識・メモの蓄積（タグ付け、検索）
- **テックニュース** - スキル・知識向上に役立つテック記事（毎週自動更新）

## 起動方法

### ローカル開発

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。

### GitHub Pages（公開URL）

https://solahy.github.io/Get-it-done/

`main` ブランチへの push で自動デプロイされます。

## テックニュースの取得仕組み

スキルアップやエンジニアリング知識に役立つ記事を、**ビルド時に取得して JSON を生成**し、画面が読み込む方式です。

```
外部API → fetch-tech-news.mjs → public/data/tech-news.json（上書き） → 画面表示
```

### データは蓄積しない

| 項目 | ポリシー |
|------|----------|
| 保持期間 | **過去7日間**の記事のみ |
| 最大件数 | **30件**（超えた分は破棄） |
| 保存方法 | 毎回ファイルを**丸ごと上書き** |
| Git管理 | JSON は `.gitignore` 対象（リポジトリに蓄積しない） |

つまり JSON ファイルのサイズは常に **約15〜20KB 程度** で固定です。過去の週の記事がどんどん溜まることはありません。

### 取得元（過去7日間）

| ソース | 内容 |
|--------|------|
| **Hacker News** | programming, software engineering, typescript, system design, devops |
| **Dev.to** | programming, webdev, tutorial, career, typescript |
| **Lobste.rs** | プログラミング・プラクティス・技術タグの人気記事 |

### 処理の流れ

1. `scripts/fetch-tech-news.mjs` が各ソースから記事を取得
2. URL の重複を除去し、日付の新しい順に最大30件を選別
3. `public/data/tech-news.json` に保存
4. 画面の「テックニュース」タブがこの JSON を読み込んで表示

### 更新タイミング

| タイミング | 動作 |
|-----------|------|
| 毎週月曜 0:00 UTC | デプロイ workflow が最新ニュースを取得して公開（JSON は commit しない） |
| `main` へ push 時 | デプロイ前に最新ニュースを取得 |
| 手動 | `npm run fetch:news`（ローカル開発用） |

### 手動でニュースを更新

```bash
npm run fetch:news
```

## データ保存

すべてのデータ（タスク、メモ、リンク）はブラウザの localStorage に保存されます。

## プリセットリンク

- Backlog
- CyTech IR 運用マニュアル
- CyTech Dashboard
- CyTech Engineer 管理
- Salesforce（本番）
- Salesforce（Staging）
- [TheNewGate GitHub](https://github.com/thenewgate-inc)
