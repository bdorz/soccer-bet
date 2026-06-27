import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ data: matches }, { data: profiles }, { data: bets }] = await Promise.all([
    supabase.from('matches').select('id, status').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, username, wallet_balance').order('wallet_balance', { ascending: false }),
    supabase.from('bets').select('id, status, amount'),
  ])

  const openCount = matches?.filter(m => m.status === 'open').length ?? 0
  const pendingBets = bets?.filter(b => b.status === 'pending').length ?? 0
  const totalBetAmount = bets?.reduce((s, b) => s + b.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="開放比賽" value={openCount} color="text-green-400" />
        <StatCard label="待結算下注" value={pendingBets} color="text-yellow-400" />
        <StatCard label="玩家人數" value={profiles?.length ?? 0} color="text-blue-400" />
        <StatCard label="總流水" value={totalBetAmount.toLocaleString()} color="text-purple-400" suffix="點" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-3">比賽管理</h2>
          <div className="space-y-2">
            <Link href="/admin/matches/new" className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg px-4 py-2.5 text-center transition-colors">
              + 新增比賽
            </Link>
            <Link href="/admin/matches" className="block w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg px-4 py-2.5 text-center transition-colors">
              管理所有比賽
            </Link>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-3">玩家列表</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {profiles?.map((p, i) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-gray-400">{i + 1}. {p.username}</span>
                <span className="text-green-400 font-medium">{p.wallet_balance.toLocaleString()} 點</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent matches needing settlement */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-3">需要結算的比賽</h2>
        <div className="space-y-2">
          {matches?.filter(m => m.status === 'closed').map(m => (
            <div key={m.id} className="flex items-center justify-between">
              <span className="text-sm text-gray-400">比賽 {m.id.slice(0, 8)}...</span>
              <Link
                href={`/admin/matches/${m.id}/settle`}
                className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg transition-colors"
              >
                結算
              </Link>
            </div>
          ))}
          {!matches?.some(m => m.status === 'closed') && (
            <p className="text-sm text-gray-500">目前沒有待結算比賽</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, suffix = '' }: { label: string; value: number | string; color: string; suffix?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}{suffix}</p>
    </div>
  )
}
