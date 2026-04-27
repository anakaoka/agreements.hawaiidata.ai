import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Nav } from '@/components/nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen flex">
      <Nav companyName={session.user.companyName} role={session.user.role} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
