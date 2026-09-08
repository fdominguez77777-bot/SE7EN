import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AuthProvider } from '@/auth/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'SE7EN',
    template: '%s · SE7EN',
  },
  description: 'Job operations platform',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ background: '#0c0d0f' }}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
