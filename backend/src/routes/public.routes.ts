import { Router } from 'express';
import { resolvePublicQrHandler } from '../controllers/qr.controller';

const router = Router();

// Public QR resolution
router.get('/qr/:qrToken', resolvePublicQrHandler);

export default router;
