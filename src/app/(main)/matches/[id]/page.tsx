import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BettingWidget from '@/components/BettingWidget'
import { Match, MatchOdds, Bet, BET_TYPE_LABELS, BET_STATUS_LABELS } from '@/types'
import Link from 'next/link'

function formatDate(s: string) {
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function UserBetHistory({ bets }: { bets: Bet[] }) {
  if (bets.length === 0) return null
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="font-semibold text-white mb-3">我的下注紀錄</h3>
      <div className="space-y-2">
        {bets.map(bet => (
          <div key={bet.id} className="flex items-center justify-between text-sm bg-gray-800 rounded-lg px-3 py-2">
            <div>
              <span className="text-gray-400">{BET_TYPE_LABELS[bet.bet_type]}</span>
              <span className="text-white ml-2">
                {bet.bet_type === '1x2' || bet.bet_type === 'half_time_1x2'
                  ? (bet.selection as { choice: string }).choice
                  : JSON.stringify(bet.selection)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-gray-300">{bet.amount} 點 @ {bet.odds.toFixed(2)}</div>
              <div className={`text-xs font-medium ${
                bet.status === 'won' ? 'text-green-400' :
                bet.status === 'lost' ? 'text-red-400' :
                bet.status === 'void' ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                {BET_STATUS_LABELS[bet.status]}
                {bet.status === 'won' && ` +${bet.actual_payout}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: match }, { data: profile }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', id).single(),
    supabase.from('profiles').select('wallet_balance').eq('id', user.id).single(),
  ])

  if (!match) notFound()

  const { data: odds } = await supabase
    .from('match_odds')
    .select('*')
    .eq('match_id', id)
    .eq('is_active', true)

  const { data: userBets } = await supabase
    .from('bets')
    .select('*')
    .eq('match_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const m = match as Match
  const hasResult = m.home_score !== null && m.away_score !== null

  return (
    <div>
      <div className="mb-4">
        <Link href="/matches" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← 返回比賽列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{m.competition}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                m.status === 'open' ? 'bg-green-900/60 text-green-400 border border-green-700' :
                m.status === 'finished' ? 'bg-gray-800 text-gray-400 border border-gray-700' :
                'bg-yellow-900/60 text-yellow-400 border border-yellow-700'
              }`}>
                {m.status === 'open' ? '開放下注' : m.status === 'finished' ? '已完賽' : m.status === 'closed' ? '已截止' : '已取消'}
              </span>
            </div>

            {/* Score / Teams */}
            <div className="flex items-center justify-center gap-6 py-6">
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-white">{m.home_team}</p>
                <p className="text-xs text-gray-500 mt-1">主隊</p>
              </div>
              <div className="text-center">
                {hasResult ? (
                  <p className="text-4xl font-black text-green-400">
                    {m.home_score} - {m.away_score}
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-gray-600">VS</p>
                )}
              </div>
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-white">{m.away_team}</p>
                <p className="text-xs text-gray-500 mt-1">客隊</p>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">比賽時間</span>
                <span className="text-gray-300">{formatDate(m.match_time)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">下注截止</span>
                <span className="text-gray-300">{formatDate(m.bet_close_time)}</span>
              </div>
              {m.source_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">運彩場次</span>
                  <span className="text-gray-400">{m.source_id}</span>
                </div>
              )}
              {m.notes && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">備註</span>
                  <span className="text-gray-400">{m.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* User bet history */}
          <UserBetHistory bets={(userBets ?? []) as Bet[]} />
        </div>

        {/* Betting panel */}
        <div>
          {odds && odds.length > 0 ? (
            <BettingWidget
              match={m}
              odds={odds as MatchOdds[]}
              walletBalance={profile?.wallet_balance ?? 0}
            />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
              <p>尚未設定賠率</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
