import express from 'express';
import { loginAdmin,getAdminDashboard,createTest } from '../controllers/adminController.js';
import { getAllTests,getTestById,generateTestCode,publishTest,unpublishTest,activateTest,endTest,deleteTest,getTestParticipants,cloneTest } from '../controllers/adminController.js';
import {getTestForEdit,updateTestInfo,addQuestion,deleteQuestion,updateQuestion,reorderQuestions,getSkillCategories} from '../controllers/adminController.js';
import { authMiddleware,isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginAdmin);
router.get('/dashboard', authMiddleware, isAdmin, getAdminDashboard);
router.post('/create-test', authMiddleware, isAdmin, createTest);

router.get('/manage-tests/',authMiddleware, isAdmin, getAllTests);

// Get single test by ID
router.get('/manage-tests/:id',authMiddleware, isAdmin, getTestById);

// Generate test code
router.post('/manage-tests/:id/generate-code',authMiddleware, isAdmin, generateTestCode);

// Test state management
router.put('/manage-tests/:id/publish',authMiddleware, isAdmin, publishTest);
router.put('/manage-tests/:id/unpublish',authMiddleware, isAdmin, unpublishTest);
router.put('/manage-tests/:id/activate',authMiddleware, isAdmin, activateTest);
router.put('/manage-tests/:id/end',authMiddleware, isAdmin, endTest);

// Delete test
router.delete('/manage-tests/:id',authMiddleware, isAdmin, deleteTest);

// Get test participants
router.get('/manage-tests/:id/participants',authMiddleware, isAdmin, getTestParticipants);

// Clone test
router.post('/manage-tests/:id/clone',authMiddleware, isAdmin, cloneTest);

// In your routes file
router.get('/tests/:id',authMiddleware, isAdmin, getTestForEdit);
router.put('/tests/:id/info',authMiddleware, isAdmin, updateTestInfo);
router.post('/tests/:id/questions',authMiddleware, isAdmin, addQuestion);
router.put('/tests/:id/questions/:questionId',authMiddleware, isAdmin, updateQuestion);
router.delete('/tests/:id/questions/:questionId',authMiddleware, isAdmin, deleteQuestion);
router.put('/tests/:id/questions/reorder',authMiddleware, isAdmin, reorderQuestions);
router.get('/skill-categories',authMiddleware, isAdmin, getSkillCategories);

export default router;