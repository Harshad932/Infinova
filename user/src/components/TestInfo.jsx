import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../assets/styles/TestInfo.module.css';

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
    <div className={styles["homepage-container"]}>
      <div className={styles["loading-container"]}>
        <div className={styles["lightbulb-container"]}>
          <div className={styles["glow-ring"]}></div>
          <div className={styles["glow-ring"]}></div>
          <div className={styles["glow-ring"]}></div>
          
          <div className={styles["lightbulb"]}>
            <div className={styles["bulb-body"]}>
              <div className={styles["filament"]}>
                <div className={styles["filament-line"]}></div>
                <div className={styles["filament-line"]}></div>
                <div className={styles["filament-line"]}></div>
              </div>
            </div>
            <div className={styles["bulb-base"]}></div>
          </div>

          <div className={styles["sparkles"]}>
            <div className={styles["sparkle"]}></div>
            <div className={styles["sparkle"]}></div>
            <div className={styles["sparkle"]}></div>
            <div className={styles["sparkle"]}></div>
            <div className={styles["sparkle"]}></div>
            <div className={styles["sparkle"]}></div>
          </div>
        </div>

        <div className={styles["loading-content"]}>
          <p className={styles["loading-text"]}>Loading available tests<span className={styles["typing-dots"]}>...</span></p>
          <p className={styles["loading-subtitle"]}>Please wait while we fetch the latest information</p>
          
          <div className={styles["progress-container"]}>
            <div className={styles["progress-bar"]}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

  if (error) {
    return (
      <div className={styles["test-info-container"]}>
        <div className={styles["error-container"]}>
          <div className={styles["error-icon"]}>⚠️</div>
          <h2 className={styles["error-title"]}>Error Loading Test</h2>
          <p className={styles["error-message"]}>{error}</p>
          <button className={styles["retry-button"]} onClick={fetchTestInfo}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!testData) {
    return (
      <div className={styles["test-info-container"]}>
        <div className={styles["error-container"]}>
          <div className={styles["error-icon"]}>📋</div>
          <h2 className={styles["error-title"]}>Test Not Found</h2>
          <p className={styles["error-message"]}>The requested test could not be found.</p>
          <button className={styles["retry-button"]} onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["test-info-container"]}>
      <div className={styles["test-info-wrapper"]}>
        {/* Header Section */}
        <div className={styles["test-info-header"]}>
          <div className={styles["brand-section"]}>
            <h1 className={styles["brand-title"]}>Infinova</h1>
            <p className={styles["brand-subtitle"]}>Test Platform</p>
          </div>
          <div className={styles["test-status-badge"]}>
            <span className={`${styles["status-indicator"]} ${styles["active"]}`}></span>
            Registration Open
          </div>
        </div>

        {/* Test Title Section */}
        <div className={styles["test-title-section"]}>
          <h2 className={styles["test-title"]}>{testData.title}</h2>
          <div className={styles["test-code"]}>
            Test Code: <span className={styles["code-highlight"]}>{testData.test_code || 'Will be provided by admin'}</span>
          </div>
        </div>

        {/* Test Description */}
        {testData.description && (
          <div className={styles["test-description-section"]}>
            <h3 className={styles["section-title"]}>About This Test</h3>
            <p className={styles["test-description"]}>{testData.description}</p>
          </div>
        )}

        {/* Test Details Grid */}
        <div className={styles["test-details-grid"]}>
          <div className={styles["detail-card"]}>
            <div className={styles["detail-icon"]}>📝</div>
            <div className={styles["detail-content"]}>
              <h4 className={styles["detail-title"]}>Total Questions</h4>
              <p className={styles["detail-value"]}>{testData.total_questions || 0}</p>
            </div>
          </div>

          <div className={styles["detail-card"]}>
            <div className={styles["detail-icon"]}>⏱️</div>
            <div className={styles["detail-content"]}>
              <h4 className={styles["detail-title"]}>Time Per Question</h4>
              <p className={styles["detail-value"]}>{testData.time_per_question || 15} seconds</p>
            </div>
          </div>

          <div className={styles["detail-card"]}>
            <div className={styles["detail-icon"]}>🎯</div>
            <div className={styles["detail-content"]}>
              <h4 className={styles["detail-title"]}>Question Format</h4>
              <p className={styles["detail-value"]}>Multiple Choice (5 Options)</p>
            </div>
          </div>

          <div className={styles["detail-card"]}>
            <div className={styles["detail-icon"]}>👥</div>
            <div className={styles["detail-content"]}>
              <h4 className={styles["detail-title"]}>Participants</h4>
              <p className={styles["detail-value"]}>{testData.current_participants || 0} registered</p>
            </div>
          </div>
        </div>

        {/* Response Format Section */}
        <div className={styles["response-format-section"]}>
          <h3 className={styles["section-title"]}>Response Format</h3>
          <div className={styles["response-format-content"]}>
            <p className={styles["format-description"]}>
              Each question will have the following response options:
            </p>
            <div className={styles["response-options"]}>
              <div className={styles["option-item"]}>
                <span className={styles["option-label"]}>A.</span>
                <span className={styles["option-text"]}>Strongly Agree</span>
                <span className={styles["option-marks"]}>(5 marks)</span>
              </div>
              <div className={styles["option-item"]}>
                <span className={styles["option-label"]}>B.</span>
                <span className={styles["option-text"]}>Agree</span>
                <span className={styles["option-marks"]}>(4 marks)</span>
              </div>
              <div className={styles["option-item"]}>
                <span className={styles["option-label"]}>C.</span>
                <span className={styles["option-text"]}>Neutral</span>
                <span className={styles["option-marks"]}>(3 marks)</span>
              </div>
              <div className={styles["option-item"]}>
                <span className={styles["option-label"]}>D.</span>
                <span className={styles["option-text"]}>Disagree</span>
                <span className={styles["option-marks"]}>(2 marks)</span>
              </div>
              <div className={styles["option-item"]}>
                <span className={styles["option-label"]}>E.</span>
                <span className={styles["option-text"]}>Strongly Disagree</span>
                <span className={styles["option-marks"]}>(1 mark)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Section */}
        {testData.instructions && (
          <div className={styles["instructions-section"]}>
            <h3 className={styles["section-title"]}>Test Instructions</h3>
            <div className={styles["instructions-content"]}>
              <div className={styles["instructions-text"]}>
                {testData.instructions.split('\n').map((line, index) => (
                  <p key={index} className={styles["instruction-line"]}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rules Section */}
        {testData.rules && (
          <div className={styles["rules-section"]}>
            <h3 className={styles["section-title"]}>Test Rules & Guidelines</h3>
            <div className={styles["rules-content"]}>
              <div className={styles["rules-text"]}>
                {testData.rules.split('\n').map((line, index) => (
                  <p key={index} className={styles["rule-line"]}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <div className={styles["important-notes"]}>
          <h3 className={styles["section-title"]}>Important Notes</h3>
          <div className={styles["notes-grid"]}>
            <div className={styles["note-item"]}>
              <span className={styles["note-icon"]}>🔒</span>
              <span className={styles["note-text"]}>You will need to verify your email with OTP</span>
            </div>
            <div className={styles["note-item"]}>
              <span className={styles["note-icon"]}>🎫</span>
              <span className={styles["note-text"]}>Test code will be provided by the administrator</span>
            </div>
            <div className={styles["note-item"]}>
              <span className={styles["note-icon"]}>⚡</span>
              <span className={styles["note-text"]}>Test will start only when enabled by admin</span>
            </div>
            <div className={styles["note-item"]}>
              <span className={styles["note-icon"]}>📊</span>
              <span className={styles["note-text"]}>Results will be available to administrators only</span>
            </div>
            <div className={styles["note-item"]}>
              <span className={styles["note-icon"]}>⏰</span>
              <span className={styles["note-text"]}>Each question has a time limit - answer carefully</span>
            </div>
            <div className={styles["note-item"]}>
              <span className={styles["note-icon"]}>🎯</span>
              <span className={styles["note-text"]}>Choose the option that best represents your opinion</span>
            </div>
          </div>
        </div>

        {/* Register Button */}
        <div className={styles["register-section"]}>
          <button 
            className={styles["register-button"]}
            onClick={handleRegisterClick}
          >
            Register for Test
          </button>
          <p className={styles["register-note"]}>
            Click above to proceed with registration and login process
          </p>
        </div>

        {/* Footer */}
        <div className={styles["test-info-footer"]}>
          <p className={styles["footer-text"]}>
            © 2025 Infinova Test Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestInfo;