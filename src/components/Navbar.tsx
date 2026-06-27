'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface NavbarProps {
  profile: Profile
}

export default function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/matches', label: '比賽' },
    { href: '/my-bets', label: '我的下注' },
    { href: '/wallet', label: '錢包' },
    { href: '/leaderboard', label: '排行榜' },
    ...(profile.is_admin ? [{ href: '/admin', label: '管理' }] : []),
  ]

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/matches" className="flex items-center gap-2 text-white font-bold text-lg">
          <span>⚽</span>
          <span className="hidden sm:inline">足球下注</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(link.href)
                  ? 'bg-green-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs text-gray-400">{profile.username}</span>
            <span className="text-sm font-semibold text-green-400">
              {profile.wallet_balance.toLocaleString()} 點
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            登出
          </button>
        </div>
      </div>
    </nav>
  )
}
