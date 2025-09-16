import Hero from '../models/Hero.js';

export const getAllHeros = async (req, res) => {
  try {
    const heros = await Hero.find().sort({ createdAt: -1 });
    res.json(heros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveHero = async (req, res) => {
  try {
    const hero = await Hero.findOne({ isActive: true });
    if (!hero) {
      return res.status(404).json({ message: 'No active hero section found' });
    }
    res.json(hero);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createHero = async (req, res) => {
  try {
    // If setting this hero as active, deactivate all others
    if (req.body.isActive) {
      await Hero.updateMany({}, { isActive: false });
    }
    
    const hero = new Hero(req.body);
    const savedHero = await hero.save();
    res.status(201).json(savedHero);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateHero = async (req, res) => {
  try {
    // If setting this hero as active, deactivate all others
    if (req.body.isActive) {
      await Hero.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    }
    
    const hero = await Hero.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!hero) {
      return res.status(404).json({ message: 'Hero section not found' });
    }
    
    res.json(hero);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteHero = async (req, res) => {
  try {
    const hero = await Hero.findByIdAndDelete(req.params.id);
    
    if (!hero) {
      return res.status(404).json({ message: 'Hero section not found' });
    }
    
    res.json({ message: 'Hero section deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};