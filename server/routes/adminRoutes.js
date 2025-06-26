import express from 'express';
import { loginAdmin,getAdminDashboard,createTest } from '../controllers/adminController.js';
import { getAllTests,getTestById,publishTest,unpublishTest,activateTest,endTest,deleteTest,getTestParticipants } from '../controllers/adminController.js';
import {getTestForEdit,updateTestInfo,addQuestion,deleteQuestion,updateQuestion,reorderQuestions,getSkillCategories} from '../controllers/adminController.js';
import {getTestDetails,getTestQuestions,generateTestCode } from '../controllers/adminController.js';
import { authMiddleware,isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginAdmin);
router.get('/dashboard', authMiddleware, isAdmin, getAdminDashboard);
router.post('/create-test', authMiddleware, isAdmin, createTest);

router.get('/manage-tests/',authMiddleware, isAdmin, getAllTests);

// Get single test by ID
router.get('/manage-tests/:id',authMiddleware, isAdmin, getTestById);

// Test state management
router.put('/manage-tests/:id/publish',authMiddleware, isAdmin, publishTest);
router.put('/manage-tests/:id/unpublish',authMiddleware, isAdmin, unpublishTest);

// Delete test
router.delete('/manage-tests/:id',authMiddleware, isAdmin, deleteTest);

// In your routes file
router.get('/tests/:id',authMiddleware, isAdmin, getTestForEdit);
router.put('/tests/:id/info',authMiddleware, isAdmin, updateTestInfo);
router.post('/tests/:id/questions',authMiddleware, isAdmin, addQuestion);
router.put('/tests/:id/questions/:questionId',authMiddleware, isAdmin, updateQuestion);
router.delete('/tests/:id/questions/:questionId',authMiddleware, isAdmin, deleteQuestion);
router.put('/tests/:id/questions/reorder',authMiddleware, isAdmin, reorderQuestions);
router.get('/skill-categories',authMiddleware, isAdmin, getSkillCategories);

router.get('/tests/:id',authMiddleware, isAdmin, getTestDetails);              // GET test details
router.get('/tests/:id/questions',authMiddleware, isAdmin, getTestQuestions);         // GET test questions
router.get('/tests/:id/participants',authMiddleware, isAdmin, getTestParticipants);   // GET test participants 

router.post('/tests/:id/generate-code',authMiddleware, isAdmin, generateTestCode);    // POST generate test code
router.put('/tests/:id/activate',authMiddleware, isAdmin, activateTest);             // PUT activate test
router.put('/tests/:id/end',authMiddleware, isAdmin, endTest);                       // PUT end test               // PUT archive test


export default router;