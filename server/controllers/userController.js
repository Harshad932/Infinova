import {pool}  from "../config/db.js";

export const getActiveTests = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.instructions,
        t.rules,
        t.time_per_question,
        t.total_questions,
        t.test_code,
        t.is_active,
        t.is_published,
        t.created_at,
        t.updated_at,
        tc.is_registration_open,
        tc.is_test_live,
        tc.is_test_ended,

        tc.current_participants,
        COUNT(DISTINCT tr.user_id) as total_registered,
        COUNT(DISTINCT ts.user_id) as total_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as completed_participants,
        ARRAY_AGG(DISTINCT q.skill_category_name) FILTER (WHERE q.skill_category_name IS NOT NULL) as skill_categories
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN test_registrations tr ON t.id = tr.test_id
      LEFT JOIN test_sessions ts ON t.id = ts.test_id
      LEFT JOIN questions q ON t.id = q.test_id
      WHERE t.is_published = true 
        AND (tc.is_test_ended = false OR tc.is_test_ended IS NULL)
      GROUP BY 
        t.id, t.title, t.description, t.instructions, t.rules, 
        t.time_per_question, t.total_questions, t.test_code, 
        t.is_active, t.is_published, t.created_at, t.updated_at,
        tc.is_registration_open, tc.is_test_live, tc.is_test_ended, 
        tc.current_participants
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query);
    
    // Format the response data and filter out completed tests
    const formattedTests = result.rows
      .map(test => {
        // Determine test status based on test control flags
        let status = 'upcoming';

        // Check if test is completed
        if (test.is_test_ended) {
          status = 'completed';
        } else if (test.is_test_live) {
          status = 'active';
        } else if (test.is_registration_open) {
          status = 'active';
        }

        return {
          id: test.id,
          title: test.title,
          description: test.description,
          instructions: test.instructions,
          rules: test.rules,
          test_code: test.test_code,
          time_per_question: test.time_per_question,
          total_questions: parseInt(test.total_questions) || 0,
          current_participants: parseInt(test.current_participants) || 0,
          skill_categories: test.skill_categories || [],
          status: status,
          is_registration_open: test.is_registration_open,
          is_test_live: test.is_test_live,
          is_active: test.is_active,
          is_published: test.is_published,
          created_at: test.created_at,
          updated_at: test.updated_at,
          // Statistics
          total_registered: parseInt(test.total_registered) || 0,
          total_participants: parseInt(test.total_participants) || 0,
          completed_participants: parseInt(test.completed_participants) || 0
        };
      })
      // Filter out completed tests
      .filter(test => test.status !== 'completed');

    res.json({
      success: true,
      message: 'Published tests fetched successfully',
      tests: formattedTests,
      total: formattedTests.length
    });

  } catch (error) {
    console.error('Error fetching active tests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching tests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

export const getTestInfo = async (req, res) => {
  try {
    const { testId } = req.params;

    // Validate testId
    if (!testId || isNaN(parseInt(testId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID provided'
      });
    }

    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.instructions,
        t.rules,
        t.time_per_question,
        t.total_questions,
        t.test_code,
        t.is_active,
        t.is_published,
        t.created_at,
        t.updated_at,
        tc.is_registration_open,
        tc.is_test_live,
        tc.is_test_ended,
        tc.current_participants,
        COUNT(DISTINCT tr.user_id) as total_registered,
        COUNT(DISTINCT ts.user_id) as total_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as completed_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'in_progress' THEN ts.user_id END) as in_progress_participants,
        ARRAY_AGG(DISTINCT q.skill_category_name) FILTER (WHERE q.skill_category_name IS NOT NULL) as skill_categories
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN test_registrations tr ON t.id = tr.test_id
      LEFT JOIN test_sessions ts ON t.id = ts.test_id
      LEFT JOIN questions q ON t.id = q.test_id
      WHERE t.id = $1
      GROUP BY 
        t.id, t.title, t.description, t.instructions, t.rules, 
        t.time_per_question, t.total_questions, t.test_code, 
        t.is_active, t.is_published, t.created_at, t.updated_at,
        tc.is_registration_open, tc.is_test_live, tc.is_test_ended, 
        tc.current_participants
    `;

    const result = await pool.query(query, [parseInt(testId)]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const testData = result.rows[0];

    // Check if test is published
    if (!testData.is_published) {
      return res.status(403).json({
        success: false,
        message: 'Test is not published yet'
      });
    }

    // Determine test status
    let testStatus = 'upcoming';
    let registrationStatus = 'closed';

    if (testData.is_test_ended) {
      testStatus = 'completed';
      registrationStatus = 'closed';
    } else if (testData.is_test_live) {
      testStatus = 'live';
      registrationStatus = testData.is_registration_open ? 'open' : 'closed';
    } else if (testData.is_registration_open) {
      testStatus = 'registration_open';
      registrationStatus = 'open';
    }

    // Format the response data
    const formattedTest = {
      id: testData.id,
      title: testData.title,
      description: testData.description,
      instructions: testData.instructions,
      rules: testData.rules,
      test_code: testData.test_code,
      time_per_question: testData.time_per_question,
      total_questions: parseInt(testData.total_questions) || 0,
      current_participants: parseInt(testData.current_participants) || 0,
      skill_categories: testData.skill_categories || [],
      
      // Status information
      status: testStatus,
      registration_status: registrationStatus,
      is_registration_open: testData.is_registration_open,
      is_test_live: testData.is_test_live,
      is_test_ended: testData.is_test_ended,
      is_active: testData.is_active,
      is_published: testData.is_published,
      
      // Timestamps
      created_at: testData.created_at,
      updated_at: testData.updated_at,
      
      // Participation statistics
      total_registered: parseInt(testData.total_registered) || 0,
      total_participants: parseInt(testData.total_participants) || 0,
      completed_participants: parseInt(testData.completed_participants) || 0,
      in_progress_participants: parseInt(testData.in_progress_participants) || 0,
    
    };

    res.json({
      success: true,
      message: 'Test information retrieved successfully',
      test: formattedTest
    });

  } catch (error) {
    console.error('Error fetching test info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching test information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};