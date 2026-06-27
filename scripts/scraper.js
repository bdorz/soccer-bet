/**
 * 台灣運彩爬蟲腳本
 *
 * 使用方式：
 *   node scripts/scraper.js
 *
 * 需要先安裝：
 *   npm install playwright @supabase/supabase-js dotenv
 *   npx playwright install chromium
 *
 * 需在 .env.local 設定 Supabase 環境變數
 */

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BASE_URL = 'https://www.sportslottery.com.tw/sportsbook/daily-coupons'

/**
 * 將台彩賠率格式轉換為我們的格式
 * 台彩顯示格式範例：主勝 2.15 / 和局 3.20 / 客勝 3.40
 */
function parseOddsNumber(text) {
  const n = parseFloat(text.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

async function scrapeMatches() {
  console.log('🚀 啟動爬蟲...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'zh-TW',
  })
  const page = await context.newPage()

  try {
    console.log(`📄 前往 ${BASE_URL}`)
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    // 截圖以確認頁面載入
    await page.screenshot({ path: 'scripts/debug_screenshot.png' })
    console.log('📸 截圖已存在 scripts/debug_screenshot.png')

    // 嘗試找到足球比賽列表
    // 台彩網站結構可能會有變化，這裡用一般性選擇器
    const matches = []

    // 方法1：尋找包含 VS 的比賽行
    const matchRows = await page.$$('[class*="event"], [class*="match"], [class*="game"]')
    console.log(`找到 ${matchRows.length} 個可能的比賽元素`)

    for (const row of matchRows.slice(0, 20)) {
      try {
        const text = await row.innerText()
        console.log('元素文字:', text.slice(0, 100))
      } catch {}
    }

    // 輸出頁面標題和URL供除錯
    console.log('\n頁面標題:', await page.title())
    console.log('當前URL:', page.url())

    // 輸出頁面主要內容供分析
    const bodyText = await page.locator('body').innerText()
    console.log('\n頁面文字（前500字）:')
    console.log(bodyText.slice(0, 500))

    return matches
  } finally {
    await browser.close()
  }
}

/**
 * 手動插入比賽資料（備用方案）
 * 當爬蟲無法自動取得資料時，可手動填入
 */
async function insertManualMatch({
  competition,
  homeTeam,
  awayTeam,
  matchTime,
  betCloseTime,
  sourceId,
  odds = [],
}) {
  console.log(`\n📝 新增比賽：${homeTeam} vs ${awayTeam}`)

  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      competition,
      home_team: homeTeam,
      away_team: awayTeam,
      match_time: new Date(matchTime).toISOString(),
      bet_close_time: new Date(betCloseTime || matchTime).toISOString(),
      source_id: sourceId || null,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    console.error('新增失敗:', error.message)
    return null
  }

  console.log(`✅ 比賽已建立，ID: ${match.id}`)

  if (odds.length > 0) {
    const { error: oddsErr } = await supabase.from('match_odds').insert(
      odds.map(o => ({ match_id: match.id, ...o }))
    )
    if (oddsErr) console.error('賠率新增失敗:', oddsErr.message)
    else console.log(`✅ ${odds.length} 種賠率已設定`)
  }

  return match
}

// ============================================================
// 範例：手動新增比賽（取消下方註解並填入資料）
// ============================================================
// await insertManualMatch({
//   competition: '英格蘭超級聯賽',
//   homeTeam: '曼城',
//   awayTeam: '阿森納',
//   matchTime: '2025-01-15T20:45:00+08:00',
//   betCloseTime: '2025-01-15T20:45:00+08:00',
//   sourceId: '3475476.1',  // 台彩場次編號
//   odds: [
//     {
//       bet_type: '1x2',
//       odds_data: { home: 2.15, draw: 3.20, away: 3.40 },
//     },
//     {
//       bet_type: 'asian_handicap',
//       odds_data: { handicap: -0.5, home_odds: 1.88, away_odds: 2.02 },
//     },
//     {
//       bet_type: 'over_under',
//       odds_data: { line: 2.5, over: 1.85, under: 2.05 },
//     },
//   ],
// })

async function main() {
  console.log('=== 台灣運彩爬蟲 ===\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ 請先設定 .env.local 中的 Supabase 環境變數')
    process.exit(1)
  }

  // 先測試資料庫連線
  const { data, error } = await supabase.from('matches').select('count').limit(1)
  if (error) {
    console.error('❌ 資料庫連線失敗:', error.message)
    process.exit(1)
  }
  console.log('✅ 資料庫連線成功\n')

  // 嘗試爬取
  try {
    await scrapeMatches()
  } catch (err) {
    console.error('爬蟲錯誤:', err.message)
    console.log('\n💡 提示：台彩網站使用 JavaScript 渲染，爬蟲可能需要額外調整。')
    console.log('   建議方案：')
    console.log('   1. 使用管理員後台手動新增比賽（推薦）')
    console.log('   2. 參考 insertManualMatch() 函數，在腳本中直接填入資料')
    console.log('   3. 開啟 debug_screenshot.png 確認頁面結構後調整選擇器')
  }
}

main().catch(console.error)
