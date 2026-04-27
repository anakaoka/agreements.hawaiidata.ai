import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const schema = z.object({
  code:        z.string().min(1).max(50).optional(),
  description: z.string().min(1).max(500).optional(),
  unitPrice:   z.number().positive().optional(),
  active:      z.boolean().optional(),
})

async function guardAdmin(companyId: string, skuId: string) {
  const sku = await db.sKU.findFirst({ where: { id: skuId, companyId } })
  return sku
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['DOMAIN_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sku = await guardAdmin(session.user.companyId, params.id)
  if (!sku) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await db.sKU.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['DOMAIN_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sku = await guardAdmin(session.user.companyId, params.id)
  if (!sku) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.sKU.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
