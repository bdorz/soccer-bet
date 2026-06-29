/**
 * 台灣運彩足球資料同步腳本（只同步世界盃）
 * 執行方式：node scripts/sync-sportslottery.js
 *
 * 賠率公式：decimal_odds = 1 + pu/pd
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SOCCER_API = 'https://blob3rd.sportslottery.com.tw/apidata/Pre/34740.1-Games.zh.json'

// pd = 分母, pu = 分子 → 小數賠率 = 1 + pu/pd
function toOdds(pu, pd) {
  const n = parseFloat(pu), d = parseFloat(pd)
  if (!d || isNaN(n)) return 0
  return parseFloat((1 + n / d).toFixed(2))
}

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
          home: toOdds(h.pu, h.pd),
          draw: toOdds(d.pu, d.pd),
          away: toOdds(a.pu, a.pd),
        }
      }
    }

    // 大小球
    if (name.startsWith('[總分]大小') && !result['over_under']) {
      const lineMatch = name.match(/[\d.]+/)
      const line = lineMatch ? parseFloat(lineMatch[0]) : null
      const over = choices.find(c => c.name?.includes('大') || c.sn?.includes('大'))
      const under = choices.find(c => c.name?.includes('小') || c.sn?.includes('小'))
      if (line && over && under) {
        result['over_under'] = {
          line,
          over: toOdds(over.pu, over.pd),
          under: toOdds(under.pu, under.pd),
        }
      }
    }

    // 半場獨贏
    if (name === '[上半場]不讓分' && !result['half_time_1x2']) {
      const h = choices.find(c => c.v === 'H')
      const d = choices.find(c => c.v === 'D')
      const a = choices.find(c => c.v === 'A')
      if (h && d && a) {
        result['half_time_1x2'] = {
          home: toOdds(h.pu, h.pd),
          draw: toOdds(d.pu, d.pd),
          away: toOdds(a.pu, a.pd),
        }
      }
    }

    // 讓球盤
    if (name.startsWith('讓分') && !result['asian_handicap']) {
      const hGoal = parseInt(name.match(/(\d+):/)?.[1] ?? '0')
      const aGoal = parseInt(name.match(/:(\d+)/)?.[1] ?? '0')
      const h = choices.find(c => c.v === 'H')
      const a = choices.find(c => c.v === 'A')
      if (h && a) {
        result['asian_handicap'] = {
          handicap: aGoal - hGoal,
          home_odds: toOdds(h.pu, h.pd),
          away_odds: toOdds(a.pu, a.pd),
        }
      }
    }

    // 波膽
    if ((name === '正確比分' || name === '波膽') && !result['correct_score']) {
      const scoreMap = {}
      for (const c of choices) {
        const label = c.name || c.sn || ''
        if (label.includes(':')) {
          const [h, a] = label.split(':').map(Number)
          scoreMap[`${h}-${a}`] = toOdds(c.pu, c.pd)
        } else if (label.includes('其他')) {
          if (c.v === 'H') scoreMap['other_home'] = toOdds(c.pu, c.pd)
          else if (c.v === 'D') scoreMap['other_draw'] = toOdds(c.pu, c.pd)
          else if (c.v === 'A') scoreMap['other_away'] = toOdds(c.pu, c.pd)
        }
      }
      if (Object.keys(scoreMap).length > 0) result['correct_score'] = scoreMap
    }
  }

  return result
}

async function cleanupNonWorldCup() {
  // 刪除非世界盃且無下注的比賽
  const { data: matches } = await supabase
    .from('matches')
    .select('id, competition')
    .not('competition', 'ilike', '%世界盃%')
    .eq('status', 'open')

  if (!matches || matches.length === 0) return

  for (const m of matches) {
    const { count } = await supabase
      .from('bets')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', m.id)

    if (count === 0) {
      await supabase.from('match_odds').delete().eq('match_id', m.id)
      await supabase.from('matches').delete().eq('id', m.id)
      console.log(`🗑  刪除非世界盃比賽：${m.competition}`)
    }
  }
}

async function syncMatches() {
  console.log('📡 抓取台彩足球資料...')

  let games
  try {
    const res = await fetch(SOCCER_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://www.sportslottery.com.tw/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    games = await res.json()
  } catch (err) {
    console.error('❌ 抓取失敗:', err.message)
    process.exit(1)
  }

  // 只保留世界盃
  const wcGames = games.filter(g => g.tn?.includes('世界盃'))
  console.log(`✅ 共 ${games.length} 場足球，其中世界盃 ${wcGames.length} 場`)

  // 清除非世界盃資料
  await cleanupNonWorldCup()

  let added = 0, updated = 0

  for (const game of wcGames) {
    const sourceId = String(game.id || game.no || '')
    const homeTeam = game.hn || ''
    const awayTeam = game.an || ''
    const competition = game.tn || '2026世界盃'
    const matchTime = game.kt ? new Date(game.kt) : null

    if (!homeTeam || !awayTeam || !matchTime) continue
    if (matchTime <= new Date()) continue

    const markets = parseMarkets(game.ms || [])
    if (Object.keys(markets).length === 0) continue

    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .eq('source_id', sourceId)
      .single()

    if (existing) {
      // 更新賠率（修正公式）
      await supabase.from('match_odds').delete().eq('match_id', existing.id)
      await supabase.from('match_odds').insert(
        Object.entries(markets).map(([bet_type, odds_data]) => ({
          match_id: existing.id, bet_type, odds_data,
        }))
      )
      console.log(`🔄 更新賠率：${homeTeam} vs ${awayTeam}`)
      updated++
      continue
    }

    const { data: match, error } = await supabase.from('matches').insert({
      competition,
      home_team: homeTeam,
      away_team: awayTeam,
      match_time: matchTime.toISOString(),
      bet_close_time: matchTime.toISOString(),
      source_id: sourceId,
      status: 'open',
    }).select().single()

    if (error) { console.error(`❌ ${homeTeam} vs ${awayTeam}:`, error.message); continue }

    await supabase.from('match_odds').insert(
      Object.entries(markets).map(([bet_type, odds_data]) => ({
        match_id: match.id, bet_type, odds_data,
      }))
    )

    console.log(`✅ 新增：${homeTeam} vs ${awayTeam} — ${Object.keys(markets).join(', ')}`)
    added++
  }

  await supabase.rpc('close_expired_matches')
  console.log(`\n📊 完成：新增 ${added}，更新賠率 ${updated} 場`)
}

// 驗證賠率輸出（測試用）
async function verifyOdds() {
  const res = await fetch(SOCCER_API, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer': 'https://www.sportslottery.com.tw/',
      'Accept': 'application/json, text/plain, */*',
    },
  })
  const games = await res.json()
  const wc = games.filter(g => g.tn?.includes('世界盃'))
  if (!wc.length) { console.log('目前無世界盃場次'); return }

  console.log('\n=== 賠率驗證 ===')
  for (const g of wc.slice(0, 3)) {
    console.log(`\n${g.hn} vs ${g.an}（${g.tn}）`)
    const bet = g.ms?.find(m => m.name === '不讓分')
    if (!bet) continue
    for (const c of bet.cs) {
      const odds = toOdds(c.pu, c.pd)
      console.log(`  ${c.name}: pd=${c.pd} pu=${c.pu} → 賠率 ${odds}`)
    }
  }
}

const args = process.argv.slice(2)
if (args.includes('--verify')) {
  verifyOdds().catch(console.error)
} else {
  syncMatches().catch(console.error)
}
