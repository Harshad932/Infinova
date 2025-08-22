import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../assets/styles/Homepage.module.css';

const Homepage = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveTests();
  }, []);

  const fetchActiveTests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/tests/active-published`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setTests(data.tests || []);
      } else {
        setError(data.message || 'Failed to load tests');
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestClick = (testId) => {
    navigate(`/test-info/${testId}`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTestStatus = (test) => {
    if (test.status) {
      return test.status;
    }
    
    // Fallback logic if status is not provided
    if (test.is_test_ended) {
      return 'completed';
    } else if (test.is_test_started && test.is_test_live) {
      return 'active';
    } else if (test.is_registration_open) {
      return 'registration_open';
    } else {
      return 'upcoming';
    }
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'registration_open':
        return 'Registration Open';
      case 'upcoming':
        return 'Upcoming';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'registration_open':
        return 'status-registration';
      case 'upcoming':
        return 'status-upcoming';
      case 'completed':
        return 'status-completed';
      default:
        return 'status-unknown';
    }
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

  return (
    <div className={styles["homepage-container"]}>
      <div className={styles["homepage-wrapper"]}>
        {/* Header Section */}
        <div className={styles["homepage-header"]}>
          <div className={styles["header-content"]}>
            <h1 className={styles["main-title"]}>Welcome to Infinova Test Platform</h1>
            <p className={styles["main-subtitle"]}>Discover and participate in comprehensive skill assessment tests</p>
          </div>
          <div className={styles["header-decoration"]}>
            <div className={styles["decoration-circle"]}></div>
            <div className={styles["decoration-circle"]}></div>
            <div className={styles["decoration-circle"]}></div>
          </div>
        </div>

        {/* Tests Section */}
        <div className={styles["tests-section"]}>
          {error && (
            <div className={styles["error-message"]}>
              <span className={styles["error-icon"]}>⚠️</span>
              {error}
              <button 
                className={styles["retry-button"]} 
                onClick={fetchActiveTests}
              >
                Retry
              </button>
            </div>
          )}

          {!error && tests.length === 0 && (
            <div className={styles["no-tests-container"]}>
              <div className={styles["no-tests-icon"]}>📋</div>
              <h3 className={styles["no-tests-title"]}>No Active Tests Available</h3>
              <p className={styles["no-tests-message"]}>
                There are currently no published tests available. Please check back later.
              </p>
            </div>
          )}

          {!error && tests.length > 0 && (
            <>
              <div className={styles["section-header"]}>
                <h2 className={styles["section-title"]}>Available Tests</h2>
                <p className={styles["section-subtitle"]}>
                  Choose a test to view details and register
                </p>
              </div>

              <div className={styles["tests-grid"]}>
                {tests.map((test) => {
                  const status = getTestStatus(test);
                  return (
                    <div 
                      key={test.id} 
                      className={`${styles["test-card"]} ${styles[getStatusColor(status)]}`}
                      onClick={() => handleTestClick(test.id)}
                    >
                      <div className={styles["test-card-header"]}>
                        <div className={styles["test-status-badge"]}>
                          <span className={`${styles["status-indicator"]} ${styles[getStatusColor(status)]}`}></span>
                          {getStatusDisplay(status)}
                        </div>
                        <div className={styles["test-code"]}>
                          Code: {test.test_code || 'TBD'}
                        </div>
                      </div>

                      <div className={styles["test-card-content"]}>
                        <h3 className={styles["test-title"]}>{test.title}</h3>
                        <p className={styles["test-description"]}>
                          {test.description || 'Comprehensive skill assessment test'}
                        </p>

                        <div className={styles["test-details"]}>
                          <div className={styles["detail-item"]}>
                            <span className={styles["detail-icon"]}>📝</span>
                            <span className={styles["detail-text"]}>
                              {test.total_questions || 0} Questions
                            </span>
                          </div>
                          <div className={styles["detail-item"]}>
                            <span className={styles["detail-icon"]}>⏱️</span>
                            <span className={styles["detail-text"]}>
                              {test.time_per_question || 15}s per question
                            </span>
                          </div>
                          <div className={styles["detail-item"]}>
                            <span className={styles["detail-icon"]}>👥</span>
                            <span className={styles["detail-text"]}>
                              {test.total_registered || 0} Registered
                            </span>
                          </div>
                        </div>

                        {/* Test Structure Info */}
                        <div className={styles["test-structure"]}>
                          <div className={styles["structure-item"]}>
                            <span className={styles["structure-label"]}>Assessment Type:</span>
                            <span className={styles["structure-value"]}>5-Point Likert Scale</span>
                          </div>
                          <div className={styles["structure-item"]}>
                            <span className={styles["structure-label"]}>Scoring:</span>
                            <span className={styles["structure-value"]}>1-5 marks per question</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles["test-card-footer"]}>
                        <div className={styles["test-meta"]}>
                          <span className={styles["meta-text"]}>
                            Created: {formatDate(test.created_at)}
                          </span>
                          {test.is_registration_open && (
                            <span className={styles["registration-status"]}>
                              Registration Open
                            </span>
                          )}
                        </div>
                        <div className={styles["test-action"]}>
                          <span className={styles["action-text"]}>
                            {status === 'registration_open' ? 'Register Now →' : 'View Details →'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Information Section */}
        <div className={styles["info-section"]}>
          <div className={styles["info-card"]}>
            <h3 className={styles["info-title"]}>About Our Assessment</h3>
            <p className={styles["info-description"]}>
              Our tests use a comprehensive 5-point Likert scale assessment system:
            </p>
            <ul className={styles["info-list"]}>
              <li><strong>Strongly Agree (5 marks)</strong> - Complete agreement</li>
              <li><strong>Agree (4 marks)</strong> - Partial agreement</li>
              <li><strong>Neutral (3 marks)</strong> - No strong opinion</li>
              <li><strong>Disagree (2 marks)</strong> - Partial disagreement</li>
              <li><strong>Strongly Disagree (1 mark)</strong> - Complete disagreement</li>
            </ul>
          </div>
        </div>

        {/* Footer Section */}
        <div className={styles["homepage-footer"]}>
          <div className={styles["footer-content"]}>
            <p className={styles["footer-text"]}>
              © 2025 Infinova Test Platform. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;