import cron from 'node-cron'
import { db } from '@/lib/db'
import { sendExpiryAlert } from '@/lib/sendgrid'
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns'

const ALERT_DAYS = [30, 7, 1]
const ALERT_TYPES: Record<number, string> = {
  30: 'expiry_30d',
  7:  'expiry_7d',
  1:  'expiry_1d',
}

async function processExpiryAlerts() {
  const now = new Date()
  const today = startOfDay(now)

  // Find active quotes that expire within the next 30 days and haven't been accepted
  const quotes = await db.quote.findMany({
    where: {
      status:    { in: ['SENT', 'VIEWED', 'REVISED'] },
      expiresAt: { gte: today, lte: addDays(today, 31) },
    },
    include: {
      alerts:  true,
      company: { select: { name: true } },
      createdBy: { select: { email: true, name: true } },
    },
  })

  for (const quote of quotes) {
    if (!quote.expiresAt) continue
    const daysLeft = differenceInCalendarDays(quote.expiresAt, today)

    for (const days of ALERT_DAYS) {
      if (daysLeft !== days) continue
      const alertType = ALERT_TYPES[days]
      const alreadySent = quote.alerts.some(a => a.alertType === alertType && a.sentAt)
      if (alreadySent) continue

      await sendExpiryAlert({
        to:           quote.createdBy.email,
        companyName:  quote.company.name,
        quoteNumber:  quote.number,
        customerName: quote.customerName,
        expiresAt:    quote.expiresAt,
        daysLeft,
      })

      await db.alert.upsert({
        where:  { quoteId_alertType: { quoteId: quote.id, alertType } },
        create: { quoteId: quote.id, alertType, sentAt: now },
        update: { sentAt: now },
      })
    }
  }

  // Mark overdue quotes as EXPIRED
  await db.quote.updateMany({
    where: {
      status:    { in: ['SENT', 'VIEWED', 'REVISED'] },
      expiresAt: { lt: today },
    },
    data: { status: 'EXPIRED' },
  })
}

// Runs every day at 08:00 server local time
export function startCronJobs() {
  cron.schedule('0 8 * * *', () => {
    processExpiryAlerts().catch(err =>
      console.error('[cron] expiry alerts failed:', err)
    )
  })
  console.log('[cron] expiry alert job registered (daily @ 08:00)')
}
