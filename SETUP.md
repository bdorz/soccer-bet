# 足球下注遊戲 — 設定說明

## 1. 建立 Supabase 專案

1. 前往 https://supabase.com 建立免費帳號
2. 建立新專案（記下密碼）
3. 前往 **SQL Editor**，貼上並執行 `supabase/schema.sql` 的全部內容
4. 在 **Project Settings > API** 取得以下三個值：
   - Project URL
   - anon / public key
   - service_role key（secret，勿公開）

## 2. 設定環境變數

複製範例檔並填入值：
```
cp .env.local.example .env.local
```

編輯 `.env.local`：
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 3. 設定管理員帳號

1. 先在網站上正常註冊一個帳號
2. 前往 Supabase **SQL Editor** 執行：
```sql
UPDATE profiles SET is_admin = true WHERE username = '你的暱稱';
```

## 4. 本地開發

```bash
npm install
npm run dev
```

前往 http://localhost:3000

## 5. 部署到 Vercel（免費）

1. 前往 https://vercel.com，連結你的 GitHub 帳號
2. 匯入此專案
3. 在 Vercel 的環境變數設定頁面，填入與 `.env.local` 相同的三個變數
4. 部署完成後即可分享網址給朋友

## 6. 新增比賽

**方法A（推薦）：** 使用管理員後台
- 登入後點選導覽列「管理」
- 選「新增比賽」，填入比賽資訊與賠率
- 參考台彩網站：https://www.sportslottery.com.tw/sportsbook/daily-coupons

**方法B：** 使用本地爬蟲腳本
```bash
# 額外安裝爬蟲依賴
npm install playwright dotenv
npx playwright install chromium

# 執行爬蟲
node scripts/scraper.js
```

## 7. 結算比賽

比賽結束後：
1. 前往管理員後台 → 管理所有比賽
2. 點選「結算」
3. 輸入最終比分，系統自動計算並派彩

## 遊戲規則

- 每位玩家初始獲得 **10,000 虛擬點數**
- 最低下注 **50 點**
- 賠率格式：**歐洲賠率**（例如 2.15 表示押 1000 點贏 2150 點）
- 支援玩法：勝平負、讓球盤、大小球、波膽、半場獨贏

## 讓球盤說明

- 數字為**主隊讓分**，負數表示主隊讓球（主隊優勢）
- 例：主隊 -0.5 → 主隊須贏球才算主隊贏
- 例：主隊 -0.75 → 贏1球算半輸半贏、贏2球以上全贏

## 免費方案限制

| 服務 | 免費額度 |
|------|---------|
| Vercel | 無限靜態、100GB 流量/月 |
| Supabase | 500MB 資料庫、2個專案、無限 API 請求 |
