import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const quote = await db.quote.findUnique({
    where:   { acceptanceToken: params.token },
    include: {
      company:   { select: { name: true } },
      lineItems: {
        where:   { deletedAt: null, customerVisible: true },
        orderBy: { sortOrder: 'asc' },
        select:  { description: true, quantity: true, unitPrice: true, totalPrice: true },
      },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.status === 'ACCEPTED')   return NextResponse.json({ error: 'Already accepted' }, { status: 409 })
  if (['EXPIRED', 'CANCELLED'].includes(quote.status)) {
    return NextResponse.json({ error: 'Quote is no longer active' }, { status: 410 })
  }

  return NextResponse.json({
    number:       quote.number,
    customerName: quote.customerName,
    companyName:  quote.company.name,
    legalTerms:   quote.legalTerms,
    expiresAt:    quote.expiresAt?.toISOString() ?? null,
    lineItems:    quote.lineItems,
  })
}
