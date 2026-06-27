import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Match, STATUS_LABELS } from '@/types'

function formatDate(s: string) {
  return new Date(s).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
}

export default async function AdminMatchesPage() {
  const supabase = await createClient()
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_time', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">所有比賽</h2>
        <Link href="/admin/matches/new" className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
          + 新增比賽
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 text-xs text-gray-500 px-4 py-2 border-b border-gray-800">
          <span className="col-span-3">比賽</span>
          <span className="col-span-2">賽事</span>
          <span className="col-span-3">時間</span>
          <span className="col-span-2">狀態</span>
          <span className="col-span-2 text-right">操作</span>
        </div>
        {matches?.map((match: Match) => (
          <div key={match.id} className="grid grid-cols-12 px-4 py-3 border-b border-gray-800/50 last:border-0 items-center text-sm">
            <span className="col-span-3 text-white font-medium truncate">
              {match.home_team} vs {match.away_team}
              {match.home_score !== null && (
                <span className="text-green-400 ml-2">{match.home_score}-{match.away_score}</span>
              )}
            </span>
            <span className="col-span-2 text-gray-400 text-xs truncate">{match.competition}</span>
            <span className="col-span-3 text-gray-400 text-xs">{formatDate(match.match_time)}</span>
            <span className="col-span-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                match.status === 'open' ? 'bg-green-900/60 text-green-400' :
                match.status === 'finished' ? 'bg-gray-800 text-gray-400' :
                match.status === 'closed' ? 'bg-yellow-900/60 text-yellow-400' :
                'bg-red-900/60 text-red-400'
              }`}>
                {STATUS_LABELS[match.status]}
              </span>
            </span>
            <div className="col-span-2 flex justify-end gap-1">
              {(match.status === 'open' || match.status === 'closed') && (
                <Link
                  href={`/admin/matches/${match.id}/settle`}
                  className="text-xs bg-yellow-800 hover:bg-yellow-700 text-yellow-200 px-2 py-1 rounded transition-colors"
                >
                  結算
                </Link>
              )}
            </div>
          </div>
        ))}
        {(!matches || matches.length === 0) && (
          <p className="text-center py-8 text-gray-500">尚無比賽</p>
        )}
      </div>
    </div>
  )
}
