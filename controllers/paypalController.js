import fetch from 'node-fetch';
import crypto from 'crypto';

// Helper: normalize amount into a fixed 2-decimal string, return null if invalid
function normalizeAmount(v) {
  if (v === undefined || v === null) return null;
  let num = v;
  if (typeof num === 'string') {
    // Strip currency symbols & spaces
    const cleaned = num.replace(/[^0-9.,-]/g, '');
    // If both comma & dot appear, assume last symbol is decimal separator; naive normalization
    if (cleaned.includes(',') && cleaned.includes('.')) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        // European style: swap commas & dots
        num = parseFloat(cleaned.replace(/\./g,'').replace(',', '.'));
      } else {
        num = parseFloat(cleaned.replace(/,/g,''));
      }
    } else if (cleaned.includes(',')) {
      // Assume comma is decimal separator
      num = parseFloat(cleaned.replace(/,/g,'.'));
    } else {
      num = parseFloat(cleaned);
    }
  }
  if (typeof num !== 'number' || !isFinite(num)) return null;
  if (num < 0) return null;
  return num.toFixed(2); // returns string
}

// Determine PayPal API base dynamically (adds back sandbox for local testing)
function getBase() {
  const mode = (process.env.PAYPAL_MODE || 'live').toLowerCase();
  if (mode === 'sandbox') return 'https://api-m.sandbox.paypal.com';
  return 'https://api-m.paypal.com';
}

async function getAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID;
  // Support both PAYPAL_SECRET and PAYPAL_CLIENT_SECRET naming (some docs use CLIENT_SECRET)
  const secret = process.env.PAYPAL_SECRET || process.env.PAYPAL_CLIENT_SECRET;
  if (!client || !secret) {
    throw new Error('Missing PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_SECRET). Save them in settings or .env and restart.');
  }
  const auth = Buffer.from(`${client}:${secret}`).toString('base64');
  const base = getBase();
  const mode = (process.env.PAYPAL_MODE || 'live').toLowerCase();
  const hash = crypto.createHash('sha256').update(secret).digest('hex').slice(0,12);
  console.log(`[PayPal] Requesting OAuth token (mode=${mode} base=${base}) clientFingerprint=${client.slice(0,6)}...${client.slice(-4)} secretLen=${secret.length} secretHash12=${hash}`);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Accept-Language': 'en_US'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const text = await res.text();
    const debugId = res.headers.get('paypal-debug-id') || res.headers.get('PayPal-Debug-Id') || null;
    console.error('[PayPal] OAuth failed', {
      status: res.status,
      debugId,
      snippet: text.slice(0,300),
      clientSet: !!client,
      secretSet: !!secret,
      clientLen: client.length,
      secretLen: secret.length
    });
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }
  return res.json();
}

export const createOrder = async (req, res, next) => {
  try {
    const { total, currency = 'USD' } = req.body;
    if (!total) return res.status(400).json({ message: 'Missing total' });

    const { access_token } = await getAccessToken();

    const base = getBase();
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: total.toFixed(2)
          }
        }
      ]
    };
  console.log('[PayPal] Creating order (intent=CAPTURE) payload=', JSON.stringify(payload));
    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await orderRes.json();
    if (!orderRes.ok) {
      console.error('[PayPal] Order creation failed:', data);
      return res.status(orderRes.status).json(data);
    }
    res.json({ id: data.id });
  } catch (e) {
    next(e);
  }
};

export const captureOrder = async (req, res, next) => {
  try {
    const { orderID } = req.params;
    if (!orderID) return res.status(400).json({ message: 'Missing orderID' });

    const { access_token } = await getAccessToken();

  const base = getBase();
  const captureRes = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }
    });

    const data = await captureRes.json();
    if (!captureRes.ok) {
      return res.status(captureRes.status).json(data);
    }
    res.json(data);
  } catch (e) {
    next(e);
  }
};

// Tokenize card (Advanced Card Fields). Normally you'd use PayPal JS SDK client-side and only create order server-side.
// This endpoint simulates a server-side card authorization step given a client-side produced payment_source.card token (nonce).
export const authorizeCard = async (req, res, next) => {
  try {
    const { orderID, amount, currency = 'USD', paymentSource } = req.body || {};
    const { access_token } = await getAccessToken();
    const base = getBase();

    // Preferred modern flow: client already created order (Hosted Fields) and just wants capture
    if (orderID) {
      console.log('[PayPal] authorizeCard capture flow orderID=', orderID);
      const captureRes = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        console.error('[PayPal] capture failed', captureRes.status, captureData);
        return res.status(captureRes.status).json(captureData);
      }
      const capture = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
      return res.json({
        flow: 'capture-only',
        status: capture?.status || captureData.status,
        id: capture?.id || orderID,
        raw: captureData
      });
    }

    // Legacy fallback: create + capture with raw card data (NOT recommended for Hosted Fields)
    if (!amount || !paymentSource?.card?.number) {
      return res.status(400).json({ message: 'Provide orderID (preferred) OR amount + paymentSource.card.number (legacy).' });
    }
    // Validate & normalize amount early
    const normalized = normalizeAmount(amount);
    if (!normalized) {
      return res.status(400).json({ message: 'Invalid amount format', originalAmount: amount });
    }
    // Basic schema validation for card fields
    const card = paymentSource.card || {};
    const problems = [];
    if (!/^\d{12,19}$/.test((card.number||'').replace(/\s+/g,''))) problems.push('card.number invalid length');
    if (!/^20\d{2}-\d{2}$/.test(card.expiry||'')) problems.push('card.expiry must be YYYY-MM');
    if (!/^\d{3,4}$/.test(card.security_code||'')) problems.push('card.security_code must be 3-4 digits');
    if (card.billing_address) {
      if (card.billing_address.country_code && !/^[A-Z]{2}$/.test(card.billing_address.country_code)) problems.push('billing_address.country_code must be ISO-2 uppercase');
    }
    if (problems.length) {
      return res.status(400).json({ message: 'Card validation failed', issues: problems });
    }
    // Mask card for logs (show only first 6 + last 4)
    const rawNum = paymentSource.card.number || '';
    const masked = rawNum ? `${rawNum.slice(0,6)}...${rawNum.slice(-4)} (len=${rawNum.length})` : 'n/a';
    console.warn('[PayPal] Using legacy create+capture card flow (consider migrating). card=', masked);
    console.log('[PayPal] Outgoing legacy order payload draft', {
      amount: normalized,
      currency,
      hasBillingAddress: !!paymentSource.card.billing_address,
      nameIncluded: !!paymentSource.card.name
    });
    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
        // PayPal requires PayPal-Request-Id when providing a payment_source directly with order create
        'PayPal-Request-Id': req.headers['x-request-id'] || crypto.randomUUID()
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: (currency||'USD').toUpperCase(), value: normalized } }],
        payment_source: paymentSource
      })
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error('[PayPal] legacy create order failed', {
        status: orderRes.status,
        debug_id: orderData.debug_id,
        name: orderData.name,
        details: orderData.details,
        message: orderData.message,
        firstDetail: orderData.details?.[0]
      });
      return res.status(orderRes.status).json(orderData);
    }
    const captureRes = await fetch(`${base}/v2/checkout/orders/${orderData.id}/capture`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }
    });
    const captureData = await captureRes.json();
    if (!captureRes.ok) {
      console.error('[PayPal] legacy capture failed', captureRes.status, captureData);
      return res.status(captureRes.status).json(captureData);
    }
    const capture = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
    res.json({ flow: 'legacy-create-capture', status: capture?.status || captureData.status, id: capture?.id || orderData.id, raw: captureData });
  } catch (e) { next(e); }
};

// Simple credentials test endpoint
export const testCredentials = async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, scope: token.scope, expires_in: token.expires_in });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
      env: {
        clientPresent: !!process.env.PAYPAL_CLIENT_ID,
        secretPresent: !!process.env.PAYPAL_SECRET,
        mode: process.env.PAYPAL_MODE || 'sandbox'
      }
    });
  }
};
