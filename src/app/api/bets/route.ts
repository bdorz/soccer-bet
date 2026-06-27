import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BetType, BetSelection, Odds1x2, OddsAsianHandicap, OddsOverUnder, OddsCorrectScore } from '@/types'

const MIN_BET = 50

function extractOdds(betType: BetType, selection: BetSelection, oddsData: Record<string, unknown>): number {
  switch (betType) {
    case '1x2':
    case 'half_time_1x2': {
      const s = selection as { choice: 'home' | 'draw' | 'away' }
      const o = oddsData as unknown as Odds1x2
      return o[s.choice]
    }
    case 'asian_handicap': {
      const s = selection as { choice: 'home' | 'away' }
      const o = oddsData as unknown as OddsAsianHandicap
      return s.choice === 'home' ? o.home_odds : o.away_odds
    }
    case 'over_under': {
      const s = selection as { choice: 'over' | 'under' }
      const o = oddsData as unknown as OddsOverUnder
      return s.choice === 'over' ? o.over : o.under
    }
    case 'correct_score': {
      const s = selection as { home_score: number; away_score: number; is_other?: boolean; other_type?: string }
      const o = oddsData as unknown as OddsCorrectScore
      if (s.is_other) {
        const key = `other_${s.other_type}`
        return o[key] as number
      }
      const key = `${s.home_score}-${s.away_score}`
      return o[key] as number
    }
    default:
      return 0
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 })

    const body = await request.json()
    const { match_id, bet_type, selection, amount } = body as {
      match_id: string
      bet_type: BetType
      selection: BetSelection
      amount: number
    }

    if (!match_id || !bet_type || !selection || !amount) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }
    if (amount < MIN_BET) {
      return NextResponse.json({ error: `最低下注金額為 ${MIN_BET} 點` }, { status: 400 })
    }

    // Use service client for writes to bypass RLS where needed
    const service = await createServiceClient()

    // 1. Verify match is open
    const { data: match } = await service
      .from('matches')
      .select('id, status, bet_close_time')
      .eq('id', match_id)
      .single()

    if (!match) return NextResponse.json({ error: '比賽不存在' }, { status: 404 })
    if (match.status !== 'open' || new Date(match.bet_close_time) <= new Date()) {
      return NextResponse.json({ error: '此比賽已截止下注' }, { status: 400 })
    }

    // 2. Get odds
    const { data: oddsRow } = await service
      .from('match_odds')
      .select('odds_data')
      .eq('match_id', match_id)
      .eq('bet_type', bet_type)
      .eq('is_active', true)
      .single()

    if (!oddsRow) return NextResponse.json({ error: '該玩法不存在' }, { status: 400 })

    const odds = extractOdds(bet_type, selection, oddsRow.odds_data as Record<string, unknown>)
    if (!odds || odds <= 0) return NextResponse.json({ error: '無效的下注選項' }, { status: 400 })

    const potential_payout = parseFloat((amount * odds).toFixed(2))

    // 3. Check and deduct wallet (atomic via transaction-like approach)
    const { data: profile } = await service
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()

    if (!profile || profile.wallet_balance < amount) {
      return NextResponse.json({ error: '點數不足' }, { status: 400 })
    }

    const balanceBefore = profile.wallet_balance
    const balanceAfter = parseFloat((balanceBefore - amount).toFixed(2))

    // 4. Deduct balance
    const { error: balanceErr } = await service
      .from('profiles')
      .update({ wallet_balance: balanceAfter })
      .eq('id', user.id)

    if (balanceErr) return NextResponse.json({ error: '扣款失敗' }, { status: 500 })

    // 5. Create bet
    const { data: bet, error: betErr } = await service
      .from('bets')
      .insert({
        user_id: user.id,
        match_id,
        bet_type,
        selection,
        amount,
        odds,
        potential_payout,
        status: 'pending',
      })
      .select()
      .single()

    if (betErr) {
      // Rollback balance
      await service.from('profiles').update({ wallet_balance: balanceBefore }).eq('id', user.id)
      return NextResponse.json({ error: '下注失敗' }, { status: 500 })
    }

    // 6. Record transaction
    await service.from('transactions').insert({
      user_id: user.id,
      amount: -amount,
      type: 'bet_placed',
      bet_id: bet.id,
      description: `下注 ${match_id}`,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
    })

    return NextResponse.json({ bet, message: '下注成功' })
  } catch (err) {
    console.error('Bet error:', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const { data: bets } = await supabase
    .from('bets')
    .select('*, matches(home_team, away_team, competition, match_time, status, home_score, away_score)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ bets })
}
