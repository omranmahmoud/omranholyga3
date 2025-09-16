import HomepageBanner from '../models/HomepageBanner.js';
import HomepageSideBanner from '../models/HomepageSideBanner.js';

// Sliders (HomepageBanner)
export const getSliders = async (req, res) => {
  const items = await HomepageBanner.find().sort({ order: 1, createdAt: 1 });
  res.json(items);
};

export const createSlider = async (req, res) => {
  const { title = '', image, link = '', active = true, labelBgType = 'gradient', labelBgColor = '#000000', labelBgOpacity = 60, labelTextColor = '#FFFFFF',
    ctaEnabled = false, ctaText = '', ctaUrl = '', ctaBgColor = '#111827', ctaTextColor = '#FFFFFF', ctaStyle = 'solid', ctaRounded = true, ctaPosition = 'bottom-left'
  } = req.body || {};
  if (!image) return res.status(400).json({ message: 'Image is required' });
  const max = await HomepageBanner.findOne().sort({ order: -1 }).lean();
  const order = (max?.order ?? 0) + 1;
  const created = await HomepageBanner.create({ title, image, link, order, active, labelBgType, labelBgColor, labelBgOpacity, labelTextColor, ctaEnabled, ctaText, ctaUrl, ctaBgColor, ctaTextColor, ctaStyle, ctaRounded, ctaPosition });
  res.status(201).json(created);
};

export const updateSlider = async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const updated = await HomepageBanner.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
};

export const deleteSlider = async (req, res) => {
  const { id } = req.params;
  const doc = await HomepageBanner.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json({ success: true });
};

export const reorderSliders = async (req, res) => {
  const { order } = req.body; // [{id, order}]
  if (!Array.isArray(order)) return res.status(400).json({ message: 'Invalid order payload' });
  const ops = order.map(o => HomepageBanner.findByIdAndUpdate(o.id, { order: o.order }));
  await Promise.all(ops);
  const items = await HomepageBanner.find().sort({ order: 1, createdAt: 1 });
  res.json(items);
};

// Side Category Banners (HomepageSideBanner)
export const getSideBanners = async (req, res) => {
  const items = await HomepageSideBanner.find().sort({ side: 1, position: 1, createdAt: 1 });
  res.json(items);
};

export const createSideBanner = async (req, res) => {
  const { label, image, link = '', side, active = true, labelBgType = 'gradient', labelBgColor = '#000000', labelBgOpacity = 60, labelTextColor = '#FFFFFF' } = req.body || {};
  if (!label || !image || !side) return res.status(400).json({ message: 'label, image and side are required' });
  const max = await HomepageSideBanner.findOne({ side }).sort({ position: -1 }).lean();
  const position = (max?.position ?? 0) + 1;
  const created = await HomepageSideBanner.create({ label, image, link, side, position, active, labelBgType, labelBgColor, labelBgOpacity, labelTextColor });
  res.status(201).json(created);
};

export const updateSideBanner = async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const updated = await HomepageSideBanner.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
};

export const deleteSideBanner = async (req, res) => {
  const { id } = req.params;
  const doc = await HomepageSideBanner.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json({ success: true });
};

export const reorderSideBanners = async (req, res) => {
  const { side, order } = req.body; // side: 'left'|'right', order: [{id, position}]
  if (!side || !Array.isArray(order)) return res.status(400).json({ message: 'Invalid reorder payload' });
  const ops = order.map(o => HomepageSideBanner.findByIdAndUpdate(o.id, { position: o.position }));
  await Promise.all(ops);
  const items = await HomepageSideBanner.find({ side }).sort({ position: 1, createdAt: 1 });
  res.json(items);
};
