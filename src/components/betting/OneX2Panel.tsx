'use client'

import { Odds1x2, Selection1x2 } from '@/types'

interface Props {
  odds: Odds1x2
  homeTeam: string
  awayTeam: string
  selection: Selection1x2 | null
  onSelect: (s: Selection1x2) => void
}

export default function OneX2Panel({ odds, homeTeam, awayTeam, selection, onSelect }: Props) {
  const options = [
    { key: 'home' as const, label: homeTeam, odds: odds.home },
    { key: 'draw' as const, label: '和局', odds: odds.draw },
    { key: 'away' as const, label: awayTeam, odds: odds.away },
  ]

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">選擇比賽結果（全場）</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onSelect({ choice: opt.key })}
            className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
              selection?.choice === opt.key
                ? 'border-green-500 bg-green-900/30 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700'
            }`}
          >
            <span className="text-xs text-gray-400 mb-1 truncate w-full text-center">{opt.label}</span>
            <span className="text-xl font-bold text-green-400">{opt.odds.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
