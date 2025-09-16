import express from 'express';
import { createOrder, captureOrder, authorizeCard, testCredentials } from '../controllers/paypalController.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// Debug logging middleware for PayPal routes
router.use((req, _res, next) => {
	if (req.path.startsWith('/card')) {
		console.log('[PayPal] Incoming', req.method, req.originalUrl);
	}
	next();
});

router.post('/orders', createOrder); // body: { total, currency? }
router.post('/orders/:orderID/capture', captureOrder);
router.post('/card/authorize', authorizeCard); // body: { amount, currency, paymentSource: { card:{ number, expiry, security_code } } } (demo only)
router.get('/token/test', testCredentials);
// Debug helper: GET request returns method not allowed but proves route mounting
router.get('/card/authorize', (req, res) => {
	return res.status(405).json({ message: 'Use POST for authorization' });
});

// Additional debug endpoint to verify paypal config quickly
router.get('/debug/info', async (req, res) => {
	try {
		const settings = await Settings.findOne();
		res.json({
			routeMounted: true,
			hasAuthorizeHandler: true,
			paypalConfig: settings?.paypalConfig ? {
				enabled: settings.paypalConfig.enabled,
				clientIdSet: !!settings.paypalConfig.clientId,
				mode: 'live',
				features: settings.paypalConfig.features
			} : null,
			env: {
				clientIdPresent: !!process.env.PAYPAL_CLIENT_ID,
				secretPresent: !!process.env.PAYPAL_SECRET,
				mode: 'live'
			}
		});
	} catch (e) {
		res.status(500).json({ message: e.message });
	}
});

// Fingerprint (debug) – reveals only partial client/secret for verification
router.get('/debug/fingerprint', async (req, res) => {
	try {
		const client = process.env.PAYPAL_CLIENT_ID || '';
		const secret = process.env.PAYPAL_SECRET || '';
		const fp = (v) => v ? `${v.slice(0,6)}...${v.slice(-4)} (len=${v.length})` : null;
		res.json({
			mode: process.env.PAYPAL_MODE || 'sandbox',
			clientSet: !!client,
			secretSet: !!secret,
			clientFingerprint: fp(client),
			secretFingerprint: secret ? `len=${secret.length}` : null
		});
	} catch (e) {
		res.status(500).json({ message: e.message });
	}
});

// Deeper credential diagnostic (no secret exposure)
router.get('/debug/cred-check', (req, res) => {
	try {
		const client = process.env.PAYPAL_CLIENT_ID || '';
		const secret = process.env.PAYPAL_SECRET || '';
		const analyze = (label, v) => ({
			set: !!v,
			length: v.length,
			leadingWhitespace: v.match(/^\s+/)?.[0].length || 0,
			trailingWhitespace: v.match(/\s+$/)?.[0].length || 0,
			nonPrintableCount: [...v].filter(c => c.charCodeAt(0) < 32).length,
			fingerprint: v ? `${v.slice(0,6)}...${v.slice(-4)}` : null,
			hash12: v ? require('crypto').createHash('sha256').update(v).digest('hex').slice(0,12) : null,
			charSample: v ? [...v.slice(0,12)].map(c => {
				const code = c.charCodeAt(0);
				if (code === 10) return 'LF';
				if (code === 13) return 'CR';
				if (code === 9) return 'TAB';
				if (code === 32) return 'SP';
				return c;
			}) : []
		});
		res.json({
			mode: 'live',
			client: analyze('client', client),
			secret: analyze('secret', secret)
		});
	} catch (e) {
		res.status(500).json({ message: e.message });
	}
});

// Simple status for admin panel (no secret exposure)
router.get('/status', async (req, res) => {
	try {
		const settings = await Settings.findOne();
		const paypal = settings?.paypalConfig || {}; 
		res.json({
			enabled: !!paypal.enabled,
				mode: 'live',
			features: paypal.features || { buttons: true, card: false },
			hasClient: !!paypal.clientId,
			hasSecret: !!process.env.PAYPAL_SECRET || !!paypal.secretPreview,
			storedSecretPreview: paypal.secretPreview ? true : false
		});
	} catch (e) {
		res.status(500).json({ message: e.message });
	}
});

export default router;
