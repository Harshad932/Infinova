import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/styles/TestInfo.css';

const TestInfo = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTestInfo();
  }, [testId]);

  const fetchTestInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/test-info/${testId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setTestData(data.test);
      } else {
        setError(data.message || 'Failed to load test information');
      }
    } catch (error) {
      console.error('Error fetching test info:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    navigate(`/login-verification/${testId}`);
  };

 if (loading) {
  return (
    <div className="homepage-container">
      <div className="loading-container">
        <div className="lightbulb-container">
          <div className="glow-ring"></div>
          <div className="glow-ring"></div>
          <div className="glow-ring"></div>
          
          <div className="lightbulb">
            <div className="bulb-body">
              <div className="filament">
                <div className="filament-line"></div>
                <div className="filament-line"></div>
                <div className="filament-line"></div>
              </div>
            </div>
            <div className="bulb-base"></div>
          </div>

          <div className="sparkles">
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
          </div>
        </div>

        <div className="loading-content">
          <p className="loading-text">Loading available tests<span className="typing-dots">...</span></p>
          <p className="loading-subtitle">Please wait while we fetch the latest information</p>
          
          <div className="progress-container">
            <div className="progress-bar"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

  if (error) {
    return (
      <div className="test-info-container">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Error Loading Test</h2>
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={fetchTestInfo}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!testData) {
    return (
      <div className="test-info-container">
        <div className="error-container">
          <div className="error-icon">📋</div>
          <h2 className="error-title">Test Not Found</h2>
          <p className="error-message">The requested test could not be found.</p>
          <button className="retry-button" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="test-info-container">
      <div className="test-info-wrapper">
        {/* Header Section */}
        <div className="test-info-header">
          <div className="brand-section">
            <h1 className="brand-title">Infinova</h1>
            <p className="brand-subtitle">Test Platform</p>
          </div>
          <div className="test-status-badge">
            <span className="status-indicator active"></span>
            Registration Open
          </div>
        </div>

        {/* Test Title Section */}
        <div className="test-title-section">
          <h2 className="test-title">{testData.title}</h2>
          <div className="test-code">
            Test Code: <span className="code-highlight">{testData.test_code || 'Will be provided by admin'}</span>
          </div>
        </div>

        {/* Test Description */}
        {testData.description && (
          <div className="test-description-section">
            <h3 className="section-title">About This Test</h3>
            <p className="test-description">{testData.description}</p>
          </div>
        )}

        {/* Test Details Grid */}
        <div className="test-details-grid">
          <div className="detail-card">
            <div className="detail-icon">📝</div>
            <div className="detail-content">
              <h4 className="detail-title">Total Questions</h4>
              <p className="detail-value">{testData.total_questions || 0}</p>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-icon">⏱️</div>
            <div className="detail-content">
              <h4 className="detail-title">Time Per Question</h4>
              <p className="detail-value">{testData.time_per_question || 15} seconds</p>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-icon">🎯</div>
            <div className="detail-content">
              <h4 className="detail-title">Question Format</h4>
              <p className="detail-value">Multiple Choice (5 Options)</p>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-icon">👥</div>
            <div className="detail-content">
              <h4 className="detail-title">Participants</h4>
              <p className="detail-value">{testData.current_participants || 0} registered</p>
            </div>
          </div>
        </div>

        {/* Response Format Section */}
        <div className="response-format-section">
          <h3 className="section-title">Response Format</h3>
          <div className="response-format-content">
            <p className="format-description">
              Each question will have the following response options:
            </p>
            <div className="response-options">
              <div className="option-item">
                <span className="option-label">A.</span>
                <span className="option-text">Strongly Agree</span>
                <span className="option-marks">(5 marks)</span>
              </div>
              <div className="option-item">
                <span className="option-label">B.</span>
                <span className="option-text">Agree</span>
                <span className="option-marks">(4 marks)</span>
              </div>
              <div className="option-item">
                <span className="option-label">C.</span>
                <span className="option-text">Neutral</span>
                <span className="option-marks">(3 marks)</span>
              </div>
              <div className="option-item">
                <span className="option-label">D.</span>
                <span className="option-text">Disagree</span>
                <span className="option-marks">(2 marks)</span>
              </div>
              <div className="option-item">
                <span className="option-label">E.</span>
                <span className="option-text">Strongly Disagree</span>
                <span className="option-marks">(1 mark)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Section */}
        {testData.instructions && (
          <div className="instructions-section">
            <h3 className="section-title">Test Instructions</h3>
            <div className="instructions-content">
              <div className="instructions-text">
                {testData.instructions.split('\n').map((line, index) => (
                  <p key={index} className="instruction-line">{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rules Section */}
        {testData.rules && (
          <div className="rules-section">
            <h3 className="section-title">Test Rules & Guidelines</h3>
            <div className="rules-content">
              <div className="rules-text">
                {testData.rules.split('\n').map((line, index) => (
                  <p key={index} className="rule-line">{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <div className="important-notes">
          <h3 className="section-title">Important Notes</h3>
          <div className="notes-grid">
            <div className="note-item">
              <span className="note-icon">🔒</span>
              <span className="note-text">You will need to verify your email with OTP</span>
            </div>
            <div className="note-item">
              <span className="note-icon">🎫</span>
              <span className="note-text">Test code will be provided by the administrator</span>
            </div>
            <div className="note-item">
              <span className="note-icon">⚡</span>
              <span className="note-text">Test will start only when enabled by admin</span>
            </div>
            <div className="note-item">
              <span className="note-icon">📊</span>
              <span className="note-text">Results will be available to administrators only</span>
            </div>
            <div className="note-item">
              <span className="note-icon">⏰</span>
              <span className="note-text">Each question has a time limit - answer carefully</span>
            </div>
            <div className="note-item">
              <span className="note-icon">🎯</span>
              <span className="note-text">Choose the option that best represents your opinion</span>
            </div>
          </div>
        </div>

        {/* Register Button */}
        <div className="register-section">
          <button 
            className="register-button"
            onClick={handleRegisterClick}
          >
            Register for Test
          </button>
          <p className="register-note">
            Click above to proceed with registration and login process
          </p>
        </div>

        {/* Footer */}
        <div className="test-info-footer">
          <p className="footer-text">
            © 2025 Infinova Test Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestInfo;