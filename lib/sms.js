const https = require('https');

function isSmsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

function twilioRequest(path, body) {
  const auth = Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64');
  const payload = new URLSearchParams(body).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      method: 'POST',
      path,
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
        reject(new Error('SMS provider returned HTTP ' + res.statusCode + ': ' + data));
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendVerificationCode(to, code, orgName) {
  if (!isSmsConfigured()) {
    throw new Error('SMS verification is not configured');
  }

  await twilioRequest('/2010-04-01/Accounts/' + encodeURIComponent(process.env.TWILIO_ACCOUNT_SID) + '/Messages.json', {
    From: process.env.TWILIO_FROM,
    To: to,
    Body: (orgName || 'Agreements') + ' verification code: ' + code + '. This code expires in 15 minutes.'
  });
}

module.exports = { isSmsConfigured, sendVerificationCode };
