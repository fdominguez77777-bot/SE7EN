import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'

const NAV: Record<Role, { to: string; label: string }[]> = {
  ADMIN: [
    { to: '/', label: 'Dashboard' },
    { to: '/candidates', label: 'Candidates' },
    { to: '/interviews', label: 'Interviews' },
  ],
  BID_MANAGER: [
    { to: '/', label: 'Dashboard' },
    { to: '/candidates', label: 'Candidates' },
    { to: '/interviews', label: 'Interviews' },
  ],
  BIDDER: [
    { to: '/', label: 'My Dashboard' },
    { to: '/profile', label: 'My Profile' },
    { to: '/interviews', label: 'My Interviews' },
  ],
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = user ? NAV[user.role] : []

  return (
    <div className="flex min-h-screen bg-stone-100 text-stone-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-stone-300 bg-stone-900 text-stone-100">
        <div className="border-b border-stone-700 px-5 py-5">
          <p className="text-xs tracking-[0.2em] text-stone-400 uppercase">
            Job Operations
          </p>
          <p className="mt-2 text-sm text-stone-300">{user?.name}</p>
          <p className="mt-1 text-xs text-stone-500">{user?.role}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-300 hover:bg-stone-800'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="m-3 rounded border border-stone-600 px-3 py-2 text-left text-sm text-stone-300 hover:bg-stone-800"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
