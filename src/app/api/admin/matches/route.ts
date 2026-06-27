import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: '僅管理員可操作' }, { status: 403 })

  const body = await request.json()
  const { competition, home_team, away_team, match_time, bet_close_time, source_id, notes, odds } = body

  if (!competition || !home_team || !away_team || !match_time || !bet_close_time) {
    return NextResponse.json({ error: '請填寫必要欄位' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: match, error } = await service.from('matches').insert({
    competition, home_team, away_team, match_time, bet_close_time,
    source_id: source_id || null,
    notes: notes || null,
    created_by: user.id,
    status: 'open',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert odds if provided
  if (odds && Array.isArray(odds) && odds.length > 0) {
    const oddsRows = odds.map((o: { bet_type: string; odds_data: Record<string, unknown> }) => ({
      match_id: match.id,
      bet_type: o.bet_type,
      odds_data: o.odds_data,
    }))
    await service.from('match_odds').insert(oddsRows)
  }

  return NextResponse.json({ match })
}
