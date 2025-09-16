import express from 'express';
import crypto from 'crypto';
import { adminAuth } from '../middleware/auth.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// Get store settings
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get analytics config (subset of settings)
router.get('/analytics', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const analytics = {
      facebookPixel: settings.facebookPixel || { pixelId: '', enabled: false },
      googleAnalytics: settings.googleAnalytics || { trackingId: '', enabled: false }
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Facebook Pixel config
router.get('/analytics/facebook-pixel', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const fb = settings.facebookPixel || { pixelId: '', enabled: false };
    res.json(fb);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Facebook Pixel config (admin only)
router.put('/analytics/facebook-pixel', adminAuth, async (req, res) => {
  try {
    const { pixelId = '', enabled = false } = req.body || {};

    // Basic validation: when enabled, require 15-16 digit numeric Pixel ID
    if (enabled && !/^\d{15,16}$/.test(String(pixelId))) {
      return res.status(400).json({ message: 'Invalid Facebook Pixel ID format' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.facebookPixel = { pixelId: String(pixelId), enabled: Boolean(enabled) };
    await settings.save();

    res.json(settings.facebookPixel);
  } catch (error) {
    if (error.name === 'ValidationError') {
      res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Get PayPal config
router.get('/payments/paypal', adminAuth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    const paypal = settings.paypalConfig || { enabled: false, clientId: '', mode: 'sandbox' };
    res.json(paypal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Google auth config
router.get('/auth/google', adminAuth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    const g = settings.googleAuth || { enabled: false, clientId: '', webClientId: '', iosClientId: '', androidClientId: '' };
    res.json(g);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Facebook auth config
router.get('/auth/facebook', adminAuth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    const f = settings.facebookAuth || { enabled: false, appId: '', webAppId: '', iosAppId: '', androidAppId: '' };
    res.json(f);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Google auth config (admin only)
router.put('/auth/google', adminAuth, async (req, res) => {
  try {
    let { enabled = false, clientId = '', webClientId = '', iosClientId = '', androidClientId = '', clientSecret } = req.body || {};
    clientId = String(clientId || '').trim();
    webClientId = String(webClientId || '').trim();
    iosClientId = String(iosClientId || '').trim();
    androidClientId = String(androidClientId || '').trim();

    if (enabled && !clientId) {
      return res.status(400).json({ message: 'clientId required when enabling Google login' });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    const cfg = {
      enabled: !!enabled,
      clientId,
      webClientId: webClientId || clientId,
      iosClientId,
      androidClientId,
      secretPreview: settings.googleAuth?.secretPreview || ''
    };

    if (clientSecret && typeof clientSecret === 'string') {
      const trimmed = clientSecret.trim();
      if (trimmed) {
        const masked = trimmed.length <= 8
          ? '*'.repeat(trimmed.length)
          : trimmed.slice(0,4) + '*'.repeat(Math.max(0, trimmed.length - 6)) + trimmed.slice(-2);
        cfg.secretPreview = masked;
        process.env.GOOGLE_CLIENT_SECRET = trimmed; // runtime only
      }
    }
    if (cfg.clientId) process.env.GOOGLE_CLIENT_ID = cfg.clientId;

    settings.googleAuth = cfg;
    await settings.save();
    res.json(cfg);
  } catch (error) {
    console.error('Google auth config update failed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update Facebook auth config (admin only)
router.put('/auth/facebook', adminAuth, async (req, res) => {
  try {
    let { enabled = false, appId = '', webAppId = '', iosAppId = '', androidAppId = '', appSecret } = req.body || {};
    appId = String(appId || '').trim();
    webAppId = String(webAppId || '').trim();
    iosAppId = String(iosAppId || '').trim();
    androidAppId = String(androidAppId || '').trim();
    if (enabled && !appId) {
      return res.status(400).json({ message: 'appId required when enabling Facebook login' });
    }
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    const cfg = {
      enabled: !!enabled,
      appId,
      webAppId: webAppId || appId,
      iosAppId,
      androidAppId,
      secretPreview: settings.facebookAuth?.secretPreview || ''
    };
    if (appSecret && typeof appSecret === 'string') {
      const trimmed = appSecret.trim();
      if (trimmed) {
        const masked = trimmed.length <= 8
          ? '*'.repeat(trimmed.length)
          : trimmed.slice(0,4) + '*'.repeat(Math.max(0, trimmed.length - 6)) + trimmed.slice(-2);
        cfg.secretPreview = masked;
        process.env.FACEBOOK_APP_SECRET = trimmed; // runtime only
      }
    }
    if (cfg.appId) process.env.FACEBOOK_APP_ID = cfg.appId;
    settings.facebookAuth = cfg;
    await settings.save();
    res.json(cfg);
  } catch (error) {
    console.error('Facebook auth config update failed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update PayPal config (admin only)
router.put('/payments/paypal', adminAuth, async (req, res) => {
  try {
  let { enabled = false, clientId = '', mode = 'live', features, secret } = req.body || {};
  if (typeof clientId === 'string') clientId = clientId.trim();
  if (typeof secret === 'string') secret = secret.trim();
  // Force live mode only
  mode = 'live';
    if (enabled && !clientId) {
      return res.status(400).json({ message: 'Client ID required when enabling PayPal' });
    }
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    // Preserve existing feature flags if not provided
    const existingFeatures = settings.paypalConfig?.features || { buttons: true, card: false };
    const nextFeatures = {
      buttons: features?.buttons !== undefined ? !!features.buttons : existingFeatures.buttons,
      card: features?.card !== undefined ? !!features.card : existingFeatures.card
    };

    // Build config update
    const cfg = {
      enabled: Boolean(enabled),
  clientId: String(clientId),
  mode: 'live',
      features: nextFeatures,
      secretPreview: settings.paypalConfig?.secretPreview || ''
    };
    // If secret provided, store only masked preview; real secret should live in env
    // Dynamically set env vars for current process (DEV convenience ONLY)
    if (cfg.clientId) {
      process.env.PAYPAL_CLIENT_ID = cfg.clientId;
    }
    // Keep runtime mode in sync so controller selects correct PayPal base URL
  process.env.PAYPAL_MODE = 'live';
    if (secret && typeof secret === 'string') {
      const trimmed = secret; // already trimmed above
      if (trimmed) {
        const masked = trimmed.length <= 8
          ? '*'.repeat(trimmed.length)
          : trimmed.slice(0,4) + '*'.repeat(Math.max(0, trimmed.length - 6)) + trimmed.slice(-2);
        cfg.secretPreview = masked;
        // Simple encryption (NOT production-grade: for dev persistence only). Use SETTINGS_SECRET_KEY to derive key.
        try {
          const rawKey = (process.env.SETTINGS_SECRET_KEY || 'dev-secret-key').padEnd(32, '0').slice(0,32);
          const iv = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(rawKey), iv);
          const enc = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
          const tag = cipher.getAuthTag();
          const packed = Buffer.concat([iv, tag, enc]).toString('base64');
          cfg.encryptedSecret = packed;
        } catch (err) {
          console.warn('[PayPal] Encryption failed, falling back to base64');
          cfg.encryptedSecret = Buffer.from(trimmed, 'utf8').toString('base64');
        }
        process.env.PAYPAL_SECRET = trimmed; // runtime
        console.log('[PayPal] Secret updated (stored encrypted + runtime env set)');
      }
    }

    settings.paypalConfig = cfg;
    await settings.save();

    // Return config without any raw secret
  const responsePayload = { ...cfg };
  delete responsePayload.encryptedSecret; // never expose
    res.json(responsePayload);
  } catch (error) {
    console.error('PayPal config update failed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update store settings (admin only)
router.put('/', adminAuth, async (req, res) => {
  try {
  console.log('[Settings PUT] Incoming payload:', req.body);
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Update settings
    Object.assign(settings, req.body);
    await settings.save();

    // Emit real-time event to notify clients of settings change
    try {
      const broadcast = req.app.get('broadcastToClients');
      if (typeof broadcast === 'function') {
        broadcast({
          type: 'settings_updated',
          data: {
            // Send only fields that impact design/theme to avoid oversharing
            primaryColor: settings.primaryColor,
            secondaryColor: settings.secondaryColor,
            accentColor: settings.accentColor,
            textColor: settings.textColor,
            backgroundColor: settings.backgroundColor,
            fontFamily: settings.fontFamily,
            borderRadius: settings.borderRadius,
            buttonStyle: settings.buttonStyle,
            headerLayout: settings.headerLayout,
            footerStyle: settings.footerStyle,
            productCardStyle: settings.productCardStyle,
            productGridStyle: settings.productGridStyle,
            // Buttons
            addToCartBgColor: settings.addToCartBgColor,
            headerBackgroundColor: settings.headerBackgroundColor,
            headerTextColor: settings.headerTextColor,
            headerIcons: settings.headerIcons,
            // Wide panel colors
            navPanelHeaderColor: settings.navPanelHeaderColor,
            navPanelFontColor: settings.navPanelFontColor,
            navPanelAccentColor: settings.navPanelAccentColor,
            navPanelColumnActiveBgColor: settings.navPanelColumnActiveBgColor,
            // Nav typography
            navCategoryFontColor: settings.navCategoryFontColor,
            navCategoryFontSize: settings.navCategoryFontSize,
            // SEO fields
            siteTitle: settings.siteTitle,
            siteDescription: settings.siteDescription,
            keywords: settings.keywords,
            socialLinks: settings.socialLinks,
            // Contact info fields
            phone: settings.phone,
            address: settings.address,
            email: settings.email,
            name: settings.name,
          }
        });
      }
    } catch (e) {
      console.error('Failed to broadcast settings update:', e);
    }

    res.json(settings);
  } catch (error) {
  console.error('[Settings PUT] Error:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

export default router;