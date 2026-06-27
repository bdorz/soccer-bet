'use client'

import { OddsOverUnder, SelectionOverUnder } from '@/types'

interface Props {
  odds: OddsOverUnder
  selection: SelectionOverUnder | null
  onSelect: (s: SelectionOverUnder) => void
}

export default function OverUnderPanel({ odds, selection, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">大小球盤口：{odds.line} 球</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect({ choice: 'over', line: odds.line })}
          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
            selection?.choice === 'over'
              ? 'border-green-500 bg-green-900/30 text-white'
              : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700'
          }`}
        >
          <span className="text-sm text-gray-400 mb-1">大 Over</span>
          <span className="text-sm font-medium text-yellow-400 mb-1">&gt; {odds.line}</span>
          <span className="text-2xl font-bold text-green-400">{odds.over.toFixed(2)}</span>
        </button>
        <button
          onClick={() => onSelect({ choice: 'under', line: odds.line })}
          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
            selection?.choice === 'under'
              ? 'border-green-500 bg-green-900/30 text-white'
              : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700'
          }`}
        >
          <span className="text-sm text-gray-400 mb-1">小 Under</span>
          <span className="text-sm font-medium text-yellow-400 mb-1">&lt; {odds.line}</span>
          <span className="text-2xl font-bold text-green-400">{odds.under.toFixed(2)}</span>
        </button>
      </div>
    </div>
  )
}
