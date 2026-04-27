import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const schema = z.object({
  code:        z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  unitPrice:   z.number().positive(),
  active:      z.boolean().optional().default(true),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const skus = await db.sKU.findMany({
    where:   { companyId: session.user.companyId },
    orderBy: { code: 'asc' },
  })
  return NextResponse.json(skus)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['DOMAIN_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const sku = await db.sKU.create({
    data: { ...parsed.data, companyId: session.user.companyId },
  })
  return NextResponse.json(sku, { status: 201 })
}
