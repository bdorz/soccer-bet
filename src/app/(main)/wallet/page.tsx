import { createClient } from '@/lib/supabase/server'
import { Transaction, TransactionType } from '@/types'

const TYPE_LABELS: Record<TransactionType, string> = {
  initial: '初始點數',
  bet_placed: '下注扣款',
  bet_won: '下注獲勝',
  bet_void: '下注退款',
  admin_credit: '管理員入帳',
  admin_debit: '管理員扣款',
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase.from('profiles').select('wallet_balance, username').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">我的錢包</h1>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-green-900/40 to-gray-900 border border-green-800/50 rounded-2xl p-8 text-center mb-8">
        <p className="text-gray-400 mb-2">目前點數餘額</p>
        <p className="text-5xl font-black text-green-400">
          {profile?.wallet_balance.toLocaleString()}
        </p>
        <p className="text-gray-500 mt-2 text-sm">點</p>
        <p className="text-gray-400 text-sm mt-4">{profile?.username}</p>
      </div>

      {/* Transaction history */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">交易紀錄</h2>

      {transactions && transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{TYPE_LABELS[tx.type as TransactionType]}</p>
                {tx.description && tx.description !== TYPE_LABELS[tx.type as TransactionType] && (
                  <p className="text-xs text-gray-500">{tx.description}</p>
                )}
                <p className="text-xs text-gray-600 mt-0.5">{formatDate(tx.created_at)}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">{(tx.balance_after as number).toLocaleString()} 點</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500">
          <p>暫無交易紀錄</p>
        </div>
      )}
    </div>
  )
}
