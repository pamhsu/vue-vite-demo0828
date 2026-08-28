# Vue 商店 + MySQL

此專案的會員、商品與最新消息資料，已改由 MySQL 與 Express API 管理。

## 第一次設定

1. 在 MySQL 執行 `database/schema.sql`，建立 `vue_store` 與三張資料表。
2. 複製 `.env.example` 為 `.env`，並填入你自己的 MySQL 帳密。
3. 安裝套件：`npm install`
4. 開兩個終端機：

```bash
npm run server
```

```bash
npm run dev
```

前端網址通常是 `http://localhost:5173`；它會透過 Vite proxy 呼叫 `http://localhost:3000/api`。

## 資料表

- `members`：會員姓名、Email、雜湊後的密碼、電話、啟用狀態與建立時間。
- `products`：商品名稱、分類、說明、價格、圖片、上／下架狀態與排序。
- `news`：公告標題、內容、圖片、發布日期與發布／草稿狀態。

## API

- `POST /api/auth/register`、`POST /api/auth/login`
- `/api/members`、`/api/products`、`/api/news`：支援 `GET`、`POST`、`PUT /:id`、`DELETE /:id`

目前是本機開發用範例。上線前必須補上管理者登入驗證與權限控管，避免管理 API 被未授權使用者呼叫。
