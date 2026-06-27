'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function usernameToEmail(username: string) {
  const encoded = btoa(
    Array.from(new TextEncoder().encode(username.trim()))
      .map(b => String.fromCharCode(b))
      .join('')
  ).replace(/[+/=]/g, '').slice(0, 40)
  return `u${encoded}@soccerbet.local`
}

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('兩次密碼不一致')
      return
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字元')
      return
    }
    if (username.trim().length < 2) {
      setError('暱稱至少需要 2 個字元')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const email = usernameToEmail(username)

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim() },
        },
      })
      if (error) {
        if (error.message.includes('already registered')) {
          setError('此暱稱已被使用，請換一個')
        } else {
          throw error
        }
        return
      }
      router.push('/matches')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '註冊失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold text-white">足球下注遊戲</h1>
          <p className="text-gray-400 mt-2">加入後即獲得 10,000 點虛擬點數</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">建立帳號</h2>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">暱稱</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                placeholder="你的暱稱（顯示在排行榜）"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="至少 6 個字元"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">確認密碼</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="再次輸入密碼"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '建立中...' : '建立帳號'}
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-6">
            已有帳號？{' '}
            <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">
              立即登入
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
