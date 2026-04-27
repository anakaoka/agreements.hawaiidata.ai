import { db } from '@/lib/db'

export async function generateQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.quote.count({
    where: { companyId, number: { startsWith: `Q-${year}-` } },
  })
  return `Q-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function logAudit(params: {
  quoteId:       string
  actionType:    string
  actorType:     'user' | 'customer' | 'system'
  actorId?:      string
  actorRole?:    string
  previousValue?: unknown
  newValue?:     unknown
  ipAddress?:    string
  userAgent?:    string
}) {
  await db.auditLog.create({
    data: {
      quoteId:       params.quoteId,
      actionType:    params.actionType,
      actorType:     params.actorType,
      actorId:       params.actorId,
      actorRole:     params.actorRole,
      previousValue: params.previousValue as any,
      newValue:      params.newValue      as any,
      ipAddress:     params.ipAddress,
      userAgent:     params.userAgent,
    },
  })
}
