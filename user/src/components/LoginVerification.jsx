import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../assets/styles/LoginVerification.module.css';

const LoginVerification = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    otp: '',
    testCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResendOtp, setCanResendOtp] = useState(true);
  const [userId, setUserId] = useState(null);
  const [testData, setTestData] = useState(null);

  // Timer effect for OTP countdown
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(otpTimer - 1);
      }, 1000);
    } else if (otpTimer === 0 && !canResendOtp) {
      setCanResendOtp(true);
    }
    return () => clearInterval(interval);
  }, [otpTimer, canResendOtp]);

  // Fetch test data on component mount
  useEffect(() => {
    fetchTestData();
  }, [testId]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  // Fetch test information
  const fetchTestData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test-info/${testId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        setTestData(data.test);
      }
    } catch (error) {
      console.error('Error fetching test data:', error);
    }
  };

  // Step 1: User Registration
const handleRegistration = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        testId: testId
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setUserId(data.userId);
      
      // Check if user should proceed to test code directly
      if (data.proceedToTestCode) {
        setSuccess('User already verified! Proceeding to test code verification.');
        setCurrentStep(3);
      } else if (data.isEmailVerified) {
        setSuccess('User already verified! Proceeding to test code verification.');
        setCurrentStep(3);
      } else {
        setSuccess('OTP sent to your email successfully!');
        setCurrentStep(2);
        setOtpTimer(300); // 5 minutes
        setCanResendOtp(false);
      }
    } else {
      setError(data.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    setError('Network error. Please try again.');
  } finally {
    setLoading(false);
  }
};

  // Step 2: OTP Verification
  const handleOtpVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          otp: formData.otp,
          userId: userId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Email verified successfully!');
        setCurrentStep(3);
      } else {
        setError(data.message || 'OTP verification failed');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          userId: userId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('OTP resent successfully!');
        setOtpTimer(300); // 5 minutes
        setCanResendOtp(false);
      } else {
        setError(data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Test Code Verification
const handleTestCodeVerification = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/verify-test-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testCode: formData.testCode,
        testId: testId,
        userId: userId
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setSuccess('Test code verified successfully!');
      

      if (data.success) {
        await handleStartTestDirect();
      }
    } else {
      setError(data.message || 'Invalid test code');
    }
  } catch (error) {
    console.error('Test code verification error:', error);
    setError('Network error. Please try again.');
  } finally {
    setLoading(false);
  }
};

// Direct test start when test is active
const handleStartTestDirect = async () => {
  try {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/start-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testId: testId,
        userId: userId
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store session data
      localStorage.setItem('testSessionToken', data.sessionToken);
      localStorage.setItem('testId', testId);
      localStorage.setItem('userId', userId);
      
      // Navigate to test page
      navigate(`/test-interface/${testId}`);
    } else {
      setError(data.message || 'Failed to start test');
    }
  } catch (error) {
    console.error('Start test error:', error);
    setError('Network error. Please try again.');
  }
};

  // Handle back button navigation
  const handleBackNavigation = (targetStep) => {
    setError('');
    setSuccess('');
    
    if (targetStep === 1 && currentStep === 2) {
      // Going back from OTP to registration - allow re-registration
      setCurrentStep(targetStep);
    } else if (targetStep === 2 && currentStep === 3) {
      // Going back from test code to OTP - stay on test code if already verified
      if (userId) {
        // Check if OTP is still valid/verified - just go to test code step
        setCurrentStep(3);
      } else {
        setCurrentStep(targetStep);
      }
    } else {
      setCurrentStep(targetStep);
    }
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles["login-verification-container"]}>
      <div className={styles["login-verification-wrapper"]}>
        
        {/* Header */}
        <div className={styles["login-header"]}>
          <div className={styles["brand-section"]}>
            <h1 className={styles["brand-title"]}>Infinova</h1>
            <p className={styles["brand-subtitle"]}>Test Platform</p>
          </div>
          {testData && (
            <div className={styles["test-info-mini"]}>
              <h3 className={styles["test-title-mini"]}>{testData.title}</h3>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className={styles["progress-steps"]}>
          <div className={`${styles["step"]} ${currentStep >= 1 ? styles["active"] : ''} ${currentStep > 1 ? styles["completed"] : ''}`}>
            <div className={styles["step-number"]}>1</div>
            <div className={styles["step-label"]}>Registration</div>
          </div>
          <div className={`${styles["step"]} ${currentStep >= 2 ? styles["active"] : ''} ${currentStep > 2 ? styles["completed"] : ''}`}>
            <div className={styles["step-number"]}>2</div>
            <div className={styles["step-label"]}>OTP Verification</div>
          </div>
          <div className={`${styles["step"]} ${currentStep >= 3 ? styles["active"] : ''} ${currentStep > 3 ? styles["completed"] : ''}`}>
            <div className={styles["step-number"]}>3</div>
            <div className={styles["step-label"]}>Test Code</div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className={`${styles["message-container"]} ${styles["error"]}`}>
            <div className={styles["message-icon"]}>⚠️</div>
            <div className={styles["message-text"]}>{error}</div>
          </div>
        )}
        
        {success && (
          <div className={`${styles["message-container"]} ${styles["success"]}`}>
            <div className={styles["message-icon"]}>✅</div>
            <div className={styles["message-text"]}>{success}</div>
          </div>
        )}

        {/* Step 1: User Registration */}
        {currentStep === 1 && (
          <div className={styles["step-content"]}>
            <div className={styles["step-header"]}>
              <h2 className={styles["step-title"]}>User Registration</h2>
              <p className={styles["step-description"]}>Please provide your details to register for the test</p>
            </div>

            <form onSubmit={handleRegistration} className={styles["registration-form"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="name" className={styles["form-label"]}>Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={styles["form-input"]}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className={styles["form-group"]}>
                <label htmlFor="email" className={styles["form-label"]}>Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={styles["form-input"]}
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div className={styles["form-group"]}>
                <label htmlFor="phone" className={styles["form-label"]}>Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={styles["form-input"]}
                  placeholder="Enter your 10-digit phone number"
                  required
                />
              </div>

              <button 
                type="submit" 
                className={`${styles["form-button"]} ${styles["primary"]}`}
                disabled={loading}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {currentStep === 2 && (
          <div className={styles["step-content"]}>
            <div className={styles["step-header"]}>
              <h2 className={styles["step-title"]}>OTP Verification</h2>
              <p className={styles["step-description"]}>
                We've sent a 6-digit OTP to <strong>{formData.email}</strong>
              </p>
            </div>

            <form onSubmit={handleOtpVerification} className={styles["otp-form"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="otp" className={styles["form-label"]}>Enter OTP *</label>
                <input
                  type="text"
                  id="otp"
                  name="otp"
                  value={formData.otp}
                  onChange={handleInputChange}
                  className={`${styles["form-input"]} ${styles["otp-input"]}`}
                  placeholder="Enter 6-digit OTP"
                  maxLength="6"
                  required
                />
              </div>

              {otpTimer > 0 && (
                <div className={styles["timer-display"]}>
                  <span className={styles["timer-icon"]}>⏱️</span>
                  <span className={styles["timer-text"]}>OTP expires in: {formatTime(otpTimer)}</span>
                </div>
              )}

              <div className={styles["form-actions"]}>
                <button 
                  type="submit" 
                  className={`${styles["form-button"]} ${styles["primary"]}`}
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>

                <button 
                  type="button" 
                  className={`${styles["form-button"]} ${styles["secondary"]}`}
                  onClick={handleResendOtp}
                  disabled={!canResendOtp || loading}
                >
                  {loading ? 'Resending...' : 'Resend OTP'}
                </button>
              </div>
            </form>

            <div className={styles["step-actions"]}>
              <button 
                className={styles["back-button"]}
                onClick={() => handleBackNavigation(1)}
              >
                ← Back to Registration
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Test Code Entry */}
        {currentStep === 3 && (
          <div className={styles["step-content"]}>
            <div className={styles["step-header"]}>
              <h2 className={styles["step-title"]}>Test Code Verification</h2>
              <p className={styles["step-description"]}>
                Please enter the test code provided by your administrator
              </p>
            </div>

            <form onSubmit={handleTestCodeVerification} className={styles["test-code-form"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="testCode" className={styles["form-label"]}>Test Code *</label>
                <input
                  type="text"
                  id="testCode"
                  name="testCode"
                  value={formData.testCode}
                  onChange={handleInputChange}
                  className={`${styles["form-input"]} ${styles["test-code-input"]}`}
                  placeholder="Enter test code"
                  required
                />
              </div>

              <button 
                type="submit" 
                className={`${styles["form-button"]} ${styles["primary"]}`}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify Test Code'}
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className={styles["login-footer"]}>
          <p className={styles["footer-text"]}>
            © 2025 Infinova Test Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginVerification;