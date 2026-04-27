import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

const FROM = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@agreements.hawaiidata.ai'

export async function sendQuoteEmail({
  to,
  customerName,
  companyName,
  quoteNumber,
  acceptanceToken,
  expiresAt,
}: {
  to: string
  customerName: string
  companyName: string
  quoteNumber: string
  acceptanceToken: string
  expiresAt?: Date | null
}) {
  const acceptUrl = `${process.env.NEXTAUTH_URL}/accept/${acceptanceToken}`
  const expiryLine = expiresAt
    ? `<p>This quote expires on <strong>${expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</strong>.</p>`
    : ''

  await sgMail.send({
    to,
    from: FROM,
    subject: `Your quote from ${companyName} — ${quoteNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Hello ${customerName},</h2>
        <p>${companyName} has sent you a quote (<strong>${quoteNumber}</strong>) for your review.</p>
        ${expiryLine}
        <p>To review and accept this quote, click the button below. You will be asked to
        verify your identity with a one-time SMS code before signing.</p>
        <p style="margin:32px 0">
          <a href="${acceptUrl}"
             style="background:#0284c7;color:#fff;padding:14px 28px;border-radius:6px;
                    text-decoration:none;font-size:16px;font-weight:600">
            Review &amp; Accept Quote
          </a>
        </p>
        <p style="color:#555;font-size:13px">
          By clicking "I Agree" on the next page, you consent to use electronic signatures
          and acknowledge this agreement is legally binding under ESIGN/UETA.
        </p>
        <p style="color:#555;font-size:13px">
          If you did not expect this email, you can safely ignore it.
        </p>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">
          Powered by agreements.hawaiidata.ai
        </p>
      </div>
    `,
  })
}

export async function sendAcceptanceConfirmation({
  to,
  customerName,
  companyName,
  quoteNumber,
  acceptedAt,
  ipAddress,
}: {
  to: string
  customerName: string
  companyName: string
  quoteNumber: string
  acceptedAt: Date
  ipAddress: string
}) {
  await sgMail.send({
    to,
    from: FROM,
    subject: `Agreement confirmed — ${quoteNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Agreement Confirmed</h2>
        <p>Hello ${customerName},</p>
        <p>You have successfully accepted quote <strong>${quoteNumber}</strong>
           from <strong>${companyName}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:24px 0">
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">Quote</td>
            <td style="padding:8px;border:1px solid #e5e7eb"><strong>${quoteNumber}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">Accepted at</td>
            <td style="padding:8px;border:1px solid #e5e7eb">${acceptedAt.toISOString()} UTC</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">IP address</td>
            <td style="padding:8px;border:1px solid #e5e7eb">${ipAddress}</td>
          </tr>
        </table>
        <p style="color:#555;font-size:13px">
          This email serves as your electronic confirmation. Please retain it for your records.
        </p>
      </div>
    `,
  })
}

export async function sendExpiryAlert({
  to,
  companyName,
  quoteNumber,
  customerName,
  expiresAt,
  daysLeft,
}: {
  to: string
  companyName: string
  quoteNumber: string
  customerName: string
  expiresAt: Date
  daysLeft: number
}) {
  await sgMail.send({
    to,
    from: FROM,
    subject: `Quote ${quoteNumber} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#b45309">Quote Expiring Soon</h2>
        <p>This is an automated alert for <strong>${companyName}</strong>.</p>
        <p>Quote <strong>${quoteNumber}</strong> for customer <strong>${customerName}</strong>
           expires on <strong>${expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</strong>
           — that is <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> from now.</p>
        <p>The quote has not yet been accepted. You may want to follow up with the customer.</p>
        <p>
          <a href="${process.env.NEXTAUTH_URL}/quotes"
             style="background:#0284c7;color:#fff;padding:12px 24px;border-radius:6px;
                    text-decoration:none;font-weight:600">
            View Quotes Dashboard
          </a>
        </p>
      </div>
    `,
  })
}
