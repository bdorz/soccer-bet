'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BetType, Match, MatchOdds, BetSelection,
  Odds1x2, OddsAsianHandicap, OddsOverUnder, OddsCorrectScore,
  Selection1x2, SelectionAsianHandicap, SelectionOverUnder, SelectionCorrectScore,
  BET_TYPE_LABELS,
} from '@/types'
import BetTypeSelector from './betting/BetTypeSelector'
import OneX2Panel from './betting/OneX2Panel'
import AsianHandicapPanel from './betting/AsianHandicapPanel'
import OverUnderPanel from './betting/OverUnderPanel'
import CorrectScorePanel from './betting/CorrectScorePanel'

interface Props {
  match: Match
  odds: MatchOdds[]
  walletBalance: number
}

const MIN_BET = 50

function getSelectionLabel(type: BetType, selection: BetSelection, match: Match): string {
  switch (type) {
    case '1x2':
    case 'half_time_1x2': {
      const s = selection as Selection1x2
      if (s.choice === 'home') return match.home_team
      if (s.choice === 'draw') return '和局'
      return match.away_team
    }
    case 'asian_handicap': {
      const s = selection as SelectionAsianHandicap
      const h = s.handicap
      const label = s.choice === 'home' ? match.home_team : match.away_team
      const hLabel = s.choice === 'home'
        ? (h < 0 ? `${h}` : `+${h}`)
        : (h > 0 ? `-${h}` : h < 0 ? `+${Math.abs(h)}` : '0')
      return `${label} (${hLabel})`
    }
    case 'over_under': {
      const s = selection as SelectionOverUnder
      return `${s.choice === 'over' ? '大' : '小'} ${s.line}`
    }
    case 'correct_score': {
      const s = selection as SelectionCorrectScore
      if (s.is_other) {
        const t = s.other_type === 'home' ? '主隊' : s.other_type === 'draw' ? '和局' : '客隊'
        return `其他（${t}）`
      }
      return `${s.home_score} - ${s.away_score}`
    }
    default:
      return ''
  }
}

function getOddsValue(type: BetType, selection: BetSelection, oddsData: MatchOdds['odds_data']): number {
  switch (type) {
    case '1x2':
    case 'half_time_1x2': {
      const s = selection as Selection1x2
      const o = oddsData as Odds1x2
      return o[s.choice]
    }
    case 'asian_handicap': {
      const s = selection as SelectionAsianHandicap
      const o = oddsData as OddsAsianHandicap
      return s.choice === 'home' ? o.home_odds : o.away_odds
    }
    case 'over_under': {
      const s = selection as SelectionOverUnder
      const o = oddsData as OddsOverUnder
      return s.choice === 'over' ? o.over : o.under
    }
    case 'correct_score': {
      const s = selection as SelectionCorrectScore
      const o = oddsData as OddsCorrectScore
      if (s.is_other) {
        const key = `other_${s.other_type}` as keyof OddsCorrectScore
        return o[key] as number
      }
      const key = `${s.home_score}-${s.away_score}`
      return o[key] as number
    }
    default:
      return 0
  }
}

export default function BettingWidget({ match, odds, walletBalance }: Props) {
  const router = useRouter()
  const availableTypes = odds.filter(o => o.is_active).map(o => o.bet_type)
  const [activeType, setActiveType] = useState<BetType>(availableTypes[0] ?? '1x2')
  const [selection, setSelection] = useState<BetSelection | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const currentOdds = odds.find(o => o.bet_type === activeType)
  const isClosed = match.status !== 'open'

  const numAmount = parseFloat(amount) || 0
  const selectedOdds = selection && currentOdds ? getOddsValue(activeType, selection, currentOdds.odds_data) : 0
  const payout = selectedOdds > 0 ? numAmount * selectedOdds : 0

  function handleTypeChange(type: BetType) {
    setActiveType(type)
    setSelection(null)
    setMessage(null)
  }

  async function handleSubmit() {
    if (!selection) return setMessage({ type: 'error', text: '請先選擇下注選項' })
    if (numAmount < MIN_BET) return setMessage({ type: 'error', text: `最低下注金額為 ${MIN_BET} 點` })
    if (numAmount > walletBalance) return setMessage({ type: 'error', text: '點數不足' })

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: match.id,
          bet_type: activeType,
          selection,
          amount: numAmount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '下注失敗')
      setMessage({ type: 'success', text: `下注成功！預期獲得 ${payout.toFixed(0)} 點` })
      setSelection(null)
      setAmount('')
      router.refresh()
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '下注失敗' })
    } finally {
      setLoading(false)
    }
  }

  if (isClosed) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-400">此比賽已截止下注</p>
        {match.home_score !== null && (
          <p className="text-2xl font-bold text-white mt-2">
            {match.home_score} - {match.away_score}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">下注</h3>
        <span className="text-sm text-green-400">{walletBalance.toLocaleString()} 點</span>
      </div>

      {/* Bet type tabs */}
      <BetTypeSelector
        availableTypes={availableTypes}
        selected={activeType}
        onChange={handleTypeChange}
      />

      {/* Odds panel */}
      {currentOdds && (
        <div>
          {activeType === '1x2' && (
            <OneX2Panel
              odds={currentOdds.odds_data as Odds1x2}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
              selection={selection as Selection1x2 | null}
              onSelect={s => setSelection(s)}
            />
          )}
          {activeType === 'half_time_1x2' && (
            <OneX2Panel
              odds={currentOdds.odds_data as Odds1x2}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
              selection={selection as Selection1x2 | null}
              onSelect={s => setSelection(s)}
            />
          )}
          {activeType === 'asian_handicap' && (
            <AsianHandicapPanel
              odds={currentOdds.odds_data as OddsAsianHandicap}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
              selection={selection as SelectionAsianHandicap | null}
              onSelect={s => setSelection(s)}
            />
          )}
          {activeType === 'over_under' && (
            <OverUnderPanel
              odds={currentOdds.odds_data as OddsOverUnder}
              selection={selection as SelectionOverUnder | null}
              onSelect={s => setSelection(s)}
            />
          )}
          {activeType === 'correct_score' && (
            <CorrectScorePanel
              odds={currentOdds.odds_data as OddsCorrectScore}
              selection={selection as SelectionCorrectScore | null}
              onSelect={s => setSelection(s)}
            />
          )}
        </div>
      )}

      {/* Bet slip */}
      {selection && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">選擇</span>
            <span className="text-white font-medium">
              {BET_TYPE_LABELS[activeType]} — {getSelectionLabel(activeType, selection, match)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">賠率</span>
            <span className="text-green-400 font-bold">{selectedOdds.toFixed(2)}</span>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">下注金額（最低 {MIN_BET} 點）</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={MIN_BET}
              max={walletBalance}
              placeholder={`${MIN_BET}`}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
            {/* Quick amount buttons */}
            <div className="flex gap-2 mt-2">
              {[100, 500, 1000, 5000].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(Math.min(v, walletBalance)))}
                  className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded py-1 transition-colors"
                >
                  {v}
                </button>
              ))}
              <button
                onClick={() => setAmount(String(walletBalance))}
                className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded py-1 transition-colors"
              >
                全押
              </button>
            </div>
          </div>

          {numAmount >= MIN_BET && (
            <div className="flex justify-between text-sm border-t border-gray-700 pt-3">
              <span className="text-gray-400">預期獲得</span>
              <span className="text-yellow-400 font-bold text-lg">{payout.toFixed(0)} 點</span>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`text-sm px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-900/40 border border-green-700 text-green-300'
            : 'bg-red-900/40 border border-red-700 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selection || numAmount < MIN_BET || loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-all"
      >
        {loading ? '下注中...' : '確認下注'}
      </button>
    </div>
  )
}
