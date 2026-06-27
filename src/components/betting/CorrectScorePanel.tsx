'use client'

import { OddsCorrectScore, SelectionCorrectScore } from '@/types'

interface Props {
  odds: OddsCorrectScore
  selection: SelectionCorrectScore | null
  onSelect: (s: SelectionCorrectScore) => void
}

const HOME_WINS = ['1-0', '2-0', '2-1', '3-0', '3-1', '3-2', '4-0', '4-1', '4-2', '4-3']
const DRAWS = ['0-0', '1-1', '2-2', '3-3']
const AWAY_WINS = ['0-1', '0-2', '1-2', '0-3', '1-3', '2-3', '0-4', '1-4', '2-4', '3-4']

function ScoreGroup({
  title,
  color,
  scores,
  odds,
  otherKey,
  selection,
  onSelect,
}: {
  title: string
  color: string
  scores: string[]
  odds: OddsCorrectScore
  otherKey: 'other_home' | 'other_draw' | 'other_away'
  selection: SelectionCorrectScore | null
  onSelect: (s: SelectionCorrectScore) => void
}) {
  const available = scores.filter(s => s in odds)
  const otherOdds = odds[otherKey]

  function parseScore(s: string): SelectionCorrectScore {
    const [h, a] = s.split('-').map(Number)
    return { home_score: h, away_score: a }
  }

  function isSelected(s: string) {
    if (!selection || selection.is_other) return false
    const [h, a] = s.split('-').map(Number)
    return selection.home_score === h && selection.away_score === a
  }

  function isOtherSelected() {
    return selection?.is_other && selection.other_type === otherKey.replace('other_', '') as 'home' | 'draw' | 'away'
  }

  return (
    <div>
      <p className={`text-xs font-semibold mb-2 ${color}`}>{title}</p>
      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {available.map(score => (
          <button
            key={score}
            onClick={() => onSelect(parseScore(score))}
            className={`flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
              isSelected(score)
                ? 'border-green-500 bg-green-900/30 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            <span className="font-bold">{score}</span>
            <span className="text-green-400 font-semibold">{(odds[score] as number).toFixed(2)}</span>
          </button>
        ))}
        {otherOdds && (
          <button
            onClick={() => onSelect({ home_score: 0, away_score: 0, is_other: true, other_type: otherKey.replace('other_', '') as 'home' | 'draw' | 'away' })}
            className={`flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
              isOtherSelected()
                ? 'border-green-500 bg-green-900/30 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            <span className="font-bold">其他</span>
            <span className="text-green-400 font-semibold">{(otherOdds as number).toFixed(2)}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function CorrectScorePanel({ odds, selection, onSelect }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">選擇正確比分（波膽）</p>
      <ScoreGroup title="主隊勝" color="text-blue-400" scores={HOME_WINS} odds={odds} otherKey="other_home" selection={selection} onSelect={onSelect} />
      <ScoreGroup title="和局" color="text-yellow-400" scores={DRAWS} odds={odds} otherKey="other_draw" selection={selection} onSelect={onSelect} />
      <ScoreGroup title="客隊勝" color="text-red-400" scores={AWAY_WINS} odds={odds} otherKey="other_away" selection={selection} onSelect={onSelect} />
    </div>
  )
}
