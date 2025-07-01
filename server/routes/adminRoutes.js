import express from 'express';
import { loginAdmin,getAdminDashboard,createTest } from '../controllers/adminController.js';
import { getAllTests,getTestById,publishTest,unpublishTest,activateTest,endTest,deleteTest,getTestParticipants } from '../controllers/adminController.js';
import {getTestDetails,getTestQuestions,generateTestCode ,getTestCategories,getTestSubcategories} from '../controllers/adminController.js';
import { authMiddleware,isAdmin } from '../middleware/auth.js';
import {
  getTestForEdit,
  updateTestInfo,
  addCategory,
  updateCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  addQuestion,
  updateQuestion,
  deleteQuestion
} from '../controllers/adminController.js';

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

// Get test by ID for editing
router.get('/tests/:id', authMiddleware, isAdmin, getTestForEdit);

// Update test basic information
router.put('/tests/:id/info', authMiddleware, isAdmin, updateTestInfo);

// Category management routes
router.post('/tests/:id/categories', authMiddleware, isAdmin, addCategory);
router.put('/tests/:id/categories/:categoryId', authMiddleware, isAdmin, updateCategory);
router.delete('/tests/:id/categories/:categoryId', authMiddleware, isAdmin, deleteCategory);

// Subcategory management routes
router.post('/tests/:id/subcategories', authMiddleware, isAdmin, addSubcategory);
router.put('/tests/:id/subcategories/:subcategoryId', authMiddleware, isAdmin, updateSubcategory);
router.delete('/tests/:id/subcategories/:subcategoryId', authMiddleware, isAdmin, deleteSubcategory);

// Question management routes
router.post('/tests/:id/questions', authMiddleware, isAdmin, addQuestion);
router.put('/tests/:id/questions/:questionId', authMiddleware, isAdmin, updateQuestion);
router.delete('/tests/:id/questions/:questionId', authMiddleware, isAdmin, deleteQuestion);

// Add these routes to your admin routes file
router.get('/tests-d/:id/categories',authMiddleware, isAdmin, getTestCategories);
router.get('/tests-d/:id/subcategories',authMiddleware, isAdmin, getTestSubcategories);

router.get('/tests-d/:id',authMiddleware, isAdmin, getTestDetails);              // GET test details
router.get('/tests-d/:id/questions',authMiddleware, isAdmin, getTestQuestions);         // GET test questions
router.get('/tests-d/:id/participants',authMiddleware, isAdmin, getTestParticipants);

router.post('/tests-d/:id/generate-code',authMiddleware, isAdmin, generateTestCode);    // POST generate test code
router.put('/tests-d/:id/activate',authMiddleware, isAdmin, activateTest);             // PUT activate test
router.put('/tests-d/:id/end',authMiddleware, isAdmin, endTest);                       // PUT end test               // PUT archive test


export default router;