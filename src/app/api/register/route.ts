import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'

const schema = z.object({
  companyName: z.string().min(2).max(100),
  name:        z.string().min(2).max(100),
  email:       z.string().email(),
  password:    z.string().min(8),
})

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { companyName, name, email, password } = parsed.data

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  // Generate a unique slug
  const base = slugify(companyName)
  let slug = base
  let n = 1
  while (await db.company.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await db.company.create({
    data: {
      name: companyName,
      slug,
      users: {
        create: {
          name,
          email: email.toLowerCase(),
          hashedPassword,
          role: 'DOMAIN_ADMIN',
        },
      },
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
