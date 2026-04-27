import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateQuoteNumber, logAudit } from '@/lib/quotes'
import { sendQuoteEmail } from '@/lib/sendgrid'

const lineItemSchema = z.object({
  skuId:          z.string().optional(),
  description:    z.string().min(1),
  quantity:       z.number().positive(),
  unitPrice:      z.number().min(0),
  totalPrice:     z.number().min(0),
  overridden:     z.boolean().optional().default(false),
  notes:          z.string().optional(),
  customerVisible:z.boolean().optional().default(true),
  editable:       z.boolean().optional().default(false),
  sortOrder:      z.number().optional().default(0),
})

const schema = z.object({
  customerName:  z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(7),  // E.164 expected
  legalTerms:    z.string().min(10),
  validFrom:     z.string().datetime().optional(),
  expiresAt:     z.string().datetime().optional(),
  lineItems:     z.array(lineItemSchema).min(1),
  sendNow:       z.boolean().optional().default(false),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quotes = await db.quote.findMany({
    where:   { companyId: session.user.companyId },
    include: { lineItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { lineItems, sendNow, ...quoteData } = parsed.data
  const number = await generateQuoteNumber(session.user.companyId)
  const acceptanceToken = crypto.randomBytes(32).toString('hex')

  const quote = await db.quote.create({
    data: {
      number,
      companyId:      session.user.companyId,
      createdById:    session.user.id,
      acceptanceToken,
      status:         sendNow ? 'SENT' : 'DRAFT',
      customerName:   quoteData.customerName,
      customerEmail:  quoteData.customerEmail,
      customerPhone:  quoteData.customerPhone,
      legalTerms:     quoteData.legalTerms,
      validFrom:      quoteData.validFrom  ? new Date(quoteData.validFrom)  : null,
      expiresAt:      quoteData.expiresAt  ? new Date(quoteData.expiresAt)  : null,
      lineItems: {
        create: lineItems.map((item, i) => ({
          ...item,
          sortOrder: item.sortOrder ?? i,
        })),
      },
    },
    include: { lineItems: true, company: { select: { name: true } } },
  })

  await logAudit({
    quoteId:    quote.id,
    actionType: sendNow ? 'sent' : 'created',
    actorType:  'user',
    actorId:    session.user.id,
    actorRole:  session.user.role,
    newValue:   { status: quote.status },
  })

  if (sendNow) {
    await sendQuoteEmail({
      to:              quote.customerEmail,
      customerName:    quote.customerName,
      companyName:     quote.company.name,
      quoteNumber:     quote.number,
      acceptanceToken: quote.acceptanceToken!,
      expiresAt:       quote.expiresAt,
    })
  }

  return NextResponse.json(quote, { status: 201 })
}
