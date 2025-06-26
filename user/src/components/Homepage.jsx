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
    const now = new Date();
    const startTime = test.test_start_time ? new Date(test.test_start_time) : null;
    const endTime = test.test_end_time ? new Date(test.test_end_time) : null;

    if (endTime && now > endTime) {
      return 'completed';
    } else if (startTime && now < startTime) {
      return 'upcoming';
    } else {
      return 'active';
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
            <p className="main-subtitle">Discover and participate in available skill assessment tests</p>
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
                      className={`test-card ${status}`}
                      onClick={() => handleTestClick(test.id)}
                    >
                      <div className="test-card-header">
                        <div className="test-status-badge">
                          <span className={`status-indicator ${status}`}></span>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
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
                              {test.current_participants || 0} Registered
                            </span>
                          </div>
                        </div>

                        {test.test_start_time && (
                          <div className="test-timing">
                            <div className="timing-item">
                              <span className="timing-label">Starts:</span>
                              <span className="timing-value">
                                {formatDate(test.test_start_time)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="test-card-footer">
                        <div className="test-meta">
                          <span className="meta-text">
                            Created: {formatDate(test.created_at)}
                          </span>
                        </div>
                        <div className="test-action">
                          <span className="action-text">View Details →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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