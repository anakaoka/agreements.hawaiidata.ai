import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { format } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  SENT:      'bg-blue-100 text-blue-700',
  VIEWED:    'bg-purple-100 text-purple-700',
  REVISED:   'bg-yellow-100 text-yellow-700',
  ACCEPTED:  'bg-green-100 text-green-700',
  EXPIRED:   'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

export default async function QuotesPage() {
  const session = await getSession()
  const quotes  = await db.quote.findMany({
    where:   { companyId: session!.user.companyId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, number: true, status: true,
      customerName: true, customerEmail: true,
      expiresAt: true, acceptedAt: true, createdAt: true,
      _count: { select: { lineItems: true } },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
        <Link href="/quotes/new"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          + New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">No quotes yet</p>
          <Link href="/quotes/new" className="text-brand-600 hover:underline text-sm">Create your first quote →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Quote #', 'Customer', 'Status', 'Expires', 'Created'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{q.number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{q.customerName}</p>
                    <p className="text-gray-400 text-xs">{q.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[q.status] ?? ''}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {q.expiresAt ? format(q.expiresAt, 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{format(q.createdAt, 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/quotes/${q.id}`} className="text-brand-600 hover:underline text-xs font-medium">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
