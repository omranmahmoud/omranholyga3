import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'Eva Curves Fashion Store'
  },
  email: {
    type: String,
    required: true,
    default: 'contact@evacurves.com'
  },
  phone: {
    type: String,
    default: '+1 (555) 123-4567'
  },
  address: {
    type: String,
    default: '123 Fashion Street, NY 10001'
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'EGP', 'IQD', 'ILS'],
    default: 'USD'
  },
  timezone: {
    type: String,
    required: true,
    default: 'UTC-5'
  },
  logo: {
    type: String,
    default: null
  },
  
  // Design/Theme settings
  primaryColor: {
    type: String,
    default: '#3b82f6' // Blue
  },
  secondaryColor: {
    type: String,
    default: '#64748b' // Slate
  },
  accentColor: {
    type: String,
    default: '#f59e0b' // Amber
  },
  textColor: {
    type: String,
    default: '#1f2937' // Gray 800
  },
  backgroundColor: {
    type: String,
    default: '#ffffff' // White
  },
  fontFamily: {
    type: String,
    default: 'Inter, system-ui, sans-serif'
  },
  headingFont: {
    type: String,
    default: 'Inter, system-ui, sans-serif'
  },
  bodyFont: {
    type: String,
    default: 'Inter, system-ui, sans-serif'
  },
  // Mega menu wide panel typography
  navPanelHeaderColor: {
    type: String,
    default: '#ea580c' // Orange 600
  },
  navPanelFontColor: {
    type: String,
    default: '#111827' // Gray 900
  },
  navPanelAccentColor: {
    type: String,
    default: '#e5e7eb' // Gray 200 for borders/rings
  },
  navPanelColumnActiveBgColor: {
    type: String,
    default: '#f3f4f6' // Gray 100 for left list active background
  },
  // Navigation categories typography
  navCategoryFontColor: {
    type: String,
    default: '#374151' // Gray 700
  },
  navCategoryFontSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  borderRadius: {
    type: String,
    default: '8px'
  },
  buttonStyle: {
    type: String,
    enum: ['rounded', 'square', 'pill'],
    default: 'rounded'
  },
  // Header (site nav bar) colors
  headerBackgroundColor: {
    type: String,
    default: '' // empty -> use theme default/transparent behavior
  },
  headerTextColor: {
    type: String,
    default: '' // empty -> use theme text
  },
  // Buttons
  addToCartBgColor: {
    type: String,
    default: '#4f46e5' // Indigo 600
  },
  // Header action icons (overrides)
  headerIcons: {
    wishlist: { type: String, default: '' },
    cart: { type: String, default: '' },
    user: { type: String, default: '' }
  },
  
  // Layout settings
  headerLayout: {
    type: String,
    enum: ['classic', 'modern', 'minimal'],
    default: 'modern'
  },
  footerStyle: {
    type: String,
    enum: ['simple', 'detailed', 'newsletter'],
    default: 'detailed'
  },
  productCardStyle: {
    type: String,
    enum: ['modern', 'classic', 'minimal'],
    default: 'modern'
  },
  // Product grid layout variants
  productGridStyle: {
    type: String,
    enum: ['standard', 'compact', 'masonry', 'list', 'wide', 'gallery', 'carousel'],
    default: 'standard'
  },
  
  // Social media links
  socialLinks: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    tiktok: { type: String, default: '' }
  },
  
  // SEO settings
  siteTitle: {
    type: String,
    default: 'Eva Curves Fashion Store'
  },
  siteDescription: {
    type: String,
    default: 'Premium fashion store offering the latest trends in clothing and accessories'
  },
  keywords: [{
    type: String
  }],
  
  // Analytics
  facebookPixel: {
    pixelId: { type: String, default: '' },
    enabled: { type: Boolean, default: false }
  },
  googleAnalytics: {
    trackingId: { type: String, default: '' },
    enabled: { type: Boolean, default: false }
  },
  // Featured product to use as the image for the "New In" tile
  featuredNewProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  // PayPal configuration (secret should remain in environment variable; only masked preview stored for UX)
  paypalConfig: {
    enabled: { type: Boolean, default: false },
    clientId: { type: String, default: '' },
    mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
    features: {
      buttons: { type: Boolean, default: true }, // PayPal Smart Buttons
      card: { type: Boolean, default: false } // Advanced card fields (needs eligibility)
    },
  secretPreview: { type: String, default: '' }, // Masked preview like 'ABCD********Z1'
  encryptedSecret: { type: String, default: '' } // Base64 or encrypted secret (DEV convenience – prefer env vars in production)
  },
  // Google OAuth configuration (Admin-managed; client secret should remain env; only masked preview stored)
  googleAuth: {
    enabled: { type: Boolean, default: false },
    clientId: { type: String, default: '' },
    webClientId: { type: String, default: '' }, // For web / backend verification if different
    iosClientId: { type: String, default: '' },
    androidClientId: { type: String, default: '' },
    secretPreview: { type: String, default: '' }
  },
  // Facebook OAuth configuration (Admin-managed; secret kept in env; only masked preview stored)
  facebookAuth: {
    enabled: { type: Boolean, default: false },
    appId: { type: String, default: '' },
    webAppId: { type: String, default: '' }, // If separate web app Id, else mirror appId
    iosAppId: { type: String, default: '' },
    androidAppId: { type: String, default: '' },
    secretPreview: { type: String, default: '' }
  }
}, {
  timestamps: true
});

// Create default settings or migrate existing ones
settingsSchema.statics.createDefaultSettings = async function() {
  try {
    const settings = await this.findOne();
    if (!settings) {
      // No settings exist, create default ones
      await this.create({});
      console.log('Default store settings created successfully');
    } else {
      // Settings exist, check if we need to add new theme fields
      let needsUpdate = false;
      const updateData = {};
      
      // Check for missing theme fields and add defaults
      if (!settings.primaryColor) {
        updateData.primaryColor = '#3b82f6';
        needsUpdate = true;
      }
      if (!settings.secondaryColor) {
        updateData.secondaryColor = '#64748b';
        needsUpdate = true;
      }
      if (!settings.accentColor) {
        updateData.accentColor = '#f59e0b';
        needsUpdate = true;
      }
      if (!settings.textColor) {
        updateData.textColor = '#1f2937';
        needsUpdate = true;
      }
      if (!settings.backgroundColor) {
        updateData.backgroundColor = '#ffffff';
        needsUpdate = true;
      }
      if (!settings.fontFamily) {
        updateData.fontFamily = 'Inter, system-ui, sans-serif';
        needsUpdate = true;
      }
      if (!settings.productGridStyle) {
        updateData.productGridStyle = 'standard';
        needsUpdate = true;
      }
      if (!settings.productCardStyle) {
        updateData.productCardStyle = 'modern';
        needsUpdate = true;
      }
      // Add-to-cart button background if missing
      if (!settings.addToCartBgColor) {
        updateData.addToCartBgColor = '#4f46e5';
        needsUpdate = true;
      }
      // Header colors if missing
      if (typeof settings.headerBackgroundColor === 'undefined') {
        updateData.headerBackgroundColor = '';
        needsUpdate = true;
      }
      if (typeof settings.headerTextColor === 'undefined') {
        updateData.headerTextColor = '';
        needsUpdate = true;
      }
      // Add nav panel typography defaults if missing
      if (!settings.navPanelHeaderColor) {
        updateData.navPanelHeaderColor = '#ea580c';
        needsUpdate = true;
      }
      if (!settings.navPanelFontColor) {
        updateData.navPanelFontColor = '#111827';
        needsUpdate = true;
      }
      if (!settings.navPanelAccentColor) {
        updateData.navPanelAccentColor = '#e5e7eb';
        needsUpdate = true;
      }
      if (!settings.navPanelColumnActiveBgColor) {
        updateData.navPanelColumnActiveBgColor = '#f3f4f6';
        needsUpdate = true;
      }
      // Add nav categories typography if missing
      if (!settings.navCategoryFontColor) {
        updateData.navCategoryFontColor = '#374151';
        needsUpdate = true;
      }
      if (!settings.navCategoryFontSize) {
        updateData.navCategoryFontSize = 'medium';
        needsUpdate = true;
      }
      // Add featured new product pointer if missing
      if (typeof settings.featuredNewProductId === 'undefined') {
        updateData.featuredNewProductId = null;
        needsUpdate = true;
      }
      // Header icons block if missing
      if (!settings.headerIcons) {
        updateData.headerIcons = { wishlist: '', cart: '', user: '' };
        needsUpdate = true;
      } else {
        const hi = settings.headerIcons || {};
        const next = { wishlist: hi.wishlist || '', cart: hi.cart || '', user: hi.user || '' };
        if (hi.wishlist !== next.wishlist || hi.cart !== next.cart || hi.user !== next.user) {
          updateData.headerIcons = next;
          needsUpdate = true;
        }
      }
      // PayPal config block
      if (!settings.paypalConfig) {
        updateData.paypalConfig = { enabled: false, clientId: '', mode: 'sandbox', features: { buttons: true, card: false }, secretPreview: '', encryptedSecret: '' };
        needsUpdate = true;
      } else {
        const pc = settings.paypalConfig || {};
        const next = {
          enabled: typeof pc.enabled === 'boolean' ? pc.enabled : false,
          clientId: pc.clientId || '',
          mode: pc.mode === 'live' ? 'live' : 'sandbox',
          features: {
            buttons: pc.features?.buttons !== undefined ? pc.features.buttons : true,
            card: pc.features?.card !== undefined ? pc.features.card : false
          },
          secretPreview: pc.secretPreview || '',
          encryptedSecret: pc.encryptedSecret || ''
        };
        if (pc.enabled !== next.enabled || pc.clientId !== next.clientId || pc.mode !== next.mode ||
            pc.features?.buttons !== next.features.buttons || pc.features?.card !== next.features.card || pc.secretPreview !== next.secretPreview || pc.encryptedSecret !== next.encryptedSecret) {
          updateData.paypalConfig = next;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await this.findByIdAndUpdate(settings._id, updateData);
        console.log('Existing settings migrated with new theme fields');
      }
      // Ensure googleAuth block exists
      if (!settings.googleAuth) {
        settings.googleAuth = { enabled: false, clientId: '', webClientId: '', iosClientId: '', androidClientId: '', secretPreview: '' };
        await settings.save();
        console.log('Added googleAuth block to existing settings');
      }
      // Ensure facebookAuth block exists
      if (!settings.facebookAuth) {
        settings.facebookAuth = { enabled: false, appId: '', webAppId: '', iosAppId: '', androidAppId: '', secretPreview: '' };
        await settings.save();
        console.log('Added facebookAuth block to existing settings');
      }
    }
  } catch (error) {
    console.error('Error creating/migrating settings:', error);
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;