import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/styles/TestInterface.css';

const TestInterface = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const heartbeatInterval = useRef(null);
  const questionTimer = useRef(null);
  
  // State management
  const [testData, setTestData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [userId, setUserId] = useState('');
  const [isTestCompleted, setIsTestCompleted] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [options, setOptions] = useState([]);

  // Fixed options based on database structure
  const fixedOptions = [
    { id: 1, label: 'A', text: 'Strongly Agree', marks: 5 },
    { id: 2, label: 'B', text: 'Agree', marks: 4 },
    { id: 3, label: 'C', text: 'Neutral', marks: 3 },
    { id: 4, label: 'D', text: 'Disagree', marks: 2 },
    { id: 5, label: 'E', text: 'Strongly Disagree', marks: 1 }
  ];

  // Initialize test session
  useEffect(() => {
    const token = localStorage.getItem('testSessionToken');
    const storedUserId = localStorage.getItem('userId');
    const storedTestId = localStorage.getItem('testId');

    if (!token || !storedUserId || storedTestId !== testId) {
      navigate('/login');
      return;
    }

    setSessionToken(token);
    setUserId(storedUserId);
    setOptions(fixedOptions);
    
    initializeTest();
    setupHeartbeat();
    

    return () => {
      cleanup();
    };
  }, [testId, navigate]);

  // Question timer effect
  useEffect(() => {
    if (timeRemaining > 0 && !isTestCompleted) {
      questionTimer.current = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
    } else if (timeRemaining === 0 && currentQuestion && !isTestCompleted) {
      handleTimeUp();
    }

    return () => {
      if (questionTimer.current) {
        clearTimeout(questionTimer.current);
      }
    };
  }, [timeRemaining, currentQuestion, isTestCompleted]);

  // Setup heartbeat and tab switch monitoring
    useEffect(() => {
  if (userId && testId && testData) {
    fetchCurrentQuestion();
  }
}, [userId, testId, currentQuestionIndex, testData]);

  // Initialize test and fetch first question
  const initializeTest = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('testSessionToken')}`
        },
        body: JSON.stringify({
          testId: testId,
          userId: localStorage.getItem('userId')
        })
      });

      const data = await response.json();

      if (response.ok) {
        setTestData(data.test);
        setTotalQuestions(data.totalQuestions);
        setCurrentQuestionIndex(data.currentQuestionIndex || 0);
        
      } else {
        setError(data.message || 'Failed to initialize test');
      }
    } catch (error) {
      console.error('Test initialization error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch current question
  const fetchCurrentQuestion = async () => {
  if (!userId || !testId) {
    console.error('Missing userId or testId');
    return;
  }

  console.log('Fetching question for index:', currentQuestionIndex);
  console.log("User ID:", userId);
  
  try {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test/question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        testId: testId,
        userId: userId,
        questionIndex: currentQuestionIndex
      })
    });

    const data = await response.json();

    if (response.ok) {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timePerQuestion || 15);
      setSelectedOption('');
      
      // Update current question index if different
      if (data.currentQuestionIndex !== currentQuestionIndex) {
        setCurrentQuestionIndex(data.currentQuestionIndex);
      }
    } else {
      if (data.message === 'Test completed') {
        handleTestCompletion();
      } else {
        setError(data.message || 'Failed to fetch question');
      }
    }
  } catch (error) {
    console.error('Fetch question error:', error);
    setError('Network error. Please try again.');
  }
};

  // Handle option selection
  const handleOptionSelect = (optionLabel) => {
    setSelectedOption(optionLabel);
  };

  // Submit current answer
  const handleSubmitAnswer = async () => {
    if (!selectedOption) {
      setError('Please select an option before proceeding');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const selectedOptionData = options.find(opt => opt.label === selectedOption);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test/submit-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          testId: testId,
          userId: userId,
          questionId: currentQuestion.id,
          selectedOptionId: selectedOptionData.id,
          selectedOptionLabel: selectedOption,
          marksObtained: selectedOptionData.marks,
          timeTaken: (testData?.timePerQuestion || 15) - timeRemaining
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Check if test is completed
        if (data.isCompleted) {
          handleTestCompletion();
        } else {
          // Move to next question
          setCurrentQuestionIndex(prev => prev + 1);
          await fetchCurrentQuestion();
        }
      } else {
        setError(data.message || 'Failed to submit answer');
      }
    } catch (error) {
      console.error('Submit answer error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle time up for current question
  const handleTimeUp = async () => {
    if (isSubmitting || isTestCompleted) return;

    // Auto-submit with no selection (or neutral if no selection)
    const autoSelectedOption = selectedOption || 'C'; // Default to neutral
    const selectedOptionData = options.find(opt => opt.label === autoSelectedOption);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test/submit-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          testId: testId,
          userId: userId,
          questionId: currentQuestion.id,
          selectedOptionId: selectedOptionData.id,
          selectedOptionLabel: autoSelectedOption,
          marksObtained: selectedOptionData.marks,
          timeTaken: testData?.timePerQuestion || 15,
          isTimeUp: true
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.isCompleted) {
          handleTestCompletion();
        } else {
          setCurrentQuestionIndex(prev => prev + 1);
          await fetchCurrentQuestion();
        }
      }
    } catch (error) {
      console.error('Auto-submit error:', error);
    }
  };

  // Handle test completion
  const handleTestCompletion = async () => {
    setIsTestCompleted(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          testId: testId,
          userId: userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Clear session data
        localStorage.removeItem('testSessionToken');
        localStorage.removeItem('testId');
        localStorage.removeItem('userId');
        
        // Navigate to thank you page
        navigate('/thank-you');
      }
    } catch (error) {
      console.error('Test completion error:', error);
    }
  };

  // Setup heartbeat to maintain session
  const setupHeartbeat = () => {
    heartbeatInterval.current = setInterval(async () => {
      try {
        console.log('Sending heartbeat for test:', testId, 'user:', userId);
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            testId: testId,
            userId: userId
          })
        });
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    }, 30000); // Every 30 seconds
  };

  // Setup tab switch monitorin

  const setupTabSwitchMonitoring = () => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      setTabSwitchWarning(true);
    } else {
      setTabSwitchWarning(false);
    }
  };

  const handleFocusChange = () => {
    if (document.hasFocus()) {
      setTabSwitchWarning(false);
    } else {
      setTabSwitchWarning(true);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocusChange);
  window.addEventListener('blur', handleFocusChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocusChange);
    window.removeEventListener('blur', handleFocusChange);
  };
};

  // Cleanup function
  const cleanup = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    if (questionTimer.current) {
      clearTimeout(questionTimer.current);
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;

  if (loading) {
    return (
      <div className="test-interface-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading test...</p>
        </div>
      </div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div className="test-interface-container">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/login')} className="error-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="test-interface-container">
      {/* Tab Switch Warning */}
      {tabSwitchWarning && (
        <div className="tab-switch-warning">
          <div className="warning-content">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>Warning:</strong> Please stay focused on the test. Tab switching is being monitored.
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="test-header">
        <div className="header-left">
          <h1 className="test-title">{testData?.title || 'Test'}</h1>
          <div className="test-info">
            <span className="test-id">Test ID: {testId}</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="progress-info">
            <span className="question-counter">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Question Section */}
      {currentQuestion && (
        <div className="question-section">
          {/* Category and Subcategory Info */}
          <div className="question-context">
            <div className="breadcrumb">
              <span className="category">{currentQuestion.categoryName}</span>
              <span className="separator">›</span>
              <span className="subcategory">{currentQuestion.subcategoryName}</span>
            </div>
          </div>

          {/* Timer */}
          <div className="timer-section">
            <div className={`timer-circle ${timeRemaining <= 5 ? 'warning' : ''}`}>
              <div className="timer-display">
                <span className="timer-seconds">{timeRemaining}</span>
                <span className="timer-label">sec</span>
              </div>
              <svg className="timer-svg" viewBox="0 0 100 100">
                <circle
                  className="timer-track"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                <circle
                  className="timer-progress"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={timeRemaining <= 5 ? "#ef4444" : "#0199d5"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(timeRemaining / (testData?.timePerQuestion || 15)) * 283} 283`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
          </div>

          {/* Question Content */}
          <div className="question-content">
            <div className="question-number">
              Q{currentQuestionIndex + 1}.
            </div>
            <div className="question-text">
              {currentQuestion.questionText}
            </div>
          </div>

          {/* Options Section */}
          <div className="options-section">
            <div className="options-grid">
              {options.map((option) => (
                <div
                  key={option.id}
                  className={`option-item ${selectedOption === option.label ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option.label)}
                >
                  <div className="option-radio">
                    <input
                      type="radio"
                      id={`option-${option.label}`}
                      name="question-option"
                      value={option.label}
                      checked={selectedOption === option.label}
                      onChange={() => handleOptionSelect(option.label)}
                    />
                    <label htmlFor={`option-${option.label}`} className="option-label">
                      <span className="option-letter">{option.label}</span>
                      <span className="option-text">{option.text}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <span>{error}</span>
            </div>
          )}

          {/* Navigation Section */}
          <div className="navigation-section">
            <div className="nav-info">
              <span className="selection-info">
                {selectedOption ? `Selected: ${selectedOption}` : 'No option selected'}
              </span>
            </div>
            
            <div className="nav-actions">
              {currentQuestionIndex + 1 === totalQuestions ? (
                <button 
                  className="submit-test-button"
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting Test...' : 'Submit Test'}
                </button>
              ) : (
                <button 
                  className="next-question-button"
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Next Question →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="test-footer">
        <div className="footer-info">
          <span>© 2025 Infinova Test Platform</span>
        </div>
      </div>
    </div>
  );
};

export default TestInterface;