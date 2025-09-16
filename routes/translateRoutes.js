import express from 'express';
import translate from '@vitalets/google-translate-api';

const router = express.Router();

// POST /api/translate
// { text: string, to: string, from?: string }
router.post('/', async (req, res) => {
  const { text, to, from } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Invalid text' });
  }
  if (typeof to !== 'string' || !to.trim()) {
    return res.status(400).json({ error: 'Target language (to) is required' });
  }
  try {
    const result = await translate(text, { to: to.trim(), ...(from ? { from: from.trim() } : {}) });
    res.json({ text: result.text, raw: result.raw, from: result.from?.language?.iso || from || null });
  } catch (e) {
    console.error('Translation error:', e.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

export default router;