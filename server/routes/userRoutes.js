import express from 'express';
import { getActiveTests,getTestInfo} from '../controllers/userController.js';

const router = express.Router();

router.get('/tests/active-published', getActiveTests);
router.get('/test-info/:testId', getTestInfo);

export default router;
