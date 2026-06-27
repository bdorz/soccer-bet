import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '足球下注遊戲',
  description: '朋友間的足球競猜遊戲平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
