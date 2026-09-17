# ByetHost 部署說明

此專案的正式環境架構為：Vue 靜態前端、PHP API、ByetHost MySQL。
本機仍可繼續使用 Vite 與原本的 Node.js API。

## 1. 設定資料庫

在 `public/api` 將 `config.local.example.php` 複製為
`config.local.php`，並將 `password` 改成 VistaPanel 顯示的 MySQL
密碼。不要將 `config.local.php` 提交到 Git 或分享給其他人。

若 VistaPanel 顯示的主機、資料庫名稱或帳號不同，也要同步修改。

## 2. 匯入資料庫

在 phpMyAdmin 選取 ByetHost 已建立的資料庫後：

1. 匯入 `pizzashop_hosting_import.sql`。
2. 再匯入 `database/byethost_migration.sql`。

第二個檔案會建立安全的會員登入工作階段資料表。SQL 檔不要包含
`CREATE DATABASE vue_store` 或 `USE vue_store`。

## 3. 建立上傳套件

在 PowerShell 執行：

```powershell
npm run build:byethost
```

完成後會在專案根目錄產生 `byethost-deploy.zip`，以及一個或多個
`byethost-images-*.zip`。主程式壓縮檔的最上層會直接包含
`index.html`、`.htaccess`、`assets`、`api` 等程式檔案，不會多包一層
`dist`。圖片會自動分成較小的壓縮檔，方便使用主機的網頁上傳功能。
`uploads` 不會包入套件，以免更新網站時覆蓋正式環境的商品圖片。

## 4. 上傳

1. 在 ByetHost File Manager 進入 `/htdocs`。
2. 上傳 `byethost-deploy.zip` 並解壓縮到 `/htdocs`。
3. 將所有 `byethost-images-*.zip` 上傳並解壓縮到 `/htdocs`。解壓縮後
   應該看到 `/htdocs/images/pizzalogo.png`，不可變成
   `/htdocs/images/images/pizzalogo.png`。
4. 確認 `/htdocs/index.html`、`/htdocs/assets` 與 `/htdocs/images` 存在。
5. 第一次部署若需要保留舊商品圖片，另行把 `dist/uploads` 的內容上傳
   到 `/htdocs/uploads`。
6. 將 `/htdocs/api/config.local.example.php` 複製為
   `/htdocs/api/config.local.php`，填入正確資料庫密碼。
7. 不要在更新網站時刪除正式環境現有的 `/htdocs/uploads`。

## 5. 驗證

依序測試：

- `/api/health` 回傳 `{"ok":true}`。
- `/api/products?status=active` 回傳商品陣列。
- `/products` 與 `/admin/login` 可直接開啟並重新整理。
- 會員註冊、登入、會員訂單查詢可使用。
- 管理員登入、商品管理、訂單管理與圖片上傳可使用。

舊瀏覽器曾儲存的會員登入沒有伺服器 Token，部署後第一次需要重新登入。

## 安全提醒

- 不要上傳專案根目錄的 `.env`。
- 不要把資料庫密碼放進 Vue、JavaScript 或 Git。
- 正式公開前請更換管理員密碼、清除舊測試登入工作階段，並確認測試會員資料是否應保留。
- SSL 啟用後只使用 `https://` 網址。
