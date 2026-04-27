'use client'
import { useState, useEffect } from 'react'

type SKU = { id: string; code: string; description: string; unitPrice: string; active: boolean }

export default function SKUsPage() {
  const [skus, setSkus]       = useState<SKU[]>([])
  const [form, setForm]       = useState({ code: '', description: '', unitPrice: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    const res = await fetch('/api/skus')
    setSkus(await res.json())
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/skus', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, unitPrice: parseFloat(form.unitPrice) }),
    })
    setLoading(false)
    if (!res.ok) { setError('Failed to create SKU'); return }
    setForm({ code: '', description: '', unitPrice: '' })
    load()
  }

  async function toggle(sku: SKU) {
    await fetch(`/api/skus/${sku.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !sku.active }),
    })
    load()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">SKU Catalog</h1>

      {/* Create form */}
      <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add SKU</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required
              placeholder="WEB-HOST-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Unit price ($)</label>
            <input type="number" min="0" step="0.01" value={form.unitPrice}
              onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-60">
              {loading ? 'Adding…' : 'Add'}
            </button>
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required
              placeholder="Managed web hosting — monthly"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
      </form>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Code', 'Description', 'Unit price', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {skus.map(sku => (
              <tr key={sku.id} className={sku.active ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-mono text-gray-900">{sku.code}</td>
                <td className="px-4 py-3 text-gray-700">{sku.description}</td>
                <td className="px-4 py-3 font-mono text-gray-900">${parseFloat(sku.unitPrice).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sku.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {sku.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggle(sku)}
                    className="text-xs text-brand-600 hover:underline">
                    {sku.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {skus.length === 0 && (
          <p className="text-center py-12 text-sm text-gray-400">No SKUs yet. Add one above.</p>
        )}
      </div>
    </div>
  )
}
