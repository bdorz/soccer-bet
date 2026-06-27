/**
 * 台灣運彩足球資料同步腳本（純 HTTP，不需要 Playwright）
 *
 * 執行方式：node scripts/sync-sportslottery.js
 * 需要：npm install @supabase/supabase-js dotenv node-fetch
 *
 * 賠率公式：decimal_odds = (pu + 10) / 10
 * 足球 API：https://blob3rd.sportslottery.com.tw/apidata/Pre/34740.1-Games.zh.json
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SOCCER_API = 'https://blob3rd.sportslottery.com.tw/apidata/Pre/34740.1-Games.zh.json'

// pu 值轉小數賠率
function puToOdds(pu) {
  return parseFloat(((pu + 10) / 10).toFixed(2))
}

// 從比賽的 ms（markets）陣列解析各玩法賠率
function parseMarkets(ms) {
  const result = {}

  for (const market of ms) {
    const name = market.name || ''
    const choices = market.cs || []

    // 勝平負（不讓分）
    if (name === '不讓分' && !result['1x2']) {
      const h = choices.find(c => c.v === 'H')
      const d = choices.find(c => c.v === 'D')
      const a = choices.find(c => c.v === 'A')
      if (h && d && a) {
        result['1x2'] = {
          home: puToOdds(h.pu),
          draw: puToOdds(d.pu),
          away: puToOdds(a.pu),
        }
      }
    }

    // 大小球（總分大小 X.5）
    if (name.startsWith('[總分]大小') && !result['over_under']) {
      const lineMatch = name.match(/[\d.]+/)
      const line = lineMatch ? parseFloat(lineMatch[0]) : null
      const over = choices.find(c => c.name?.includes('大') || c.sn?.includes('大') || c.v === 'O')
      const under = choices.find(c => c.name?.includes('小') || c.sn?.includes('小') || c.v === 'U')
      if (line && over && under) {
        result['over_under'] = {
          line,
          over: puToOdds(over.pu),
          under: puToOdds(under.pu),
        }
      }
    }

    // 半場獨贏（上半場不讓分）
    if (name === '[上半場]不讓分' && !result['half_time_1x2']) {
      const h = choices.find(c => c.v === 'H')
      const d = choices.find(c => c.v === 'D')
      const a = choices.find(c => c.v === 'A')
      if (h && d && a) {
        result['half_time_1x2'] = {
          home: puToOdds(h.pu),
          draw: puToOdds(d.pu),
          away: puToOdds(a.pu),
        }
      }
    }

    // 讓球盤（讓分 X:Y）- 取第一個出現的
    if (name.startsWith('讓分') && !result['asian_handicap']) {
      // 解析讓分格式，如「讓分 1:0」代表客隊讓 1 球
      const hGoal = parseInt(name.match(/(\d+):/)?.[1] ?? '0')
      const aGoal = parseInt(name.match(/:(\d+)/)?.[1] ?? '0')
      const h = choices.find(c => c.v === 'H')
      const a = choices.find(c => c.v === 'A')
      if (h && a) {
        // handicap 從主隊角度：主隊需讓幾球（負 = 主隊讓球）
        const handicap = aGoal - hGoal
        result['asian_handicap'] = {
          handicap,
          home_odds: puToOdds(h.pu),
          away_odds: puToOdds(a.pu),
        }
      }
    }

    // 波膽（正確比分）- 台彩 API 中的玩法名稱
    if ((name === '正確比分' || name === '波膽') && !result['correct_score']) {
      const scoreMap = {}
      for (const c of choices) {
        // c.name 通常是 "1:0", "2:1" 等格式
        const scoreLabel = c.name || c.sn || ''
        if (scoreLabel.includes(':')) {
          const [h, a] = scoreLabel.split(':').map(Number)
          const key = `${h}-${a}`
          scoreMap[key] = puToOdds(c.pu)
        } else if (scoreLabel.includes('其他')) {
          const v = c.v || ''
          if (v === 'H') scoreMap['other_home'] = puToOdds(c.pu)
          else if (v === 'D') scoreMap['other_draw'] = puToOdds(c.pu)
          else if (v === 'A') scoreMap['other_away'] = puToOdds(c.pu)
        }
      }
      if (Object.keys(scoreMap).length > 0) {
        result['correct_score'] = scoreMap
      }
    }
  }

  return result
}

async function syncMatches() {
  console.log('📡 抓取台彩足球資料...')

  let games
  try {
    // Node.js 18+ 內建 fetch
    const res = await fetch(SOCCER_API)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    games = await res.json()
  } catch (err) {
    console.error('❌ 抓取失敗:', err.message)
    process.exit(1)
  }

  console.log(`✅ 共 ${games.length} 場足球比賽`)

  let added = 0, skipped = 0, updated = 0

  for (const game of games) {
    const sourceId = String(game.id || game.no || '')
    const homeTeam = game.hn || ''
    const awayTeam = game.an || ''
    const competition = game.tn || '足球'
    const matchTime = game.kt ? new Date(game.kt) : null

    if (!homeTeam || !awayTeam || !matchTime) continue

    // 只同步未來的比賽
    if (matchTime <= new Date()) continue

    // 解析賠率
    const markets = parseMarkets(game.ms || [])
    if (Object.keys(markets).length === 0) continue

    // 確認是否已存在
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .eq('source_id', sourceId)
      .single()

    if (existing) {
      skipped++
      continue
    }

    // 新增比賽
    const { data: match, error } = await supabase.from('matches').insert({
      competition,
      home_team: homeTeam,
      away_team: awayTeam,
      match_time: matchTime.toISOString(),
      bet_close_time: matchTime.toISOString(),
      source_id: sourceId,
      status: 'open',
    }).select().single()

    if (error) {
      console.error(`❌ 新增失敗 ${homeTeam} vs ${awayTeam}:`, error.message)
      continue
    }

    // 新增賠率
    const oddsRows = Object.entries(markets).map(([bet_type, odds_data]) => ({
      match_id: match.id,
      bet_type,
      odds_data,
    }))
    await supabase.from('match_odds').insert(oddsRows)

    console.log(`✅ 新增：${homeTeam} vs ${awayTeam}（${competition}）— ${Object.keys(markets).join(', ')}`)
    added++
  }

  // 關閉過期比賽
  await supabase.rpc('close_expired_matches')

  console.log(`\n📊 同步完成：新增 ${added}，略過 ${skipped} 場`)
}

syncMatches().catch(err => {
  console.error('同步錯誤:', err)
  process.exit(1)
})
