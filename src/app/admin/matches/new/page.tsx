'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { COMPETITIONS } from '@/types'

interface OddsEntry {
  bet_type: string
  enabled: boolean
  // 1x2
  home?: number; draw?: number; away?: number
  // asian_handicap
  handicap?: number; home_odds?: number; away_odds?: number
  // over_under
  line?: number; over?: number; under?: number
  // correct_score / half_time handled separately
}

const DEFAULT_ODDS: OddsEntry[] = [
  { bet_type: '1x2', enabled: true, home: 2.00, draw: 3.20, away: 3.50 },
  { bet_type: 'asian_handicap', enabled: false, handicap: -0.5, home_odds: 1.88, away_odds: 2.02 },
  { bet_type: 'over_under', enabled: false, line: 2.5, over: 1.85, under: 2.05 },
  { bet_type: 'half_time_1x2', enabled: false, home: 2.80, draw: 2.50, away: 4.00 },
]

const BET_TYPE_LABELS: Record<string, string> = {
  '1x2': '勝平負 (1X2)',
  'asian_handicap': '讓球盤 (Asian Handicap)',
  'over_under': '大小球 (Over/Under)',
  'correct_score': '波膽 (Correct Score)',
  'half_time_1x2': '半場獨贏',
}

function buildOddsData(entry: OddsEntry): Record<string, unknown> {
  switch (entry.bet_type) {
    case '1x2':
    case 'half_time_1x2':
      return { home: entry.home, draw: entry.draw, away: entry.away }
    case 'asian_handicap':
      return { handicap: entry.handicap, home_odds: entry.home_odds, away_odds: entry.away_odds }
    case 'over_under':
      return { line: entry.line, over: entry.over, under: entry.under }
    default:
      return {}
  }
}

export default function NewMatchPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [competition, setCompetition] = useState(COMPETITIONS[0])
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [matchTime, setMatchTime] = useState('')
  const [betCloseTime, setBetCloseTime] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [notes, setNotes] = useState('')
  const [oddsEntries, setOddsEntries] = useState<OddsEntry[]>(DEFAULT_ODDS)

  // Correct score separate state (JSON textarea)
  const [correctScoreEnabled, setCorrectScoreEnabled] = useState(false)
  const [correctScoreJson, setCorrectScoreJson] = useState(
    JSON.stringify({
      '1-0': 7.50, '2-0': 9.50, '2-1': 7.00, '3-0': 16.00, '3-1': 12.00, '3-2': 16.00,
      '4-0': 34.00, '4-1': 26.00, '4-2': 34.00, '4-3': 67.00,
      '0-0': 8.50, '1-1': 5.00, '2-2': 12.00, '3-3': 34.00,
      '0-1': 9.50, '0-2': 13.00, '1-2': 8.00, '0-3': 19.00, '1-3': 13.00, '2-3': 16.00,
      '0-4': 41.00, '1-4': 26.00, '2-4': 34.00, '3-4': 67.00,
      'other_home': 20.00, 'other_draw': 45.00, 'other_away': 22.00,
    }, null, 2)
  )

  function updateOdds(idx: number, field: string, value: unknown) {
    setOddsEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  function handleMatchTimeChange(v: string) {
    setMatchTime(v)
    // Auto-set close time to match time
    if (!betCloseTime && v) setBetCloseTime(v)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!homeTeam || !awayTeam || !matchTime) {
      setError('請填寫隊名與時間')
      return
    }

    const odds: { bet_type: string; odds_data: Record<string, unknown> }[] = []

    for (const entry of oddsEntries) {
      if (!entry.enabled) continue
      odds.push({ bet_type: entry.bet_type, odds_data: buildOddsData(entry) })
    }

    if (correctScoreEnabled) {
      try {
        const data = JSON.parse(correctScoreJson)
        odds.push({ bet_type: 'correct_score', odds_data: data })
      } catch {
        setError('波膽賠率 JSON 格式錯誤')
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competition, home_team: homeTeam, away_team: awayTeam,
          match_time: new Date(matchTime).toISOString(),
          bet_close_time: new Date(betCloseTime || matchTime).toISOString(),
          source_id: sourceId || null,
          notes: notes || null,
          odds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/admin/matches')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '建立失敗')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">新增比賽</h2>
        <Link href="/admin/matches" className="text-sm text-gray-400 hover:text-white">← 返回</Link>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Basic info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">比賽資訊</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1">賽事</label>
          <select value={competition} onChange={e => setCompetition(e.target.value)} className={inputClass}>
            {COMPETITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">主隊</label>
            <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} required placeholder="主隊名稱" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">客隊</label>
            <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} required placeholder="客隊名稱" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">比賽時間</label>
            <input type="datetime-local" value={matchTime} onChange={e => handleMatchTimeChange(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">下注截止時間</label>
            <input type="datetime-local" value={betCloseTime} onChange={e => setBetCloseTime(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">運彩場次 (選填)</label>
            <input value={sourceId} onChange={e => setSourceId(e.target.value)} placeholder="e.g. 3475476.1" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">備註 (選填)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="額外說明" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Odds */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">賠率設定</h3>

        {oddsEntries.map((entry, idx) => (
          <div key={entry.bet_type} className="border border-gray-800 rounded-lg p-3">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.enabled}
                onChange={e => updateOdds(idx, 'enabled', e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm font-medium text-white">{BET_TYPE_LABELS[entry.bet_type]}</span>
            </label>

            {entry.enabled && (
              <div className="grid grid-cols-3 gap-2">
                {(entry.bet_type === '1x2' || entry.bet_type === 'half_time_1x2') && (
                  <>
                    <div><label className="text-xs text-gray-500">主隊賠率</label>
                      <input type="number" step="0.01" value={entry.home} onChange={e => updateOdds(idx, 'home', parseFloat(e.target.value))} className={inputClass} /></div>
                    <div><label className="text-xs text-gray-500">和局賠率</label>
                      <input type="number" step="0.01" value={entry.draw} onChange={e => updateOdds(idx, 'draw', parseFloat(e.target.value))} className={inputClass} /></div>
                    <div><label className="text-xs text-gray-500">客隊賠率</label>
                      <input type="number" step="0.01" value={entry.away} onChange={e => updateOdds(idx, 'away', parseFloat(e.target.value))} className={inputClass} /></div>
                  </>
                )}
                {entry.bet_type === 'asian_handicap' && (
                  <>
                    <div><label className="text-xs text-gray-500">讓分（主隊）</label>
                      <input type="number" step="0.25" value={entry.handicap} onChange={e => updateOdds(idx, 'handicap', parseFloat(e.target.value))} className={inputClass} /></div>
                    <div><label className="text-xs text-gray-500">主隊賠率</label>
                      <input type="number" step="0.01" value={entry.home_odds} onChange={e => updateOdds(idx, 'home_odds', parseFloat(e.target.value))} className={inputClass} /></div>
                    <div><label className="text-xs text-gray-500">客隊賠率</label>
                      <input type="number" step="0.01" value={entry.away_odds} onChange={e => updateOdds(idx, 'away_odds', parseFloat(e.target.value))} className={inputClass} /></div>
                  </>
                )}
                {entry.bet_type === 'over_under' && (
                  <>
                    <div><label className="text-xs text-gray-500">盤口（球）</label>
                      <input type="number" step="0.5" value={entry.line} onChange={e => updateOdds(idx, 'line', parseFloat(e.target.value))} className={inputClass} /></div>
                    <div><label className="text-xs text-gray-500">大賠率</label>
                      <input type="number" step="0.01" value={entry.over} onChange={e => updateOdds(idx, 'over', parseFloat(e.target.value))} className={inputClass} /></div>
                    <div><label className="text-xs text-gray-500">小賠率</label>
                      <input type="number" step="0.01" value={entry.under} onChange={e => updateOdds(idx, 'under', parseFloat(e.target.value))} className={inputClass} /></div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Correct score */}
        <div className="border border-gray-800 rounded-lg p-3">
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={correctScoreEnabled}
              onChange={e => setCorrectScoreEnabled(e.target.checked)}
              className="w-4 h-4 accent-green-500"
            />
            <span className="text-sm font-medium text-white">{BET_TYPE_LABELS['correct_score']}</span>
          </label>
          {correctScoreEnabled && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">賠率 JSON（格式：&quot;1-0&quot;: 7.50, ...）</label>
              <textarea
                value={correctScoreJson}
                onChange={e => setCorrectScoreJson(e.target.value)}
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-all"
      >
        {loading ? '建立中...' : '建立比賽'}
      </button>
    </form>
  )
}
