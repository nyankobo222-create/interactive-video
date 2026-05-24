# インタラクティブ動画システム 仕様書

最終更新: 2026-05-23

---

## 1. システム概要

動画クリエイターが複数の動画クリップをブランチ（分岐）構造でつなぎ、
視聴者がボタンを操作しながら見るインタラクティブ動画を
**ノーコードで制作・管理・配信**できるWebシステム。

### 1-1. 想定ユーザー

| ロール | 誰 | 何をするか |
|--------|-----|-----------|
| 制作者 | 動画クリエイター（あなた） | 管理画面でプロジェクトを作成・設定・納品 |
| 視聴者 | 採用候補者・エンドユーザー | プレーヤー画面でインタラクティブ動画を視聴 |

### 1-2. 現在の開発フェーズ

```
Phase 1  プレーヤー本体（完成）
         └ config.jsを手書きで設定してデプロイ

Phase 2  管理画面 基本版（現在）
         └ ブラウザ上でプロジェクト作成・動画アップロード・分岐設定

Phase 3  ビジュアルエディター（未着手）
         └ イラレのUI画像を読み込み、ボタン位置をGUI操作で設定

Phase 4  マルチクライアント管理（未着手）
         └ ログイン機能・クライアント別アクセス制御
```

---

## 2. 技術スタック

| 役割 | 技術 | バージョン |
|------|------|-----------|
| フロントエンド（UI） | React + React Router | 18.x / 7.x |
| ビルドツール | Vite | 6.x |
| バックエンド（API） | Node.js + Express | 25.x / 4.x |
| ファイルアップロード | multer | 2.x |
| ID生成 | uuid | 14.x |
| データ保存 | JSONファイル（data/projects/） | - |
| 動画ファイル保存 | ローカル（uploads/）→ 本番はCloudflare R2 | - |
| ホスティング | Railway | - |
| コード管理 | GitHub | - |

---

## 3. ディレクトリ構成

```
D:\interactive-video\
│
├── server.js               # Expressサーバー（API + 静的ファイル配信）
├── vite.config.js          # Vite設定（開発時proxyあり）
├── package.json
├── nixpacks.toml           # Railwayデプロイ設定
│
├── src/                    # Reactフロントエンド
│   ├── main.jsx            # エントリーポイント（BrowserRouter）
│   ├── App.jsx             # ルーティング定義
│   ├── index.css           # グローバルスタイル
│   │
│   ├── pages/
│   │   ├── AdminHome.jsx       # プロジェクト一覧（/admin）
│   │   ├── AdminHome.css
│   │   ├── ProjectEditor.jsx   # プロジェクト編集（/admin/:id）
│   │   ├── ProjectEditor.css
│   │   └── PlayerPage.jsx      # プレーヤー画面（/play/:id）
│   │
│   ├── components/
│   │   ├── InteractivePlayer.jsx   # プレーヤー本体
│   │   ├── BranchMenu.jsx          # ブランチ選択オーバーレイ
│   │   ├── BottomBar.jsx           # 下部ナビゲーションバー
│   │   ├── DemoChapter.jsx         # デモ用プレースホルダー
│   │   └── InteractivePlayer.css   # プレーヤー全スタイル
│   │
│   └── configs/
│       └── fken.js         # ※開発検証用サンプルconfig（本番不使用）
│
├── data/
│   └── projects/           # プロジェクトデータ（JSON形式、1件1ファイル）
│       └── {id}.json
│
├── uploads/                # アップロードされた動画ファイル
│   └── {projectId}/
│       └── {chapterId}.mp4
│
└── dist/                   # Viteビルド出力（Railwayがこれを配信）
```

---

## 4. データ構造

### 4-1. プロジェクトJSON（data/projects/{id}.json）

```json
{
  "id": "a1b2c3d4",
  "createdAt": "2026-05-23T00:00:00.000Z",
  "updatedAt": "2026-05-23T00:00:00.000Z",

  "company": {
    "name": "株式会社FKEN",
    "phone": "0833-57-4497",
    "contactUrl": "https://fken.net/#anker-contact"
  },

  "theme": {
    "primary": "#2a9824"
  },

  "chapters": [
    {
      "id": "C01",
      "label": "オープニング",
      "url": "/uploads/a1b2c3d4/C01.mp4",
      "demoDuration": 15
    },
    {
      "id": "C02",
      "label": "タイトル①",
      "url": null,
      "demoDuration": 4
    }
    // ... C03〜C14
  ],

  "flow": {
    "intro": {
      "chapter": "C01",
      "pauseAt": 15
    },
    "branches": [
      {
        "id": "b1",
        "label": "01 未経験からプロへ",
        "sublabel": "Zero to Pro",
        "chapters": ["C02", "C03", "C04", "C05"]
      },
      {
        "id": "b2",
        "label": "02 人間関係に自信あり",
        "sublabel": "Supportive Team",
        "chapters": ["C06", "C07", "C08", "C09"]
      },
      {
        "id": "b3",
        "label": "03 代表の想い",
        "sublabel": "CEO's Vision",
        "chapters": ["C10", "C11", "C12", "C13"]
      }
    ],
    "endMenu": "C14"
  }
}
```

### 4-2. フィールド説明

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 8文字のランダムID（UUID短縮形） |
| company.name | string | エンドメニューに表示される会社名 |
| company.phone | string | 電話ボタンのリンク先（tel:）|
| company.contactUrl | string | メールボタンのリンク先URL |
| theme.primary | string | ボタン・進捗バーのカラー（#HEX） |
| chapters[].url | string \| null | MP4のURL。nullの場合デモモード動作 |
| chapters[].demoDuration | number | デモモード時の再生秒数 |
| flow.intro.pauseAt | number | C01動画を何秒で停止するか |
| flow.branches[].chapters | string[] | そのブランチで再生するチャプターIDの順番 |
| flow.endMenu | string \| null | 全ブランチ終了後に再生するチャプターID |

---

## 5. API仕様

### ベースURL
- 開発: `http://localhost:3000/api`
- 本番: `https://your-railway-app.up.railway.app/api`

### エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/projects | プロジェクト一覧取得 |
| POST | /api/projects | 新規プロジェクト作成（初期データ自動生成） |
| GET | /api/projects/:id | プロジェクト1件取得 |
| PUT | /api/projects/:id | プロジェクト更新（bodyにJSON全体を送る） |
| DELETE | /api/projects/:id | プロジェクト削除（動画ファイルも削除） |
| POST | /api/projects/:projectId/upload/:chapterId | 動画ファイルアップロード |

### 各エンドポイント詳細

#### GET /api/projects
```
Response: [
  {
    "id": "a1b2c3d4",
    "name": "株式会社FKEN",
    "updatedAt": "2026-05-23T...",
    "chapterCount": 14
  }
]
```

#### POST /api/projects/:projectId/upload/:chapterId
```
Request: multipart/form-data
  - video: File（MP4）

Response: { "url": "/uploads/a1b2c3d4/C01.mp4" }
副作用: プロジェクトJSONのchapter.urlも自動更新
```

---

## 6. フロントエンド ルーティング

| パス | コンポーネント | 説明 |
|------|--------------|------|
| / | redirect | /adminへリダイレクト |
| /admin | AdminHome | プロジェクト一覧 |
| /admin/:id | ProjectEditor | プロジェクト編集 |
| /play/:id | PlayerPage | インタラクティブ動画プレーヤー |

---

## 7. プレーヤーの状態遷移

```
intro（C01再生中）
  └─ pauseAt秒到達 ──→ branch_select（ブランチ選択オーバーレイ表示）
                             └─ ボタンタップ ──→ branch_playing（ブランチ再生中）
                                                      └─ 最終チャプター終了 ──→ end_menu（エンドメニュー）
                                                                                    ├─ 別ブランチ選択 ──→ branch_playing
                                                                                    └─ トップへ戻る ──→ intro
```

---

## 8. 開発環境の起動方法

```bash
# フロントエンド（開発サーバー）
npm run dev
# → http://localhost:5173  ※APIは自動でlocalhost:3000にproxy

# バックエンド（APIサーバー）
node server.js
# → http://localhost:3000
```

### ビルド＆本番起動
```bash
npm run build   # Reactをdist/にビルド
npm start       # Expressサーバー起動（port 3000でdist/を配信）
```

---

## 9. Railwayへのデプロイ手順

1. GitHubリポジトリを作成してpush
2. Railwayでリポジトリを接続
3. ビルドコマンド: `npm run build`（nixpacks.tomlで設定済み）
4. スタートコマンド: `npm start`（nixpacks.tomlで設定済み）
5. 環境変数: 特に不要（PORT はRailwayが自動設定）

### ⚠ 注意事項
- Railwayのファイルシステムはデプロイ時にリセットされる
- `uploads/`に保存した動画ファイルはデプロイ時に消える
- **本番運用前に Cloudflare R2 への切り替えが必要**

---

## 10. Cloudflare R2 切り替え手順（TODO）

現在はローカルの`uploads/`に動画を保存。本番前に以下を実装予定:

```
1. Cloudflare R2バケットを作成
2. R2のAccess Key ID / Secret Access Keyを発行
3. server.jsのmulter storageをR2に変更（@aws-sdk/client-s3を使用）
4. 動画URLを /uploads/... から https://r2.dev/... に変更
5. RailwayにR2の環境変数を設定
```

---

## 11. Phase 3 ビジュアルエディター 設計メモ

### 概要
イラレから書き出したSVG/PNG画像をアップロードし、
その上にボタン領域をGUIで配置する機能。

### 追加するデータ構造
```json
"overlay": {
  "imageUrl": "/uploads/{id}/overlay.svg",
  "buttons": [
    {
      "id": "btn1",
      "branchId": "b1",
      "x": 12.5,
      "y": 45.0,
      "width": 28.0,
      "height": 8.0
    }
  ]
}
```

### 追加するAPI
```
POST /api/projects/:id/upload/overlay   # UI画像アップロード
```

### エディターUI
- 動画プレビュー or 静止画の上にオーバーレイ画像を重ねて表示
- ボタン領域をドラッグ&ドロップで配置・リサイズ
- 各ボタンにブランチを割り当てる

---

## 12. 既知の問題・TODO

| 優先度 | 内容 | 対応状況 |
|--------|------|---------|
| 高 | Vite開発サーバーのAPIプロキシ設定 | ✅ 完了（vite.config.js） |
| 高 | チャプターの上下並び替え | ✅ 完了（▲▼ボタン） |
| 中 | デモ再生時間の編集UI | ✅ 完了（動画未アップロード時に表示） |
| 中 | プロジェクト複製機能 | ✅ 完了（/duplicate API + 複製ボタン） |
| 中 | 動画アップロード後のサムネイル表示 | TODO |
| 低 | Cloudflare R2への切り替え | TODO（本番前） |
| 低 | ログイン認証 | Phase 4 |
