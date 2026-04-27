'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type SKU = { id: string; code: string; description: string; unitPrice: string }
type LineItem = {
  skuId?: string; description: string; quantity: number
  unitPrice: number; totalPrice: number; notes?: string
  customerVisible: boolean; editable: boolean; sortOrder: number
}

const DEFAULT_TERMS = `By clicking "I Agree" you consent to use electronic signatures and confirm
this agreement is legally binding under ESIGN and UETA. You may request a paper
copy at any time by contacting us.`

export default function NewQuotePage() {
  const router = useRouter()
  const [skus, setSkus]     = useState<SKU[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    customerName:  '',
    customerEmail: '',
    customerPhone: '',
    legalTerms:    DEFAULT_TERMS,
    validFrom:     '',
    expiresAt:     '',
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  useEffect(() => {
    fetch('/api/skus').then(r => r.json()).then(setSkus)
  }, [])

  function updateForm(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  function addLineItem(sku?: SKU) {
    const up = sku ? parseFloat(sku.unitPrice) : 0
    setLineItems(prev => [...prev, {
      skuId:           sku?.id,
      description:     sku?.description ?? '',
      quantity:        1,
      unitPrice:       up,
      totalPrice:      up,
      customerVisible: true,
      editable:        false,
      sortOrder:       prev.length,
    }])
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setLineItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, ...patch }
      if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
        updated.totalPrice = updated.quantity * updated.unitPrice
      }
      return updated
    }))
  }

  function removeItem(i: number) {
    setLineItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function submit(sendNow: boolean) {
    setLoading(true); setError('')
    const res = await fetch('/api/quotes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, lineItems, sendNow }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Failed to create quote')
      return
    }
    const data = await res.json()
    router.push(`/quotes/${data.id}`)
  }

  const total = lineItems.reduce((s, i) => s + i.totalPrice, 0)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Quote</h1>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>}

      {/* Customer */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Customer</h2>
        <div className="grid grid-cols-2 gap-4">
          {([
            ['customerName',  'Full name',    'text',  'Jane Smith'],
            ['customerEmail', 'Email',        'email', 'jane@example.com'],
            ['customerPhone', 'Phone (E.164)','tel',   '+18085551234'],
          ] as const).map(([k, label, type, ph]) => (
            <div key={k} className={k === 'customerName' ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} placeholder={ph} value={form[k]} onChange={updateForm(k)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}
        </div>
      </section>

      {/* Dates */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Validity</h2>
        <div className="grid grid-cols-2 gap-4">
          {(['validFrom', 'expiresAt'] as const).map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {k === 'validFrom' ? 'Valid from' : 'Expires at'}
              </label>
              <input type="datetime-local" value={form[k]} onChange={updateForm(k)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}
        </div>
      </section>

      {/* Line items */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Line Items</h2>

        {skus.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {skus.filter(s => (s as any).active !== false).map(sku => (
              <button key={sku.id} onClick={() => addLineItem(sku)} type="button"
                className="text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-3 py-1 hover:bg-brand-100 transition">
                + {sku.code}
              </button>
            ))}
          </div>
        )}

        {lineItems.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">No line items yet. Add from catalog above or add a custom item.</p>
        )}

        <div className="space-y-3">
          {lineItems.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input value={item.description} onChange={e => updateItem(i, { description: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                  <input type="number" min="0" step="any" value={item.quantity}
                    onChange={e => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Unit price</label>
                  <input type="number" min="0" step="0.01" value={item.unitPrice}
                    onChange={e => updateItem(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Total</label>
                  <p className="text-sm font-mono font-medium text-gray-900 py-1.5">
                    ${item.totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={item.customerVisible}
                    onChange={e => updateItem(i, { customerVisible: e.target.checked })} />
                  Visible to customer
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={item.editable}
                    onChange={e => updateItem(i, { editable: e.target.checked })} />
                  Customer can request edit
                </label>
                <button onClick={() => removeItem(i)} type="button"
                  className="ml-auto text-red-400 hover:text-red-600">Remove</button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => addLineItem()} type="button"
          className="mt-4 text-sm text-brand-600 hover:underline">
          + Add custom line item
        </button>

        {lineItems.length > 0 && (
          <div className="mt-4 text-right text-sm font-semibold text-gray-900">
            Total: <span className="font-mono">${total.toFixed(2)}</span>
          </div>
        )}
      </section>

      {/* Legal terms */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">Legal terms</h2>
        <p className="text-xs text-gray-400 mb-2">This text is shown to the customer before they click "I Agree".</p>
        <textarea rows={4} value={form.legalTerms} onChange={updateForm('legalTerms')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </section>

      <div className="flex gap-3">
        <button onClick={() => submit(false)} disabled={loading || lineItems.length === 0}
          className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-60">
          {loading ? 'Saving…' : 'Save as draft'}
        </button>
        <button onClick={() => submit(true)} disabled={loading || lineItems.length === 0}
          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-60">
          {loading ? 'Sending…' : 'Save & send to customer'}
        </button>
      </div>
    </div>
  )
}
