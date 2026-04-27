# Legal Enforceability of Emailed Agreements (ESIGN / UETA)

Notes captured before deprecating `agreements.hawaiidata.ai`. These describe
what an emailed-agreement workflow needs to satisfy U.S. (and Hawaii) contract
and electronic-signature law, so a future implementation can pick this back up.

## 1. Governing law

Two statutes establish that electronic signatures and records cannot be denied
legal effect solely because they are electronic:

- **ESIGN Act** (federal)
- **UETA** (adopted by Hawaii)

Email agreements can be binding **if** the four core contract elements are
present: offer, acceptance, consideration, and mutual assent.

## 2. Minimum elements to capture

### A. Identity of the signer (authentication)

You must reasonably prove the person accepting is who they claim to be.
Strongest → weakest:

1. Signed-in account (email + password tied to user account)
2. Email verification link (unique token)
3. 2FA (SMS or authenticator)
4. IP address + device fingerprint logging

Minimum via email: send to a known address and require a positive action
(not passive receipt).

### B. Clear offer

The email or linked page must clearly state:

- Services / products
- Pricing
- Term (start/end or ongoing)
- Payment obligations
- Termination terms
- Any penalties (e.g., no early cancellation)

Courts look for definite terms — avoid ambiguity.

### C. Explicit acceptance

The user must take an affirmative action showing intent to agree.

Valid:

- Clicking "I Agree" (preferred)
- Typing name + submitting form
- Replying with explicit language: "I agree to the terms", "Approved"

Not sufficient:

- "If you don't reply, you agree"
- Passive email delivery
- Pre-checked boxes

### D. Intent to sign electronically

You must disclose that the user is agreeing electronically and that this has
the same effect as a handwritten signature. Example clause:

> By clicking "I Agree" or replying to this email, you consent to use
> electronic signatures and agree this is legally binding.

This disclosure is required under ESIGN.

### E. Consent to do business electronically

You must also disclose:

- They can receive records electronically
- They can request paper copies
- Any hardware/software requirements (minimal but technically required)

### F. Consideration

A clear exchange of value: you provide service; they pay (or commit to pay).
Without this it's not enforceable.

## 3. Practical data checklist

Required:

- Full legal name
- Email address (verified)
- Company name (if applicable)

Strongly recommended:

- IP address at time of acceptance
- Timestamp (UTC + local)
- User agent / device info
- Unique agreement ID / hash
- Version of terms agreed to

Optional but stronger:

- SMS verification (code)
- Typed signature field

## 4. Email flow that holds up

1. **Send agreement email** — summary of terms, link to full agreement, unique
   acceptance link.
2. **User clicks link** — lands on agreement page; must scroll or acknowledge.
3. **Explicit action** — "I Agree" button OR typed name + submit.
4. **Confirmation email** — "You agreed to Agreement #123"; attach PDF
   snapshot of terms.

## 5. Is an email reply enough?

Yes, but weaker. A reply of "I agree" can be enforceable only if:

- Terms were clearly presented
- Identity is reasonably tied to that email
- No ambiguity exists

This is more disputable than a structured e-sign flow.

## 6. When it would NOT be binding

- Terms are vague or missing
- No clear acceptance action
- Identity cannot be proven
- User did not consent to electronic signing
- It falls under exceptions (e.g., wills, some real estate docs)

## 7. Strength hierarchy (strongest → weakest)

1. Dedicated e-sign platform with full audit trail (DocuSign-level)
2. Your system with login + click-accept + logs
3. Email link + click-accept
4. Email reply "I agree"
5. Passive email (not enforceable)

## 8. Bottom line

If you implement: verified email identity, clear terms, an explicit "I Agree"
action, audit logs (IP, timestamp, version), and an electronic-consent
disclosure — your emailed agreement is binding under ESIGN + UETA.

Next-level implementation work would be: exact endpoints, log fields, and
DB schema for the acceptance record.
