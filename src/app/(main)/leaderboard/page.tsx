import { createClient } from '@/lib/supabase/server'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profiles }, { data: betStats }] = await Promise.all([
    supabase.from('profiles').select('id, username, wallet_balance').order('wallet_balance', { ascending: false }),
    supabase.from('bets').select('user_id, status, amount, actual_payout').neq('status', 'cancelled'),
  ])

  // Compute stats per user
  const statsMap = new Map<string, { total_bets: number; won: number; total_won: number; total_placed: number }>()
  betStats?.forEach(b => {
    const cur = statsMap.get(b.user_id) ?? { total_bets: 0, won: 0, total_won: 0, total_placed: 0 }
    cur.total_bets += 1
    cur.total_placed += b.amount
    if (b.status === 'won') { cur.won += 1; cur.total_won += b.actual_payout }
    statsMap.set(b.user_id, cur)
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">排行榜</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 text-xs text-gray-500 px-4 py-3 border-b border-gray-800">
          <span className="col-span-1 text-center">#</span>
          <span className="col-span-4">玩家</span>
          <span className="col-span-3 text-right">點數</span>
          <span className="col-span-2 text-right">下注</span>
          <span className="col-span-2 text-right">勝率</span>
        </div>

        {profiles?.map((profile, index) => {
          const stats = statsMap.get(profile.id)
          const winRate = stats && stats.total_bets > 0
            ? ((stats.won / stats.total_bets) * 100).toFixed(0)
            : '0'
          const isMe = profile.id === user?.id

          return (
            <div
              key={profile.id}
              className={`grid grid-cols-12 px-4 py-3 border-b border-gray-800/50 last:border-0 items-center
                ${isMe ? 'bg-green-900/20' : 'hover:bg-gray-800/30'}`}
            >
              <span className={`col-span-1 text-center font-bold ${
                index === 0 ? 'text-yellow-400 text-lg' :
                index === 1 ? 'text-gray-300 text-lg' :
                index === 2 ? 'text-amber-600 text-lg' :
                'text-gray-600'
              }`}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </span>
              <div className="col-span-4">
                <span className={`font-medium ${isMe ? 'text-green-400' : 'text-white'}`}>
                  {profile.username}
                  {isMe && <span className="text-xs text-green-600 ml-1">(我)</span>}
                </span>
              </div>
              <span className="col-span-3 text-right font-bold text-green-400">
                {profile.wallet_balance.toLocaleString()}
              </span>
              <span className="col-span-2 text-right text-gray-400 text-sm">
                {stats?.total_bets ?? 0}
              </span>
              <span className="col-span-2 text-right text-sm">
                <span className={parseInt(winRate) >= 50 ? 'text-green-400' : 'text-gray-400'}>
                  {winRate}%
                </span>
              </span>
            </div>
          )
        })}

        {(!profiles || profiles.length === 0) && (
          <div className="text-center py-10 text-gray-500">
            <p>暫無排名</p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 text-center mt-4">
        初始點數：10,000 點 · 每位玩家均可查看排名
      </p>
    </div>
  )
}
