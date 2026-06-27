'use client'

import { OddsAsianHandicap, SelectionAsianHandicap } from '@/types'

interface Props {
  odds: OddsAsianHandicap
  homeTeam: string
  awayTeam: string
  selection: SelectionAsianHandicap | null
  onSelect: (s: SelectionAsianHandicap) => void
}

export default function AsianHandicapPanel({ odds, homeTeam, awayTeam, selection, onSelect }: Props) {
  const handicap = odds.handicap
  const homeHandicapLabel = handicap < 0 ? `${handicap}` : handicap > 0 ? `+${handicap}` : '0'
  const awayHandicapLabel = handicap > 0 ? `-${handicap}` : handicap < 0 ? `+${Math.abs(handicap)}` : '0'

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">讓球盤 — 主隊讓 {homeHandicapLabel} 球</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect({ choice: 'home', handicap })}
          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
            selection?.choice === 'home'
              ? 'border-green-500 bg-green-900/30 text-white'
              : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700'
          }`}
        >
          <span className="text-xs text-gray-400 mb-1">{homeTeam}</span>
          <span className="text-sm font-medium text-yellow-400 mb-1">{homeHandicapLabel}</span>
          <span className="text-2xl font-bold text-green-400">{odds.home_odds.toFixed(2)}</span>
        </button>
        <button
          onClick={() => onSelect({ choice: 'away', handicap })}
          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
            selection?.choice === 'away'
              ? 'border-green-500 bg-green-900/30 text-white'
              : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700'
          }`}
        >
          <span className="text-xs text-gray-400 mb-1">{awayTeam}</span>
          <span className="text-sm font-medium text-yellow-400 mb-1">{awayHandicapLabel}</span>
          <span className="text-2xl font-bold text-green-400">{odds.away_odds.toFixed(2)}</span>
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        * 亞洲讓球盤無和局，半球讓分必有勝負
      </p>
    </div>
  )
}
