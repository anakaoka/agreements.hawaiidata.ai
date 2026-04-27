'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SendButton({ quoteId }: { quoteId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function send() {
    setLoading(true)
    await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
    setLoading(false)
    router.refresh()
  }

  return (
    <button onClick={send} disabled={loading}
      className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60">
      {loading ? 'Sending…' : 'Send to customer'}
    </button>
  )
}
