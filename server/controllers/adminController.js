import jwt from "jsonwebtoken";
import {findAdminByEmail} from "../models/adminModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {pool}  from "../config/db.js";

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
    { expiresIn: '1h' }
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
  const { title, description, instructions, rules, timePerQuestion, questions, isDraft } = req.body;
  const adminId = req.user.id;



  // Validation
  if (!title || !title.trim()) {

    return res.status(400).json({ message: 'Test title is required' });
  }

  if (!questions || questions.length === 0) {

    return res.status(400).json({ message: 'At least one question is required' });
  }

  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    if (!question.questionText || !question.questionText.trim()) {

      return res.status(400).json({ message: `Question ${i + 1}: Question text is required` });
    }
    // Changed from skillCategoryId  for dynamic categories
    if (!question.skillCategoryId || !question.skillCategoryId.trim()) {

      return res.status(400).json({ message: `Question ${i + 1}: Skill category name is required` });
    }
    if (!question.options || question.options.length < 2) {

      return res.status(400).json({ message: `Question ${i + 1}: At least 2 options are required` });
    }
    
    // Validate options
    for (let j = 0; j < question.options.length; j++) {
      const option = question.options[j];
      if (!option.optionText || !option.optionText.trim()) {

        return res.status(400).json({ message: `Question ${i + 1}, Option ${j + 1}: Option text is required` });
      }
      if (typeof option.marks !== 'number' || option.marks < 0) {

        return res.status(400).json({ message: `Question ${i + 1}, Option ${j + 1}: Valid marks are required` });
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

    // Insert questions and options
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      // Insert question - skill_category_name will auto-create/link skill category via trigger
      const questionQuery = `
        INSERT INTO questions (test_id, skill_category_name, question_text, question_order)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const questionValues = [
        testId,
        question.skillCategoryId.trim(), // Using skillCategoryId instead of skillCategoryId
        question.questionText.trim(),
        i + 1 // question_order starts from 1
      ];

      const questionResult = await client.query(questionQuery, questionValues);
      const questionId = questionResult.rows[0].id;

      // Insert options for this question
      for (let j = 0; j < question.options.length; j++) {
        const option = question.options[j];
        
        const optionQuery = `
          INSERT INTO question_options (question_id, option_text, option_order, marks)
          VALUES ($1, $2, $3, $4)
        `;
        
        const optionValues = [
          questionId,
          option.optionText.trim(),
          j + 1, // option_order starts from 1
          option.marks
        ];

        await client.query(optionQuery, optionValues);
      }
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
      test: testResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating test:', error);
    
    // Handle specific database errors
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({ message: 'Invalid reference in test data' });
    }
    
    res.status(500).json({ message: 'Internal server error while creating test' });
  } finally {
    client.release();
  }
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
        t.time_per_question as "timePerQuestion",
        t.total_questions as "totalQuestions",
        t.is_active as "isActive",
        t.is_published as "isPublished",
        t.test_code as "testCode",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        tc.is_test_live as "isTestLive",
        tc.is_test_ended as "isTestEnded",
        tc.current_participants as "currentParticipants",
        COALESCE(participant_stats.total_participants, 0) as participants,
        COALESCE(participant_stats.completed_participants, 0) as "completedParticipants",
        COALESCE(participant_stats.in_progress_participants, 0) as "inProgressParticipants",
        ARRAY_AGG(DISTINCT q.skill_category_name) FILTER (WHERE q.skill_category_name IS NOT NULL) as "skillCategories"
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN questions q ON t.id = q.test_id
      LEFT JOIN (
        SELECT 
          test_id,
          COUNT(*) as total_participants,
          COUNT(CASE WHEN session_status = 'completed' THEN 1 END) as completed_participants,
          COUNT(CASE WHEN session_status = 'in_progress' THEN 1 END) as in_progress_participants
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
          baseQuery += ` AND t.is_published = true AND t.is_active = false`;
          break;
        case 'active':
          baseQuery += ` AND t.is_active = true`;
          break;
        case 'completed':
          baseQuery += ` AND tc.is_test_ended = true`;
          break;
      }
    }
    
    baseQuery += ` 
      GROUP BY t.id, tc.is_test_live, tc.is_test_ended, tc.current_participants, participant_stats.total_participants, participant_stats.completed_participants, participant_stats.in_progress_participants
      ORDER BY t.updated_at DESC
    `;
    
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
          countQuery += ` AND t.is_published = true AND t.is_active = false`;
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
    
    // Process results to add computed status
    const tests = result.rows.map(test => ({
      ...test,
      status: getTestStatus(test),
      skillCategories: test.skillCategories || []
    }));
    
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
        tc.is_test_live as "isTestLive",
        tc.is_test_ended as "isTestEnded",
        tc.current_participants as "currentParticipants",
        COALESCE(participant_stats.total_participants, 0) as participants,
        COALESCE(participant_stats.completed_participants, 0) as "completedParticipants",
        ARRAY_AGG(DISTINCT q.skill_category_name) FILTER (WHERE q.skill_category_name IS NOT NULL) as "skillCategories"
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN questions q ON t.id = q.test_id
      LEFT JOIN (
        SELECT 
          test_id,
          COUNT(*) as total_participants,
          COUNT(CASE WHEN session_status = 'completed' THEN 1 END) as completed_participants
        FROM test_sessions
        GROUP BY test_id
      ) participant_stats ON t.id = participant_stats.test_id
      WHERE t.id = $1 AND t.created_by = $2
      GROUP BY t.id, tc.is_test_live, tc.is_test_ended, tc.current_participants, participant_stats.total_participants, participant_stats.completed_participants
    `;
    
    const result = await pool.query(query, [id, adminId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    const test = {
      ...result.rows[0],
      status: getTestStatus(result.rows[0]),
      skillCategories: result.rows[0].skillCategories || []
    };
    
    res.json({ test });
    
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ message: 'Internal server error while fetching test' });
  }
};

export const publishTest = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if test exists and has questions
      const testCheck = await client.query(
        'SELECT t.*, COUNT(q.id) as question_count FROM tests t LEFT JOIN questions q ON t.id = q.test_id WHERE t.id = $1 AND t.created_by = $2 GROUP BY t.id',
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
      
      // Update test controls
      await client.query(
        'UPDATE test_controls SET is_registration_open = true WHERE test_id = $1',
        [id]
      );
      
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

// Generate test code
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
         SET is_test_live = true, updated_by = $2
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

// Delete test
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
      
      // Check if test has participants
      const participantCheck = await client.query(
        'SELECT COUNT(*) as count FROM test_sessions WHERE test_id = $1',
        [id]
      );
      
      if (participantCheck.rows[0].count > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot delete test with participants' });
      }
      
      // Delete test (cascade will handle related records)
      await client.query('DELETE FROM tests WHERE id = $1 AND created_by = $2', [id, adminId]);
      
      await client.query('COMMIT');
      
      res.json({ message: 'Test deleted successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({ message: 'Internal server error while deleting test' });
  }
};

// Get test details by ID
export const getTestDetails = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    // Get test details with comprehensive information
    const testQuery = `
      SELECT 
        t.*,
        tc.is_registration_open as "isRegistrationOpen",
        tc.is_test_live as "isActive",
        tc.is_test_ended as "isTestEnded",
        tc.current_participants as "currentParticipants",
        tc.proctoring_enabled as "proctoringEnabled",
        COUNT(DISTINCT q.id) as "totalQuestions",
        COUNT(DISTINCT tr.user_id) as "totalRegistered",
        COUNT(DISTINCT ts.user_id) as "totalParticipants",
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as "completedParticipants",
        ARRAY_AGG(DISTINCT q.skill_category_name) FILTER (WHERE q.skill_category_name IS NOT NULL) as "skillCategories"
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN questions q ON t.id = q.test_id
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
    } else if (test.isActive) {
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
      totalQuestions: test.total_questions,
      isActive: test.isActive,
      isPublished: test.is_published,
      isTestEnded: test.isTestEnded,
      testCode: test.test_code,
      skillCategories: test.skillCategories || [],
      status: status,
      createdAt: test.created_at,
      updatedAt: test.updated_at,
      createdBy: test.created_by,
      // Additional stats
      totalRegistered: test.totalRegistered || 0,
      totalParticipants: test.totalParticipants || 0,
      completedParticipants: test.completedParticipants || 0,
      currentParticipants: test.currentParticipants || 0,
      proctoringEnabled: test.proctoringEnabled || false,
    };

    res.json(testDetails);

  } catch (error) {
    console.error('Error fetching test details:', error);
    res.status(500).json({ message: 'Internal server error while fetching test details' });
  }
};

// Get test questions
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

    // Get questions with options
    const questionsQuery = `
      SELECT 
        q.id,
        q.question_text as "questionText",
        q.skill_category_name as "skillCategoryName",
        q.question_order as "questionOrder",
        q.created_at as "createdAt",
        q.updated_at as "updatedAt",
        json_agg(
          json_build_object(
            'id', qo.id,
            'optionText', qo.option_text,
            'optionOrder', qo.option_order,
            'marks', qo.marks
          ) ORDER BY qo.option_order
        ) as options
      FROM questions q
      LEFT JOIN question_options qo ON q.id = qo.question_id
      WHERE q.test_id = $1
      GROUP BY q.id, q.question_text, q.skill_category_name, q.question_order, q.created_at, q.updated_at
      ORDER BY q.question_order
    `;

    const questionsResult = await pool.query(questionsQuery, [id]);

    res.json({
      questions: questionsResult.rows
    });

  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({ message: 'Internal server error while fetching questions' });
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
      
      // Check if test is active
      const testCheck = await pool.query(
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
      await client.query(
        'UPDATE test_controls SET is_registration_open = false WHERE test_id = $1',
        [id]
      );
      
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

// Activate test (start test)
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
         SET is_test_live = true, updated_by = $2
         WHERE test_id = $1`,
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

// End test
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

// Get test participants
// Enhanced version of getTestParticipants with better data handling
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
        registrationNumber: participant.registrationNumber,
        organization: participant.organization,
        
        // Session data
        sessionId: participant.sessionId,
        
        // Registration data
        registrationId: participant.registrationId,
        registeredAt: participant.registeredAt || participant.sessionCreatedAt,
        approvedAt: participant.approvedAt,
        
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

// Helper function to determine test status
const getTestStatus = (test) => {
  if (!test.is_published) return 'draft';
  if (test.is_test_ended) return 'completed';
  if (test.is_active || test.is_test_live) return 'active';
  if (test.is_published) return 'published';
  return 'draft';
};

// Get test details for editing
export const getTestForEdit = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  
  try {
    // Get test basic info
    const testQuery = `
      SELECT 
        t.*,
        tc.is_test_live as "isTestLive",
        tc.is_test_ended as "isTestEnded",
        tc.current_participants as "currentParticipants"
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.created_by = $2
    `;
    
    const testResult = await pool.query(testQuery, [id, adminId]);
    
    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    const test = testResult.rows[0];
    
    // Get questions with options
    const questionsQuery = `
      SELECT 
        q.id,
        q.question_text as "questionText",
        q.skill_category_name as "skillCategoryName",
        q.question_order as "questionOrder",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', qo.id,
            'text', qo.option_text,
            'marks', qo.marks,
            'optionOrder', qo.option_order
          ) ORDER BY qo.option_order
        ) as options
      FROM questions q
      LEFT JOIN question_options qo ON q.id = qo.question_id
      WHERE q.test_id = $1
      GROUP BY q.id, q.question_text, q.skill_category_name, q.question_order
      ORDER BY q.question_order
    `;
    
    const questionsResult = await pool.query(questionsQuery, [id]);
    
    // Get unique skill categories
    const skillCategoriesQuery = `
      SELECT DISTINCT skill_category_name
      FROM questions
      WHERE test_id = $1
      ORDER BY skill_category_name
    `;
    
    const skillsResult = await pool.query(skillCategoriesQuery, [id]);
    const skillCategories = skillsResult.rows.map(row => row.skill_category_name);
    
    res.json({
      ...test,
      questions: questionsResult.rows,
      skillCategories
    });
    
  } catch (error) {
    console.error('Error fetching test for edit:', error);
    res.status(500).json({ message: 'Internal server error while fetching test data' });
  }
};

// Update test basic information
export const updateTestInfo = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const { 
    title, 
    description, 
    instructions, 
    rules, 
    timePerQuestion, 
  } = req.body;
  
  try {
    // Check if test exists and belongs to admin
    const testCheck = await pool.query(
      'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Don't allow editing if test is active
    if (testCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot edit an active test' });
    }
    
    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Test title is required' });
    }
    
    if (timePerQuestion && (timePerQuestion < 5 || timePerQuestion > 300)) {
      return res.status(400).json({ message: 'Time per question must be between 5 and 300 seconds' });
    }
    
    // Update test
    const updateQuery = `
      UPDATE tests 
      SET 
        title = $1,
        description = $2,
        instructions = $3,
        rules = $4,
        time_per_question = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND created_by = $7
      RETURNING *
    `;
    
    const values = [
      title.trim(),
      description?.trim() || null,
      instructions?.trim() || null,
      rules?.trim() || null,
      timePerQuestion || 15,
      id,
      adminId
    ];
    
    const result = await pool.query(updateQuery, values);
    
    res.json({
      message: 'Test information updated successfully',
      test: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating test info:', error);
    res.status(500).json({ message: 'Internal server error while updating test' });
  }
};

// Add new question to test
export const addQuestion = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const { 
    questionText, 
    skillCategoryName, 
    options,  
    questionOrder 
  } = req.body;
  
  try {
    // Check if test exists and belongs to admin
    const testCheck = await pool.query(
      'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Don't allow editing if test is active
    if (testCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot edit an active test' });
    }
    
    // Validation
    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ message: 'Question text is required' });
    }
    
    if (!skillCategoryName || !skillCategoryName.trim()) {
      return res.status(400).json({ message: 'Skill category is required' });
    }
    
    if (!options || options.length < 2) {
      return res.status(400).json({ message: 'At least 2 options are required' });
    }
    
    // Validate options
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      if (!option.text || !option.text.trim()) {
        return res.status(400).json({ message: `Option ${i + 1}: Option text is required` });
      }
      if (typeof option.marks !== 'number' || option.marks < 0) {
        return res.status(400).json({ message: `Option ${i + 1}: Valid marks are required` });
      }
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current max question order
      const maxOrderResult = await client.query(
        'SELECT COALESCE(MAX(question_order), 0) as max_order FROM questions WHERE test_id = $1',
        [id]
      );
      
      const nextOrder = questionOrder || (maxOrderResult.rows[0].max_order + 1);
      
      // Insert question
      const questionQuery = `
        INSERT INTO questions (test_id, skill_category_name, question_text, question_order)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const questionValues = [
        id,
        skillCategoryName.trim(),
        questionText.trim(),
        nextOrder,
      ];
      
      const questionResult = await client.query(questionQuery, questionValues);
      const questionId = questionResult.rows[0].id;
      
      // Insert options
      const insertedOptions = [];
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        
        const optionQuery = `
          INSERT INTO question_options (question_id, option_text, option_order, marks)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        
        const optionValues = [
          questionId,
          option.text.trim(),
          i + 1,
          option.marks,
        ];
        
        const optionResult = await client.query(optionQuery, optionValues);
        insertedOptions.push(optionResult.rows[0]);
      }
      
      // Update total questions count
      await client.query(
        'UPDATE tests SET total_questions = (SELECT COUNT(*) FROM questions WHERE test_id = $1) WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      const newQuestion = {
        ...questionResult.rows[0],
        options: insertedOptions
      };
      
      res.status(201).json({
        message: 'Question added successfully',
        question: newQuestion
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ message: 'Internal server error while adding question' });
  }
};

// Update existing question
export const updateQuestion = async (req, res) => {
  const { id, questionId } = req.params;
  const adminId = req.user.id;
  const { 
    questionText, 
    skillCategoryName, 
    options,  
  } = req.body;
  
  try {
    // Check if test exists and belongs to admin
    const testCheck = await pool.query(
      'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Don't allow editing if test is active
    if (testCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot edit an active test' });
    }
    
    // Check if question exists in this test
    const questionCheck = await pool.query(
      'SELECT * FROM questions WHERE id = $1 AND test_id = $2',
      [questionId, id]
    );
    
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    // Validation
    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ message: 'Question text is required' });
    }
    
    if (!skillCategoryName || !skillCategoryName.trim()) {
      return res.status(400).json({ message: 'Skill category is required' });
    }
    
    if (!options || options.length < 2) {
      return res.status(400).json({ message: 'At least 2 options are required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update question
      const questionQuery = `
        UPDATE questions 
        SET 
          question_text = $1,
          skill_category_name = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND test_id = $4
        RETURNING *
      `;
      
      const questionValues = [
        questionText.trim(),
        skillCategoryName.trim(),
        questionId,
        id
      ];
      
      const questionResult = await client.query(questionQuery, questionValues);
      
      // Delete existing options
      await client.query('DELETE FROM question_options WHERE question_id = $1', [questionId]);
      
      // Insert new options
      const insertedOptions = [];
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        
        const optionQuery = `
          INSERT INTO question_options (question_id, option_text, option_order, marks)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        
        const optionValues = [
          questionId,
          option.text.trim(),
          i + 1,
          option.marks,
        ];
        
        const optionResult = await client.query(optionQuery, optionValues);
        insertedOptions.push(optionResult.rows[0]);
      }
      
      await client.query('COMMIT');
      
      const updatedQuestion = {
        ...questionResult.rows[0],
        options: insertedOptions
      };
      
      res.json({
        message: 'Question updated successfully',
        question: updatedQuestion
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Internal server error while updating question' });
  }
};

// Delete question
export const deleteQuestion = async (req, res) => {
  const { id, questionId } = req.params;
  const adminId = req.user.id;
  
  try {
    // Check if test exists and belongs to admin
    const testCheck = await pool.query(
      'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Don't allow editing if test is active
    if (testCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot edit an active test' });
    }
    
    // Check if question exists in this test
    const questionCheck = await pool.query(
      'SELECT * FROM questions WHERE id = $1 AND test_id = $2',
      [questionId, id]
    );
    
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete question (cascade will handle options)
      await client.query('DELETE FROM questions WHERE id = $1 AND test_id = $2', [questionId, id]);
      
      // Update question orders for remaining questions
      await client.query(`
        UPDATE questions 
        SET question_order = question_order - 1 
        WHERE test_id = $1 AND question_order > $2
      `, [id, questionCheck.rows[0].question_order]);
      
      // Update total questions count
      await client.query(
        'UPDATE tests SET total_questions = (SELECT COUNT(*) FROM questions WHERE test_id = $1) WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      res.json({ message: 'Question deleted successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Internal server error while deleting question' });
  }
};

// Reorder questions
export const reorderQuestions = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const { questionIds } = req.body; // Array of question IDs in new order
  
  try {
    // Check if test exists and belongs to admin
    const testCheck = await pool.query(
      'SELECT * FROM tests WHERE id = $1 AND created_by = $2',
      [id, adminId]
    );
    
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Don't allow editing if test is active
    if (testCheck.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot edit an active test' });
    }
    
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({ message: 'Invalid question IDs array' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update question orders
      for (let i = 0; i < questionIds.length; i++) {
        await client.query(
          'UPDATE questions SET question_order = $1 WHERE id = $2 AND test_id = $3',
          [i + 1, questionIds[i], id]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ message: 'Questions reordered successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error reordering questions:', error);
    res.status(500).json({ message: 'Internal server error while reordering questions' });
  }
};

// Get available skill categories
export const getSkillCategories = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT skill_category_name
      FROM questions
      WHERE skill_category_name IS NOT NULL
      ORDER BY skill_category_name
    `;
    
    const result = await pool.query(query);
    const skillCategories = result.rows.map(row => row.skill_category_name);
    
    res.json({ skillCategories });
    
  } catch (error) {
    console.error('Error fetching skill categories:', error);
    res.status(500).json({ message: 'Internal server error while fetching skill categories' });
  }
};