import express from 'express';
import { 
  getActiveTests, 
  getTestInfo, 
  registerUser, 
  verifyOTP, 
  resendOTP, 
  verifyTestCode, 
  getTestStatus, 
  startTest 
} from '../controllers/userController.js';

import { initializeTest,fetchCurrentQuestion,submitAnswer,completeTest,heartbeat } from '../controllers/userController.js';

const router = express.Router();

// Existing routes
router.get('/tests/active-published', getActiveTests);
router.get('/test-info/:testId', getTestInfo);

// New routes for LoginVerification component
router.post('/register', registerUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/verify-test-code', verifyTestCode);
router.get('/test-status/:testId', getTestStatus);
router.post('/start-test', startTest);

//Test Interface routes

router.post('/test/initialize', initializeTest);
router.post('/test/question', fetchCurrentQuestion);
router.post('/test/submit-answer', submitAnswer);
router.post('/test/complete', completeTest);
router.post('/test/heartbeat', heartbeat);

export default router;