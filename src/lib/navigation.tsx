'use client'

import NextLink from 'next/link'
import {
  useParams as useNextParams,
  usePathname as useNextPathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import {
  useEffect,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react'

type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & {
  to: string
  href?: string
  children?: ReactNode
}

export function Link({ to, href, children, ...rest }: LinkProps) {
  return (
    <NextLink href={href ?? to} {...rest}>
      {children}
    </NextLink>
  )
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (replace) {
      router.replace(to)
      return
    }
    router.push(to)
  }, [replace, router, to])
  return null
}

export function useNavigate() {
  const router = useRouter()
  return (to: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      router.replace(to)
      return
    }
    router.push(to)
  }
}

export function usePathname() {
  return useNextPathname()
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useNextParams() as T
}

export function useSearchParams() {
  return [useNextSearchParams()] as const
}

export function NavLink({
  to,
  end,
  className,
  children,
  onClick,
  ...rest
}: {
  to: string
  end?: boolean
  className?: string | ((state: { isActive: boolean }) => string)
  children?: ReactNode | ((state: { isActive: boolean }) => ReactNode)
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
} & Omit<ComponentProps<typeof NextLink>, 'href' | 'className' | 'children' | 'onClick'>) {
  const pathname = useNextPathname()
  const isActive = end
    ? pathname === to
    : pathname === to || pathname.startsWith(`${to}/`)
  const resolvedClassName =
    typeof className === 'function' ? className({ isActive }) : className
  const content = typeof children === 'function' ? children({ isActive }) : children
  return (
    <NextLink href={to} className={resolvedClassName} onClick={onClick} {...rest}>
      {content}
    </NextLink>
  )
}
