import { createClient } from '@/lib/supabase/server'
import { Bet, BET_TYPE_LABELS, BET_STATUS_LABELS } from '@/types'
import Link from 'next/link'

function formatDate(s: string) {
  return new Date(s).toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getSelectionText(bet: Bet & { matches?: { home_team: string; away_team: string } }): string {
  const s = bet.selection as unknown as Record<string, unknown>
  switch (bet.bet_type) {
    case '1x2':
    case 'half_time_1x2': {
      const map: Record<string, string> = {
        home: bet.matches?.home_team ?? '主隊',
        draw: '和局',
        away: bet.matches?.away_team ?? '客隊',
      }
      return map[s.choice as string] ?? String(s.choice)
    }
    case 'asian_handicap': {
      const team = s.choice === 'home' ? bet.matches?.home_team ?? '主隊' : bet.matches?.away_team ?? '客隊'
      const h = s.handicap as number
      const label = s.choice === 'home'
        ? (h < 0 ? `${h}` : `+${h}`)
        : (h > 0 ? `-${h}` : h < 0 ? `+${Math.abs(h)}` : '0')
      return `${team} (${label})`
    }
    case 'over_under':
      return `${s.choice === 'over' ? '大' : '小'} ${s.line}`
    case 'correct_score':
      if (s.is_other) return `其他（${s.other_type === 'home' ? '主隊' : s.other_type === 'draw' ? '和局' : '客隊'}）`
      return `${s.home_score} - ${s.away_score}`
    default:
      return JSON.stringify(s)
  }
}

export default async function MyBetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bets } = await supabase
    .from('bets')
    .select('*, matches(id, home_team, away_team, competition, match_time, home_score, away_score, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const pending = bets?.filter(b => b.status === 'pending') ?? []
  const settled = bets?.filter(b => b.status !== 'pending') ?? []

  const totalWon = settled.filter(b => b.status === 'won').reduce((s, b) => s + b.actual_payout, 0)
  const totalBet = (bets ?? []).reduce((s, b) => s + b.amount, 0)
  const totalPending = pending.reduce((s, b) => s + b.amount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">我的下注</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">總下注次數</p>
          <p className="text-2xl font-bold text-white">{bets?.length ?? 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">待結算</p>
          <p className="text-2xl font-bold text-yellow-400">{totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">總獲利</p>
          <p className={`text-2xl font-bold ${totalWon - totalBet + totalPending >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalWon.toLocaleString()}
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">待結算</h2>
          <div className="space-y-2">
            {pending.map(bet => <BetRow key={bet.id} bet={bet} />)}
          </div>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">已結算</h2>
          <div className="space-y-2">
            {settled.map(bet => <BetRow key={bet.id} bet={bet} />)}
          </div>
        </section>
      )}

      {(!bets || bets.length === 0) && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">還沒有下注紀錄</p>
          <Link href="/matches" className="text-green-400 hover:text-green-300">去下注 →</Link>
        </div>
      )}
    </div>
  )
}

function BetRow({ bet }: { bet: Bet & { matches?: { id: string; home_team: string; away_team: string; competition: string; match_time: string; home_score: number | null; away_score: number | null } } }) {
  const statusStyles = {
    pending: 'text-yellow-400',
    won: 'text-green-400',
    lost: 'text-red-400',
    void: 'text-gray-400',
    cancelled: 'text-gray-500',
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {bet.matches && (
            <Link
              href={`/matches/${bet.matches.id}`}
              className="text-sm font-medium text-white hover:text-green-400 transition-colors"
            >
              {bet.matches.home_team} vs {bet.matches.away_team}
            </Link>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
              {BET_TYPE_LABELS[bet.bet_type]}
            </span>
            <span className="text-sm text-gray-300">{getSelectionText(bet)}</span>
            <span className="text-xs text-green-400">@ {bet.odds.toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{formatDate(bet.created_at)}</p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-white font-semibold">{bet.amount.toLocaleString()} 點</p>
          <p className={`text-sm font-medium ${statusStyles[bet.status]}`}>
            {BET_STATUS_LABELS[bet.status]}
            {bet.status === 'won' && <span className="ml-1">+{bet.actual_payout.toLocaleString()}</span>}
            {bet.status === 'void' && <span className="ml-1">(退款)</span>}
          </p>
          {bet.status === 'pending' && (
            <p className="text-xs text-gray-500">可得 {bet.potential_payout.toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}
