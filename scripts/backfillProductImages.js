import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected');

  const products = await Product.find({ $or: [ { images: { $exists: true, $size: 0 } }, { images: { $exists: false } } ] }).select('images colors name');
  if (!products.length) {
    console.log('No products without images found.');
    await mongoose.disconnect();
    return;
  }
  let updated = 0;
  for (const p of products) {
    const existing = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (existing.length === 0 && Array.isArray(p.colors) && p.colors[0]?.images?.length) {
      const colorImgs = p.colors[0].images.filter(Boolean);
      if (colorImgs.length) {
        p.images = colorImgs.slice(0, 6); // limit
        await p.save();
        updated++;
        console.log('Updated', p._id.toString(), p.name);
      }
    }
  }
  console.log('Done. Updated', updated, 'products.');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
