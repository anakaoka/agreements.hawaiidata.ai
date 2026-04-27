import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { SendButton } from './send-button'

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  SENT:      'bg-blue-100 text-blue-700',
  VIEWED:    'bg-purple-100 text-purple-700',
  REVISED:   'bg-yellow-100 text-yellow-700',
  ACCEPTED:  'bg-green-100 text-green-700',
  EXPIRED:   'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const quote   = await db.quote.findFirst({
    where:   { id: params.id, companyId: session!.user.companyId },
    include: {
      lineItems:  { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      auditLogs:  { orderBy: { createdAt: 'asc' } },
      createdBy:  { select: { name: true, email: true } },
    },
  })
  if (!quote) notFound()

  const total = quote.lineItems.reduce((s, i) => s + Number(i.totalPrice), 0)
  const canSend = ['DRAFT', 'REVISED', 'SENT', 'VIEWED'].includes(quote.status)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 font-mono">{quote.number}</p>
          <h1 className="text-2xl font-bold text-gray-900">{quote.customerName}</h1>
          <p className="text-sm text-gray-500">{quote.customerEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_STYLES[quote.status] ?? ''}`}>
            {quote.status}
          </span>
          {canSend && <SendButton quoteId={quote.id} />}
        </div>
      </div>

      {/* Dates */}
      {(quote.validFrom || quote.expiresAt) && (
        <div className="flex gap-6 mb-4 text-sm text-gray-500">
          {quote.validFrom  && <span>Valid from: <strong>{format(quote.validFrom,  'MMM d, yyyy')}</strong></span>}
          {quote.expiresAt  && <span>Expires:    <strong>{format(quote.expiresAt,  'MMM d, yyyy')}</strong></span>}
          {quote.acceptedAt && <span className="text-green-600">Accepted: <strong>{format(quote.acceptedAt, 'MMM d, yyyy HH:mm')} UTC</strong></span>}
        </div>
      )}

      {/* Line items */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Description', 'Qty', 'Unit price', 'Total'].map(h => (
                <th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h !== 'Description' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quote.lineItems.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                  {item.overridden && <span className="text-xs text-amber-600 font-medium">Admin override</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{Number(item.quantity)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">${Number(item.totalPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Acceptance record */}
      {quote.status === 'ACCEPTED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4 text-sm">
          <h3 className="font-semibold text-green-900 mb-2">Acceptance record</h3>
          <ul className="space-y-1 text-green-800">
            <li>Accepted at: <strong>{format(quote.acceptedAt!, 'PPpp')} UTC</strong></li>
            <li>IP address:  <strong>{quote.acceptanceIp}</strong></li>
            <li>User agent:  <strong className="break-all">{quote.acceptanceAgent}</strong></li>
            <li>SMS verified: <strong>{quote.smsVerifiedAt ? 'Yes' : 'No'}</strong></li>
          </ul>
        </div>
      )}

      {/* Audit log */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Audit log</h3>
        <ol className="space-y-2">
          {quote.auditLogs.map(log => (
            <li key={log.id} className="flex gap-3 text-sm">
              <span className="text-gray-400 shrink-0 w-36">{format(log.createdAt, 'MMM d HH:mm:ss')}</span>
              <span className="font-medium text-gray-700 capitalize">{log.actionType.replace(/_/g, ' ')}</span>
              <span className="text-gray-400">({log.actorType}{log.actorRole ? ` / ${log.actorRole}` : ''})</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
