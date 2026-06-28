'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Match, Bet, BET_TYPE_LABELS } from '@/types'

export default function SettlePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [bets, setBets] = useState<(Bet & { profiles?: { username: string } })[]>([])
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settled, setSettled] = useState<{ settled: number; total_paid_out: number } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('matches').select('*').eq('id', id).single().then(({ data }) => setMatch(data as Match))
    supabase.from('bets').select('*, profiles(username)').eq('match_id', id).eq('status', 'pending').then(({ data }) => setBets((data ?? []) as (Bet & { profiles?: { username: string } })[]))
  }, [id])

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const h = parseInt(homeScore)
    const a = parseInt(awayScore)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError('請輸入有效比分')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/matches/${id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_score: h, away_score: a }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSettled(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '結算失敗')
    } finally {
      setLoading(false)
    }
  }

  if (!match) return <div className="text-gray-400">載入中...</div>

  if (settled) {
    return (
      <div className="max-w-md text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-white mb-2">結算完成</h2>
        <p className="text-gray-400 mb-1">已結算 <span className="text-white font-bold">{settled.settled}</span> 筆下注</p>
        <p className="text-gray-400 mb-6">共派彩 <span className="text-green-400 font-bold">{(settled.total_paid_out ?? 0).toLocaleString()} 點</span></p>
        <Link href="/admin/matches" className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl px-6 py-3 transition-colors">
          返回比賽列表
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">結算比賽</h2>
        <Link href="/admin/matches" className="text-sm text-gray-400 hover:text-white">← 返回</Link>
      </div>

      {/* Match info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-500 mb-2">{match.competition}</p>
        <div className="flex items-center justify-center gap-6 py-4">
          <p className="text-xl font-bold text-white">{match.home_team}</p>
          <p className="text-gray-500">VS</p>
          <p className="text-xl font-bold text-white">{match.away_team}</p>
        </div>
        <p className="text-center text-sm text-gray-500">
          {new Date(match.match_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
        </p>
        <div className="text-center mt-3">
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${match.home_team} vs ${match.away_team} 賽果`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            🔍 Google 查詢賽果
          </a>
        </div>
      </div>

      {/* Pending bets summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">待結算下注（{bets.length} 筆）</h3>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {bets.map(bet => (
            <div key={bet.id} className="flex justify-between text-xs text-gray-400">
              <span>{bet.profiles?.username} — {BET_TYPE_LABELS[bet.bet_type]}</span>
              <span>{bet.amount} 點 @ {bet.odds.toFixed(2)} → {bet.potential_payout.toFixed(0)}</span>
            </div>
          ))}
          {bets.length === 0 && <p className="text-gray-600">無待結算下注</p>}
        </div>
      </div>

      {/* Score input */}
      <form onSubmit={handleSettle} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase">輸入最終比分</h3>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-1">{match.home_team}</p>
            <input
              type="number"
              min="0"
              value={homeScore}
              onChange={e => setHomeScore(e.target.value)}
              required
              placeholder="0"
              className="w-full text-center text-3xl font-bold bg-gray-800 border border-gray-700 rounded-xl py-4 text-white focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <span className="text-gray-600 text-2xl font-bold">:</span>
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-1">{match.away_team}</p>
            <input
              type="number"
              min="0"
              value={awayScore}
              onChange={e => setAwayScore(e.target.value)}
              required
              placeholder="0"
              className="w-full text-center text-3xl font-bold bg-gray-800 border border-gray-700 rounded-xl py-4 text-white focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !homeScore || !awayScore}
          className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-all"
        >
          {loading ? '結算中...' : `確認結算 ${homeScore || '?'} : ${awayScore || '?'}`}
        </button>
        <p className="text-xs text-gray-600 text-center">結算後將自動派彩給獲勝玩家，此操作不可撤銷</p>
      </form>
    </div>
  )
}
