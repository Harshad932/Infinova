import jwt from "jsonwebtoken";
import {findAdminByEmail} from "../models/adminModel.js";
import bcrypt from "bcrypt";
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import {pool}  from "../config/db.js";

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL, 
    pass: process.env.APP_PASSWORD, 
  },
});

export const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await findAdminByEmail(email);

  if (!admin || admin.role !== 'admin') {
    return res.status(401).json({ message: 'Invalid credentials or not an admin' });
  }
  
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) return res.status(401).json({ message: 'Invalid password' });
  
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '10h' }
    );

  res.json({ token ,admin: { username: admin.username, email: admin.email }});
}

export const getAdminDashboard = (req, res) => {
  res.json({
    message: 'Welcome to the admin dashboard',
    user: req.user,
  });
}

export const createTest = async (req, res) => {
  const { 
    title, 
    description, 
    instructions, 
    rules, 
    timePerQuestion, 
    categories, 
    subcategories, 
    questions, 
    isDraft 
  } = req.body;
  
  const adminId = req.user.id;

  // Validation
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Test title is required' });
  }

  if (!categories || categories.length === 0) {
    return res.status(400).json({ message: 'At least one category is required' });
  }

  if (!subcategories || subcategories.length === 0) {
    return res.status(400).json({ message: 'At least one subcategory is required' });
  }

  if (!questions || questions.length === 0) {
    return res.status(400).json({ message: 'At least one question is required' });
  }

  // Validate categories
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    if (!category.name || !category.name.trim()) {
      return res.status(400).json({ message: `Category ${i + 1}: Category name is required` });
    }
  }

  // Validate subcategories
  for (let i = 0; i < subcategories.length; i++) {
    const subcategory = subcategories[i];
    if (!subcategory.name || !subcategory.name.trim()) {
      return res.status(400).json({ message: `Subcategory ${i + 1}: Subcategory name is required` });
    }
    if (!subcategory.categoryId) {
      return res.status(400).json({ message: `Subcategory ${i + 1}: Category is required` });
    }
  }

  // Validate questions
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    if (!question.questionText || !question.questionText.trim()) {
      return res.status(400).json({ message: `Question ${i + 1}: Question text is required` });
    }
    if (!question.categoryId) {
      return res.status(400).json({ message: `Question ${i + 1}: Category is required` });
    }
    if (!question.subcategoryId) {
      return res.status(400).json({ message: `Question ${i + 1}: Subcategory is required` });
    }
    
    // Validate that the question has the fixed options structure
    if (!question.options || question.options.length !== 5) {
      return res.status(400).json({ message: `Question ${i + 1}: Must have exactly 5 options (Strongly Agree to Strongly Disagree)` });
    }

    // Validate fixed options structure
    const expectedOptions = [
      { optionText: 'Strongly Agree', marks: 5 },
      { optionText: 'Agree', marks: 4 },
      { optionText: 'Neutral', marks: 3 },
      { optionText: 'Disagree', marks: 2 },
      { optionText: 'Strongly Disagree', marks: 1 }
    ];

    for (let j = 0; j < question.options.length; j++) {
      const option = question.options[j];
      const expected = expectedOptions[j];
      
      if (option.optionText !== expected.optionText || option.marks !== expected.marks) {
        return res.status(400).json({ 
          message: `Question ${i + 1}: Options must follow the fixed structure (Strongly Agree=5, Agree=4, Neutral=3, Disagree=2, Strongly Disagree=1)` 
        });
      }
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert test
    const testQuery = `
      INSERT INTO tests (title, description, instructions, rules, time_per_question, total_questions, is_published, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const testValues = [
      title.trim(),
      description?.trim() || null,
      instructions?.trim() || null,
      rules?.trim() || null,
      timePerQuestion || 15,
      questions.length,
      !isDraft, // is_published is opposite of isDraft
      adminId
    ];

    const testResult = await client.query(testQuery, testValues);
    const testId = testResult.rows[0].id;

    // Create maps to store frontend ID to database ID mappings
    const categoryIdMap = new Map();
    const subcategoryIdMap = new Map();

    // Insert categories into test_categories table
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      
      const categoryQuery = `
        INSERT INTO test_categories (test_id, name, description, display_order, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const categoryValues = [
        testId, // Link category to the test
        category.name.trim(),
        category.description?.trim() || null,
        category.displayOrder || i + 1,
        adminId
      ];

      const categoryResult = await client.query(categoryQuery, categoryValues);
      const dbCategoryId = categoryResult.rows[0].id;
      
      // Map frontend category ID to database category ID
      categoryIdMap.set(String(category.id), dbCategoryId);
    }

    // Insert subcategories into test_subcategories table
    for (let i = 0; i < subcategories.length; i++) {
      const subcategory = subcategories[i];
      
      // Get the database category ID from our mapping
      const dbCategoryId = categoryIdMap.get(String(subcategory.categoryId));
      
      if (!dbCategoryId) {
        throw new Error(`Category not found for subcategory: ${subcategory.name}`);
      }

      const subcategoryQuery = `
        INSERT INTO test_subcategories (test_id, category_id, name, description, display_order, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const subcategoryValues = [
        testId, // Link subcategory to the test
        dbCategoryId,
        subcategory.name.trim(),
        subcategory.description?.trim() || null,
        subcategory.displayOrder || i + 1,
        adminId
      ];

      const subcategoryResult = await client.query(subcategoryQuery, subcategoryValues);
      const dbSubcategoryId = subcategoryResult.rows[0].id;
      
      // Map frontend subcategory ID to database subcategory ID
      subcategoryIdMap.set(String(subcategory.id), dbSubcategoryId);
    }

    // Insert questions into test_questions table
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      // Get the database IDs from our mappings
      const dbCategoryId = categoryIdMap.get(String(question.categoryId));
      const dbSubcategoryId = subcategoryIdMap.get(String(question.subcategoryId));

      if (!dbCategoryId || !dbSubcategoryId) {
        throw new Error(`Category or subcategory not found for question: ${question.questionText}`);
      }

      // Calculate subcategory_order (order within the subcategory)
      const subcategoryOrderQuery = `
        SELECT COALESCE(MAX(subcategory_order), 0) + 1 as next_order
        FROM test_questions 
        WHERE test_id = $1 AND subcategory_id = $2
      `;
      
      const subcategoryOrderResult = await client.query(subcategoryOrderQuery, [testId, dbSubcategoryId]);
      const subcategoryOrder = subcategoryOrderResult.rows[0].next_order;

      const questionQuery = `
        INSERT INTO test_questions (test_id, category_id, subcategory_id, question_text, question_order, subcategory_order, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const questionValues = [
        testId,
        dbCategoryId,
        dbSubcategoryId,
        question.questionText.trim(),
        i + 1, // Global question order
        subcategoryOrder, // Order within subcategory
        adminId
      ];

      const questionResult = await client.query(questionQuery, questionValues);
      const questionId = questionResult.rows[0].id;

      // Note: We don't need to insert options since they're fixed in the database
      // The fixed_question_options table already contains the standard options
      // Questions will reference these fixed options during test taking
    }

    // Create test control entry
    const controlQuery = `
      INSERT INTO test_controls (test_id, is_registration_open, is_test_live, is_test_ended, updated_by)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    const controlValues = [testId, true, false, false, adminId];
    await client.query(controlQuery, controlValues);

    await client.query('COMMIT');

    res.status(201).json({
      message: isDraft ? 'Test saved as draft successfully' : 'Test published successfully',
      test: {
        ...testResult.rows[0],
        categoriesCreated: categories.length,
        subcategoriesCreated: subcategories.length,
        questionsCreated: questions.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating test:', error);
    
    // Handle specific database errors
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({ message: 'Invalid reference in test data' });
    }
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ message: 'Duplicate category or subcategory name within test' });
    }
    
    res.status(500).json({ 
      message: 'Internal server error while creating test',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Helper function to determine test status
const getTestStatus = (test) => {
  if (!test.is_published) return 'draft';
  if (test.is_test_ended) return 'completed';
  if (test.is_active || test.is_test_live) return 'active';
  if (test.is_published) return 'published';
  return 'draft';
};

// Get all tests with filtering and search
export const getAllTests = async (req, res) => {
  const { search, status, page = 1, limit = 10 } = req.query;
  const adminId = req.user.id;
  
  try {
    let baseQuery = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.instructions,
        t.rules,
        t.time_per_question,
        t.total_questions,
        t.total_categories,
        t.total_subcategories,
        t.is_active,
        t.is_published,
        t.is_live,
        t.test_code,
        t.created_at,
        t.updated_at,
        tc.is_test_live,
        tc.is_test_ended,
        tc.current_participants,
        COALESCE(participant_stats.total_participants, 0) as participants,
        COALESCE(participant_stats.completed_participants, 0) as completed_participants
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN (
        SELECT 
          test_id,
          COUNT(*) as total_participants,
          COUNT(CASE WHEN session_status = 'completed' THEN 1 END) as completed_participants
        FROM test_sessions
        GROUP BY test_id
      ) participant_stats ON t.id = participant_stats.test_id
      WHERE t.created_by = $1
    `;
    
    const queryParams = [adminId];
    let paramIndex = 2;
    
    // Add search filter
    if (search && search.trim()) {
      baseQuery += ` AND (LOWER(t.title) LIKE LOWER($${paramIndex}) OR LOWER(t.description) LIKE LOWER($${paramIndex}))`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }
    
    // Add status filter
    if (status && status !== 'all') {
      switch (status) {
        case 'draft':
          baseQuery += ` AND t.is_published = false`;
          break;
        case 'published':
          baseQuery += ` AND t.is_published = true AND (t.is_active = false OR t.is_active IS NULL)`;
          break;
        case 'active':
          baseQuery += ` AND t.is_active = true`;
          break;
        case 'completed':
          baseQuery += ` AND tc.is_test_ended = true`;
          break;
      }
    }
    
    baseQuery += ` ORDER BY t.updated_at DESC`;
    
    // Add pagination
    const offset = (page - 1) * limit;
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const result = await pool.query(baseQuery, queryParams);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.created_by = $1
    `;
    
    const countParams = [adminId];
    let countParamIndex = 2;
    
    if (search && search.trim()) {
      countQuery += ` AND (LOWER(t.title) LIKE LOWER($${countParamIndex}) OR LOWER(t.description) LIKE LOWER($${countParamIndex}))`;
      countParams.push(`%${search.trim()}%`);
      countParamIndex++;
    }
    
    if (status && status !== 'all') {
      switch (status) {
        case 'draft':
          countQuery += ` AND t.is_published = false`;
          break;
        case 'published':
          countQuery += ` AND t.is_published = true AND (t.is_active = false OR t.is_active IS NULL)`;
          break;
        case 'active':
          countQuery += ` AND t.is_active = true`;
          break;
        case 'completed':
          countQuery += ` AND tc.is_test_ended = true`;
          break;
      }
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalTests = parseInt(countResult.rows[0].total);
    
    // Process results to match frontend expectations
    const tests = result.rows.map(test => {
      const status = getTestStatus(test);
      
      return {
        id: test.id,
        title: test.title,
        description: test.description,
        instructions: test.instructions,
        rules: test.rules,
        test_code: test.test_code,
        testCode: test.test_code,
        time_per_question: test.time_per_question,
        timePerQuestion: test.time_per_question,
        total_questions: test.total_questions,
        totalQuestions: test.total_questions,
        total_categories: test.total_categories,
        totalCategories: test.total_categories,
        total_subcategories: test.total_subcategories,
        totalSubcategories: test.total_subcategories,
        is_active: test.is_active,
        isActive: test.is_active,
        is_published: test.is_published,
        isPublished: test.is_published,
        is_live: test.is_live,
        isLive: test.is_live,
        is_test_ended: test.is_test_ended,
        isTestEnded: test.is_test_ended,
        participants: test.participants || 0,
        completed_participants: test.completed_participants || 0,
        completedParticipants: test.completed_participants || 0,
        created_at: test.created_at,
        createdAt: test.created_at,
        updated_at: test.updated_at,
        status: status
      };
    });
    
    res.json({
      tests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTests / limit),
        totalTests,
        hasNext: (page * limit) < totalTests,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({ message: 'Internal server error while fetching tests' });
  }
};

// Get single test details
export const getTestById = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const query = `
      SELECT 
        t.*,
        tc.is_test_live,
        tc.is_test_ended,
        tc.current_participants,
        COALESCE(participant_stats.total_participants, 0) as participants,
        COALESCE(participant_stats.completed_participants, 0) as completed_participants
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN (
        SELECT 
          test_id,
          COUNT(*) as total_participants,
          COUNT(CASE WHEN session_status = 'completed' THEN 1 END) as completed_participants
        FROM test_sessions
        GROUP BY test_id
      ) participant_stats ON t.id = participant_stats.test_id
      WHERE t.id = $1 AND t.created_by = $2
    `;
    
    const result = await pool.query(query, [id, adminId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    const testData = result.rows[0];
    const status = getTestStatus(testData);
    
    const test = {
      id: testData.id,
      title: testData.title,
      description: testData.description,
      instructions: testData.instructions,
      rules: testData.rules,
      test_code: testData.test_code,
      testCode: testData.test_code,
      time_per_question: testData.time_per_question,
      timePerQuestion: testData.time_per_question,
      total_questions: testData.total_questions,
      totalQuestions: testData.total_questions,
      total_categories: testData.total_categories,
      totalCategories: testData.total_categories,
      total_subcategories: testData.total_subcategories,
      totalSubcategories: testData.total_subcategories,
      is_active: testData.is_active,
      isActive: testData.is_active,
      is_published: testData.is_published,
      isPublished: testData.is_published,
      is_live: testData.is_live,
      isLive: testData.is_live,
      is_test_ended: testData.is_test_ended,
      isTestEnded: testData.is_test_ended,
      participants: testData.participants || 0,
      completed_participants: testData.completed_participants || 0,
      completedParticipants: testData.completed_participants || 0,
      created_at: testData.created_at,
      createdAt: testData.created_at,
      updated_at: testData.updated_at,
      status: status
    };
    
    res.json({ test });
    
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ message: 'Internal server error while fetching test' });
  }
};

// Publish test
export const publishTest = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test exists and has questions - UPDATED to use test_questions table
      const testCheck = await client.query(
        'SELECT t.*, COUNT(q.id) as question_count FROM tests t LEFT JOIN test_questions q ON t.id = q.test_id WHERE t.id = $1 AND t.created_by = $2 GROUP BY t.id',
        [id, adminId]
      );
      
      if (testCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Test not found' });
      }
      
      if (testCheck.rows[0].question_count === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot publish test without questions' });
      }
      
      // Update test to published
      const updateQuery = `
        UPDATE tests 
        SET is_published = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND created_by = $2
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [id, adminId]);
      
      // Ensure test_controls record exists and update it
      await client.query(`
        INSERT INTO test_controls (test_id, is_registration_open, updated_by)
        VALUES ($1, true, $2)
        ON CONFLICT (test_id) DO UPDATE SET
        is_registration_open = true,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      `, [id, adminId]);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Test published successfully',
        test: result.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error publishing test:', error);
    res.status(500).json({ message: 'Internal server error while publishing test' });
  }
};

// Unpublish test
export const unpublishTest = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test exists and is not active
      const testCheck = await client.query(
        'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
        [id, adminId]
      );
      
      if (testCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Test not found' });
      }
      
      if (testCheck.rows[0].is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot unpublish an active test' });
      }
      
      // Update test to draft
      const updateQuery = `
        UPDATE tests 
        SET is_published = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND created_by = $2
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [id, adminId]);
      
      // Update test controls
      await client.query(`
        INSERT INTO test_controls (test_id, is_registration_open, updated_by)
        VALUES ($1, false, $2)
        ON CONFLICT (test_id) DO UPDATE SET
        is_registration_open = false,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      `, [id, adminId]);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Test unpublished successfully',
        test: result.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error unpublishing test:', error);
    res.status(500).json({ message: 'Internal server error while unpublishing test' });
  }
};

// Delete test - UPDATED to work with new linked table structure
export const deleteTest = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test exists and is not active
      const testCheck = await client.query(
        'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
        [id, adminId]
      );
      
      if (testCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Test not found' });
      }
      
      if (testCheck.rows[0].is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot delete an active test' });
      }
      
      // UPDATED: Since categories and subcategories are now test-specific,
      // we need to get categories and subcategories that belong to this test
      const testCategories = await client.query(`
        SELECT DISTINCT tc.id, tc.name
        FROM test_categories tc
        WHERE tc.test_id = $1
      `, [id]);
      
      const testSubcategories = await client.query(`
        SELECT DISTINCT tsc.id, tsc.name
        FROM test_subcategories tsc
        WHERE tsc.test_id = $1
      `, [id]);
      
      // Log what will be deleted for audit purposes
      const deletionLog = {
        test_id: id,
        test_title: testCheck.rows[0].title,
        test_categories: testCategories.rows.map(tc => ({ id: tc.id, name: tc.name })),
        test_subcategories: testSubcategories.rows.map(tsc => ({ id: tsc.id, name: tsc.name })),
        deleted_by: adminId,
        deleted_at: new Date().toISOString()
      };
      
      // Log the deletion in admin activity logs
      await client.query(`
        INSERT INTO admin_activity_logs (
          admin_id, action_type, target_table, target_id, old_data, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        adminId,
        'test_deleted_with_categories',
        'tests',
        id,
        JSON.stringify(deletionLog),
        req.ip || null,
        req.get('User-Agent') || null
      ]);
      
      // UPDATED: Delete the test first - this will cascade delete all related data
      // including test_categories, test_subcategories, and test_questions
      // due to the ON DELETE CASCADE foreign key constraints in the new schema
      await client.query('DELETE FROM tests WHERE id = $1 AND created_by = $2', [id, adminId]);
      
      await client.query('COMMIT');
      
      // Prepare response with deletion summary
      const deletionSummary = {
        message: 'Test deleted successfully',
        deleted: {
          test: {
            id: id,
            title: testCheck.rows[0].title
          },
          categories: testCategories.rows.length,
          subcategories: testSubcategories.rows.length
        }
      };
      
      // Include details if there were categories/subcategories deleted
      if (testCategories.rows.length > 0 || testSubcategories.rows.length > 0) {
        deletionSummary.details = {
          deleted_categories: testCategories.rows.map(tc => tc.name),
          deleted_subcategories: testSubcategories.rows.map(tsc => tsc.name)
        };
      }
      
      res.json(deletionSummary);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({ 
      message: 'Internal server error while deleting test',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Generate test code
// Updated backend functions for the hierarchical category system

export const generateTestCode = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test exists and is published
      const testCheck = await client.query(
        'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
        [id, adminId]
      );
      
      if (testCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Test not found' });
      }
      
      const test = testCheck.rows[0];
      
      if (!test.is_published) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Test must be published before generating code' });
      }
      
      if (test.test_code) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Test code already exists' });
      }
      
      // Generate unique test code
      let testCode;
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        testCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const existingCode = await client.query(
          'SELECT id FROM tests WHERE test_code = $1',
          [testCode]
        );
        
        if (existingCode.rows.length === 0) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Failed to generate unique test code' });
      }
      
      // Update test with generated code and set as active
      const updateQuery = `
        UPDATE tests 
        SET test_code = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND created_by = $3
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [testCode, id, adminId]);
      
      // Update test controls
      await client.query(
        `UPDATE test_controls 
         SET is_test_live = true, is_test_started = true, updated_by = $2
         WHERE test_id = $1`,
        [id, adminId]
      );
      
      // If no test_controls record exists, create one
      await client.query(
        `INSERT INTO test_controls (test_id, is_test_live, updated_by)
        SELECT $1, true, $2::INTEGER
        WHERE NOT EXISTS (SELECT 1 FROM test_controls WHERE test_id = $1)`,
        [id, adminId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Test code generated successfully',
        testCode: testCode,
        test: result.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error generating test code:', error);
    res.status(500).json({ message: 'Internal server error while generating test code' });
  }
};

// Get test details by ID - Updated for new linked structure
export const getTestDetails = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  try {
    // Get test details with comprehensive information using new table structure
    const testQuery = `
      SELECT 
        t.*,
        tc.is_registration_open as "isRegistrationOpen",
        tc.is_test_live as "isTestLive",
        tc.is_test_ended as "isTestEnded",
        tc.current_participants as "currentParticipants",
        tc.proctoring_enabled as "proctoringEnabled",
        COUNT(DISTINCT tq.id) as "totalQuestions",
        COUNT(DISTINCT tr.user_id) as "totalRegistered",
        COUNT(DISTINCT ts.user_id) as "totalParticipants",
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as "completedParticipants",
        ARRAY_AGG(DISTINCT tcat.name) FILTER (WHERE tcat.name IS NOT NULL) as "categories",
        ARRAY_AGG(DISTINCT tsub.name) FILTER (WHERE tsub.name IS NOT NULL) as "subcategories"
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN test_questions tq ON t.id = tq.test_id
      LEFT JOIN test_categories tcat ON t.id = tcat.test_id AND tcat.is_active = true
      LEFT JOIN test_subcategories tsub ON t.id = tsub.test_id AND tsub.is_active = true
      LEFT JOIN test_registrations tr ON t.id = tr.test_id
      LEFT JOIN test_sessions ts ON t.id = ts.test_id
      WHERE t.id = $1 AND t.created_by = $2
      GROUP BY t.id, tc.is_registration_open, tc.is_test_live, tc.is_test_ended,  
               tc.current_participants, tc.proctoring_enabled
    `;

    const testResult = await pool.query(testQuery, [id, adminId]);

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const test = testResult.rows[0];

    // Determine test status based on flags
    let status = 'draft';
    if (test.isTestEnded) {
      status = 'completed';
    } else if (test.isTestLive) {
      status = 'active';
    } else if (test.is_published) {
      status = 'published';
    }

    // Format the response
    const testDetails = {
      id: test.id,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      rules: test.rules,
      timePerQuestion: test.time_per_question,
      totalQuestions: parseInt(test.totalQuestions) || 0,
      total_categories: test.total_categories,
      total_subcategories: test.total_subcategories,
      is_active: test.is_active,
      isActive: test.isTestLive || false,
      is_published: test.is_published,
      isTestEnded: test.isTestEnded || false,
      testCode: test.test_code,
      categories: test.categories || [],
      subcategories: test.subcategories || [],
      status: status,
      createdAt: test.created_at,
      updatedAt: test.updated_at,
      createdBy: test.created_by,
      // Additional stats
      totalRegistered: parseInt(test.totalRegistered) || 0,
      totalParticipants: parseInt(test.totalParticipants) || 0,
      completedParticipants: parseInt(test.completedParticipants) || 0,
      currentParticipants: test.currentParticipants || 0,
      proctoringEnabled: test.proctoringEnabled || false,
    };

    res.json(testDetails);

  } catch (error) {
    console.error('Error fetching test details:', error);
    res.status(500).json({ message: 'Internal server error while fetching test details' });
  }
};

// Get test questions - Updated for new linked structure
export const getTestQuestions = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query(
      'SELECT id FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Get questions with category and subcategory information using new table structure
    const questionsQuery = `
      SELECT 
        tq.id,
        tq.question_text as "questionText",
        tq.category_id as "categoryId",
        tq.subcategory_id as "subcategoryId",
        tq.question_order as "questionOrder",
        tq.subcategory_order as "subcategoryOrder",
        tq.created_at as "createdAt",
        tq.updated_at as "updatedAt",
        tcat.name as "categoryName",
        tcat.display_order as "categoryOrder",
        tsub.name as "subcategoryName",
        tsub.display_order as "subcategoryDisplayOrder"
      FROM test_questions tq
      LEFT JOIN test_categories tcat ON tq.category_id = tcat.id
      LEFT JOIN test_subcategories tsub ON tq.subcategory_id = tsub.id
      WHERE tq.test_id = $1
      ORDER BY tq.question_order
    `;

    const questionsResult = await pool.query(questionsQuery, [id]);

    // Get fixed options for all questions
    const optionsQuery = `
      SELECT 
        id,
        option_label as "label",
        option_text as "text",
        marks,
        display_order as "order"
      FROM fixed_question_options 
      WHERE is_active = true
      ORDER BY display_order
    `;

    const optionsResult = await pool.query(optionsQuery);
    const fixedOptions = optionsResult.rows;

    // Add fixed options to each question
    const questionsWithOptions = questionsResult.rows.map(question => ({
      ...question,
      options: fixedOptions
    }));

    res.json({
      questions: questionsWithOptions
    });

  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({ message: 'Internal server error while fetching questions' });
  }
};

// Activate test (start test) - Updated
export const activateTest = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test is published and has a test code
      const testCheck = await client.query(
        'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
        [id, adminId]
      );
      
      if (testCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Test not found' });
      }
      
      const test = testCheck.rows[0];
      
      if (!test.is_published) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Test must be published before activation' });
      }
      
      if (!test.test_code) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Test code must be generated before activation' });
      }
      
      // Update test to active
      const updateQuery = `
        UPDATE tests 
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND created_by = $2
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [id, adminId]);
      
      // Update test controls
      await client.query(
        `UPDATE test_controls 
         SET is_test_live = true, is_test_started = true, updated_by = $2
         WHERE test_id = $1`,
        [id, adminId]
      );
      
      // If no test_controls record exists, create one
      await client.query(
        `INSERT INTO test_controls (test_id, is_test_live, is_test_started, updated_by)
        SELECT $1, true, true, $2::INTEGER
        WHERE NOT EXISTS (SELECT 1 FROM test_controls WHERE test_id = $1)`,
        [id, adminId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Test activated successfully',
        test: result.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error activating test:', error);
    res.status(500).json({ message: 'Internal server error while activating test' });
  }
};

// End test - Updated
export const endTest = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test exists and is active
      const testCheck = await client.query(
        'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
        [id, adminId]
      );
      
      if (testCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Test not found' });
      }
      
      if (!testCheck.rows[0].is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Test is not active' });
      }
      
      // End all active sessions
      await client.query(
        `UPDATE test_sessions 
         SET session_status = 'terminated', updated_at = CURRENT_TIMESTAMP
         WHERE test_id = $1 AND session_status = 'in_progress'`,
        [id]
      );
      
      // Update test to inactive
      const updateQuery = `
        UPDATE tests 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND created_by = $2
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [id, adminId]);
      
      // Update test controls
      await client.query(
        `UPDATE test_controls 
         SET is_test_live = false, is_test_ended = true, updated_by = $2
         WHERE test_id = $1`,
        [id, adminId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Test ended successfully',
        test: result.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error ending test:', error);
    res.status(500).json({ message: 'Internal server error while ending test' });
  }
};

// Get test participants - Updated for new table structure
export const getTestParticipants = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query(
      'SELECT id, total_questions FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const totalQuestions = testCheck.rows[0].total_questions;
    
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at as "userCreatedAt",
        
        -- Session information
        ts.id as "sessionId",
        ts.session_status as "sessionStatus",
        ts.current_question_order as "currentQuestion",
        ts.created_at as "sessionCreatedAt",
        ts.completed_at as "completedAt",
        
        -- Registration information
        tr.id as "registrationId",
        tr.registration_status as "registrationStatus",
        tr.registered_at as "registeredAt",
        tr.approved_at as "approvedAt",
        
        -- Response count for progress calculation
        (SELECT COUNT(*) FROM user_responses ur WHERE ur.session_id = ts.id) as "answeredQuestions",
        
        -- Calculate status priority: session_status > registration_status > 'not_registered'
        CASE 
          WHEN ts.session_status IS NOT NULL THEN ts.session_status
          WHEN tr.registration_status IS NOT NULL THEN tr.registration_status
          ELSE 'not_registered'
        END as "status"
        
      FROM users u
      LEFT JOIN test_sessions ts ON u.id = ts.user_id AND ts.test_id = $1
      LEFT JOIN test_registrations tr ON u.id = tr.user_id AND tr.test_id = $1
      WHERE (ts.id IS NOT NULL OR tr.id IS NOT NULL)
      ORDER BY 
        CASE 
          WHEN ts.session_status = 'in_progress' THEN 1
          WHEN ts.session_status = 'completed' THEN 2
          WHEN tr.registration_status = 'registered' THEN 3
          WHEN tr.registration_status = 'approved' THEN 4
          ELSE 5
        END,
        ts.created_at DESC NULLS LAST,
        tr.registered_at DESC NULLS LAST
    `;
    
    const result = await pool.query(query, [id]);
    
    const participants = result.rows.map(participant => {
      // Calculate progress information
      let progress = {
        current: 0,
        total: totalQuestions || 0,
        percentage: 0
      };
      
      if (participant.sessionStatus === 'completed') {
        progress.current = totalQuestions || 0;
        progress.percentage = 100;
      } else if (participant.sessionStatus === 'in_progress') {
        progress.current = participant.answeredQuestions || participant.currentQuestion || 0;
        progress.percentage = totalQuestions > 0 ? Math.round((progress.current / totalQuestions) * 100) : 0;
      }
      
      // Determine final status with more clarity
      let finalStatus = participant.status;
      if (participant.sessionStatus) {
        finalStatus = participant.sessionStatus;
      } else if (participant.registrationStatus) {
        finalStatus = participant.registrationStatus;
      }
      
      return {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        
        // Session data
        sessionId: participant.sessionId,
        
        // Registration data
        registrationId: participant.registrationId,
        registeredAt: participant.registeredAt || participant.sessionCreatedAt,
        approvedAt: participant.approvedAt,
        completedAt: participant.completedAt,
        
        // Computed fields
        status: finalStatus,
        progress: progress,
        currentQuestion: participant.currentQuestion || 0,
        answeredQuestions: participant.answeredQuestions || 0,
        
        // Status flags for easy filtering
        isCompleted: participant.sessionStatus === 'completed',
        isInProgress: participant.sessionStatus === 'in_progress',
        isRegistered: !!participant.registrationId,
        hasStarted: !!participant.sessionId
      };
    });
    
    // Additional summary statistics
    const summary = {
      total: participants.length,
      completed: participants.filter(p => p.isCompleted).length,
      inProgress: participants.filter(p => p.isInProgress).length,
      registered: participants.filter(p => p.isRegistered && !p.hasStarted).length,
    };
    
    res.json({ 
      participants,
      summary,
      totalQuestions: totalQuestions || 0
    });
    
  } catch (error) {
    console.error('Error fetching test participants:', error);
    res.status(500).json({ message: 'Internal server error while fetching participants' });
  }
};

// Get categories specific to a test - Updated for new table structure
export const getTestCategories = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query(
      'SELECT id FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Get categories for this specific test using new table structure
    const query = `
      SELECT 
        tc.id,
        tc.name,
        tc.description,
        tc.display_order,
        tc.is_active,
        tc.created_at,
        tc.updated_at,
        COUNT(tq.id) as question_count,
        COUNT(DISTINCT tsc.id) as subcategory_count
      FROM test_categories tc
      LEFT JOIN test_questions tq ON tc.id = tq.category_id
      LEFT JOIN test_subcategories tsc ON tc.id = tsc.category_id AND tsc.is_active = true
      WHERE tc.test_id = $1 AND tc.is_active = true
      GROUP BY tc.id, tc.name, tc.description, tc.display_order, tc.is_active, tc.created_at, tc.updated_at
      ORDER BY tc.display_order, tc.name
    `;
    
    const result = await pool.query(query, [id]);
    
    res.json({
      categories: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching test categories:', error);
    res.status(500).json({ message: 'Internal server error while fetching categories' });
  }
};

// Get subcategories specific to a test - Updated for new table structure
export const getTestSubcategories = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query(
      'SELECT id FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Get subcategories for this specific test using new table structure
    const query = `
      SELECT 
        tsc.id,
        tsc.category_id,
        tsc.name,
        tsc.description,
        tsc.display_order,
        tsc.is_active,
        tsc.created_at,
        tsc.updated_at,
        tc.name as category_name,
        tc.display_order as category_display_order,
        COUNT(tq.id) as question_count
      FROM test_subcategories tsc
      LEFT JOIN test_categories tc ON tsc.category_id = tc.id
      LEFT JOIN test_questions tq ON tsc.id = tq.subcategory_id
      WHERE tsc.test_id = $1 AND tsc.is_active = true
      GROUP BY tsc.id, tsc.category_id, tsc.name, tsc.description, tsc.display_order, 
               tsc.is_active, tsc.created_at, tsc.updated_at, tc.name, tc.display_order
      ORDER BY tc.display_order, tsc.display_order, tsc.name
    `;
    
    const result = await pool.query(query, [id]);
    
    res.json({
      subcategories: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching test subcategories:', error);
    res.status(500).json({ message: 'Internal server error while fetching subcategories' });
  }
};

// Get test details for editing
// Backend functions for EditTest functionality
// Add these to your adminController.js file

// Get test data for editing
export const getTestForEdit = async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ message: 'Test ID is required' });
  }

  const client = await pool.connect();

  try {
    // Get test basic info
    const testQuery = `
      SELECT 
        id, title, description, instructions, rules, time_per_question as "timePerQuestion",
        is_active as "isActive", is_published as "isPublished",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM tests 
      WHERE id = $1
    `;
    
    const testResult = await client.query(testQuery, [id]);
    
    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const test = testResult.rows[0];

    // Get categories
    const categoriesQuery = `
      SELECT 
        id, name, description, display_order as "displayOrder"
      FROM test_categories 
      WHERE test_id = $1 AND is_active = true
      ORDER BY display_order
    `;
    
    const categoriesResult = await client.query(categoriesQuery, [id]);
    const categories = categoriesResult.rows;

    // Get subcategories
    const subcategoriesQuery = `
      SELECT 
        id, category_id as "categoryId", name, description, 
        display_order as "displayOrder"
      FROM test_subcategories 
      WHERE test_id = $1 AND is_active = true
      ORDER BY category_id, display_order
    `;
    
    const subcategoriesResult = await client.query(subcategoriesQuery, [id]);
    const subcategories = subcategoriesResult.rows;

    // Get questions
    const questionsQuery = `
      SELECT 
        id, category_id as "categoryId", subcategory_id as "subcategoryId",
        question_text as "questionText", question_order as "questionOrder",
        subcategory_order as "subcategoryOrder"
      FROM test_questions 
      WHERE test_id = $1
      ORDER BY question_order
    `;
    
    const questionsResult = await client.query(questionsQuery, [id]);
    const questions = questionsResult.rows;

    res.json({
      ...test,
      categories,
      subcategories,
      questions
    });

  } catch (error) {
    console.error('Error fetching test data:', error);
    res.status(500).json({ 
      message: 'Internal server error while fetching test data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Update test basic information
export const updateTestInfo = async (req, res) => {
  const { id } = req.params;
  const { 
    title, 
    description, 
    instructions, 
    rules, 
    timePerQuestion, 
    isActive, 
    isPublished 
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Test ID is required' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Test title is required' });
  }

  const client = await pool.connect();

  try {
    const updateQuery = `
      UPDATE tests 
      SET 
        title = $1,
        description = $2,
        instructions = $3,
        rules = $4,
        time_per_question = $5,
        is_active = $6,
        is_published = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      title.trim(),
      description?.trim() || null,
      instructions?.trim() || null,
      rules?.trim() || null,
      timePerQuestion || 15,
      isActive || false,
      isPublished || false,
      id
    ];

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({
      message: 'Test information updated successfully',
      test: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating test info:', error);
    res.status(500).json({ 
      message: 'Internal server error while updating test information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Add category to test
export const addCategory = async (req, res) => {
  const { id } = req.params; // test id
  const { name, description, displayOrder } = req.body;
  const adminId = req.user.id;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  const client = await pool.connect();

  try {
    // Check if test exists
    const testCheck = await client.query('SELECT id FROM tests WHERE id = $1', [id]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Get next display order if not provided
    let finalDisplayOrder = displayOrder;
    if (!finalDisplayOrder) {
      const orderQuery = `
        SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
        FROM test_categories 
        WHERE test_id = $1
      `;
      const orderResult = await client.query(orderQuery, [id]);
      finalDisplayOrder = orderResult.rows[0].next_order;
    }

    const insertQuery = `
      INSERT INTO test_categories (test_id, name, description, display_order, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, description, display_order as "displayOrder"
    `;

    const values = [id, name.trim(), description?.trim() || null, finalDisplayOrder, adminId];
    const result = await client.query(insertQuery, values);

    res.status(201).json({
      message: 'Category added successfully',
      category: result.rows[0]
    });

  } catch (error) {
    console.error('Error adding category:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ message: 'Category name already exists in this test' });
    }
    
    res.status(500).json({ 
      message: 'Internal server error while adding category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Update category
export const updateCategory = async (req, res) => {
  const { id, categoryId } = req.params;
  const { name, description, displayOrder } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  const client = await pool.connect();

  try {
    const updateQuery = `
      UPDATE test_categories 
      SET 
        name = $1,
        description = $2,
        display_order = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND test_id = $5
      RETURNING id, name, description, display_order as "displayOrder"
    `;

    const values = [name.trim(), description?.trim() || null, displayOrder, categoryId, id];
    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category updated successfully',
      category: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating category:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Category name already exists in this test' });
    }
    
    res.status(500).json({ 
      message: 'Internal server error while updating category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  const { id, categoryId } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if category has subcategories or questions
    const dependenciesQuery = `
      SELECT 
        (SELECT COUNT(*) FROM test_subcategories WHERE category_id = $1) as subcategory_count,
        (SELECT COUNT(*) FROM test_questions WHERE category_id = $1) as question_count
    `;
    
    const dependenciesResult = await client.query(dependenciesQuery, [categoryId]);
    const { subcategory_count, question_count } = dependenciesResult.rows[0];

    if (parseInt(subcategory_count) > 0 || parseInt(question_count) > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. It has ${subcategory_count} subcategories and ${question_count} questions. Please delete them first.` 
      });
    }

    // Delete the category
    const deleteQuery = `
      DELETE FROM test_categories 
      WHERE id = $1 AND test_id = $2
      RETURNING id
    `;
    
    const result = await client.query(deleteQuery, [categoryId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Category deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting category:', error);
    res.status(500).json({ 
      message: 'Internal server error while deleting category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Add subcategory to test
export const addSubcategory = async (req, res) => {
  const { id } = req.params; // test id
  const { categoryId, name, description, displayOrder } = req.body;
  const adminId = req.user.id;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Subcategory name is required' });
  }

  if (!categoryId) {
    return res.status(400).json({ message: 'Category is required' });
  }

  const client = await pool.connect();

  try {
    // Check if category exists and belongs to the test
    const categoryCheck = await client.query(
      'SELECT id FROM test_categories WHERE id = $1 AND test_id = $2', 
      [categoryId, id]
    );
    
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found in this test' });
    }

    // Get next display order if not provided
    let finalDisplayOrder = displayOrder;
    if (!finalDisplayOrder) {
      const orderQuery = `
        SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
        FROM test_subcategories 
        WHERE test_id = $1 AND category_id = $2
      `;
      const orderResult = await client.query(orderQuery, [id, categoryId]);
      finalDisplayOrder = orderResult.rows[0].next_order;
    }

    const insertQuery = `
      INSERT INTO test_subcategories (test_id, category_id, name, description, display_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, category_id as "categoryId", name, description, display_order as "displayOrder"
    `;

    const values = [id, categoryId, name.trim(), description?.trim() || null, finalDisplayOrder, adminId];
    const result = await client.query(insertQuery, values);

    // Return the subcategory with proper structure that matches frontend expectations
    const subcategory = {
      id: result.rows[0].id,
      categoryId: result.rows[0].categoryId,
      name: result.rows[0].name,
      description: result.rows[0].description,
      displayOrder: result.rows[0].displayOrder
    };

    res.status(201).json(subcategory); // Return just the subcategory object

  } catch (error) {
    console.error('Error adding subcategory:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Subcategory name already exists in this category' });
    }
    
    res.status(500).json({ 
      message: 'Internal server error while adding subcategory',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Fixed updateSubcategory function
export const updateSubcategory = async (req, res) => {
  const { id, subcategoryId } = req.params;
  const { categoryId, name, description, displayOrder } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Subcategory name is required' });
  }

  const client = await pool.connect();

  try {
    const updateQuery = `
      UPDATE test_subcategories 
      SET 
        category_id = $1,
        name = $2,
        description = $3,
        display_order = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND test_id = $6
      RETURNING id, category_id as "categoryId", name, description, display_order as "displayOrder"
    `;

    const values = [categoryId, name.trim(), description?.trim() || null, displayOrder, subcategoryId, id];
    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    // Return the subcategory with proper structure
    const subcategory = {
      id: result.rows[0].id,
      categoryId: result.rows[0].categoryId,
      name: result.rows[0].name,
      description: result.rows[0].description,
      displayOrder: result.rows[0].displayOrder
    };

    res.json(subcategory); // Return just the subcategory object

  } catch (error) {
    console.error('Error updating subcategory:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Subcategory name already exists in this category' });
    }
    
    res.status(500).json({ 
      message: 'Internal server error while updating subcategory',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Delete subcategory
export const deleteSubcategory = async (req, res) => {
  const { id, subcategoryId } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if subcategory has questions
    const questionsQuery = `
      SELECT COUNT(*) as question_count
      FROM test_questions 
      WHERE subcategory_id = $1
    `;
    
    const questionsResult = await client.query(questionsQuery, [subcategoryId]);
    const questionCount = parseInt(questionsResult.rows[0].question_count);

    if (questionCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete subcategory. It has ${questionCount} questions. Please delete them first.` 
      });
    }

    // Delete the subcategory
    const deleteQuery = `
      DELETE FROM test_subcategories 
      WHERE id = $1 AND test_id = $2
      RETURNING id
    `;
    
    const result = await client.query(deleteQuery, [subcategoryId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Subcategory deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ 
      message: 'Internal server error while deleting subcategory',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Add question to test
export const addQuestion = async (req, res) => {
  const { id } = req.params; // test id
  const { categoryId, subcategoryId, questionText, questionOrder, subcategoryOrder } = req.body;
  const adminId = req.user.id;

  if (!questionText || !questionText.trim()) {
    return res.status(400).json({ message: 'Question text is required' });
  }

  if (!categoryId) {
    return res.status(400).json({ message: 'Category is required' });
  }

  if (!subcategoryId) {
    return res.status(400).json({ message: 'Subcategory is required' });
  }

  const client = await pool.connect();

  try {
    // Verify subcategory belongs to the category and test
    const verifyQuery = `
      SELECT ts.id 
      FROM test_subcategories ts
      JOIN test_categories tc ON ts.category_id = tc.id
      WHERE ts.id = $1 AND tc.id = $2 AND ts.test_id = $3
    `;
    
    const verifyResult = await client.query(verifyQuery, [subcategoryId, categoryId, id]);
    
    if (verifyResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid category/subcategory combination for this test' });
    }

    // Get next question order if not provided
    let finalQuestionOrder = questionOrder;
    if (!finalQuestionOrder) {
      const questionOrderQuery = `
        SELECT COALESCE(MAX(question_order), 0) + 1 as next_order
        FROM test_questions 
        WHERE test_id = $1
      `;
      const questionOrderResult = await client.query(questionOrderQuery, [id]);
      finalQuestionOrder = questionOrderResult.rows[0].next_order;
    }

    // Get next subcategory order if not provided
    let finalSubcategoryOrder = subcategoryOrder;
    if (!finalSubcategoryOrder) {
      const subcategoryOrderQuery = `
        SELECT COALESCE(MAX(subcategory_order), 0) + 1 as next_order
        FROM test_questions 
        WHERE test_id = $1 AND subcategory_id = $2
      `;
      const subcategoryOrderResult = await client.query(subcategoryOrderQuery, [id, subcategoryId]);
      finalSubcategoryOrder = subcategoryOrderResult.rows[0].next_order;
    }

    const insertQuery = `
      INSERT INTO test_questions (test_id, category_id, subcategory_id, question_text, question_order, subcategory_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, category_id as "categoryId", subcategory_id as "subcategoryId", 
                question_text as "questionText", question_order as "questionOrder", 
                subcategory_order as "subcategoryOrder"
    `;

    const values = [id, categoryId, subcategoryId, questionText.trim(), finalQuestionOrder, finalSubcategoryOrder, adminId];
    const result = await client.query(insertQuery, values);

    // Return the question with proper structure
    const question = {
      id: result.rows[0].id,
      categoryId: result.rows[0].categoryId,
      subcategoryId: result.rows[0].subcategoryId,
      questionText: result.rows[0].questionText,
      questionOrder: result.rows[0].questionOrder,
      subcategoryOrder: result.rows[0].subcategoryOrder
    };

    res.status(201).json(question); // Return just the question object

  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ 
      message: 'Internal server error while adding question',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Fixed updateQuestion function
export const updateQuestion = async (req, res) => {
  const { id, questionId } = req.params;
  const { categoryId, subcategoryId, questionText, questionOrder, subcategoryOrder } = req.body;

  if (!questionText || !questionText.trim()) {
    return res.status(400).json({ message: 'Question text is required' });
  }

  const client = await pool.connect();

  try {
    // Verify subcategory belongs to the category and test if they're being changed
    if (categoryId && subcategoryId) {
      const verifyQuery = `
        SELECT ts.id 
        FROM test_subcategories ts
        JOIN test_categories tc ON ts.category_id = tc.id
        WHERE ts.id = $1 AND tc.id = $2 AND ts.test_id = $3
      `;
      
      const verifyResult = await client.query(verifyQuery, [subcategoryId, categoryId, id]);
      
      if (verifyResult.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid category/subcategory combination for this test' });
      }
    }

    const updateQuery = `
      UPDATE test_questions 
      SET 
        category_id = COALESCE($1, category_id),
        subcategory_id = COALESCE($2, subcategory_id),
        question_text = $3,
        question_order = COALESCE($4, question_order),
        subcategory_order = COALESCE($5, subcategory_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND test_id = $7
      RETURNING id, category_id as "categoryId", subcategory_id as "subcategoryId", 
                question_text as "questionText", question_order as "questionOrder", 
                subcategory_order as "subcategoryOrder"
    `;

    const values = [categoryId, subcategoryId, questionText.trim(), questionOrder, subcategoryOrder, questionId, id];
    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Return the question with proper structure
    const question = {
      id: result.rows[0].id,
      categoryId: result.rows[0].categoryId,
      subcategoryId: result.rows[0].subcategoryId,
      questionText: result.rows[0].questionText,
      questionOrder: result.rows[0].questionOrder,
      subcategoryOrder: result.rows[0].subcategoryOrder
    };

    res.json(question); // Return just the question object

  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ 
      message: 'Internal server error while updating question',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

// Delete question
export const deleteQuestion = async (req, res) => {
  const { id, questionId } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if question has responses
    const responsesQuery = `
      SELECT COUNT(*) as response_count
      FROM user_responses 
      WHERE question_id = $1
    `;
    
    const responsesResult = await client.query(responsesQuery, [questionId]);
    const responseCount = parseInt(responsesResult.rows[0].response_count);

    if (responseCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete question. It has ${responseCount} user responses. Questions with responses cannot be deleted.` 
      });
    }

    // Delete the question
    const deleteQuery = `
      DELETE FROM test_questions 
      WHERE id = $1 AND test_id = $2
      RETURNING id
    `;
    
    const result = await client.query(deleteQuery, [questionId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Question deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting question:', error);
    res.status(500).json({ 
      message: 'Internal server error while deleting question',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

export const reorderQuestion = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { testId, questionId } = req.params;
    const { subcategoryOrder } = req.body;
    
    // Validate inputs
    if (!subcategoryOrder || subcategoryOrder < 1) {
      return res.status(400).json({ 
        message: 'Valid subcategory order is required' 
      });
    }

    // Get current question details
    const currentQuestionQuery = `
      SELECT subcategory_id, subcategory_order 
      FROM test_questions 
      WHERE id = $1 AND test_id = $2
    `;
    const currentResult = await client.query(currentQuestionQuery, [questionId, testId]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    const { subcategory_id, subcategory_order: currentOrder } = currentResult.rows[0];
    
    // If order hasn't changed, return success
    if (currentOrder === subcategoryOrder) {
      await client.query('COMMIT');
      return res.json({ message: 'Question order unchanged' });
    }
    
    // Check if target order position is available
    const conflictQuery = `
      SELECT id FROM test_questions 
      WHERE test_id = $1 AND subcategory_id = $2 AND subcategory_order = $3 AND id != $4
    `;
    const conflictResult = await client.query(conflictQuery, [testId, subcategory_id, subcategoryOrder, questionId]);
    
    if (conflictResult.rows.length > 0) {
      // Shift other questions to make room
      if (subcategoryOrder < currentOrder) {
        // Moving up - shift questions down
        const shiftQuery = `
          UPDATE test_questions 
          SET subcategory_order = subcategory_order + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE test_id = $1 AND subcategory_id = $2 
            AND subcategory_order >= $3 AND subcategory_order < $4
        `;
        await client.query(shiftQuery, [testId, subcategory_id, subcategoryOrder, currentOrder]);
      } else {
        // Moving down - shift questions up
        const shiftQuery = `
          UPDATE test_questions 
          SET subcategory_order = subcategory_order - 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE test_id = $1 AND subcategory_id = $2 
            AND subcategory_order > $3 AND subcategory_order <= $4
        `;
        await client.query(shiftQuery, [testId, subcategory_id, currentOrder, subcategoryOrder]);
      }
    }
    
    // Update the target question
    const updateQuery = `
      UPDATE test_questions 
      SET subcategory_order = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND test_id = $3
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [subcategoryOrder, questionId, testId]);
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Question reordered successfully',
      question: updateResult.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering question:', error);
    res.status(500).json({ 
      message: 'Failed to reorder question',
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Get test results with basic test info
export const getTestResults = async (req, res) => {
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    const query = `
      SELECT 
        t.*,
        tc.is_test_live,
        tc.is_test_ended,
        tc.current_participants,
        tc.completed_participants
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.created_by = $2
    `;
    
    const result = await pool.query(query, [testId, adminId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    const testData = result.rows[0];
    
    res.json({ 
      test: {
        id: testData.id,
        title: testData.title,
        description: testData.description,
        test_code: testData.test_code,
        total_questions: testData.total_questions,
        total_categories: testData.total_categories,
        total_subcategories: testData.total_subcategories,
        is_live: testData.is_live,
        is_test_ended: testData.is_test_ended,
        participants: testData.current_participants || 0,
        completed_participants: testData.completed_participants || 0,
        created_at: testData.created_at
      }
    });
    
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({ message: 'Internal server error while fetching test results' });
  }
};

// Get participants list with pagination and search
export const getTestParticipantsForResults = async (req, res) => {
  const testId = req.params.id;
  const { page = 1, limit = 10, search = '' } = req.query;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query('SELECT id FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Convert to integers early
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const offsetInt = (pageInt - 1) * limitInt;
    
    let whereClause = 'WHERE ts.test_id = $1';
    let queryParams = [testId];
    let paramIndex = 2;
    
    if (search.trim()) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const participantsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        ts.session_status,
        ts.started_at,
        ts.completed_at,
        ts.questions_answered,
        ts.total_questions,
        COALESCE(AVG(cr.average_percentage), 0) as overall_percentage
      FROM users u
      JOIN test_sessions ts ON u.id = ts.user_id
      LEFT JOIN category_results cr ON ts.id = cr.session_id
      ${whereClause}
      GROUP BY u.id, u.name, u.email, u.phone, ts.session_status, ts.started_at, ts.completed_at, ts.questions_answered, ts.total_questions
      ORDER BY ts.completed_at DESC NULLS LAST, ts.started_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Add LIMIT and OFFSET as integers
    queryParams.push(limitInt, offsetInt);
    
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      JOIN test_sessions ts ON u.id = ts.user_id
      ${whereClause}
    `;
    
    // For count query, use params without LIMIT and OFFSET
    const countParams = queryParams.slice(0, -2);
    
    const [participants, countResult] = await Promise.all([
      pool.query(participantsQuery, queryParams),
      pool.query(countQuery, countParams)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitInt);
    
    res.json({
      participants: participants.rows,
      pagination: {
        currentPage: pageInt,
        totalPages,
        totalItems: total,
        itemsPerPage: limitInt,
        hasNextPage: pageInt < totalPages,
        hasPreviousPage: pageInt > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ message: 'Internal server error while fetching participants' });
  }
};

// Get individual participant detailed results
export const getParticipantResults = async (req, res) => {
  const { participantId } = req.params;
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query('SELECT id FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Get participant session
    const sessionQuery = `
      SELECT ts.*, u.name, u.email, u.phone
      FROM test_sessions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.test_id = $1 AND ts.user_id = $2
    `;
    
    const sessionResult = await pool.query(sessionQuery, [testId, participantId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Participant not found' });
    }
    
    const sessionData = sessionResult.rows[0];
    
    // Get category results
    const categoryQuery = `
      SELECT 
        cr.*,
        tc.name as category_name
      FROM category_results cr
      JOIN test_categories tc ON cr.category_id = tc.id
      WHERE cr.session_id = $1
      ORDER BY tc.display_order
    `;
    
    // Get subcategory results
    const subcategoryQuery = `
      SELECT 
        sr.*,
        tsc.name as subcategory_name,
        tc.name as category_name
      FROM subcategory_results sr
      JOIN test_subcategories tsc ON sr.subcategory_id = tsc.id
      JOIN test_categories tc ON sr.category_id = tc.id
      WHERE sr.session_id = $1
      ORDER BY tc.display_order, tsc.display_order
    `;
    
    // Get question-wise results
    const questionResultsQuery = `
      SELECT 
        ur.question_id,
        ur.marks_obtained,
        ur.selected_option_label,
        ur.time_taken,
        ur.answered_at,
        tq.question_text,
        tq.question_order,
        tc.name as category_name,
        tsc.name as subcategory_name,
        fqo.option_text as selected_option_text,
        fqo.marks as option_marks
      FROM user_responses ur
      JOIN test_questions tq ON ur.question_id = tq.id
      JOIN test_categories tc ON ur.category_id = tc.id
      JOIN test_subcategories tsc ON ur.subcategory_id = tsc.id
      JOIN fixed_question_options fqo ON ur.selected_option_id = fqo.id
      WHERE ur.session_id = $1
      ORDER BY tq.question_order
    `;
    
    const [categoryResults, subcategoryResults, questionResults] = await Promise.all([
      pool.query(categoryQuery, [sessionData.id]),
      pool.query(subcategoryQuery, [sessionData.id]),
      pool.query(questionResultsQuery, [sessionData.id])
    ]);
    
    // Calculate overall percentage
    const overallPercentage = categoryResults.rows.length > 0 
      ? categoryResults.rows.reduce((sum, cat) => sum + parseFloat(cat.average_percentage), 0) / categoryResults.rows.length
      : 0;
    
    res.json({
      participant: {
        id: sessionData.user_id,
        name: sessionData.name,
        email: sessionData.email,
        phone: sessionData.phone
      },
      session: {
        status: sessionData.session_status,
        started_at: sessionData.started_at,
        completed_at: sessionData.completed_at,
        questions_answered: sessionData.questions_answered,
        total_questions: sessionData.total_questions
      },
      overallPercentage: overallPercentage.toFixed(2),
      categoryResults: categoryResults.rows.map(cat => ({
        categoryId: cat.category_id,
        categoryName: cat.category_name,
        totalSubcategories: cat.total_subcategories,
        totalQuestions: cat.total_questions,
        totalMarksObtained: cat.total_marks_obtained,
        maxPossibleMarks: cat.max_possible_marks,
        averagePercentage: parseFloat(cat.average_percentage).toFixed(2)
      })),
      subcategoryResults: subcategoryResults.rows.map(sub => ({
        subcategoryId: sub.subcategory_id,
        subcategoryName: sub.subcategory_name,
        categoryName: sub.category_name,
        totalQuestions: sub.total_questions,
        totalMarksObtained: sub.total_marks_obtained,
        maxPossibleMarks: sub.max_possible_marks,
        percentageScore: parseFloat(sub.percentage_score).toFixed(2)
      })),
      questionResults: questionResults.rows.map(q => ({
        questionId: q.question_id,
        questionOrder: q.question_order,
        questionText: q.question_text,
        categoryName: q.category_name,
        subcategoryName: q.subcategory_name,
        selectedOptionLabel: q.selected_option_label,
        selectedOptionText: q.selected_option_text,
        marksObtained: q.marks_obtained,
        maxMarks: 5, // Fixed max marks per question
        timeTaken: q.time_taken,
        answeredAt: q.answered_at
      }))
    });
    
  } catch (error) {
    console.error('Error fetching participant results:', error);
    res.status(500).json({ message: 'Internal server error while fetching participant results' });
  }
};

// Get overall test results
export const getOverallTestResults = async (req, res) => {
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query('SELECT title FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT ts.user_id) as total_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as completed_participants,
        AVG(CASE WHEN ts.session_status = 'completed' THEN ts.questions_answered END) as avg_questions_answered,
        AVG(CASE WHEN cr.average_percentage IS NOT NULL THEN cr.average_percentage END) as overall_average_percentage
      FROM test_sessions ts
      LEFT JOIN category_results cr ON ts.id = cr.session_id
      WHERE ts.test_id = $1
    `;
    
    // Get category averages
    const categoryAveragesQuery = `
      SELECT 
        tc.name as category_name,
        AVG(cr.average_percentage) as average_score,
        COUNT(DISTINCT cr.session_id) as participant_count
      FROM test_categories tc
      LEFT JOIN category_results cr ON tc.id = cr.category_id
      LEFT JOIN test_sessions ts ON cr.session_id = ts.id AND ts.session_status = 'completed'
      WHERE tc.test_id = $1
      GROUP BY tc.id, tc.name, tc.display_order
      ORDER BY tc.display_order
    `;
    
    // Get performance distribution
    const performanceQuery = `
  SELECT 
    performance_range,
    COUNT(*) as count
  FROM (
    SELECT 
      ts.id,
      AVG(cr.average_percentage) as avg_percentage,
      CASE 
        WHEN AVG(cr.average_percentage) >= 80 THEN 'Excellent (80-100%)'
        WHEN AVG(cr.average_percentage) >= 60 THEN 'Good (60-79%)'
        WHEN AVG(cr.average_percentage) >= 40 THEN 'Average (40-59%)'
        ELSE 'Below Average (0-39%)'
      END as performance_range
    FROM test_sessions ts
    JOIN category_results cr ON ts.id = cr.session_id
    WHERE ts.test_id = $1 AND ts.session_status = 'completed'
    GROUP BY ts.id
  ) session_averages
  GROUP BY performance_range
  ORDER BY 
    CASE performance_range
      WHEN 'Excellent (80-100%)' THEN 1
      WHEN 'Good (60-79%)' THEN 2
      WHEN 'Average (40-59%)' THEN 3
      ELSE 4
    END
`;
    
    const [statsResult, categoryAveragesResult, performanceResult] = await Promise.all([
      pool.query(statsQuery, [testId]),
      pool.query(categoryAveragesQuery, [testId]),
      pool.query(performanceQuery, [testId])
    ]);
    
    const stats = statsResult.rows[0];
    
    res.json({
      testTitle: testCheck.rows[0].title,
      statistics: {
        totalParticipants: parseInt(stats.total_participants) || 0,
        completedParticipants: parseInt(stats.completed_participants) || 0,
        averageQuestionsAnswered: parseFloat(stats.avg_questions_answered) || 0,
        overallAveragePercentage: parseFloat(stats.overall_average_percentage) || 0
      },
      categoryAverages: categoryAveragesResult.rows.map(cat => ({
        categoryName: cat.category_name,
        averageScore: parseFloat(cat.average_score) || 0,
        participantCount: parseInt(cat.participant_count) || 0
      })),
      performanceDistribution: performanceResult.rows.map(perf => ({
        name: perf.performance_range,
        count: parseInt(perf.count)
      }))
    });
    
  } catch (error) {
    console.error('Error fetching overall results:', error);
    res.status(500).json({ message: 'Internal server error while fetching overall results' });
  }
};

// Enhanced color palette for better visibility
// Enhanced color palette for better visibility
const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280'  // Gray
];

// Helper function to draw a professional bar chart
const drawBarChart = (doc, chartData, x, y, width, height, title) => {
  // Chart title with better styling
  doc.fontSize(14).font('Helvetica-Bold')
     .fillColor('#1F2937')
     .text(title, x, y, { width, align: 'center' });
  
  y += 30;

  // Chart dimensions with better proportions
  const chartX = x + 80; // Increased left margin for Y-axis label
  const chartY = y + 20;
  const chartWidth = width - 140; // Adjusted width
  const chartHeight = height - 120; // Increased bottom margin for labels

  // Draw chart background with subtle border
  doc.rect(chartX, chartY, chartWidth, chartHeight)
     .fillAndStroke('#FAFAFA', '#E5E7EB');

  // Draw horizontal grid lines and Y-axis labels
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const gridY = chartY + (chartHeight / gridLines) * i;
    const percentage = 100 - (i * 20);
    
    // Grid line
    doc.moveTo(chartX, gridY)
       .lineTo(chartX + chartWidth, gridY)
       .stroke('#E5E7EB');
    
    // Y-axis label with better positioning
    doc.fontSize(9).font('Helvetica')
       .fillColor('#6B7280')
       .text(`${percentage}%`, x + 25, gridY - 3, { width: 50, align: 'right' });
  }

  // Draw bars with better spacing and styling
  if (chartData && chartData.length > 0) {
    const barWidth = Math.min(80, (chartWidth * 0.7) / chartData.length);
    const totalBarsWidth = barWidth * chartData.length;
    const spacing = (chartWidth - totalBarsWidth) / (chartData.length + 1);

    chartData.forEach((item, index) => {
      const percentage = parseFloat(item.percentageScore || item.averagePercentage);
      const barHeight = (percentage / 100) * chartHeight;
      const barX = chartX + spacing + (index * (barWidth + spacing));
      const barY = chartY + chartHeight - barHeight;

      // Draw bar with gradient effect
      doc.rect(barX, barY, barWidth, barHeight)
         .fill(COLORS[index % COLORS.length]);

      // Add subtle border
      doc.rect(barX, barY, barWidth, barHeight)
         .stroke('#FFFFFF');

      // Draw percentage on top of bar with better styling
      doc.fontSize(9).font('Helvetica-Bold')
         .fillColor('#1F2937')
         .text(`${percentage.toFixed(1)}%`, 
               barX, barY - 15, { width: barWidth, align: 'center' });
    });

    // Draw category labels below chart with better formatting and word wrapping
    chartData.forEach((item, index) => {
      const barX = chartX + spacing + (index * (barWidth + spacing));
      const labelText = (item.subcategoryName || item.categoryName);
      
      // Improved label handling - split long text into multiple lines
      const maxCharsPerLine = 15;
      const words = labelText.split(' ');
      let lines = [];
      let currentLine = '';
      
      words.forEach(word => {
        if ((currentLine + word).length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Single word is too long, truncate it
            lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
            currentLine = '';
          }
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Limit to 3 lines maximum
      if (lines.length > 3) {
        lines = lines.slice(0, 2);
        lines.push('...');
      }

      // Draw each line
      lines.forEach((line, lineIndex) => {
        doc.fontSize(8).font('Helvetica')
           .fillColor('#4B5563')
           .text(line, barX - 10, chartY + chartHeight + 10 + (lineIndex * 12), 
                 { width: barWidth + 20, align: 'center' });
      });
    });
  }

  // Add chart border
  doc.rect(chartX, chartY, chartWidth, chartHeight)
     .stroke('#D1D5DB');
};

// Enhanced table drawing function
const drawTable = (doc, data, x, y, title) => {
  // Table title
  doc.fontSize(14).font('Helvetica-Bold')
     .fillColor('#1F2937')
     .text(title, x, y, { width: 500, align: 'center' });
  
  y += 30;

  const colWidths = [180, 80, 100, 100]; // Increased category column width
  const rowHeight = 25; // Slightly increased row height
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);

  // Center the table
  const tableX = x + (500 - tableWidth) / 2;

  // Table headers with background
  const headerY = y;
  doc.rect(tableX, headerY, tableWidth, rowHeight)
     .fill('#F3F4F6');

  doc.fontSize(10).font('Helvetica-Bold')
     .fillColor('#1F2937')
     .text('Category', tableX + 8, headerY + 8)
     .text('Questions', tableX + colWidths[0] + 8, headerY + 8)
     .text('Marks', tableX + colWidths[0] + colWidths[1] + 8, headerY + 8)
     .text('Percentage', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, headerY + 8);

  // Table border
  doc.rect(tableX, headerY, tableWidth, rowHeight)
     .stroke('#D1D5DB');

  // Table data rows
  let currentY = headerY + rowHeight;
  doc.fontSize(9).font('Helvetica');

  data.forEach((item, index) => {
    // Alternate row colors
    if (index % 2 === 0) {
      doc.rect(tableX, currentY, tableWidth, rowHeight)
         .fill('#FAFAFA');
    }

    // Better category name handling - word wrap instead of truncation
    const categoryName = item.categoryName;
    const maxWidth = colWidths[0] - 16;
    
    // Use PDFKit's text wrapping by setting width
    doc.fillColor('#374151')
       .text(categoryName, tableX + 8, currentY + 8, { 
         width: maxWidth, 
         ellipsis: true // This will add ... if text is too long
       })
       .text(item.totalQuestions.toString(), tableX + colWidths[0] + 8, currentY + 8, 
             { width: colWidths[1] - 16, align: 'center' })
       .text(`${item.totalMarksObtained}/${item.maxPossibleMarks}`, 
             tableX + colWidths[0] + colWidths[1] + 8, currentY + 8,
             { width: colWidths[2] - 16, align: 'center' })
       .text(`${item.averagePercentage}%`, 
             tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 8,
             { width: colWidths[3] - 16, align: 'center' });

    // Row border
    doc.rect(tableX, currentY, tableWidth, rowHeight)
       .stroke('#E5E7EB');

    currentY += rowHeight;
  });

  // Add outer border
  doc.rect(tableX, headerY, tableWidth, (data.length + 1) * rowHeight)
     .stroke('#D1D5DB');
};

// Generate enhanced PDF report
const generateParticipantPDF = async (participantData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Header with better styling
      doc.fontSize(20).font('Helvetica-Bold')
         .fillColor('#1F2937')
         .text('Test Results Report', { align: 'center' });
      
      doc.moveDown(0.3);
      
      // Subtitle line
      doc.moveTo(100, doc.y)
         .lineTo(500, doc.y)
         .stroke('#3B82F6');
      
      doc.moveDown(1.5);

      // Participant Information Card
      const cardY = doc.y;
      doc.rect(50, cardY, 500, 70)
         .fill('#F8FAFC')
         .stroke('#E2E8F0');

      doc.fontSize(16).font('Helvetica-Bold')
         .fillColor('#1E40AF')
         .text('Participant Information', 70, cardY + 12);

      doc.fontSize(11).font('Helvetica')
         .fillColor('#374151')
         .text(`Name: ${participantData.participant.name}`, 70, cardY + 35)
         .text(`Email: ${participantData.participant.email}`, 70, cardY + 50);

      // Overall Score Badge
      doc.fontSize(12).font('Helvetica-Bold')
         .fillColor('#059669')
         .text(`Overall Score: ${participantData.overallPercentage}%`, 380, cardY + 35);

      doc.y = cardY + 90;

      // Category Performance Charts
      participantData.categoryResults.forEach((category, categoryIndex) => {
        const categorySubcategories = participantData.subcategoryResults.filter(
          sub => sub.categoryName === category.categoryName
        );

        if (categorySubcategories.length > 0) {
          // Check if we need a new page
          if (doc.y > 400) { // Adjusted for better spacing
            doc.addPage();
          }

          const chartTitle = `${category.categoryName} - Subcategory Performance`;
          drawBarChart(doc, categorySubcategories, 50, doc.y, 500, 300, chartTitle); // Increased height
          doc.y += 350; // Increased spacing
        }
      });

      // Overall Category Performance - Now using Bar Chart instead of Pie Chart
      if (participantData.categoryResults.length > 0) {
        if (doc.y > 300) {
          doc.addPage();
        }

        drawBarChart(doc, participantData.categoryResults, 50, doc.y, 500, 300, 'Overall Category Performance');
        doc.y += 350;
      }

      // Performance Summary Table
      if (doc.y > 350) {
        doc.addPage();
      }

      drawTable(doc, participantData.categoryResults, 50, doc.y, 'Performance Summary');

      // Question-wise Results Section
      if (participantData.questionResults && participantData.questionResults.length > 0) {
        doc.addPage();
        
        // Questions Section Header
        doc.fontSize(16).font('Helvetica-Bold')
           .fillColor('#1E40AF')
           .text('Question-wise Results', 50, doc.y);
        
        doc.moveDown(0.3);
        
        // Subtitle line
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke('#3B82F6');
        
        doc.moveDown(1);

        // Group questions by category
        const questionsByCategory = participantData.questionResults.reduce((acc, question) => {
          const category = question.categoryName;
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(question);
          return acc;
        }, {});

        // Iterate through each category
        Object.entries(questionsByCategory).forEach(([categoryName, questions]) => {
          // Check if we need a new page for category header
          if (doc.y > 700) {
            doc.addPage();
          }

          // Category header
          doc.fontSize(14).font('Helvetica-Bold')
             .fillColor('#1F2937')
             .text(categoryName, 50, doc.y);
          
          doc.moveDown(0.5);

          questions.forEach((question, index) => {
            // Check if we need a new page (allowing space for question content)
            if (doc.y > 650) {
              doc.addPage();
            }

            // Question container
            const questionY = doc.y;
            const questionHeight = 80;
            
            // Question background
            doc.rect(50, questionY, 500, questionHeight)
               .fill('#F9FAFB')
               .stroke('#E5E7EB');

            // Question number badge
            doc.rect(60, questionY + 10, 30, 20)
               .fill('#3B82F6')
               .stroke('#2563EB');
            
            doc.fontSize(10).font('Helvetica-Bold')
               .fillColor('#FFFFFF')
               .text(`Q${question.questionOrder}`, 65, questionY + 16);

            // Subcategory label
            doc.fontSize(8).font('Helvetica')
               .fillColor('#6B7280')
               .text(question.subcategoryName, 100, questionY + 12);

            // Question text
            doc.fontSize(10).font('Helvetica')
               .fillColor('#111827')
               .text(question.questionText, 60, questionY + 35, { width: 400, height: 25 });

            // Answer and marks section
            const answerY = questionY + 55;
            
            // Answer
            doc.fontSize(9).font('Helvetica-Bold')
               .fillColor('#374151')
               .text('Answer:', 60, answerY);
            
            doc.fontSize(9).font('Helvetica')
               .fillColor('#111827')
               .text(`${question.selectedOptionLabel} - ${question.selectedOptionText}`, 100, answerY);

            // Marks
            doc.fontSize(9).font('Helvetica-Bold')
               .fillColor('#374151')
               .text('Marks:', 350, answerY);

            // Color-coded marks
            const marksColor = question.marksObtained >= 4 ? '#059669' : 
                              question.marksObtained >= 3 ? '#D97706' : '#DC2626';
            
            doc.fontSize(9).font('Helvetica-Bold')
               .fillColor(marksColor)
               .text(`${question.marksObtained}/5`, 385, answerY);

            // Time taken (if available)
            if (question.timeTaken) {
              doc.fontSize(8).font('Helvetica')
                 .fillColor('#6B7280')
                 .text(`Time: ${question.timeTaken}s`, 450, answerY);
            }

            doc.y = questionY + questionHeight + 10;
          });

          doc.moveDown(1);
        });
      }

      // Footer
      doc.fontSize(8).font('Helvetica')
         .fillColor('#6B7280')
         .text(`Generated on ${new Date().toLocaleDateString()}`, 50, 750, { align: 'center', width: 500 });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

// Export participant results as PDF
export const exportParticipantPDF = async (req, res) => {
  const { participantId } = req.params;
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    // Get participant results
    const testCheck = await pool.query('SELECT id FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Get participant data
    const sessionQuery = `
      SELECT ts.*, u.name, u.email, u.phone
      FROM test_sessions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.test_id = $1 AND ts.user_id = $2
    `;
    
    const sessionResult = await pool.query(sessionQuery, [testId, participantId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Participant not found' });
    }
    
    const sessionData = sessionResult.rows[0];
    
    // Get results data
    const categoryQuery = `
      SELECT 
        cr.*,
        tc.name as category_name
      FROM category_results cr
      JOIN test_categories tc ON cr.category_id = tc.id
      WHERE cr.session_id = $1
      ORDER BY tc.display_order
    `;
    
    const subcategoryQuery = `
      SELECT 
        sr.*,
        tsc.name as subcategory_name,
        tc.name as category_name
      FROM subcategory_results sr
      JOIN test_subcategories tsc ON sr.subcategory_id = tsc.id
      JOIN test_categories tc ON sr.category_id = tc.id
      WHERE sr.session_id = $1
      ORDER BY tc.display_order, tsc.display_order
    `;

    const questionResultsQuery = `
      SELECT 
        ur.question_id,
        ur.marks_obtained,
        ur.selected_option_label,
        ur.time_taken,
        tq.question_text,
        tq.question_order,
        tc.name as category_name,
        tsc.name as subcategory_name,
        fqo.option_text as selected_option_text
      FROM user_responses ur
      JOIN test_questions tq ON ur.question_id = tq.id
      JOIN test_categories tc ON ur.category_id = tc.id
      JOIN test_subcategories tsc ON ur.subcategory_id = tsc.id
      JOIN fixed_question_options fqo ON ur.selected_option_id = fqo.id
      WHERE ur.session_id = $1
      ORDER BY tq.question_order
    `;
    
    const [categoryResults, subcategoryResults, questionResults] = await Promise.all([
      pool.query(categoryQuery, [sessionData.id]),
      pool.query(subcategoryQuery, [sessionData.id]),
      pool.query(questionResultsQuery, [sessionData.id])
    ]);
    
    const overallPercentage = categoryResults.rows.length > 0 
      ? categoryResults.rows.reduce((sum, cat) => sum + parseFloat(cat.average_percentage), 0) / categoryResults.rows.length
      : 0;
    
    const participantData = {
      participant: {
        name: sessionData.name,
        email: sessionData.email,
        phone: sessionData.phone
      },
      overallPercentage: overallPercentage.toFixed(2),
      categoryResults: categoryResults.rows.map(cat => ({
        categoryName: cat.category_name,
        totalQuestions: cat.total_questions,
        totalMarksObtained: cat.total_marks_obtained,
        maxPossibleMarks: cat.max_possible_marks,
        averagePercentage: parseFloat(cat.average_percentage).toFixed(2)
      })),
      subcategoryResults: subcategoryResults.rows.map(sub => ({
        subcategoryName: sub.subcategory_name,
        categoryName: sub.category_name,
        totalQuestions: sub.total_questions,
        percentageScore: parseFloat(sub.percentage_score).toFixed(2)
      })),
      questionResults: questionResults.rows.map(q => ({
        questionId: q.question_id,
        questionOrder: q.question_order,
        questionText: q.question_text,
        categoryName: q.category_name,
        subcategoryName: q.subcategory_name,
        selectedOptionLabel: q.selected_option_label,
        selectedOptionText: q.selected_option_text,
        marksObtained: q.marks_obtained,
        maxMarks: 5,
        timeTaken: q.time_taken
      }))
    };
    
    const pdfBuffer = await generateParticipantPDF(participantData);
    
    res.setHeader('Content-Type', 'application/pdf');
    // Create safe filename from participant name
    const safeFileName = sessionData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}_test_results.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Internal server error while generating PDF' });
  }
};

// Export participant results as Excel
export const exportParticipantExcel = async (req, res) => {
  const { participantId } = req.params;
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    // Get participant data (same as PDF export)
    const testCheck = await pool.query('SELECT id, title FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    const testInfo = testCheck.rows[0];
    
    const sessionQuery = `
      SELECT ts.*, u.name, u.email, u.phone
      FROM test_sessions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.test_id = $1 AND ts.user_id = $2
    `;
    
    const sessionResult = await pool.query(sessionQuery, [testId, participantId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Participant not found' });
    }
    
    const sessionData = sessionResult.rows[0];
    
    // Get all results data (same queries as PDF export)
    const categoryQuery = `
      SELECT 
        cr.*,
        tc.name as category_name
      FROM category_results cr
      JOIN test_categories tc ON cr.category_id = tc.id
      WHERE cr.session_id = $1
      ORDER BY tc.display_order
    `;
    
    const subcategoryQuery = `
      SELECT 
        sr.*,
        tsc.name as subcategory_name,
        tc.name as category_name
      FROM subcategory_results sr
      JOIN test_subcategories tsc ON sr.subcategory_id = tsc.id
      JOIN test_categories tc ON sr.category_id = tc.id
      WHERE sr.session_id = $1
      ORDER BY tc.display_order, tsc.display_order
    `;

    const questionResultsQuery = `
      SELECT 
        ur.question_id,
        ur.marks_obtained,
        ur.selected_option_label,
        ur.time_taken,
        tq.question_text,
        tq.question_order,
        tc.name as category_name,
        tsc.name as subcategory_name,
        fqo.option_text as selected_option_text
      FROM user_responses ur
      JOIN test_questions tq ON ur.question_id = tq.id
      JOIN test_categories tc ON ur.category_id = tc.id
      JOIN test_subcategories tsc ON ur.subcategory_id = tsc.id
      JOIN fixed_question_options fqo ON ur.selected_option_id = fqo.id
      WHERE ur.session_id = $1
      ORDER BY tq.question_order
    `;
    
    const [categoryResults, subcategoryResults, questionResults] = await Promise.all([
      pool.query(categoryQuery, [sessionData.id]),
      pool.query(subcategoryQuery, [sessionData.id]),
      pool.query(questionResultsQuery, [sessionData.id])
    ]);

    // Calculate overall percentage
    const overallPercentage = categoryResults.rows.length > 0 
      ? categoryResults.rows.reduce((sum, cat) => sum + parseFloat(cat.average_percentage), 0) / categoryResults.rows.length
      : 0;
    
    const workbook = new ExcelJS.Workbook();
    
    // 1. Test & Participant Summary Sheet
    const summarySheet = workbook.addWorksheet('Test Summary');
    
    // Add header styling
    summarySheet.addRow(['TEST RESULTS REPORT']).font = { bold: true, size: 16 };
    summarySheet.addRow([]);
    
    // Test Information
    summarySheet.addRow(['Test Information']).font = { bold: true, size: 14 };
    summarySheet.addRow(['Test Title', testInfo.title]);
    summarySheet.addRow(['Test ID', testId]);
    summarySheet.addRow(['Generated On', new Date().toLocaleDateString()]);
    summarySheet.addRow([]);
    
    // Participant Information
    summarySheet.addRow(['Participant Information']).font = { bold: true, size: 14 };
    summarySheet.addRow(['Name', sessionData.name]);
    summarySheet.addRow(['Email', sessionData.email]);
    summarySheet.addRow(['Phone', sessionData.phone]);
    summarySheet.addRow(['Test Status', sessionData.session_status]);
    summarySheet.addRow(['Questions Answered', sessionData.questions_answered]);
    summarySheet.addRow(['Total Questions', sessionData.total_questions]);
    summarySheet.addRow(['Overall Score', `${overallPercentage.toFixed(2)}%`]);
    summarySheet.addRow(['Started At', sessionData.started_at ? new Date(sessionData.started_at).toLocaleString() : 'N/A']);
    summarySheet.addRow(['Completed At', sessionData.completed_at ? new Date(sessionData.completed_at).toLocaleString() : 'N/A']);
    
    // Auto-fit columns
    summarySheet.columns = [
      { width: 25 },
      { width: 40 }
    ];
    
    // 2. Category Results Sheet
    const categorySheet = workbook.addWorksheet('Category Results');
    
    // Add headers with styling
    const categoryHeaders = categorySheet.addRow([
      'Category Name', 
      'Total Subcategories',
      'Total Questions', 
      'Marks Obtained', 
      'Max Possible Marks', 
      'Average Percentage (%)'
    ]);
    categoryHeaders.font = { bold: true };
    categoryHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    
    categoryResults.rows.forEach(cat => {
      const row = categorySheet.addRow([
        cat.category_name,
        cat.total_subcategories,
        cat.total_questions,
        cat.total_marks_obtained,
        cat.max_possible_marks,
        parseFloat(cat.average_percentage).toFixed(2)
      ]);
      
      // Color code based on percentage
      const percentage = parseFloat(cat.average_percentage);
      if (percentage >= 80) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (percentage >= 60) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      }
    });
    
    categorySheet.columns = [
      { width: 30 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 20 }
    ];
    
    // 3. Subcategory Results Sheet
    const subcategorySheet = workbook.addWorksheet('Subcategory Results');
    
    const subcategoryHeaders = subcategorySheet.addRow([
      'Category', 
      'Subcategory Name', 
      'Questions', 
      'Marks Obtained', 
      'Max Possible Marks', 
      'Percentage (%)'
    ]);
    subcategoryHeaders.font = { bold: true };
    subcategoryHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    
    subcategoryResults.rows.forEach(sub => {
      const row = subcategorySheet.addRow([
        sub.category_name,
        sub.subcategory_name,
        sub.total_questions,
        sub.total_marks_obtained,
        sub.max_possible_marks,
        parseFloat(sub.percentage_score).toFixed(2)
      ]);
      
      // Color code based on percentage
      const percentage = parseFloat(sub.percentage_score);
      if (percentage >= 80) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (percentage >= 60) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      }
    });
    
    subcategorySheet.columns = [
      { width: 25 }, { width: 30 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 16 }
    ];
    
    // 4. Question-wise Results Sheet with Category/Subcategory Structure
    if (questionResults.rows.length > 0) {
      const questionSheet = workbook.addWorksheet('Question-wise Results');
      
      // Group questions by category and subcategory
      const questionsByCategory = {};
      questionResults.rows.forEach(q => {
        if (!questionsByCategory[q.category_name]) {
          questionsByCategory[q.category_name] = {};
        }
        if (!questionsByCategory[q.category_name][q.subcategory_name]) {
          questionsByCategory[q.category_name][q.subcategory_name] = [];
        }
        questionsByCategory[q.category_name][q.subcategory_name].push(q);
      });

      let currentRow = 1;

      Object.entries(questionsByCategory).forEach(([categoryName, subcategories]) => {
        // Category Header
        const categoryHeaderRow = questionSheet.addRow([`CATEGORY: ${categoryName}`]);
        categoryHeaderRow.font = { bold: true, size: 14 };
        categoryHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3B82F6' }
        };
        categoryHeaderRow.getCell(1).font = { ...categoryHeaderRow.getCell(1).font, color: { argb: 'FFFFFFFF' } };
        
        // Merge cells for category header
        questionSheet.mergeCells(`A${currentRow + 1}:I${currentRow + 1}`);
        currentRow += 2;

        // Find category results for summary
        const categoryResult = categoryResults.rows.find(cat => cat.category_name === categoryName);
        if (categoryResult) {
          const summaryRow = questionSheet.addRow([
            'Category Summary:', 
            `Questions: ${categoryResult.total_questions}`,
            `Marks: ${categoryResult.total_marks_obtained}/${categoryResult.max_possible_marks}`,
            `Average: ${parseFloat(categoryResult.average_percentage).toFixed(2)}%`
          ]);
          summaryRow.font = { bold: true };
          summaryRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0F2FE' }
          };
          currentRow += 2;
        }

        Object.entries(subcategories).forEach(([subcategoryName, questions]) => {
          // Subcategory Header
          const subcategoryHeaderRow = questionSheet.addRow([`  SUBCATEGORY: ${subcategoryName}`]);
          subcategoryHeaderRow.font = { bold: true, size: 12 };
          subcategoryHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' }
          };
          subcategoryHeaderRow.getCell(1).font = { ...subcategoryHeaderRow.getCell(1).font, color: { argb: 'FFFFFFFF' } };
          
          // Merge cells for subcategory header
          questionSheet.mergeCells(`A${currentRow + 1}:I${currentRow + 1}`);
          currentRow += 2;

          // Find subcategory results for summary
          const subcategoryResult = subcategoryResults.rows.find(sub => 
            sub.category_name === categoryName && sub.subcategory_name === subcategoryName
          );
          if (subcategoryResult) {
            const subSummaryRow = questionSheet.addRow([
              '  Subcategory Summary:', 
              `Questions: ${subcategoryResult.total_questions}`,
              `Marks: ${subcategoryResult.total_marks_obtained}/${subcategoryResult.max_possible_marks}`,
              `Percentage: ${parseFloat(subcategoryResult.percentage_score).toFixed(2)}%`
            ]);
            subSummaryRow.font = { bold: true };
            subSummaryRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD1FAE5' }
            };
            currentRow += 2;
          }

          // Question Headers
          const questionHeaders = questionSheet.addRow([
            'Q. No.',
            'Question Text',
            'Selected',
            'Answer Text',
            'Marks',
            'Max',
            'Performance',
            'Time (sec)',
            'Status'
          ]);
          questionHeaders.font = { bold: true };
          questionHeaders.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
          };
          currentRow++;

          // Questions
          questions.forEach(q => {
            const performance = (q.marks_obtained / 5) * 100;
            let status = 'Poor';
            if (performance >= 80) status = 'Excellent';
            else if (performance >= 60) status = 'Good';
            else if (performance >= 40) status = 'Average';

            const row = questionSheet.addRow([
              q.question_order,
              q.question_text,
              q.selected_option_label,
              q.selected_option_text,
              q.marks_obtained,
              5,
              `${performance.toFixed(1)}%`,
              q.time_taken || 'N/A',
              status
            ]);
            
            // Color code marks based on performance
            const marksCell = row.getCell(5);
            const statusCell = row.getCell(9);
            if (q.marks_obtained >= 4) {
              marksCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            } else if (q.marks_obtained >= 3) {
              marksCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            } else {
              marksCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
            }
            currentRow++;
          });

          // Add spacing between subcategories
          questionSheet.addRow([]);
          currentRow++;
        });

        // Add spacing between categories
        questionSheet.addRow([]);
        currentRow++;
      });
      
      questionSheet.columns = [
        { width: 8 }, { width: 60 }, { width: 10 }, { width: 20 }, 
        { width: 8 }, { width: 6 }, { width: 12 }, { width: 12 }, { width: 12 }
      ];
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const safeFileName = sessionData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}_detailed_test_results.xlsx"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ message: 'Internal server error while generating Excel' });
  }
};

export const exportParticipantCSV = async (req, res) => {
  const { participantId } = req.params;
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    // Get participant data (same as other exports)
    const testCheck = await pool.query('SELECT id, title FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    const testInfo = testCheck.rows[0];
    
    const sessionQuery = `
      SELECT ts.*, u.name, u.email, u.phone
      FROM test_sessions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.test_id = $1 AND ts.user_id = $2
    `;
    
    const sessionResult = await pool.query(sessionQuery, [testId, participantId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Participant not found' });
    }
    
    const sessionData = sessionResult.rows[0];
    
    // Get all results data
    const categoryQuery = `
      SELECT 
        cr.*,
        tc.name as category_name
      FROM category_results cr
      JOIN test_categories tc ON cr.category_id = tc.id
      WHERE cr.session_id = $1
      ORDER BY tc.display_order
    `;
    
    const subcategoryQuery = `
      SELECT 
        sr.*,
        tsc.name as subcategory_name,
        tc.name as category_name
      FROM subcategory_results sr
      JOIN test_subcategories tsc ON sr.subcategory_id = tsc.id
      JOIN test_categories tc ON sr.category_id = tc.id
      WHERE sr.session_id = $1
      ORDER BY tc.display_order, tsc.display_order
    `;

    const questionResultsQuery = `
      SELECT 
        ur.question_id,
        ur.marks_obtained,
        ur.selected_option_label,
        ur.time_taken,
        tq.question_text,
        tq.question_order,
        tc.name as category_name,
        tsc.name as subcategory_name,
        fqo.option_text as selected_option_text
      FROM user_responses ur
      JOIN test_questions tq ON ur.question_id = tq.id
      JOIN test_categories tc ON ur.category_id = tc.id
      JOIN test_subcategories tsc ON ur.subcategory_id = tsc.id
      JOIN fixed_question_options fqo ON ur.selected_option_id = fqo.id
      WHERE ur.session_id = $1
      ORDER BY tq.question_order
    `;
    
    const [categoryResults, subcategoryResults, questionResults] = await Promise.all([
      pool.query(categoryQuery, [sessionData.id]),
      pool.query(subcategoryQuery, [sessionData.id]),
      pool.query(questionResultsQuery, [sessionData.id])
    ]);

    // Calculate overall percentage
    const overallPercentage = categoryResults.rows.length > 0 
      ? categoryResults.rows.reduce((sum, cat) => sum + parseFloat(cat.average_percentage), 0) / categoryResults.rows.length
      : 0;

    // Build CSV content with multiple sections
    let csvContent = '';
    
    // Header Section
    csvContent += '"TEST RESULTS REPORT"\n';
    csvContent += '"Generated on:","' + new Date().toLocaleDateString() + '"\n';
    csvContent += '\n';
    
    // Test Information Section
    csvContent += '"TEST INFORMATION"\n';
    csvContent += '"Test Title","' + testInfo.title.replace(/"/g, '""') + '"\n';
    csvContent += '"Test ID","' + testId + '"\n';
    csvContent += '\n';
    
    // Participant Information Section
    csvContent += '"PARTICIPANT INFORMATION"\n';
    csvContent += '"Name","' + sessionData.name.replace(/"/g, '""') + '"\n';
    csvContent += '"Email","' + sessionData.email + '"\n';
    csvContent += '"Phone","' + sessionData.phone + '"\n';
    csvContent += '"Test Status","' + sessionData.session_status + '"\n';
    csvContent += '"Questions Answered","' + sessionData.questions_answered + '"\n';
    csvContent += '"Total Questions","' + sessionData.total_questions + '"\n';
    csvContent += '"Overall Score","' + overallPercentage.toFixed(2) + '%"\n';
    csvContent += '"Started At","' + (sessionData.started_at ? new Date(sessionData.started_at).toLocaleString() : 'N/A') + '"\n';
    csvContent += '"Completed At","' + (sessionData.completed_at ? new Date(sessionData.completed_at).toLocaleString() : 'N/A') + '"\n';
    csvContent += '\n';
    
    // Category Results Section
    csvContent += '"CATEGORY RESULTS"\n';
    csvContent += '"Category Name","Total Subcategories","Total Questions","Marks Obtained","Max Possible Marks","Average Percentage (%)"\n';
    
    categoryResults.rows.forEach(cat => {
      csvContent += `"${cat.category_name.replace(/"/g, '""')}","${cat.total_subcategories}","${cat.total_questions}","${cat.total_marks_obtained}","${cat.max_possible_marks}","${parseFloat(cat.average_percentage).toFixed(2)}"\n`;
    });
    
    csvContent += '\n';
    
    // Subcategory Results Section
    csvContent += '"SUBCATEGORY RESULTS"\n';
    csvContent += '"Category","Subcategory Name","Questions","Marks Obtained","Max Possible Marks","Percentage (%)"\n';
    
    subcategoryResults.rows.forEach(sub => {
      csvContent += `"${sub.category_name.replace(/"/g, '""')}","${sub.subcategory_name.replace(/"/g, '""')}","${sub.total_questions}","${sub.total_marks_obtained}","${sub.max_possible_marks}","${parseFloat(sub.percentage_score).toFixed(2)}"\n`;
    });
    
    csvContent += '\n';
    
    // Question-wise Results Section with Category Structure
    if (questionResults.rows.length > 0) {
      csvContent += '"DETAILED QUESTION-WISE RESULTS"\n';
      csvContent += '\n';

      // Group questions by category and subcategory
      const questionsByCategory = {};
      questionResults.rows.forEach(q => {
        if (!questionsByCategory[q.category_name]) {
          questionsByCategory[q.category_name] = {};
        }
        if (!questionsByCategory[q.category_name][q.subcategory_name]) {
          questionsByCategory[q.category_name][q.subcategory_name] = [];
        }
        questionsByCategory[q.category_name][q.subcategory_name].push(q);
      });

      Object.entries(questionsByCategory).forEach(([categoryName, subcategories]) => {
        csvContent += `"CATEGORY: ${categoryName.replace(/"/g, '""')}"\n`;
        
        // Find category results for summary
        const categoryResult = categoryResults.rows.find(cat => cat.category_name === categoryName);
        if (categoryResult) {
          csvContent += `"Category Summary","Questions: ${categoryResult.total_questions}","Marks: ${categoryResult.total_marks_obtained}/${categoryResult.max_possible_marks}","Average: ${parseFloat(categoryResult.average_percentage).toFixed(2)}%"\n`;
        }
        csvContent += '\n';

        Object.entries(subcategories).forEach(([subcategoryName, questions]) => {
          csvContent += `"  SUBCATEGORY: ${subcategoryName.replace(/"/g, '""')}"\n`;
          
          // Find subcategory results for summary
          const subcategoryResult = subcategoryResults.rows.find(sub => 
            sub.category_name === categoryName && sub.subcategory_name === subcategoryName
          );
          if (subcategoryResult) {
            csvContent += `"  Subcategory Summary","Questions: ${subcategoryResult.total_questions}","Marks: ${subcategoryResult.total_marks_obtained}/${subcategoryResult.max_possible_marks}","Percentage: ${parseFloat(subcategoryResult.percentage_score).toFixed(2)}%"\n`;
          }
          csvContent += '\n';

          // Question headers
          csvContent += '"Q. No.","Question Text","Selected","Answer Text","Marks","Max","Performance %","Time (sec)","Status"\n';
          
          questions.forEach(q => {
            const questionText = q.question_text.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ');
            const answerText = q.selected_option_text.replace(/"/g, '""');
            const performance = (q.marks_obtained / 5) * 100;
            let status = 'Poor';
            if (performance >= 80) status = 'Excellent';
            else if (performance >= 60) status = 'Good';
            else if (performance >= 40) status = 'Average';
            
            csvContent += `"${q.question_order}","${questionText}","${q.selected_option_label}","${answerText}","${q.marks_obtained}","5","${performance.toFixed(1)}%","${q.time_taken || 'N/A'}","${status}"\n`;
          });

          csvContent += '\n';
        });

        csvContent += '\n';
      });

      // Summary Statistics
      csvContent += '"PERFORMANCE ANALYSIS"\n';
      
      // Calculate performance stats
      const totalQuestions = questionResults.rows.length;
      const excellentQuestions = questionResults.rows.filter(q => q.marks_obtained >= 4).length;
      const goodQuestions = questionResults.rows.filter(q => q.marks_obtained === 3).length;
      const poorQuestions = questionResults.rows.filter(q => q.marks_obtained <= 2).length;
      
      csvContent += `"Total Questions","${totalQuestions}"\n`;
      csvContent += `"Excellent Performance (4-5 marks)","${excellentQuestions}","${((excellentQuestions/totalQuestions)*100).toFixed(1)}%"\n`;
      csvContent += `"Good Performance (3 marks)","${goodQuestions}","${((goodQuestions/totalQuestions)*100).toFixed(1)}%"\n`;
      csvContent += `"Needs Improvement (1-2 marks)","${poorQuestions}","${((poorQuestions/totalQuestions)*100).toFixed(1)}%"\n`;
      
      // Average time per question
      const totalTime = questionResults.rows.reduce((sum, q) => sum + (q.time_taken || 0), 0);
      const avgTime = totalTime / totalQuestions;
      csvContent += `"Average Time per Question","${avgTime.toFixed(1)} seconds"\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sessionData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_detailed_results.csv"`
    );

    // Send BOM + CSV together in one go
    res.send('\ufeff' + csvContent);

    
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ message: 'Internal server error while generating CSV' });
  }
};

// Export overall results
export const exportOverallResults = async (req, res) => {
  const {  format } = req.params;
  const testId = req.params.id;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query('SELECT title FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Get all participants with their results
    const participantsQuery = `
      SELECT 
        u.name,
        u.email,
        u.phone,
        ts.session_status,
        ts.started_at,
        ts.completed_at,
        ts.questions_answered,
        ts.total_questions,
        AVG(cr.average_percentage) as overall_percentage
      FROM users u
      JOIN test_sessions ts ON u.id = ts.user_id
      LEFT JOIN category_results cr ON ts.id = cr.session_id
      WHERE ts.test_id = $1
      GROUP BY u.id, u.name, u.email, u.phone, ts.session_status, ts.started_at, ts.completed_at, ts.questions_answered, ts.total_questions
      ORDER BY ts.completed_at DESC NULLS LAST
    `;
    
    const participantsResult = await pool.query(participantsQuery, [testId]);
    
    if (format === 'csv') {
      let csvContent = 'Name,Email,Phone,Status,Started At,Completed At,Questions Answered,Total Questions,Overall Percentage\n';
      
      participantsResult.rows.forEach(participant => {
        csvContent += `"${participant.name}","${participant.email}","${participant.phone}","${participant.session_status}","${participant.started_at || ''}","${participant.completed_at || ''}",${participant.questions_answered},${participant.total_questions},${parseFloat(participant.overall_percentage || 0).toFixed(2)}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="overall_results.csv"`);
      res.send(csvContent);
      
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Overall Results');
      
      worksheet.addRow(['Name', 'Email', 'Phone', 'Status', 'Started At', 'Completed At', 'Questions Answered', 'Total Questions', 'Overall Percentage']);
      
      participantsResult.rows.forEach(participant => {
        worksheet.addRow([
          participant.name,
          participant.email,
          participant.phone,
          participant.session_status,
          participant.started_at,
          participant.completed_at,
          participant.questions_answered,
          participant.total_questions,
          parseFloat(participant.overall_percentage || 0).toFixed(2)
        ]);
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="overall_results.xlsx"`);
      res.send(buffer);
      
    } else {
      res.status(400).json({ message: 'Invalid format. Use csv or excel.' });
    }
    
  } catch (error) {
    console.error('Error exporting overall results:', error);
    res.status(500).json({ message: 'Internal server error while exporting results' });
  }
};

// Send email to individual participant
export const sendEmailToParticipant = async (req, res) => {
  const { participantId } = req.params;
  const testId = req.params.id;
  const { includeReport = true, format = 'pdf' } = req.body;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query('SELECT title FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found or access denied' });
    }

    // Get participant details
    const participantQuery = `
      SELECT u.name, u.email, ts.id as session_id, ts.session_status
      FROM users u
      JOIN test_sessions ts ON u.id = ts.user_id
      WHERE ts.test_id = $1 AND u.id = $2
    `;
    
    const participantResult = await pool.query(participantQuery, [testId, participantId]);
    if (participantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participant = participantResult.rows[0];
    
    // Check if participant has completed the test
    if (participant.session_status !== 'completed') {
      return res.status(400).json({ error: 'Participant has not completed the test' });
    }

    let reportBuffer = null;
    if (includeReport) {
      // Generate report based on format
      if (format === 'pdf') {
        reportBuffer = await generateParticipantPDFReport(testId, participantId);
      } else if (format === 'excel') {
        reportBuffer = await generateParticipantExcelReport(testId, participantId);
      }
    }

    // Send email using nodemailer or your preferred email service
    const emailContent = {
      to: participant.email,
      subject: `Test Results - ${testCheck.rows[0].title}`,
      html: `
        <h2>Test Results</h2>
        <p>Dear ${participant.name},</p>
        <p>Your test results for "${testCheck.rows[0].title}" are ready.</p>
        ${includeReport ? '<p>Please find your detailed report attached.</p>' : ''}
        <p>Thank you for participating.</p>
      `,
      attachments: reportBuffer ? [{
        filename: `test_results_${participantId}.${format === 'excel' ? 'xlsx' : format}`,
        content: reportBuffer
      }] : []
    };

    await sendEmail(emailContent);
    
    res.json({ 
      message: 'Email sent successfully',
      participant: participant.name,
      email: participant.email
    });
  } catch (error) {
    console.error('Error sending email to participant:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
};

export const sendEmailToAllParticipants = async (req, res) => {
  const testId = req.params.id;
  const { includeReport = true, format = 'pdf' } = req.body;
  const adminId = req.user.id;
  
  try {
    // Verify test ownership
    const testCheck = await pool.query('SELECT title FROM tests WHERE id = $1 AND created_by = $2', [testId, adminId]);
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found or access denied' });
    }

    // Get all participants who completed the test
    const participantsQuery = `
      SELECT u.id, u.name, u.email, ts.id as session_id
      FROM users u
      JOIN test_sessions ts ON u.id = ts.user_id
      WHERE ts.test_id = $1 AND ts.session_status = 'completed'
    `;
    
    const participantsResult = await pool.query(participantsQuery, [testId]);
    
    if (participantsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No completed participants found' });
    }

    let sentCount = 0;
    const failedEmails = [];

    for (const participant of participantsResult.rows) {
      try {
        let reportBuffer = null;
        if (includeReport) {
          if (format === 'pdf') {
            reportBuffer = await generateParticipantPDFReport(testId, participant.id);
          } else if (format === 'excel') {
            reportBuffer = await generateParticipantExcelReport(testId, participant.id);
          }
        }

        const emailContent = {
          to: participant.email,
          subject: `Test Results - ${testCheck.rows[0].title}`,
          html: `
            <h2>Test Results</h2>
            <p>Dear ${participant.name},</p>
            <p>Your test results for "${testCheck.rows[0].title}" are ready.</p>
            ${includeReport ? '<p>Please find your detailed report attached.</p>' : ''}
            <p>Thank you for participating.</p>
          `,
          attachments: reportBuffer ? [{
            filename: `test_results_${participant.id}.${format === 'excel' ? 'xlsx' : format}`,
            content: reportBuffer
          }] : []
        };

        await sendEmail(emailContent);
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send email to ${participant.email}:`, emailError);
        failedEmails.push(participant.email);
      }
    }
    
    res.json({ 
      message: `Emails sent to ${sentCount} participants`,
      sentCount,
      totalParticipants: participantsResult.rows.length,
      failedEmails
    });
  } catch (error) {
    console.error('Error sending emails to all participants:', error);
    res.status(500).json({ error: 'Failed to send emails' });
  }
};

// Helper function to generate PDF report
const generateParticipantPDFReport = async (testId, participantId) => {
  const doc = new PDFDocument();
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {});

  // Get participant results
  const participantResults = await getIndividualResults(testId, participantId);
  
  // Add content to PDF
  doc.fontSize(20).text('Test Results Report', 100, 100);
  doc.fontSize(14).text(`Participant: ${participantResults.participant.name}`, 100, 140);
  doc.text(`Email: ${participantResults.participant.email}`, 100, 160);
  doc.text(`Test: ${participantResults.test.title}`, 100, 180);
  doc.text(`Completed: ${new Date(participantResults.session.completed_at).toLocaleDateString()}`, 100, 200);
  
  // Add overall performance
  doc.fontSize(16).text('Overall Performance', 100, 240);
  doc.fontSize(12).text(`Total Score: ${participantResults.totalScore}%`, 100, 260);
  doc.text(`Questions Answered: ${participantResults.questionsAnswered}`, 100, 280);
  
  // Add category results
  let yPosition = 320;
  doc.fontSize(16).text('Category Performance', 100, yPosition);
  yPosition += 20;
  
  participantResults.categoryResults.forEach(category => {
    doc.fontSize(12).text(`${category.categoryName}: ${category.averagePercentage}%`, 100, yPosition);
    yPosition += 20;
  });
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

// Helper function to generate Excel report
const generateParticipantExcelReport = async (testId, participantId) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Test Results');
  
  // Get participant results
  const participantResults = await getIndividualResults(testId, participantId);
  
  // Add headers and data
  worksheet.addRow(['Test Results Report']);
  worksheet.addRow(['Participant', participantResults.participant.name]);
  worksheet.addRow(['Email', participantResults.participant.email]);
  worksheet.addRow(['Test', participantResults.test.title]);
  worksheet.addRow(['Completed', new Date(participantResults.session.completed_at).toLocaleDateString()]);
  worksheet.addRow([]);
  
  // Add category results
  worksheet.addRow(['Category Performance']);
  worksheet.addRow(['Category', 'Percentage', 'Questions', 'Marks Obtained']);
  
  participantResults.categoryResults.forEach(category => {
    worksheet.addRow([
      category.categoryName,
      category.averagePercentage,
      category.totalQuestions,
      category.totalMarksObtained
    ]);
  });
  
  // Add subcategory results
  worksheet.addRow([]);
  worksheet.addRow(['Subcategory Performance']);
  worksheet.addRow(['Subcategory', 'Category', 'Percentage', 'Questions', 'Marks']);
  
  participantResults.subcategoryResults.forEach(subcategory => {
    worksheet.addRow([
      subcategory.subcategoryName,
      subcategory.categoryName,
      subcategory.percentageScore,
      subcategory.totalQuestions,
      subcategory.totalMarksObtained
    ]);
  });
  
  return await workbook.xlsx.writeBuffer();
};

// Helper function to get participant results (reused from earlier)
const getIndividualResults = async (testId, participantId) => {
  // Get participant and test info
  const participantQuery = `
    SELECT u.name, u.email, t.title, ts.completed_at, ts.questions_answered
    FROM users u
    JOIN test_sessions ts ON u.id = ts.user_id
    JOIN tests t ON ts.test_id = t.id
    WHERE ts.test_id = $1 AND u.id = $2
  `;
  
  const participantResult = await pool.query(participantQuery, [testId, participantId]);
  if (participantResult.rows.length === 0) {
    throw new Error('Participant not found');
  }
  
  const participant = participantResult.rows[0];
  
  // Get category results
  const categoryQuery = `
    SELECT 
      tc.name as category_name,
      cr.total_questions,
      cr.total_marks_obtained,
      cr.max_possible_marks,
      cr.average_percentage
    FROM category_results cr
    JOIN test_categories tc ON cr.category_id = tc.id
    JOIN test_sessions ts ON cr.session_id = ts.id
    WHERE ts.test_id = $1 AND ts.user_id = $2
    ORDER BY tc.display_order
  `;
  
  const categoryResults = await pool.query(categoryQuery, [testId, participantId]);
  
  // Get subcategory results
  const subcategoryQuery = `
    SELECT 
      tsc.name as subcategory_name,
      tc.name as category_name,
      sr.total_questions,
      sr.total_marks_obtained,
      sr.max_possible_marks,
      sr.percentage_score
    FROM subcategory_results sr
    JOIN test_subcategories tsc ON sr.subcategory_id = tsc.id
    JOIN test_categories tc ON sr.category_id = tc.id
    JOIN test_sessions ts ON sr.session_id = ts.id
    WHERE ts.test_id = $1 AND ts.user_id = $2
    ORDER BY tc.display_order, tsc.display_order
  `;
  
  const subcategoryResults = await pool.query(subcategoryQuery, [testId, participantId]);
  
  return {
    participant: {
      name: participant.name,
      email: participant.email
    },
    test: {
      title: participant.title
    },
    session: {
      completed_at: participant.completed_at,
      questions_answered: participant.questions_answered
    },
    categoryResults: categoryResults.rows.map(row => ({
      categoryName: row.category_name,
      totalQuestions: row.total_questions,
      totalMarksObtained: row.total_marks_obtained,
      maxPossibleMarks: row.max_possible_marks,
      averagePercentage: row.average_percentage
    })),
    subcategoryResults: subcategoryResults.rows.map(row => ({
      subcategoryName: row.subcategory_name,
      categoryName: row.category_name,
      totalQuestions: row.total_questions,
      totalMarksObtained: row.total_marks_obtained,
      maxPossibleMarks: row.max_possible_marks,
      percentageScore: row.percentage_score
    }))
  };
};

// Helper function to send email (implement based on your email service)
const sendEmail = async (emailContent) => {
  
  const mailOptions = {
    from: process.env.EMAIL,
    to: emailContent.to,
    subject: emailContent.subject,
    html: emailContent.html,
    attachments: emailContent.attachments || []
  };
  
  return await transporter.sendMail(mailOptions);
};
