import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Resolve project paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseUploadsDir = path.resolve(__dirname, '../../public/uploads');

// Ensure directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(baseUploadsDir);
const iconsDir = path.join(baseUploadsDir, 'icons');
const bannersDir = path.join(baseUploadsDir, 'banners');
const sideBannersDir = path.join(baseUploadsDir, 'side-banners');
ensureDir(iconsDir);
ensureDir(bannersDir);
ensureDir(sideBannersDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Default to icons; specific routes below will override via _uploadDest on req
    const dest = req._uploadDest || iconsDir;
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(safeBase);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ''}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

// POST /api/uploads/icons
router.post('/icons', adminAuth, (req, _res, next) => { req._uploadDest = iconsDir; next(); }, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const pathOnly = `/uploads/icons/${req.file.filename}`;
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}${pathOnly}`;
  res.json({ url, path: pathOnly, filename: req.file.filename, field: req.file.fieldname });
});

// POST /api/uploads/banners
router.post('/banners', adminAuth, (req, _res, next) => { req._uploadDest = bannersDir; next(); }, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const pathOnly = `/uploads/banners/${req.file.filename}`;
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}${pathOnly}`;
  res.json({ url, path: pathOnly, filename: req.file.filename, field: req.file.fieldname });
});

// POST /api/uploads/side-banners
router.post('/side-banners', adminAuth, (req, _res, next) => { req._uploadDest = sideBannersDir; next(); }, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const pathOnly = `/uploads/side-banners/${req.file.filename}`;
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}${pathOnly}`;
  res.json({ url, path: pathOnly, filename: req.file.filename, field: req.file.fieldname });
});

export default router;
