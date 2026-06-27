import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  BetType, BetSelection,
  Odds1x2, OddsCorrectScore,
  Selection1x2, SelectionAsianHandicap, SelectionOverUnder, SelectionCorrectScore,
} from '@/types'

function determineResult(
  betType: BetType,
  selection: BetSelection,
  homeScore: number,
  awayScore: number,
  oddsData: Record<string, unknown>
): 'won' | 'lost' | 'void' {
  const totalGoals = homeScore + awayScore
  const diff = homeScore - awayScore

  switch (betType) {
    case '1x2':
    case 'half_time_1x2': {
      const s = selection as Selection1x2
      const result = diff > 0 ? 'home' : diff < 0 ? 'away' : 'draw'
      return s.choice === result ? 'won' : 'lost'
    }

    case 'asian_handicap': {
      const s = selection as SelectionAsianHandicap
      const h = s.handicap
      // Adjust home team score by handicap
      const adjustedDiff = diff + (s.choice === 'home' ? h : -h)
      if (adjustedDiff === 0) return 'void'  // push / refund
      return adjustedDiff > 0 ? 'won' : 'lost'
    }

    case 'over_under': {
      const s = selection as SelectionOverUnder
      const line = s.line
      if (totalGoals === line) return 'void'
      if (s.choice === 'over') return totalGoals > line ? 'won' : 'lost'
      return totalGoals < line ? 'won' : 'lost'
    }

    case 'correct_score': {
      const s = selection as SelectionCorrectScore
      if (s.is_other) {
        const result = diff > 0 ? 'home' : diff < 0 ? 'away' : 'draw'
        if (s.other_type !== result) return 'lost'
        // Check if the actual score is NOT in the listed scores
        const o = oddsData as unknown as OddsCorrectScore
        const key = `${homeScore}-${awayScore}`
        return key in o ? 'lost' : 'won'
      }
      return s.home_score === homeScore && s.away_score === awayScore ? 'won' : 'lost'
    }

    default:
      return 'void'
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: '僅管理員可操作' }, { status: 403 })

  const body = await request.json()
  const { home_score, away_score } = body as { home_score: number; away_score: number }

  if (home_score === undefined || away_score === undefined) {
    return NextResponse.json({ error: '請提供比分' }, { status: 400 })
  }

  const service = await createServiceClient()

  // 1. Update match
  await service.from('matches').update({
    home_score, away_score, status: 'finished',
  }).eq('id', id)

  // 2. Get all pending bets for this match
  const { data: bets } = await service
    .from('bets')
    .select('*, match_odds!inner(odds_data)')
    .eq('match_id', id)
    .eq('status', 'pending')

  if (!bets || bets.length === 0) {
    return NextResponse.json({ message: '無待結算下注', settled: 0 })
  }

  // Get odds data per type
  const { data: allOdds } = await service
    .from('match_odds')
    .select('bet_type, odds_data')
    .eq('match_id', id)

  const oddsMap = new Map<string, Record<string, unknown>>()
  allOdds?.forEach(o => oddsMap.set(o.bet_type, o.odds_data as Record<string, unknown>))

  let settledCount = 0
  let totalPaidOut = 0

  for (const bet of bets) {
    const oddsData = oddsMap.get(bet.bet_type) ?? {}
    const result = determineResult(
      bet.bet_type as BetType,
      bet.selection as BetSelection,
      home_score,
      away_score,
      oddsData
    )

    const actualPayout = result === 'won' ? bet.potential_payout : result === 'void' ? bet.amount : 0

    // Update bet
    await service.from('bets').update({
      status: result,
      actual_payout: actualPayout,
      settled_at: new Date().toISOString(),
    }).eq('id', bet.id)

    // Payout to user
    if (actualPayout > 0) {
      const { data: userProfile } = await service
        .from('profiles')
        .select('wallet_balance')
        .eq('id', bet.user_id)
        .single()

      if (userProfile) {
        const newBalance = parseFloat((userProfile.wallet_balance + actualPayout).toFixed(2))
        await service.from('profiles').update({ wallet_balance: newBalance }).eq('id', bet.user_id)
        await service.from('transactions').insert({
          user_id: bet.user_id,
          amount: actualPayout,
          type: result === 'void' ? 'bet_void' : 'bet_won',
          bet_id: bet.id,
          description: result === 'void' ? '下注退款' : `下注獲勝：${actualPayout} 點`,
          balance_before: userProfile.wallet_balance,
          balance_after: newBalance,
        })
        totalPaidOut += actualPayout
      }
    }
    settledCount++
  }

  return NextResponse.json({ message: '結算完成', settled: settledCount, total_paid_out: totalPaidOut })
}
