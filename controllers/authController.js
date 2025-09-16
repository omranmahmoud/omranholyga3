import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export const register = async (req, res) => {
  try {
    let { name, email, password, phoneNumber } = req.body;
    // If email missing but phone provided, synthesize internal email
    if (!email && phoneNumber) {
      const digits = String(phoneNumber).replace(/[^0-9]/g,'');
      if (digits.length < 7) return res.status(400).json({ message: 'Invalid phone number' });
      email = `p${digits}@phone.local`;
    }
    const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev_jwt_secret_change_me' : undefined);
    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server JWT secret not configured' });
    }

  // Build uniqueness query (avoid empty object that matches everything)
  const or = [{ email }];
  if (phoneNumber) or.push({ phoneNumber });
  const existingUser = await User.findOne({ $or: or });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email/phone' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: 'user',
      phoneNumber: phoneNumber || undefined
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send response
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Duplicate key error (email or phoneNumber already taken)
    if (error?.code === 11000) {
      const fields = Object.keys(error.keyPattern || error.keyValue || { duplicate: 'value' });
      return res.status(400).json({ message: `Already registered: ${fields.join(', ')}` });
    }
    // Mongoose validation error
    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map(e => e.message).join('; ');
      return res.status(400).json({ message: messages || 'Invalid data' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev_jwt_secret_change_me' : undefined);
    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server JWT secret not configured' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send response
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lightweight identifier existence check used by mobile signup step 1
// Accepts { identifier } which can be email or phone (+E.164). For phone we expect normalized (+countrycode...).
export const checkIdentifier = async (req, res) => {
  try {
    let { identifier } = req.body || {};
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ message: 'Missing identifier' });
    }
    identifier = identifier.trim();
    const isEmail = /\S+@\S+\.\S+/.test(identifier);
    let query = {};
    if (isEmail) {
      query = { email: identifier.toLowerCase() };
    } else if (/^\+?[0-9]{7,16}$/.test(identifier.replace(/[^0-9+]/g,''))) {
      // Phone path (normalized or raw digits)
      const phone = identifier.startsWith('+') ? identifier : '+' + identifier.replace(/[^0-9]/g,'');
      query = { $or: [ { phoneNumber: phone }, { email: new RegExp(`^p${phone.replace(/[^0-9]/g,'')}@phone\\.local$`, 'i') } ] };
    } else {
      return res.json({ exists: false });
    }
    const user = await User.findOne(query).select('email phoneNumber');
    if (!user) return res.json({ exists: false });
    return res.json({ exists: true });
  } catch (error) {
    console.error('checkIdentifier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};