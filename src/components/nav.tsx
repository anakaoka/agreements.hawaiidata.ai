'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const links = [
  { href: '/quotes',    label: 'Quotes' },
  { href: '/skus',      label: 'SKU Catalog' },
  { href: '/settings',  label: 'Settings' },
]

export function Nav({ companyName, role }: { companyName: string; role: string }) {
  const pathname = usePathname()
  const isAdmin = ['DOMAIN_ADMIN', 'SUPER_ADMIN'].includes(role)

  const visibleLinks = isAdmin
    ? links
    : links.filter(l => l.href !== '/settings' && l.href !== '/skus')

  return (
    <aside className="w-56 min-h-screen bg-brand-900 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-brand-700">
        <p className="text-xs uppercase tracking-widest text-brand-100 mb-1">Agreements</p>
        <p className="font-semibold text-sm truncate">{companyName}</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleLinks.map(link => (
          <Link key={link.href} href={link.href}
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition
              ${pathname.startsWith(link.href)
                ? 'bg-brand-700 text-white'
                : 'text-brand-100 hover:bg-brand-800'}`}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-brand-700">
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-100 hover:bg-brand-800 transition">
          Sign out
        </button>
      </div>
    </aside>
  )
}
