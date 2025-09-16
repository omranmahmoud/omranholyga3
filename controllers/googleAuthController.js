import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import fetch from 'node-fetch';

/**
 * Exchange Google ID token coming from client (mobile/web) and create/login user
 * Expected body: { idToken, name?, email? }
 */
export const googleLogin = async (req, res) => {
  try {
    const { idToken, email, name } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ message: 'idToken required' });
    }

    // Verify token with Google
    const ticket = await verifyGoogleToken(idToken);
    if (!ticket) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { sub: googleId, email: googleEmail, name: googleName, picture } = ticket;
    const finalEmail = (email || googleEmail || '').toLowerCase();
    if (!finalEmail) {
      return res.status(400).json({ message: 'Email not present in Google profile' });
    }

    let user = await User.findOne({ $or: [ { googleId }, { email: finalEmail } ] });

    if (!user) {
      // Create new user with random password placeholder
      const randomPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      user = new User({
        name: name || googleName || finalEmail.split('@')[0],
        email: finalEmail,
        password: randomPass, // will be hashed by pre-save hook
        googleId,
        image: picture || ''
      });
      await user.save();
    } else {
      // Attach googleId if newly linking
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.image && picture) user.image = picture;
        await user.save();
      }
    }

    const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev_jwt_secret_change_me' : undefined);
    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server JWT secret not configured' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        googleId: user.googleId
      }
    });
  } catch (e) {
    console.error('Google login error:', e);
    res.status(500).json({ message: 'Server error during Google login' });
  }
};

/**
 * Verify Google ID token manually using Google tokeninfo endpoint
 * (Simpler than using google-auth-library; can be swapped later)
 */
async function verifyGoogleToken(idToken) {
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    // Optionally validate aud against Settings.googleAuth.clientId if configured
    const settings = await Settings.findOne();
    const aud = settings?.googleAuth?.clientId || process.env.GOOGLE_CLIENT_ID;
    if (aud && data.aud !== aud) {
      console.warn('Google token aud mismatch', data.aud, 'expected', aud);
      return null;
    }
    return data; // contains sub, email, name, picture, etc.
  } catch (e) {
    console.error('verifyGoogleToken failed:', e.message);
    return null;
  }
}
