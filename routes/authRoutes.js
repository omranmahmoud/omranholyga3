import express from 'express';
import { login, register, getCurrentUser, checkIdentifier } from '../controllers/authController.js';
import { googleLogin } from '../controllers/googleAuthController.js';
import { facebookLogin } from '../controllers/facebookAuthController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/check-identifier', checkIdentifier);
router.post('/google', googleLogin); // Google OAuth ID token exchange
router.post('/facebook', facebookLogin); // Facebook OAuth access token exchange
router.get('/me', auth, getCurrentUser);

export default router;