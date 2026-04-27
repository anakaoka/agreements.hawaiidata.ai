import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendVerificationCode } from '@/lib/twilio'
import { logAudit } from '@/lib/quotes'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const quote = await db.quote.findUnique({
    where: { acceptanceToken: params.token },
  })

  if (!quote) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  if (quote.status === 'ACCEPTED') return NextResponse.json({ error: 'Already accepted' }, { status: 409 })
  if (quote.status === 'EXPIRED' || quote.status === 'CANCELLED') {
    return NextResponse.json({ error: 'This quote is no longer active' }, { status: 410 })
  }
  if (quote.expiresAt && quote.expiresAt < new Date()) {
    await db.quote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ error: 'This quote has expired' }, { status: 410 })
  }

  // Mark as VIEWED if not already past that
  if (quote.status === 'SENT') {
    await db.quote.update({ where: { id: quote.id }, data: { status: 'VIEWED' } })
    await logAudit({
      quoteId:    quote.id,
      actionType: 'viewed',
      actorType:  'customer',
      ipAddress:  req.headers.get('x-forwarded-for') ?? req.ip,
      userAgent:  req.headers.get('user-agent') ?? undefined,
    })
  }

  // Send SMS code
  await sendVerificationCode(quote.customerPhone)

  return NextResponse.json({ ok: true, phone: quote.customerPhone.replace(/\d(?=\d{4})/g, '*') })
}
