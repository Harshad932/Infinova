import {pool}  from "../config/db.js";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL, 
    pass: process.env.APP_PASSWORD, 
  },
});

export const getActiveTests = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.time_per_question,
        t.total_questions,
        t.test_code,
        t.is_active,
        t.is_published,
        t.is_live,
        t.created_at,
        t.updated_at,
        tc.is_registration_open,
        tc.is_test_live,
        tc.is_test_started,
        tc.is_test_ended,
        tc.current_participants,
        COUNT(DISTINCT tr.user_id) as total_registered,
        COUNT(DISTINCT ts.user_id) as total_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as completed_participants
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN test_registrations tr ON t.id = tr.test_id AND tr.registration_status = 'registered'
      LEFT JOIN test_sessions ts ON t.id = ts.test_id
      WHERE t.is_published = true 
        OR t.is_active = true
        AND (tc.is_test_ended IS NULL OR tc.is_test_ended = false)
      GROUP BY 
        t.id, t.title, t.description, 
        t.time_per_question, t.total_questions,
        t.test_code, t.is_active, t.is_published, t.is_live, t.created_at, t.updated_at,
        tc.is_registration_open, tc.is_test_live, tc.is_test_started, tc.is_test_ended, 
        tc.current_participants
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query);
    
    // Format the response data and filter out completed tests
    const formattedTests = result.rows
      .map(test => {
        // Determine test status based on test control flags and test properties
        let status = 'upcoming';

        // Check if test is completed
        if (test.is_test_ended) {
          status = 'completed';
        } else if (test.is_test_started && test.is_test_live) {
          status = 'active';
        } else if (test.is_registration_open) {
          status = 'registration_open';
        } else if (test.is_live) {
          status = 'upcoming';
        }

        return {
          id: test.id,
          title: test.title,
          description: test.description,
          test_code: test.test_code,
          time_per_question: test.time_per_question,
          total_questions: parseInt(test.total_questions) || 0,
          current_participants: parseInt(test.current_participants) || 0,
          status: status,
          is_registration_open: test.is_registration_open || false,
          is_test_live: test.is_test_live || false,
          is_test_started: test.is_test_started || false,
          is_test_ended: test.is_test_ended || false,
          is_active: test.is_active,
          is_published: test.is_published,
          is_live: test.is_live,
          created_at: test.created_at,
          updated_at: test.updated_at,
          // Statistics
          total_registered: parseInt(test.total_registered) || 0,
          total_participants: parseInt(test.total_participants) || 0,
          completed_participants: parseInt(test.completed_participants) || 0
        };
      })
      // Filter out completed tests (only show active, registration_open, and upcoming tests)
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
        t.total_categories,
        t.total_subcategories,
        t.test_code,
        t.is_active,
        t.is_published,
        t.is_live,
        t.created_at,
        t.updated_at,
        tc.is_registration_open,
        tc.is_test_live,
        tc.is_test_started,
        tc.is_test_ended,
        tc.current_participants,
        COUNT(DISTINCT tr.user_id) as total_registered,
        COUNT(DISTINCT ts.user_id) as total_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'completed' THEN ts.user_id END) as completed_participants,
        COUNT(DISTINCT CASE WHEN ts.session_status = 'in_progress' THEN ts.user_id END) as in_progress_participants,
        ARRAY_AGG(DISTINCT tcat.name) FILTER (WHERE tcat.name IS NOT NULL) as categories,
        ARRAY_AGG(DISTINCT tsub.name) FILTER (WHERE tsub.name IS NOT NULL) as subcategories
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      LEFT JOIN test_registrations tr ON t.id = tr.test_id
      LEFT JOIN test_sessions ts ON t.id = ts.test_id
      LEFT JOIN test_categories tcat ON t.id = tcat.test_id AND tcat.is_active = true
      LEFT JOIN test_subcategories tsub ON t.id = tsub.test_id AND tsub.is_active = true
      WHERE t.id = $1
      GROUP BY 
        t.id, t.title, t.description, t.instructions, t.rules, 
        t.time_per_question, t.total_questions, t.total_categories, t.total_subcategories, t.test_code, 
        t.is_active, t.is_published, t.is_live, t.created_at, t.updated_at,
        tc.is_registration_open, tc.is_test_live, tc.is_test_started, tc.is_test_ended, 
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
      total_categories: parseInt(testData.total_categories) || 0,
      total_subcategories: parseInt(testData.total_subcategories) || 0,
      current_participants: parseInt(testData.current_participants) || 0,
      categories: testData.categories || [],
      subcategories: testData.subcategories || [],
      
      // Status information
      status: testStatus,
      registration_status: registrationStatus,
      is_registration_open: testData.is_registration_open,
      is_test_live: testData.is_test_live,
      is_test_started: testData.is_test_started,
      is_test_ended: testData.is_test_ended,
      is_active: testData.is_active,
      is_published: testData.is_published,
      is_live: testData.is_live,
      
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

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, userName) => {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your OTP for Test Registration',
    html: `
      <h2>Test Registration OTP</h2>
      <p>Hello ${userName},</p>
      <p>Your OTP for test registration is: <strong>${otp}</strong></p>
      <p>This OTP will expire in 5 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <br>
      <p>Best regards,<br>Infinova Test Platform</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// User Registration Function
export const registerUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, email, phone, testId } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !testId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required (name, email, phone, testId)'
      });
    }

    // Validate email format - more strict regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate phone format - Indian phone number format
    const phoneRegex = /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/;
    const cleanPhone = phone.replace(/\D/g, '');
    if (!phoneRegex.test(phone) || cleanPhone.length < 10 || cleanPhone.length > 12) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number'
      });
    }

    await client.query('BEGIN');

    // Check if test exists and is accepting registrations
    const testQuery = `
      SELECT t.id, t.title, tc.is_registration_open, tc.is_test_ended
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.is_published = true
    `;
    const testResult = await client.query(testQuery, [testId]);

    if (testResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Test not found or not published'
      });
    }

    const testData = testResult.rows[0];
    if (!testData.is_registration_open || testData.is_test_ended) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Registration is not open for this test'
      });
    }

    // Check for duplicate email globally
    const existingEmailUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    // Check for duplicate phone globally
    const existingPhoneUser = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);

    // Check existing registration status for this test
    const existingRegistration = await client.query(`
      SELECT 
        u.id as user_id,
        tr.registration_status,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM user_otps uo 
            WHERE uo.user_id = u.id AND uo.is_verified = true 
            AND uo.expires_at > NOW() - INTERVAL '1 hour'
          ) THEN true 
          ELSE false 
        END as is_email_verified,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM test_sessions ts 
            WHERE ts.user_id = u.id AND ts.test_id = tr.test_id 
            AND ts.session_status IN ('completed', 'in_progress')
          ) THEN true 
          ELSE false 
        END as has_test_session
      FROM users u 
      JOIN test_registrations tr ON u.id = tr.user_id 
      WHERE u.email = $1 AND tr.test_id = $2
    `, [email, testId]);

    if (existingRegistration.rows.length > 0) {
      const regData = existingRegistration.rows[0];
      
      // If email verified but no test session, allow to proceed to test code step
      if (regData.is_email_verified && !regData.has_test_session) {
        await client.query('COMMIT');
        return res.json({
          success: true,
          message: 'User already verified. Proceeding to test code verification.',
          userId: regData.user_id,
          isEmailVerified: true,
          proceedToTestCode: true
        });
      }
      
      // If already completed or in progress, block registration
      if (regData.has_test_session) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'You have already started/completed this test'
        });
      }
    }

    // Check for duplicate email with different user for this test
    if (existingEmailUser.rows.length > 0) {
      const existingUserId = existingEmailUser.rows[0].id;
      
      // Check if this email is registered for this specific test
      const emailTestRegistration = await client.query(
        'SELECT id FROM test_registrations WHERE user_id = $1 AND test_id = $2',
        [existingUserId, testId]
      );
      
      if (emailTestRegistration.rows.length === 0) {
        // Email exists but not registered for this test - check if phone matches
        const existingUserDetails = await client.query('SELECT phone FROM users WHERE id = $1', [existingUserId]);
        
        if (existingUserDetails.rows[0].phone !== phone) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: 'This email is already registered with a different phone number'
          });
        }
      }
    }

    // Check for duplicate phone with different email
    if (existingPhoneUser.rows.length > 0) {
      const existingUserWithPhone = await client.query('SELECT email FROM users WHERE phone = $1', [phone]);
      
      if (existingUserWithPhone.rows[0].email !== email) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered with a different email'
        });
      }
    }

    // Create or get user
    let userId;
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Update user information
      await client.query(
        'UPDATE users SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [name, phone, userId]
      );
    } else {
      // Create new user
      const userResult = await client.query(
        'INSERT INTO users (name, email, phone) VALUES ($1, $2, $3) RETURNING id',
        [name, email, phone]
      );
      userId = userResult.rows[0].id;
    }

    // Create test registration
    await client.query(
      'INSERT INTO test_registrations (test_id, user_id) VALUES ($1, $2) ON CONFLICT (test_id, user_id) DO NOTHING',
      [testId, userId]
    );

    // Check if user already has verified OTP for this test
    const verifiedOtpQuery = `
      SELECT id FROM user_otps 
      WHERE user_id = $1 AND is_verified = true AND expires_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const verifiedOtpResult = await client.query(verifiedOtpQuery, [userId]);

    let isEmailVerified = verifiedOtpResult.rows.length > 0;

    if (!isEmailVerified) {
      // Generate and store OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Delete any existing OTPs for this user
      await client.query('DELETE FROM user_otps WHERE user_id = $1', [userId]);

      // Insert new OTP
      await client.query(
        'INSERT INTO user_otps (user_id, email, otp_code, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, email, otp, expiresAt]
      );

      // Send OTP email
      try {
        await sendOTPEmail(email, otp, name);
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Don't fail the registration if email fails
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: isEmailVerified ? 'User verified successfully' : 'Registration successful. OTP sent to your email.',
      userId: userId,
      isEmailVerified: isEmailVerified,
      proceedToTestCode: isEmailVerified
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  } finally {
    client.release();
  }
};

// OTP Verification Function
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp, userId } = req.body;

    // Validate required fields
    if (!email || !otp || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and User ID are required'
      });
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format. OTP must be 6 digits.'
      });
    }

    // Check OTP in database
    const otpQuery = `
      SELECT id, is_verified, expires_at, attempt_count
      FROM user_otps 
      WHERE user_id = $1 AND email = $2 AND otp_code = $3
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const otpResult = await pool.query(otpQuery, [userId, email, otp]);

    if (otpResult.rows.length === 0) {
      // Increment attempt count for failed attempts
      await pool.query(
        'UPDATE user_otps SET attempt_count = attempt_count + 1 WHERE user_id = $1 AND email = $2 AND expires_at > NOW()',
        [userId, email]
      );
      
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    const otpData = otpResult.rows[0];

    // Check if OTP is already verified
    if (otpData.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'OTP already verified'
      });
    }

    // Check if OTP has expired
    if (new Date() > new Date(otpData.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Check attempt count (max 3 attempts)
    if (otpData.attempt_count >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.'
      });
    }

    // Mark OTP as verified
    await pool.query(
      'UPDATE user_otps SET is_verified = true, attempt_count = attempt_count + 1 WHERE id = $1',
      [otpData.id]
    );

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OTP verification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Resend OTP Function
export const resendOTP = async (req, res) => {
  try {
    const { email, userId } = req.body;

    // Validate required fields
    if (!email || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Email and User ID are required'
      });
    }

    // Get user details
    const userQuery = 'SELECT name FROM users WHERE id = $1 AND email = $2';
    const userResult = await pool.query(userQuery, [userId, email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userName = userResult.rows[0].name;

    // Check if there's a recent OTP request (prevent spam)
    const recentOtpQuery = `
      SELECT created_at FROM user_otps 
      WHERE user_id = $1 AND email = $2 AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const recentOtpResult = await pool.query(recentOtpQuery, [userId, email]);

    if (recentOtpResult.rows.length > 0) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete old OTPs for this user
    await pool.query('DELETE FROM user_otps WHERE user_id = $1', [userId]);

    // Insert new OTP
    await pool.query(
      'INSERT INTO user_otps (user_id, email, otp_code, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, email, otp, expiresAt]
    );

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, userName);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.json({
      success: true,
      message: 'OTP resent successfully'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OTP resend',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Test Code Verification Function
export const verifyTestCode = async (req, res) => {
  try {
    const { testCode, testId, userId } = req.body;

    // Validate required fields
    if (!testCode || !testId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Test code, Test ID, and User ID are required'
      });
    }

    // Verify test code
    const testQuery = `
      SELECT t.id, t.title, t.test_code, tc.is_test_live, tc.is_test_ended
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.test_code = $2 AND t.is_published = true
    `;
    const testResult = await pool.query(testQuery, [testId, testCode]);

    if (testResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test code'
      });
    }

    const testData = testResult.rows[0];

    // Check if test is ended
    if (testData.is_test_ended) {
      return res.status(403).json({
        success: false,
        message: 'Test has already ended'
      });
    }

    // Check if user is registered for this test
    const registrationQuery = `
      SELECT id FROM test_registrations 
      WHERE test_id = $1 AND user_id = $2 AND registration_status = 'registered'
    `;
    const registrationResult = await pool.query(registrationQuery, [testId, userId]);

    if (registrationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User not registered for this test'
      });
    }

    // Check if user has already started the test
    const sessionQuery = `
      SELECT id, session_status FROM test_sessions 
      WHERE test_id = $1 AND user_id = $2
    `;
    const sessionResult = await pool.query(sessionQuery, [testId, userId]);

    if (sessionResult.rows.length > 0) {
      const sessionStatus = sessionResult.rows[0].session_status;
      if (sessionStatus === 'completed') {
        return res.status(403).json({
          success: false,
          message: 'You have already completed this test'
        });
      } else if (sessionStatus === 'in_progress') {
        return res.status(403).json({
          success: false,
          message: 'You have already started this test'
        });
      }
    }

    // Check if test is active (add this before the final response)
    const isTestActive = testData.is_test_live && testData.is_test_started && !testData.is_test_ended;

    res.json({
      success: true,
      message: 'Test code verified successfully',
      isTestActive: isTestActive
    });

  } catch (error) {
    console.error('Test code verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during test code verification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Test Status Check Function
export const getTestStatus = async (req, res) => {
  try {
    const { testId } = req.params;

    // Validate testId
    if (!testId || isNaN(parseInt(testId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test ID'
      });
    }

    // Get test status
    const statusQuery = `
      SELECT 
        t.id, t.title, t.is_active, t.is_published,
        tc.is_registration_open, tc.is_test_live, tc.is_test_started, tc.is_test_ended,
        tc.current_participants
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.is_published = true
    `;
    const statusResult = await pool.query(statusQuery, [testId]);

    if (statusResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const testData = statusResult.rows[0];

    res.json({
      success: true,
      isTestStarted: testData.is_test_started && testData.is_test_live,
      isTestEnded: testData.is_test_ended,
      isRegistrationOpen: testData.is_registration_open,
      currentParticipants: testData.current_participants || 0
    });

  } catch (error) {
    console.error('Test status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during test status check',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Start Test Function
export const startTest = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { testId, userId } = req.body;

    // Validate required fields
    if (!testId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and User ID are required'
      });
    }

    await client.query('BEGIN');

    // Check if test is ready to start
    const testQuery = `
      SELECT 
        t.id, t.title, t.total_questions, t.time_per_question,
        tc.is_test_live, tc.is_test_started, tc.is_test_ended
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.is_published = true
    `;
    const testResult = await client.query(testQuery, [testId]);

    if (testResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const testData = testResult.rows[0];

    // Check if test is ready to start
    if (!testData.is_test_started || !testData.is_test_live) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Test has not been started yet'
      });
    }

    if (testData.is_test_ended) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Test has ended'
      });
    }

    // Check if user is registered
    const registrationQuery = `
      SELECT id FROM test_registrations 
      WHERE test_id = $1 AND user_id = $2 AND registration_status = 'registered'
    `;
    const registrationResult = await client.query(registrationQuery, [testId, userId]);

    if (registrationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'User not registered for this test'
      });
    }

    // Check if user already has a session
    const existingSessionQuery = `
      SELECT id, session_status FROM test_sessions 
      WHERE test_id = $1 AND user_id = $2
    `;
    const existingSessionResult = await client.query(existingSessionQuery, [testId, userId]);

    if (existingSessionResult.rows.length > 0) {
      const sessionStatus = existingSessionResult.rows[0].session_status;
      if (sessionStatus === 'completed') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'You have already completed this test'
        });
      } else if (sessionStatus === 'in_progress') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'You have already started this test'
        });
      }
    }

    // Generate session token
    const sessionToken = jwt.sign(
      { userId, testId, timestamp: Date.now() },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );

    // Create test session
    const sessionQuery = `
      INSERT INTO test_sessions (
        test_id, user_id, session_token, session_status, 
        total_questions, browser_info, ip_address, started_at
      ) VALUES ($1, $2, $3, 'in_progress', $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    
    const browserInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    
    const sessionResult = await client.query(sessionQuery, [
      testId, userId, sessionToken, testData.total_questions, browserInfo, ipAddress
    ]);

    const sessionId = sessionResult.rows[0].id;

    // Update current participants count
    await client.query(
      'UPDATE test_controls SET current_participants = current_participants + 1 WHERE test_id = $1',
      [testId]
    );

    // Log activity
    await client.query(
      `INSERT INTO test_activity_logs (test_id, user_id, session_id, activity_type, ip_address, user_agent) 
       VALUES ($1, $2, $3, 'test_started', $4, $5)`,
      [testId, userId, sessionId, ipAddress, browserInfo]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Test started successfully',
      sessionToken: sessionToken,
      sessionId: sessionId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start test error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during test start',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  } finally {
    client.release();
  }
};

export const initializeTest = async (req, res) => {
  try {
    const { testId, userId } = req.body;

    // Validate required fields
    if (!testId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and User ID are required'
      });
    }

    const testIdNum = parseInt(testId);
    const userIdNum = parseInt(userId);

    if (isNaN(testIdNum) || isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and User ID must be valid numbers'
      });
    }

    // Check if test exists and is active
    const testQuery = `
      SELECT 
        t.id, t.title, t.description, t.instructions, t.rules,
        t.time_per_question, t.total_questions, t.is_active, t.is_published,
        tc.is_registration_open, tc.is_test_live, tc.is_test_started, tc.is_test_ended
      FROM tests t
      LEFT JOIN test_controls tc ON t.id = tc.test_id
      WHERE t.id = $1 AND t.is_published = true
    `;

    const testResult = await pool.query(testQuery, [parseInt(testId)]);

    if (testResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found or not published'
      });
    }

    const testData = testResult.rows[0];

    // Check if test is live and can be taken
    if (!testData.is_test_live || testData.is_test_ended) {
      return res.status(403).json({
        success: false,
        message: 'Test is not currently available'
      });
    }

    // Check if user is registered for this test
    const registrationQuery = `
      SELECT registration_status FROM test_registrations
      WHERE test_id = $1 AND user_id = $2
    `;
    const registrationResult = await pool.query(registrationQuery, [testId, userId]);

    if (registrationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User not registered for this test'
      });
    }

    // Check if user already has a session for this test
    const existingSessionQuery = `
      SELECT id, session_status, current_question_order
      FROM test_sessions
      WHERE test_id = $1 AND user_id = $2
    `;
    const existingSessionResult = await pool.query(existingSessionQuery, [testId, userId]);

    let sessionId;
    let currentQuestionIndex = 0;

    if (existingSessionResult.rows.length > 0) {
      const existingSession = existingSessionResult.rows[0];
      
      if (existingSession.session_status === 'completed') {
        return res.status(403).json({
          success: false,
          message: 'Test has already been completed'
        });
      }

      // Resume existing session
      sessionId = existingSession.id;
      currentQuestionIndex = existingSession.current_question_order - 1; // Convert to 0-based index
    } else {
      // Create new session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const browserInfo = req.headers['user-agent'] || 'Unknown';
      const ipAddress = req.ip || req.connection.remoteAddress;

      const createSessionQuery = `
        INSERT INTO test_sessions (
          test_id, user_id, session_token, session_status, 
          current_question_order, total_questions, browser_info, ip_address, started_at
        ) VALUES ($1, $2, $3, 'in_progress', 1, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      const sessionResult = await pool.query(createSessionQuery, [
        testId, userId, sessionToken, testData.total_questions, browserInfo, ipAddress
      ]);

      sessionId = sessionResult.rows[0].id;
    }

    res.json({
      success: true,
      message: 'Test initialized successfully',
      test: {
        id: testData.id,
        title: testData.title,
        description: testData.description,
        instructions: testData.instructions,
        rules: testData.rules,
        timePerQuestion: testData.time_per_question
      },
      sessionId: sessionId,
      totalQuestions: testData.total_questions,
      currentQuestionIndex: currentQuestionIndex
    });

  } catch (error) {
    console.error('Error initializing test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while initializing test',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Replace the entire fetchCurrentQuestion function with this:
export const fetchCurrentQuestion = async (req, res) => {
  try {
    const { testId, userId, questionIndex } = req.body;

    // Validate inputs
    if (!testId || !userId || questionIndex === undefined || questionIndex === null) {
      return res.status(400).json({
        success: false,
        message: 'Test ID, User ID, and Question Index are required'
      });
    }

    // Convert to numbers to ensure proper comparison
    const testIdNum = parseInt(testId);
    const userIdNum = parseInt(userId);
    const questionIndexNum = parseInt(questionIndex);

    // Get user's session
    const sessionQuery = `
      SELECT id, session_status, current_question_order, total_questions
      FROM test_sessions
      WHERE test_id = $1 AND user_id = $2
    `;
    const sessionResult = await pool.query(sessionQuery, [testIdNum, userIdNum]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test session not found'
      });
    }

    const session = sessionResult.rows[0];

    if (session.session_status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test completed'
      });
    }

    // Check if all questions are completed
    if (questionIndexNum >= session.total_questions) {
      return res.status(400).json({
        success: false,
        message: 'Test completed'
      });
    }

    // Get the question at the specified index (1-based in database)
    const questionQuery = `
      SELECT 
        tq.id, tq.question_text, tq.question_order,
        tc.name as category_name,
        tsc.name as subcategory_name,
        t.time_per_question
      FROM test_questions tq
      JOIN test_categories tc ON tq.category_id = tc.id
      JOIN test_subcategories tsc ON tq.subcategory_id = tsc.id
      JOIN tests t ON tq.test_id = t.id
      WHERE tq.test_id = $1 AND tq.question_order = $2
      ORDER BY tq.question_order
    `;

    const questionResult = await pool.query(questionQuery, [testIdNum, questionIndexNum + 1]);

    if (questionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const question = questionResult.rows[0];

    // Update session's current question order
    await pool.query(
      'UPDATE test_sessions SET current_question_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [questionIndexNum + 1, session.id]
    );

    res.json({
      success: true,
      message: 'Question fetched successfully',
      question: {
        id: question.id,
        questionText: question.question_text,
        categoryName: question.category_name,
        subcategoryName: question.subcategory_name,
        questionOrder: question.question_order
      },
      currentQuestionIndex: questionIndexNum,
      timePerQuestion: question.time_per_question
    });

  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching question',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Submit answer for current question
export const submitAnswer = async (req, res) => {
  try {
    const { 
      testId, userId, questionId, selectedOptionId, 
      selectedOptionLabel, marksObtained, timeTaken, isTimeUp 
    } = req.body;

    // Validate required fields
    if (!testId || !userId || !questionId || !selectedOptionId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Get user's session
    const sessionQuery = `
      SELECT id, session_status, current_question_order, total_questions
      FROM test_sessions
      WHERE test_id = $1 AND user_id = $2
    `;
    const sessionResult = await pool.query(sessionQuery, [testId, userId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test session not found'
      });
    }

    const session = sessionResult.rows[0];

    if (session.session_status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test already completed'
      });
    }

    // Get question details for proper categorization
    const questionQuery = `
      SELECT category_id, subcategory_id, test_id
      FROM test_questions
      WHERE id = $1
    `;
    const questionResult = await pool.query(questionQuery, [questionId]);

    if (questionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const question = questionResult.rows[0];

    // Check if answer already exists for this question
    const existingAnswerQuery = `
      SELECT id FROM user_responses
      WHERE session_id = $1 AND question_id = $2
    `;
    const existingAnswerResult = await pool.query(existingAnswerQuery, [session.id, questionId]);

    if (existingAnswerResult.rows.length > 0) {
      // Update existing answer
      await pool.query(`
        UPDATE user_responses SET
          selected_option_id = $1,
          selected_option_label = $2,
          marks_obtained = $3,
          time_taken = $4,
          answered_at = CURRENT_TIMESTAMP
        WHERE session_id = $5 AND question_id = $6
      `, [selectedOptionId, selectedOptionLabel, marksObtained, timeTaken, session.id, questionId]);
    } else {
      // Insert new answer
      await pool.query(`
        INSERT INTO user_responses (
          session_id, question_id, test_id, category_id, subcategory_id,
          selected_option_id, selected_option_label, marks_obtained, time_taken
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        session.id, questionId, question.test_id, question.category_id, question.subcategory_id,
        selectedOptionId, selectedOptionLabel, marksObtained, timeTaken
      ]);
    }

    // Update session progress
    const nextQuestionOrder = session.current_question_order + 1;
    const isCompleted = nextQuestionOrder > session.total_questions;

    if (isCompleted) {
      // Mark session as completed
      await pool.query(`
        UPDATE test_sessions SET
          session_status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [session.id]);

      // Log completion activity
      await pool.query(`
        INSERT INTO test_activity_logs (
          test_id, user_id, session_id, activity_type, activity_data
        ) VALUES ($1, $2, $3, 'test_completed', $4)
      `, [testId, userId, session.id, JSON.stringify({ completed_at: new Date() })]);
    } else {
      // Update current question order
      await pool.query(`
        UPDATE test_sessions SET
          current_question_order = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [nextQuestionOrder, session.id]);
    }

    // Count questions answered
    const answeredCountQuery = `
      SELECT COUNT(*) as answered_count
      FROM user_responses
      WHERE session_id = $1
    `;
    const answeredCountResult = await pool.query(answeredCountQuery, [session.id]);
    const answeredCount = parseInt(answeredCountResult.rows[0].answered_count);

    // Update questions answered count
    await pool.query(`
      UPDATE test_sessions SET
        questions_answered = $1
      WHERE id = $2
    `, [answeredCount, session.id]);

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      isCompleted: isCompleted,
      nextQuestionIndex: isCompleted ? null : nextQuestionOrder - 1, // Convert to 0-based index
      questionsAnswered: answeredCount,
      totalQuestions: session.total_questions
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while submitting answer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Complete test and finalize session
export const completeTest = async (req, res) => {
  try {
    const { testId, userId } = req.body;

    // Validate inputs
    if (!testId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and User ID are required'
      });
    }

    // Get user's session
    const sessionQuery = `
      SELECT id, session_status
      FROM test_sessions
      WHERE test_id = $1 AND user_id = $2
    `;
    const sessionResult = await pool.query(sessionQuery, [testId, userId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test session not found'
      });
    }

    const session = sessionResult.rows[0];

    if (session.session_status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test already completed'
      });
    }

    // Mark session as completed
    await pool.query(`
      UPDATE test_sessions SET
        session_status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [session.id]);

    // Log completion activity
    await pool.query(`
      INSERT INTO test_activity_logs (
        test_id, user_id, session_id, activity_type, activity_data
      ) VALUES ($1, $2, $3, 'test_completed', $4)
    `, [testId, userId, session.id, JSON.stringify({ completed_at: new Date() })]);

    res.json({
      success: true,
      message: 'Test completed successfully',
      sessionId: session.id,
      completedAt: new Date()
    });

  } catch (error) {
    console.error('Error completing test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while completing test',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// Heartbeat to maintain session
export const heartbeat = async (req, res) => {
  try {
    const { testId, userId } = req.body;

    // Validate inputs
    if (!testId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and User ID are required'
      });
    }

    // Update session heartbeat
    const updateQuery = `
      UPDATE test_sessions SET
        updated_at = CURRENT_TIMESTAMP
      WHERE test_id = $1 AND user_id = $2 AND session_status = 'in_progress'
      RETURNING id
    `;
    const result = await pool.query(updateQuery, [testId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    res.json({
      success: true,
      message: 'Heartbeat updated successfully',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating heartbeat',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

export const abandonTest = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { testId, userId } = req.body;

    // Validate required fields
    if (!testId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and User ID are required'
      });
    }

    await client.query('BEGIN');

    // Get user's session
    const sessionQuery = `
      SELECT id, session_status, current_question_order, total_questions
      FROM test_sessions
      WHERE test_id = $1 AND user_id = $2
    `;
    const sessionResult = await client.query(sessionQuery, [testId, userId]);

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Test session not found'
      });
    }

    const session = sessionResult.rows[0];

    if (session.session_status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Test already completed'
      });
    }

    // Mark session as abandoned/completed
    await client.query(`
      UPDATE test_sessions SET
        session_status = 'abandoned',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [session.id]);

    // Update current participants count (decrease)
    await client.query(
      'UPDATE test_controls SET current_participants = GREATEST(current_participants - 1, 0) WHERE test_id = $1',
      [testId]
    );

    // Log abandonment activity
    await client.query(
      `INSERT INTO test_activity_logs (test_id, user_id, session_id, activity_type, activity_data, ip_address, user_agent) 
       VALUES ($1, $2, $3, 'test_abandoned', $4, $5, $6)`,
      [
        testId, 
        userId, 
        session.id, 
        JSON.stringify({ 
          abandoned_at: new Date(),
          questions_completed: session.current_question_order - 1
        }),
        req.ip || req.connection.remoteAddress || 'Unknown',
        req.headers['user-agent'] || 'Unknown'
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Test abandoned successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Abandon test error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during test abandonment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  } finally {
    client.release();
  }
};