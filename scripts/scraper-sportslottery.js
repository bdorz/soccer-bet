/**
 * 台灣運彩自動爬蟲
 * 執行方式: node scripts/scraper-sportslottery.js
 * 需要: npm install playwright @supabase/supabase-js dotenv
 *       npx playwright install chromium
 */

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SOCCER_URL = 'https://www.sportslottery.com.tw/sportsbook/daily-coupons'

// 競賽名稱對照
const COMPETITION_MAP = {
  'EPL': '英格蘭超級聯賽', 'English Premier League': '英格蘭超級聯賽',
  'La Liga': '西班牙超級聯賽', 'LALIGA': '西班牙超級聯賽',
  'Bundesliga': '德國甲組聯賽', 'Serie A': '義大利甲組聯賽',
  'Ligue 1': '法國甲組聯賽', 'UEFA Champions League': 'UEFA冠軍聯賽',
  'UEFA Europa League': 'UEFA歐洲聯賽',
}

function mapCompetition(name) {
  for (const [key, val] of Object.entries(COMPETITION_MAP)) {
    if (name.includes(key)) return val
  }
  return name
}

async function scrape() {
  console.log('🚀 啟動台彩爬蟲...')
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  try {
    await page.goto(SOCCER_URL, { waitUntil: 'networkidle', timeout: 60000 })
    console.log('✅ 頁面載入完成')

    // 等待比賽內容出現（嘗試常見 class）
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'scripts/debug.png' })
    console.log('📸 截圖已存：scripts/debug.png')

    // 監聽 XHR/Fetch 請求以找出 API
    const apiResponses = []
    page.on('response', async (res) => {
      const url = res.url()
      if (url.includes('/api/') || url.includes('event') || url.includes('odds') || url.includes('sport')) {
        try {
          const ct = res.headers()['content-type'] || ''
          if (ct.includes('json')) {
            const body = await res.json().catch(() => null)
            if (body) {
              apiResponses.push({ url, body })
              console.log('🔍 發現 API:', url)
            }
          }
        } catch {}
      }
    })

    // 重新載入以捕捉 API 請求
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(8000)

    if (apiResponses.length > 0) {
      console.log('\n✅ 找到以下 API：')
      apiResponses.forEach(r => {
        console.log(' -', r.url)
      })
      // 儲存 API 回應供分析
      const fs = require('fs')
      fs.writeFileSync('scripts/api_responses.json', JSON.stringify(apiResponses, null, 2))
      console.log('💾 API 回應已存至 scripts/api_responses.json')
    } else {
      console.log('⚠️  未發現 JSON API，嘗試直接解析 DOM...')
      await parseDom(page)
    }

  } finally {
    await browser.close()
  }
}

async function parseDom(page) {
  // 嘗試各種可能的 selector
  const selectors = [
    '[class*="event"]', '[class*="match"]', '[class*="game"]',
    '[class*="coupon"]', '[class*="fixture"]', '[data-testid*="event"]',
  ]

  for (const sel of selectors) {
    const count = await page.$$(sel).then(els => els.length).catch(() => 0)
    if (count > 0) {
      console.log(`找到 ${count} 個元素 (${sel})`)
    }
  }

  // 輸出完整 HTML 供分析
  const html = await page.content()
  const fs = require('fs')
  fs.writeFileSync('scripts/page_html.html', html)
  console.log('💾 頁面 HTML 已存至 scripts/page_html.html（供分析 DOM 結構）')
}

async function insertMatch({ competition, homeTeam, awayTeam, matchTime, sourceId, odds }) {
  // 確認是否已存在
  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('source_id', sourceId)
    .single()

  if (existing) {
    console.log(`⏭  已存在：${homeTeam} vs ${awayTeam}`)
    return
  }

  const { data: match, error } = await supabase.from('matches').insert({
    competition,
    home_team: homeTeam,
    away_team: awayTeam,
    match_time: matchTime,
    bet_close_time: matchTime,
    source_id: sourceId,
    status: 'open',
  }).select().single()

  if (error) { console.error('新增失敗:', error.message); return }

  if (odds.length > 0) {
    await supabase.from('match_odds').insert(
      odds.map(o => ({ match_id: match.id, ...o }))
    )
  }
  console.log(`✅ 新增：${homeTeam} vs ${awayTeam}`)
}

scrape().catch(err => {
  console.error('爬蟲錯誤:', err.message)
  process.exit(1)
})
