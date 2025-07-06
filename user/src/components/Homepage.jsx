import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/Homepage.css';

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
      <div className="homepage-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading available tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <div className="homepage-wrapper">
        {/* Header Section */}
        <div className="homepage-header">
          <div className="header-content">
            <h1 className="main-title">Welcome to Infinova Test Platform</h1>
            <p className="main-subtitle">Discover and participate in comprehensive skill assessment tests</p>
          </div>
          <div className="header-decoration">
            <div className="decoration-circle"></div>
            <div className="decoration-circle"></div>
            <div className="decoration-circle"></div>
          </div>
        </div>

        {/* Tests Section */}
        <div className="tests-section">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
              <button 
                className="retry-button" 
                onClick={fetchActiveTests}
              >
                Retry
              </button>
            </div>
          )}

          {!error && tests.length === 0 && (
            <div className="no-tests-container">
              <div className="no-tests-icon">📋</div>
              <h3 className="no-tests-title">No Active Tests Available</h3>
              <p className="no-tests-message">
                There are currently no published tests available. Please check back later.
              </p>
            </div>
          )}

          {!error && tests.length > 0 && (
            <>
              <div className="section-header">
                <h2 className="section-title">Available Tests</h2>
                <p className="section-subtitle">
                  Choose a test to view details and register
                </p>
              </div>

              <div className="tests-grid">
                {tests.map((test) => {
                  const status = getTestStatus(test);
                  return (
                    <div 
                      key={test.id} 
                      className={`test-card ${getStatusColor(status)}`}
                      onClick={() => handleTestClick(test.id)}
                    >
                      <div className="test-card-header">
                        <div className="test-status-badge">
                          <span className={`status-indicator ${getStatusColor(status)}`}></span>
                          {getStatusDisplay(status)}
                        </div>
                        <div className="test-code">
                          Code: {test.test_code || 'TBD'}
                        </div>
                      </div>

                      <div className="test-card-content">
                        <h3 className="test-title">{test.title}</h3>
                        <p className="test-description">
                          {test.description || 'Comprehensive skill assessment test'}
                        </p>

                        <div className="test-details">
                          <div className="detail-item">
                            <span className="detail-icon">📝</span>
                            <span className="detail-text">
                              {test.total_questions || 0} Questions
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">⏱️</span>
                            <span className="detail-text">
                              {test.time_per_question || 15}s per question
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">👥</span>
                            <span className="detail-text">
                              {test.total_registered || 0} Registered
                            </span>
                          </div>
                        </div>

                        {/* Test Structure Info */}
                        <div className="test-structure">
                          <div className="structure-item">
                            <span className="structure-label">Assessment Type:</span>
                            <span className="structure-value">5-Point Likert Scale</span>
                          </div>
                          <div className="structure-item">
                            <span className="structure-label">Scoring:</span>
                            <span className="structure-value">1-5 marks per question</span>
                          </div>
                        </div>
                      </div>

                      <div className="test-card-footer">
                        <div className="test-meta">
                          <span className="meta-text">
                            Created: {formatDate(test.created_at)}
                          </span>
                          {test.is_registration_open && (
                            <span className="registration-status">
                              Registration Open
                            </span>
                          )}
                        </div>
                        <div className="test-action">
                          <span className="action-text">
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
        <div className="info-section">
          <div className="info-card">
            <h3 className="info-title">About Our Assessment</h3>
            <p className="info-description">
              Our tests use a comprehensive 5-point Likert scale assessment system:
            </p>
            <ul className="info-list">
              <li><strong>Strongly Agree (5 marks)</strong> - Complete agreement</li>
              <li><strong>Agree (4 marks)</strong> - Partial agreement</li>
              <li><strong>Neutral (3 marks)</strong> - No strong opinion</li>
              <li><strong>Disagree (2 marks)</strong> - Partial disagreement</li>
              <li><strong>Strongly Disagree (1 mark)</strong> - Complete disagreement</li>
            </ul>
          </div>
        </div>

        {/* Footer Section */}
        <div className="homepage-footer">
          <div className="footer-content">
            <p className="footer-text">
              © 2025 Infinova Test Platform. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;