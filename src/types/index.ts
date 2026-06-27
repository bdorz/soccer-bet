export type BetType = '1x2' | 'asian_handicap' | 'over_under' | 'correct_score' | 'half_time_1x2'

export type MatchStatus = 'open' | 'closed' | 'finished' | 'cancelled'

export type BetStatus = 'pending' | 'won' | 'lost' | 'void' | 'cancelled'

export type TransactionType =
  | 'initial'
  | 'bet_placed'
  | 'bet_won'
  | 'bet_void'
  | 'admin_credit'
  | 'admin_debit'

export interface Profile {
  id: string
  username: string
  wallet_balance: number
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  competition: string
  home_team: string
  away_team: string
  match_time: string
  bet_close_time: string
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  source_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  match_odds?: MatchOdds[]
}

export interface MatchOdds {
  id: string
  match_id: string
  bet_type: BetType
  odds_data: OddsData
  is_active: boolean
  updated_at: string
}

// Odds data shapes per bet type
export interface Odds1x2 {
  home: number
  draw: number
  away: number
}

export interface OddsAsianHandicap {
  handicap: number   // negative = home gives, positive = home receives
  home_odds: number
  away_odds: number
}

export interface OddsOverUnder {
  line: number
  over: number
  under: number
}

export interface OddsCorrectScore {
  [score: string]: number   // e.g. "1-0": 7.5, "other_home": 20
}

export interface OddsHalfTime1x2 {
  home: number
  draw: number
  away: number
}

export type OddsData =
  | Odds1x2
  | OddsAsianHandicap
  | OddsOverUnder
  | OddsCorrectScore
  | OddsHalfTime1x2

// Bet selections per type
export interface Selection1x2 {
  choice: 'home' | 'draw' | 'away'
}

export interface SelectionAsianHandicap {
  choice: 'home' | 'away'
  handicap: number
}

export interface SelectionOverUnder {
  choice: 'over' | 'under'
  line: number
}

export interface SelectionCorrectScore {
  home_score: number
  away_score: number
  is_other?: boolean
  other_type?: 'home' | 'draw' | 'away'
}

export interface SelectionHalfTime1x2 {
  choice: 'home' | 'draw' | 'away'
}

export type BetSelection =
  | Selection1x2
  | SelectionAsianHandicap
  | SelectionOverUnder
  | SelectionCorrectScore
  | SelectionHalfTime1x2

export interface Bet {
  id: string
  user_id: string
  match_id: string
  bet_type: BetType
  selection: BetSelection
  amount: number
  odds: number
  potential_payout: number
  status: BetStatus
  actual_payout: number
  settled_at: string | null
  created_at: string
  matches?: Match
  profiles?: Profile
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  type: TransactionType
  bet_id: string | null
  description: string
  balance_before: number
  balance_after: number
  created_at: string
}

export const BET_TYPE_LABELS: Record<BetType, string> = {
  '1x2': '勝平負',
  'asian_handicap': '讓球盤',
  'over_under': '大小球',
  'correct_score': '波膽',
  'half_time_1x2': '半場獨贏',
}

export const STATUS_LABELS: Record<MatchStatus, string> = {
  open: '開放下注',
  closed: '已截止',
  finished: '已完賽',
  cancelled: '已取消',
}

export const BET_STATUS_LABELS: Record<BetStatus, string> = {
  pending: '待結算',
  won: '贏',
  lost: '輸',
  void: '無效',
  cancelled: '已取消',
}

export const COMPETITIONS = [
  '英格蘭超級聯賽',
  '西班牙超級聯賽',
  '德國甲組聯賽',
  '義大利甲組聯賽',
  '法國甲組聯賽',
  'UEFA冠軍聯賽',
  'UEFA歐洲聯賽',
  '荷蘭甲組聯賽',
  '葡萄牙超級聯賽',
  '世界盃',
  '歐洲盃',
  '亞洲盃',
  '台灣超級聯賽',
  '其他',
]
