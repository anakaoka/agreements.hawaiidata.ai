import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/quotes'
import { sendQuoteEmail } from '@/lib/sendgrid'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quote = await db.quote.findFirst({
    where:   { id: params.id, companyId: session.user.companyId },
    include: { company: { select: { name: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.status === 'ACCEPTED') {
    return NextResponse.json({ error: 'Quote already accepted' }, { status: 409 })
  }

  const newStatus = quote.status === 'DRAFT' ? 'SENT' : 'REVISED'
  await db.quote.update({
    where: { id: quote.id },
    data:  { status: newStatus },
  })

  await sendQuoteEmail({
    to:              quote.customerEmail,
    customerName:    quote.customerName,
    companyName:     quote.company.name,
    quoteNumber:     quote.number,
    acceptanceToken: quote.acceptanceToken!,
    expiresAt:       quote.expiresAt,
  })

  await logAudit({
    quoteId:    quote.id,
    actionType: 'sent',
    actorType:  'user',
    actorId:    session.user.id,
    actorRole:  session.user.role,
    newValue:   { status: newStatus },
  })

  return NextResponse.json({ ok: true })
}
