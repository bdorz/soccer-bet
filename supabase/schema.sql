-- =============================================
-- Soccer Bet 足球下注遊戲 - Supabase Schema
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES (extends Supabase Auth users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- MATCHES
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition TEXT NOT NULL,              -- e.g. 英超, 西甲, 歐冠
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_time TIMESTAMPTZ NOT NULL,
  bet_close_time TIMESTAMPTZ NOT NULL,   -- 下注截止時間
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'finished', 'cancelled')),
  home_score INTEGER,
  away_score INTEGER,
  source_id TEXT,                         -- 運彩場次編號 (optional)
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- MATCH ODDS (per match, per bet type)
-- =============================================
CREATE TABLE IF NOT EXISTS match_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL
    CHECK (bet_type IN ('1x2', 'asian_handicap', 'over_under', 'correct_score', 'half_time_1x2')),
  odds_data JSONB NOT NULL,
  -- 1x2:            { "home": 2.15, "draw": 3.20, "away": 3.40 }
  -- asian_handicap: { "handicap": -0.5, "home_odds": 1.88, "away_odds": 2.02 }
  -- over_under:     { "line": 2.5, "over": 1.85, "under": 2.05 }
  -- correct_score:  { "1-0": 7.5, "0-0": 8.5, ... "other_home": 20, ... }
  -- half_time_1x2:  { "home": 3.10, "draw": 2.50, "away": 4.50 }
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- BETS
-- =============================================
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id),
  bet_type TEXT NOT NULL
    CHECK (bet_type IN ('1x2', 'asian_handicap', 'over_under', 'correct_score', 'half_time_1x2')),
  selection JSONB NOT NULL,
  -- 1x2:            { "choice": "home" | "draw" | "away" }
  -- asian_handicap: { "choice": "home" | "away", "handicap": -0.5 }
  -- over_under:     { "choice": "over" | "under", "line": 2.5 }
  -- correct_score:  { "home_score": 2, "away_score": 1 }
  -- half_time_1x2:  { "choice": "home" | "draw" | "away" }
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 50),
  odds DECIMAL(8,3) NOT NULL,
  potential_payout DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'void', 'cancelled')),
  actual_payout DECIMAL(12,2) NOT NULL DEFAULT 0,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,          -- positive=入帳, negative=出帳
  type TEXT NOT NULL
    CHECK (type IN ('initial', 'bet_placed', 'bet_won', 'bet_void', 'admin_credit', 'admin_debit')),
  bet_id UUID REFERENCES bets(id),
  description TEXT NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, only update own
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Matches: all can read, only admins can write
CREATE POLICY "matches_select_all" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_admin_insert" ON matches FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "matches_admin_update" ON matches FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "matches_admin_delete" ON matches FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Match Odds: all can read, only admins can write
CREATE POLICY "odds_select_all" ON match_odds FOR SELECT USING (true);
CREATE POLICY "odds_admin_write" ON match_odds FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Bets: users can read own, admins can read all
CREATE POLICY "bets_select_own" ON bets FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "bets_insert_own" ON bets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bets_admin_update" ON bets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Transactions: users can read own, admins can read all
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_admin_insert" ON transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, username, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    10000.00
  );
  -- Record initial deposit transaction
  INSERT INTO transactions (user_id, amount, type, description, balance_before, balance_after)
  VALUES (NEW.id, 10000.00, 'initial', '初始點數', 0, 10000.00);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-close matches when bet_close_time passes (called via cron or manually)
CREATE OR REPLACE FUNCTION close_expired_matches()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE matches
  SET status = 'closed'
  WHERE status = 'open'
    AND bet_close_time <= NOW();
END;
$$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_match_time ON matches(match_time);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_match_odds_match_id ON match_odds(match_id);

-- =============================================
-- SERVICE ROLE bypass for API routes
-- =============================================
-- The service_role key bypasses RLS automatically.
-- Use it only in server-side API routes, never in the browser.
