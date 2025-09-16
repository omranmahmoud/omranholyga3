import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import fetch from 'node-fetch';

/**
 * Exchange Facebook access token from client (mobile/web) to create/login user.
 * Expected body: { accessToken, userID?, email?, name? }
 * Client should obtain accessToken via Facebook SDK (JS or mobile) then send here.
 */
export const facebookLogin = async (req, res) => {
  try {
    const { accessToken, userID, email, name } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ message: 'accessToken required' });
    }

    // Verify token with Facebook Graph debug or by fetching /me
    const profile = await fetchFacebookProfile(accessToken, userID);
    if (!profile || !profile.id) {
      return res.status(401).json({ message: 'Invalid Facebook token' });
    }

    const fbId = profile.id;
    const fbEmail = (email || profile.email || '').toLowerCase();
    const displayName = name || profile.name || (fbEmail ? fbEmail.split('@')[0] : 'Facebook User');

    if (!fbEmail) {
      // Some Facebook accounts may not have email permission granted
      return res.status(400).json({ message: 'Email not present in Facebook profile or permission not granted' });
    }

    let user = await User.findOne({ $or: [ { facebookId: fbId }, { email: fbEmail } ] });

    if (!user) {
      const randomPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      user = new User({
        name: displayName,
        email: fbEmail,
        password: randomPass,
        facebookId: fbId,
        image: profile.picture?.data?.url || ''
      });
      await user.save();
    } else {
      if (!user.facebookId) {
        user.facebookId = fbId;
        if (!user.image && profile.picture?.data?.url) user.image = profile.picture.data.url;
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
        facebookId: user.facebookId
      }
    });
  } catch (e) {
    console.error('Facebook login error:', e);
    res.status(500).json({ message: 'Server error during Facebook login' });
  }
};

/**
 * Fetches basic profile from Facebook Graph API using the access token.
 * Optionally verifies that provided userID matches returned id.
 */
async function fetchFacebookProfile(accessToken, providedUserID) {
  try {
    // Fields we want: id, name, email, picture
    const fields = 'id,name,email,picture.type(large)';
    const url = `https://graph.facebook.com/me?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('Facebook profile fetch failed with status', resp.status);
      return null;
    }
    const data = await resp.json();

    // Validate app id (optional) using debug_token endpoint if settings specify appId
    const settings = await Settings.findOne();
    const appId = settings?.facebookAuth?.appId || process.env.FACEBOOK_APP_ID;
    if (appId) {
      // Quick debug call to ensure token belongs to our app.
      // Requires an app access token; if not available skip this step.
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (appSecret) {
        const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appId + '|' + appSecret)}`;
        const debugResp = await fetch(debugUrl);
        if (debugResp.ok) {
          const debugJson = await debugResp.json();
          if (!debugJson.data?.is_valid || (debugJson.data.app_id && debugJson.data.app_id !== appId)) {
            console.warn('Facebook token app_id mismatch or invalid');
            return null;
          }
        }
      }
    }

    if (providedUserID && data.id && providedUserID !== data.id) {
      console.warn('Facebook userID mismatch', providedUserID, data.id);
      return null;
    }

    return data;
  } catch (e) {
    console.error('fetchFacebookProfile failed:', e.message);
    return null;
  }
}

export default facebookLogin;
