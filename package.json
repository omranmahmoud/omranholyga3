// ...existing code...
import recipientRoutes from './routes/recipientRoutes.js';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { errorHandler } from './middleware/errorHandler.js';
// Mobile detection helper (simple UA check) - keep tiny to avoid dependency
function isLikelyMobile(ua = '') {
  ua = ua.toLowerCase();
  return /(iphone|ipad|ipod|android|blackberry|bb10|opera mini|windows phone|mobile|silk)/.test(ua);
}

// Route Imports
import mobileBannerUploadRoutes from './routes/mobileBannerUploadRoutes.js';
import mobileBannerRoutes from './routes/mobileBannerRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import authRoutes from './routes/authRoutes.js';
import heroRoutes from './routes/heroRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import navigationCategoryRoutes from './routes/navigationCategoryRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import footerRoutes from './routes/footerRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import backgroundRoutes from './routes/backgroundRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import giftCardRoutes from './routes/giftCardRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js'; // Added Shipping Routes
import revenueRoutes from './routes/revenueRoutes.js'; // Added Revenue Routes
import pushRoutes from './routes/pushRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import homepageRoutes from './routes/homepageRoutes.js';
import translateRoutes from './routes/translateRoutes.js';
import paypalRoutes from './routes/paypalRoutes.js';
import flashSaleRoutes from './routes/flashSaleRoutes.js';
import Settings from './models/Settings.js';
import crypto from 'crypto';

// Path Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment Variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
// Middleware (must be registered before routes so req.body is populated)
app.use(cors());
app.use(express.json());
// Serve static for service worker if behind express (especially in production)
app.use(express.static(path.resolve(__dirname, '../public')));

// Serve built web + mobile (single dist with /m entry)
const distDir = path.resolve(__dirname, '../dist');
import { existsSync } from 'fs';
if (existsSync(distDir)) {
  app.use('/', express.static(distDir, { index: false }));
  // Mobile assets live under /m/* inside same dist build
  app.use('/m', express.static(distDir, { index: false }));
}

// UA redirect (only for root web pages, not assets or API or already on /m)
app.use((req, res, next) => {
  try {
  if (!existsSync(distDir)) return next(); // nothing to do
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    if (req.path.startsWith('/m')) return next();
    if (req.path.startsWith('/assets') || req.path.includes('.')) return next(); // likely an asset
    const ua = req.headers['user-agent'] || '';
    if (isLikelyMobile(ua)) {
      // Map /some/path -> /m/some/path for deep linking parity
      const target = '/m' + (req.path === '/' ? '' : req.path);
      return res.redirect(302, target);
    }
  } catch (e) {
    console.warn('Mobile redirect middleware error:', e.message);
  }
  next();
});
// Also expose uploads under /api/uploads for clients that prefix API on asset URLs
app.use('/api/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

// MongoDB Connection with improved resilience
const connectDB = async (retryCount = 0) => {
  const maxRetries = 5;
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error(`MongoDB connection attempt ${retryCount + 1} failed:`, error.message);

    if (retryCount < maxRetries) {
      console.log(`Retrying connection in ${retryDelay}ms...`);
      setTimeout(() => connectDB(retryCount + 1), retryDelay);
    } else {
      console.error('Max retry attempts reached. Could not connect to MongoDB.');
      process.exit(1);
    }
    return null;
  }
};

// API Routes
app.use('/api/mobile-banners/upload', mobileBannerUploadRoutes);
app.use('/api/mobile-banners', mobileBannerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/navigation', navigationCategoryRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/backgrounds', backgroundRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/shipping', shippingRoutes); // Added Shipping Routes
app.use('/api/revenue', revenueRoutes); // Added Revenue Routes
app.use('/api/push', pushRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/flash-sales', flashSaleRoutes);

// Debug: list all registered routes
app.get('/api/_debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(',');
      routes.push({ path: m.route.path, methods });
    } else if (m.name === 'router' && m.handle?.stack) {
      m.handle.stack.forEach(r => {
        if (r.route && r.route.path) {
          const methods = Object.keys(r.route.methods).join(',');
          // Attempt to detect mount path (regex in m.regexp)
          let prefix = '';
          if (m.regexp && m.regexp.source) {
            const match = m.regexp.source.match(/\^\\\/([^\\]+)/);
            if (match) prefix = '/' + match[1];
          }
          routes.push({ path: prefix + r.route.path, methods });
        }
      });
    }
  });
  res.json({ count: routes.length, routes });
});

// Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback handling (after API routes, before error handler)
app.get('/m/*', (req, res, next) => {
  if (!existsSync(distDir)) return next();
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();
  // Mobile HTML is emitted as m/index.html inside dist
  res.sendFile(path.join(distDir, 'm/index.html'));
});

app.get('*', (req, res, next) => {
  if (!existsSync(distDir)) return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// 404 handler (only if not handled above)
app.use((req, res) => {
  console.warn('[404]', req.method, req.originalUrl);
  res.status(404).json({ message: 'Route not found', path: req.originalUrl });
});

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// WebSocket setup
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, request) => {
  console.log('New WebSocket connection established');
  clients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection_established',
    data: { message: 'Connected to real-time updates' },
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data);
      
      // Handle different message types if needed
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Function to broadcast to all connected clients
export function broadcastToClients(data) {
  const message = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  });
  
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending message to client:', error);
        clients.delete(client);
      }
    }
  });
}

// Make broadcaster accessible to routes/controllers without creating import cycles
// Routes can access it via req.app.get('broadcastToClients')
app.set('broadcastToClients', broadcastToClients);

// Initialize server
const startServer = async () => {
  if (process.env.SKIP_DB === '1') {
    console.warn('Starting server with SKIP_DB=1 (database connection skipped).');
    server.listen(PORT, () => {
      console.log(`Server running (no DB) on port ${PORT}`);
      console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
    });
    return;
  }

  const conn = await connectDB();
  if (!conn) {
    console.error('Database connection failed; server not started. Set SKIP_DB=1 to bypass during development.');
    return;
  }

  // Load persisted PayPal secret if env missing
  try {
    const settings = await Settings.findOne();
    const pc = settings?.paypalConfig;
    if (pc) {
      if (!process.env.PAYPAL_CLIENT_ID && pc.clientId) {
        process.env.PAYPAL_CLIENT_ID = pc.clientId;
        console.log('[PayPal] Loaded clientId from settings');
      }
      // Determine effective mode (prefer env, else stored, else sandbox)
      if (!process.env.PAYPAL_MODE) {
        process.env.PAYPAL_MODE = pc.mode === 'live' ? 'live' : 'sandbox';
        console.log(`[PayPal] Mode set from settings: ${process.env.PAYPAL_MODE}`);
      } else {
        console.log(`[PayPal] Mode from ENV retained: ${process.env.PAYPAL_MODE}`);
      }
      if (!process.env.PAYPAL_SECRET && pc.encryptedSecret) {
        try {
          const rawKey = (process.env.SETTINGS_SECRET_KEY || 'dev-secret-key').padEnd(32, '0').slice(0,32);
          const buf = Buffer.from(pc.encryptedSecret, 'base64');
          if (buf.length > 28) { // 12 iv +16 tag minimal
            const iv = buf.slice(0,12);
            const tag = buf.slice(12,28);
            const enc = buf.slice(28);
            try {
              const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(rawKey), iv);
              decipher.setAuthTag(tag);
              const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
              process.env.PAYPAL_SECRET = dec;
              console.log('[PayPal] Decrypted secret loaded from settings');
            } catch (e) {
              // Maybe base64 fallback
              const fallback = Buffer.from(pc.encryptedSecret, 'base64').toString('utf8');
              if (fallback) {
                process.env.PAYPAL_SECRET = fallback;
                console.log('[PayPal] Loaded base64 secret from settings (fallback)');
              }
            }
          }
        } catch (e) {
          console.warn('[PayPal] Failed to load encrypted secret:', e.message);
        }
      }

      // Summarize effective config (no secret value leaked)
      console.log('[PayPal] Effective configuration', {
        mode: process.env.PAYPAL_MODE,
        clientSet: !!process.env.PAYPAL_CLIENT_ID,
        secretSet: !!process.env.PAYPAL_SECRET
      });
    }
  } catch (e) {
    console.warn('[PayPal] Startup credential load skipped:', e.message);
  }

  // Initialize default data after database connection is established
  try {
    // Import and run data initialization
    const User = (await import('./models/User.js')).default;
    const Settings = (await import('./models/Settings.js')).default;
    const FooterSettings = (await import('./models/FooterSettings.js')).default;
    const Background = (await import('./models/Background.js')).default;

    // Create default admin user
    await User.createDefaultAdmin();

    // Create default settings
    await Settings.createDefaultSettings();

    // Create default footer settings
    await FooterSettings.createDefaultSettings();

    // Create default background
    await Background.createDefaultBackground();

    // Ensure a test delivery company exists
    try {
      const { createTestDeliveryCompany } = await import('./utils/createTestData.js');
      await createTestDeliveryCompany();
    } catch (e) {
      console.warn('Delivery company seeding skipped:', e.message);
    }
    
    

    console.log('✅ Default data initialization completed');
  } catch (error) {
    console.error('❌ Error during data initialization:', error.message);
  }

  // Start real-time services after everything is initialized
  import('./services/realTimeEventService.js');

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  });
};

// Start server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});
