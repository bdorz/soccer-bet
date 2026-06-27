import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Match, STATUS_LABELS } from '@/types'

function formatMatchTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: Match['status'] }) {
  const styles = {
    open: 'bg-green-900/60 text-green-400 border border-green-700',
    closed: 'bg-yellow-900/60 text-yellow-400 border border-yellow-700',
    finished: 'bg-gray-800 text-gray-400 border border-gray-700',
    cancelled: 'bg-red-900/60 text-red-400 border border-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export default async function MatchesPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, match_odds(bet_type)')
    .order('match_time', { ascending: true })

  const openMatches = matches?.filter(m => m.status === 'open') ?? []
  const otherMatches = matches?.filter(m => m.status !== 'open') ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">比賽列表</h1>

      {/* Open for betting */}
      {openMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">
            開放下注
          </h2>
          <div className="space-y-3">
            {openMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Past / closed */}
      {otherMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            其他比賽
          </h2>
          <div className="space-y-3">
            {otherMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {(!matches || matches.length === 0) && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">⚽</div>
          <p className="text-lg">目前沒有比賽</p>
          <p className="text-sm mt-1">請等待管理員新增比賽</p>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match }: { match: Match & { match_odds: { bet_type: string }[] } }) {
  const betTypes = match.match_odds?.map(o => o.bet_type) ?? []
  const hasResult = match.home_score !== null && match.away_score !== null

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all hover:bg-gray-900/80 group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Match info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
              {match.competition}
            </span>
            <StatusBadge status={match.status} />
          </div>

          {/* Teams */}
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold text-lg truncate">{match.home_team}</span>
            {hasResult ? (
              <span className="text-2xl font-bold text-green-400 flex-shrink-0">
                {match.home_score} - {match.away_score}
              </span>
            ) : (
              <span className="text-gray-500 text-sm flex-shrink-0">VS</span>
            )}
            <span className="text-white font-semibold text-lg truncate">{match.away_team}</span>
          </div>

          {/* Match time */}
          <p className="text-xs text-gray-500 mt-2">
            {formatMatchTime(match.match_time)}
          </p>
        </div>

        {/* Bet types available */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex flex-wrap gap-1 justify-end">
            {betTypes.includes('1x2') && (
              <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">勝平負</span>
            )}
            {betTypes.includes('asian_handicap') && (
              <span className="text-xs bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded">讓球</span>
            )}
            {betTypes.includes('over_under') && (
              <span className="text-xs bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded">大小球</span>
            )}
            {betTypes.includes('correct_score') && (
              <span className="text-xs bg-pink-900/40 text-pink-400 px-1.5 py-0.5 rounded">波膽</span>
            )}
            {betTypes.includes('half_time_1x2') && (
              <span className="text-xs bg-teal-900/40 text-teal-400 px-1.5 py-0.5 rounded">半場</span>
            )}
          </div>
          <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors mt-1">
            查看 →
          </span>
        </div>
      </div>
    </Link>
  )
}
