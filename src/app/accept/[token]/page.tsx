'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type QuoteData = {
  number: string
  customerName: string
  companyName: string
  legalTerms: string
  expiresAt: string | null
  lineItems: Array<{ description: string; quantity: string; unitPrice: string; totalPrice: string }>
}

type Step = 'loading' | 'error' | 'review' | 'verify' | 'done'

export default function AcceptPage() {
  const params    = useParams()
  const token     = params.token as string

  const [step, setStep]         = useState<Step>('loading')
  const [quote, setQuote]       = useState<QuoteData | null>(null)
  const [maskedPhone, setMasked] = useState('')
  const [code, setCode]         = useState('')
  const [errMsg, setErrMsg]     = useState('')
  const [working, setWorking]   = useState(false)
  const [accepted, setAccepted] = useState<{ number: string; acceptedAt: string } | null>(null)

  // Load quote preview
  useEffect(() => {
    fetch(`/api/accept/${token}/preview`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setQuote(data); setStep('review') })
      .catch(() => setStep('error'))
  }, [token])

  async function startVerification() {
    setWorking(true); setErrMsg('')
    const res = await fetch(`/api/accept/${token}/start`, { method: 'POST' })
    const data = await res.json()
    setWorking(false)
    if (!res.ok) { setErrMsg(data.error ?? 'Something went wrong'); return }
    setMasked(data.phone)
    setStep('verify')
  }

  async function submitCode() {
    setWorking(true); setErrMsg('')
    const res = await fetch(`/api/accept/${token}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    setWorking(false)
    if (!res.ok) { setErrMsg(data.error ?? 'Incorrect code'); return }
    setAccepted({ number: data.quote.number, acceptedAt: data.quote.acceptedAt })
    setStep('done')
  }

  if (step === 'loading') {
    return (
      <Shell>
        <p className="text-center text-gray-400 py-20">Loading quote…</p>
      </Shell>
    )
  }

  if (step === 'error') {
    return (
      <Shell>
        <div className="text-center py-20">
          <p className="text-lg font-semibold text-red-600 mb-2">Link not found or expired</p>
          <p className="text-sm text-gray-500">This quote link is invalid, expired, or has already been accepted.</p>
        </div>
      </Shell>
    )
  }

  if (step === 'done') {
    return (
      <Shell>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">Agreement Accepted</h2>
          <p className="text-gray-600 mb-1">Quote <strong>{accepted?.number}</strong> is now signed.</p>
          <p className="text-sm text-gray-400">A confirmation email has been sent to you.</p>
          <p className="text-xs text-gray-300 mt-4">{accepted?.acceptedAt}</p>
        </div>
      </Shell>
    )
  }

  if (step === 'verify') {
    return (
      <Shell>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Verify your identity</h2>
        <p className="text-sm text-gray-500 mb-6">
          We sent a one-time code to <strong>{maskedPhone}</strong>. Enter it below to confirm your acceptance.
        </p>
        {errMsg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{errMsg}</p>}
        <input type="text" inputMode="numeric" maxLength={8} placeholder="6-digit code"
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button onClick={submitCode} disabled={working || code.length < 4}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-60">
          {working ? 'Verifying…' : 'Confirm & sign agreement'}
        </button>
      </Shell>
    )
  }

  // step === 'review'
  const total = quote!.lineItems.reduce((s, i) => s + parseFloat(i.totalPrice), 0)

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-xs text-gray-400 font-mono">{quote!.number}</p>
        <h2 className="text-xl font-bold text-gray-900">{quote!.companyName}</h2>
        <p className="text-sm text-gray-500">Hello, {quote!.customerName}</p>
        {quote!.expiresAt && (
          <p className="text-sm text-amber-600 mt-1">
            This quote expires {new Date(quote!.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' })}.
          </p>
        )}
      </div>

      {/* Line items */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Description', 'Qty', 'Total'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h !== 'Description' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quote!.lineItems.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-gray-900">{item.description}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(item.quantity)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">${parseFloat(item.totalPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={2} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold">${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legal terms */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 text-sm text-gray-600 whitespace-pre-wrap">
        {quote!.legalTerms}
      </div>

      {errMsg && <p className="text-sm text-red-600 mb-4">{errMsg}</p>}

      <button onClick={startVerification} disabled={working}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-lg transition disabled:opacity-60">
        {working ? 'Sending code…' : 'I Agree — verify via SMS →'}
      </button>
      <p className="text-xs text-center text-gray-400 mt-3">
        You will receive a one-time SMS code to confirm your identity before signing.
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        {children}
      </div>
    </div>
  )
}
