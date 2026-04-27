import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { checkVerificationCode } from '@/lib/twilio'
import { logAudit } from '@/lib/quotes'
import { sendAcceptanceConfirmation } from '@/lib/sendgrid'

const schema = z.object({ code: z.string().min(4).max(10) })

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })

  const quote = await db.quote.findUnique({
    where:   { acceptanceToken: params.token },
    include: { company: { select: { name: true } }, lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
  })

  if (!quote) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (quote.status === 'ACCEPTED') return NextResponse.json({ error: 'Already accepted' }, { status: 409 })

  const approved = await checkVerificationCode(quote.customerPhone, parsed.data.code)
  if (!approved) return NextResponse.json({ error: 'Incorrect or expired code' }, { status: 422 })

  const now = new Date()
  const ip  = req.headers.get('x-forwarded-for') ?? req.ip ?? 'unknown'
  const ua  = req.headers.get('user-agent') ?? 'unknown'

  await db.quote.update({
    where: { id: quote.id },
    data: {
      status:         'ACCEPTED',
      acceptedAt:     now,
      smsVerifiedAt:  now,
      acceptanceIp:   ip,
      acceptanceAgent: ua,
    },
  })

  await logAudit({
    quoteId:    quote.id,
    actionType: 'accepted',
    actorType:  'customer',
    newValue: {
      acceptedAt: now.toISOString(),
      ipAddress:  ip,
      userAgent:  ua,
      smsVerified: true,
    },
    ipAddress: ip,
    userAgent: ua,
  })

  await sendAcceptanceConfirmation({
    to:           quote.customerEmail,
    customerName: quote.customerName,
    companyName:  quote.company.name,
    quoteNumber:  quote.number,
    acceptedAt:   now,
    ipAddress:    ip,
  })

  return NextResponse.json({
    ok:     true,
    quote: {
      number:      quote.number,
      acceptedAt:  now.toISOString(),
      companyName: quote.company.name,
    },
  })
}
