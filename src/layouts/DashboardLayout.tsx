'use client'

import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate, usePathname } from '@/lib/navigation'
import {
  ClipboardCheck,
  CalendarClock,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  UserRoundCog,
  Users,
  UsersRound,
  WalletCards,
  Receipt,
  X,
} from 'lucide-react'

import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { AvatarPhotoDialog } from '../ui/AvatarPhotoDialog'
import { BrandLockup, BrandLogo } from '../ui/BrandLogo'
import { RouteErrorBoundary } from '../ui/RouteErrorBoundary'
import { StatusBadge } from '../ui/StatusBadge'
import { useDailySubmissionInbox } from './daily-submission-inbox'

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  inbox?: 'daily-submissions'
}

type NavSection = { label: string; items: NavItem[] }

const NAV: Record<Role, NavSection[]> = {
  ADMIN: [
    {
      label: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      label: 'Operations',
      items: [
        { to: '/candidates', label: 'Profiles', icon: Users },
        { to: '/bidders', label: 'Bidders', icon: UserRoundCog },
        { to: '/applications', label: 'Applications', icon: Send },
        { to: '/interviews', label: 'Interviews', icon: CalendarClock },
      ],
    },
    {
      label: 'Manager workflow',
      items: [
        { to: '/daily-submissions', label: 'Daily Submission', icon: ClipboardCheck, inbox: 'daily-submissions' },
        { to: '/weekly-invoices', label: 'Weekly Invoice', icon: Receipt },
      ],
    },
    {
      label: 'Analytics',
      items: [{ to: '/reports', label: 'Reports', icon: ChartNoAxesCombined }],
    },
    {
      label: 'Admin',
      items: [
        { to: '/admin/members', label: 'Members', icon: UsersRound },
        { to: '/settings/compensation', label: 'Compensation', icon: WalletCards },
      ],
    },
  ],
  BID_MANAGER: [
    {
      label: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      label: 'Operations',
      items: [
        { to: '/candidates', label: 'Profiles', icon: Users },
        { to: '/bidders', label: 'Bidders', icon: UserRoundCog },
        { to: '/applications', label: 'Applications', icon: Send },
        { to: '/interviews', label: 'Interviews', icon: CalendarClock },
      ],
    },
    {
      label: 'Manager workflow',
      items: [
        { to: '/daily-submissions', label: 'Daily Submission', icon: ClipboardCheck },
        { to: '/weekly-invoices', label: 'Weekly Invoice', icon: Receipt },
      ],
    },
    {
      label: 'Analytics',
      items: [{ to: '/reports', label: 'Reports', icon: ChartNoAxesCombined }],
    },
  ],
  BIDDER: [
    {
      label: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      label: 'My work',
      items: [
        { to: '/profile', label: 'My Profiles', icon: Users },
        { to: '/applications', label: 'Applications', icon: Send },
        { to: '/interviews', label: 'Interviews', icon: CalendarClock },
      ],
    },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  BID_MANAGER: 'Bid Manager',
  BIDDER: 'Bidder',
}

function pageTitle(pathname: string, sections: NavSection[]) {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        return item.label
      }
    }
  }
  return 'SE7EN'
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout, applyUser } = useAuth()
  const navigate = useNavigate()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const sections = user ? NAV[user.role] : []
  const title = pageTitle(pathname, sections)
  const unreadDaily = useDailySubmissionInbox(user?.role === 'ADMIN')
  const badges: Partial<Record<NonNullable<NavItem['inbox']>, number>> = {
    'daily-submissions': unreadDaily,
  }

  function Sidebar({ variant }: { variant: 'desktop' | 'drawer' }) {
    return (
      <aside
        className={`glass-shell w-64 shrink-0 flex-col overflow-x-hidden text-[var(--text-secondary)] ${
          variant === 'desktop'
            ? 'hidden h-full lg:flex print:hidden'
            : 'relative z-10 flex h-dvh'
        }`}
      >
        <div className="flex shrink-0 items-center border-b border-[var(--border-glass)] px-5 py-5">
          <BrandLockup onNavigate={() => setOpen(false)} />
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-3">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[11px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const unread = item.inbox ? badges[item.inbox] ?? 0 : 0
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `nav-item flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition duration-150 ${
                          isActive
                            ? 'bg-white/[0.065] font-medium text-[#f4f4f4] shadow-[inset_3px_0_0_var(--accent)]'
                            : 'text-[var(--text-secondary)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]'
                        }`
                      }
                      aria-label={
                        unread > 0
                          ? `${item.label}, ${unread} unread`
                          : item.label
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative shrink-0">
                            <Icon
                              className={`h-[18px] w-[18px] ${isActive ? 'text-[var(--accent)]' : ''}`}
                              aria-hidden="true"
                            />
                            {unread > 0 && !isActive ? (
                              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#141518] px-1 text-[10px] font-semibold leading-none text-white ring-1 ring-black/50">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-[var(--border-glass)] p-3">
          <div className="mb-2 flex items-center gap-2.5 px-2">
            <EntityAvatar name={user?.name} src={user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{user?.name}</p>
              {user ? (
                <StatusBadge muted>{ROLE_LABEL[user.role]}</StatusBadge>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="mb-1 flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/[0.045] hover:text-[var(--text-primary)]"
            onClick={() => setPhotoOpen(true)}
          >
            Change photo
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-muted)] transition hover:bg-red-500/10 hover:text-red-200 active:bg-red-500/15"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)] print:h-auto print:overflow-visible">
      <Sidebar variant="desktop" />
      {open ? (
        <div className="nav-drawer-overlay fixed inset-0 z-40 lg:hidden print:hidden">
          <button
            type="button"
            className="dialog-overlay absolute inset-0 bg-black/65"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <Sidebar variant="drawer" />
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <header className="app-topbar hidden shrink-0 items-center justify-between px-8 py-3 print:hidden lg:flex">
          <p className="text-[13px] text-[var(--text-muted)]">
            Pages <span className="mx-1.5 text-white/20">/</span>
            <span className="text-[var(--text-secondary)]">{title}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.04]"
              onClick={() => setPhotoOpen(true)}
              aria-label="Change photo"
            >
              <EntityAvatar name={user?.name} src={user?.avatarUrl} size="sm" />
              <span className="text-sm font-medium text-[var(--text-primary)]">{user?.name}</span>
            </button>
          </div>
        </header>
        <header className="app-topbar sticky top-0 z-20 flex shrink-0 items-center gap-3 px-4 py-3 print:hidden lg:hidden">
          <button
            type="button"
            className="rounded-lg border border-[var(--border-glass)] p-2 text-[var(--text-primary)]"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <BrandLogo size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
              SE7EN
            </p>
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          </div>
        </header>
        <div
          className={`min-h-0 flex-1 print:overflow-visible ${pathname === '/interviews' ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          <main
            className={`app-main px-4 md:px-6 lg:px-8 ${pathname === '/interviews' ? 'flex h-full min-h-0 flex-col py-3' : 'py-6'}`}
            style={{
              position: 'relative',
              zIndex: 20,
              display: pathname === '/interviews' ? 'flex' : 'block',
              opacity: 1,
              visibility: 'visible',
              color: '#f2f2f3',
            }}
          >
            <RouteErrorBoundary
              key={pathname.replace(/\/\d+$/, '')}
            >
              <div className={pathname === '/interviews' ? 'page-enter flex min-h-0 flex-1 flex-col' : 'page-enter'}>
                {children}
              </div>
            </RouteErrorBoundary>
          </main>
        </div>
      </div>
      {photoOpen && user ? (
        <AvatarPhotoDialog
          name={user.name}
          src={user.avatarUrl}
          endpoint="/users/me/avatar"
          onClose={() => setPhotoOpen(false)}
          onSaved={(next) => {
            applyUser(next)
            setPhotoOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
