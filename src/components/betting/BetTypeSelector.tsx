'use client'

import { BetType, BET_TYPE_LABELS } from '@/types'

interface BetTypeSelectorProps {
  availableTypes: BetType[]
  selected: BetType
  onChange: (type: BetType) => void
}

export default function BetTypeSelector({ availableTypes, selected, onChange }: BetTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {availableTypes.map(type => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selected === type
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {BET_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}
