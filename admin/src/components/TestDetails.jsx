import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/styles/TestDetails.css';

const TestDetail = () => {
  const { id: testId } = useParams();

  const navigate = useNavigate();
  
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, questions, participants

  // API base URL
  const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

  // Get auth token
   // Get auth token from localStorage
  const getAuthToken = () => {
    return localStorage.getItem('adminToken');
  };

  // API headers with auth
  const getApiHeaders = () => {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch test details, questions, and participants
  const fetchTestDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch test details
    

      const testResponse = await fetch(`${API_BASE_URL}/admin/tests/${testId}`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      if (!testResponse.ok) {
        throw new Error(`Failed to fetch test details: ${testResponse.status}`);
      }

      const testData = await testResponse.json();
      // Set test status based on backend flags
      let status = 'draft';
      if (testData.isTestEnded) status = 'completed';
      else if (testData.is_active) status = 'active';
      else if (testData.is_published) status = 'published';

      setTest({ ...testData, status });

      console.log('Test Data:', status);

      // Fetch questions
      const questionsResponse = await fetch(`${API_BASE_URL}/admin/tests/${testId}/questions`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        setQuestions(questionsData.questions || []);
      }

      // Fetch participants
      const participantsResponse = await fetch(`${API_BASE_URL}/admin/tests/${testId}/participants`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      if (participantsResponse.ok) {
        const participantsData = await participantsResponse.json();
        setParticipants(participantsData.participants || []);
      }

    } catch (error) {
      console.error('Error fetching test details:', error);
      setError('Failed to load test details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestDetails();
  }, [testId]);

  // Handle generate code
  const handleGenerateCode = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/tests/${testId}/generate-code`, {
        method: 'POST',
        headers: getApiHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to generate code');
      }

      const data = await response.json();
      setGeneratedCode(data.testCode);
      setShowCodeModal(true);
      
      // Refresh test details to get updated status
      fetchTestDetails();
    } catch (error) {
      console.error('Error generating code:', error);
      setError('Failed to generate test code. Please try again.');
    }
  };

  // Handle test actions
  const handleTestAction = async (action) => {
    try {
      let response;
      let endpoint = '';

      switch(action) {
        case 'unpublish':
          endpoint = `${API_BASE_URL}/admin/manage-tests/${testId}/unpublish`
          navigate('/admin/manage-tests');
          break;
        case 'end_test':
          endpoint = `${API_BASE_URL}/admin/tests/${testId}/end`;
          break;
        case 'activate':
          endpoint = `${API_BASE_URL}/admin/tests/${testId}/activate`;
          break;
        default:
          throw new Error('Unknown action');
      }

      response = await fetch(endpoint, {
        method: 'PUT',
        headers: getApiHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Action failed');
      }

      // Refresh test details
      fetchTestDetails();
      
    } catch (error) {
      console.error('Error executing action:', error);
      setError(error.message || 'Action failed. Please try again.');
    }
    
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const handleConfirmAction = (action) => {
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'draft': return 'status-draft';
      case 'published': return 'status-published';
      case 'active': return 'status-active';
      case 'completed': return 'status-completed';
      default: return 'status-draft';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'draft': return 'Draft';
      case 'published': return 'Published';
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      default: return 'Draft';
    }
  };

  const toggleQuestionExpand = (questionId) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    // You could add a toast notification here
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Test Details...</p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="error-container">
        <h3>Test not found</h3>
        <button onClick={() => navigate('/admin/manage-tests')} className="back-button">
          ← Back to Manage Tests
        </button>
      </div>
    );
  }

  return (
    <div className="test-detail-container">
      {/* Header */}
      <header className="test-detail-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              onClick={() => navigate('/admin/manage-tests')}
              className="back-button"
            >
              ← Back to Manage Tests
            </button>
            <div className="test-title-section">
              <h1 className="test-title">{test.title}</h1>
              <span className={`status-badge ${getStatusBadge(test.status)}`}>
                {getStatusText(test.status)}
              </span>
            </div>
          </div>
          
          <div className="header-actions">
            {test.status === 'published' && (
              <button 
                onClick={handleGenerateCode}
                className="action-btn generate-code-btn"
              >
                🔑 Generate Code
              </button>
            )}
            
            <button 
              onClick={() => navigate(`/admin/edit-test/${testId}`)}
              className="action-btn edit-btn"
            >
              ✏️ Edit Test
            </button>
            
            {(test.status === 'published' || test.status === 'active') && (
              <button 
                onClick={() => handleConfirmAction('unpublish')}
                className="action-btn unpublish-btn"
              >
                📤 Unpublish
              </button>
            )}
            
            {test.status === 'active' && (
              <button 
                onClick={() => handleConfirmAction('end_test')}
                className="action-btn end-test-btn"
              >
                ⏹️ End Test
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Test Code Display */}
      {test.testCode && (
        <div className="test-code-display">
          <div className="code-info">
            <span className="code-label">Test Code:</span>
            <span className="code-value">{test.testCode}</span>
            <button 
              onClick={() => copyCodeToClipboard()}
              className="copy-code-btn"
              title="Copy to clipboard"
            >
              📋
            </button>
          </div>
          <div className="code-instruction">
            Share this code with participants to allow them to join the test
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="detail-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          ❓ Questions ({questions.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          👥 Participants ({participants.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="overview-grid">
              <div className="info-card">
                <h3>Test Information</h3>
                <div className="info-item">
                  <span className="label">Description:</span>
                  <span className="value">{test.description || 'No description provided'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Instructions:</span>
                  <span className="value">{test.instructions || 'No instructions provided'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Rules:</span>
                  <span className="value">{test.rules || 'No rules specified'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Created:</span>
                  <span className="value">{formatDate(test.createdAt)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Last Updated:</span>
                  <span className="value">{formatDate(test.updatedAt)}</span>
                </div>
              </div>

              <div className="stats-card">
                <h3>Test Statistics</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-number">{questions.length}</span>
                    <span className="stat-label">Total Questions</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{test.timePerQuestion || 0}s</span>
                    <span className="stat-label">Time per Question</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{participants.length}</span>
                    <span className="stat-label">Registered Users</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{participants.filter(p => p.status === 'completed').length}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                </div>
              </div>

              <div className="skills-card">
                <h3>Skill Categories</h3>
                <div className="skills-list">
                  {test.skillCategories && test.skillCategories.length > 0 ? (
                    test.skillCategories.map((skill, index) => (
                      <span key={index} className="skill-tag">{skill}</span>
                    ))
                  ) : (
                    <span className="no-skills">No skill categories defined</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="questions-section">
            {questions.length === 0 ? (
              <div className="no-questions">
                <div className="no-questions-icon">❓</div>
                <h3>No questions added yet</h3>
                <p>Add questions to this test to get started</p>
                <button 
                  onClick={() => navigate(`/admin/edit-test/${testId}`)}
                  className="add-questions-btn"
                >
                  Add Questions
                </button>
              </div>
            ) : (
              <div className="questions-list">
                {questions.map((question, index) => (
                  <div key={question.id} className="question-card">
                    <div className="question-header" onClick={() => toggleQuestionExpand(question.id)}>
                      <div className="question-info">
                        <span className="question-number">Q{index + 1}</span>
                        <span className="question-text">{question.questionText}</span>
                        <span className="skill-category">{question.skillCategoryName}</span>
                      </div>
                      <button className="expand-btn">
                        {expandedQuestion === question.id ? '▼' : '▶'}
                      </button>
                    </div>
                    
                    {expandedQuestion === question.id && (
                      <div className="question-details">
                        <div className="options-list">
                          {question.options && question.options.map((option, optIndex) => (
                            <div 
                              key={option.id} 
                              className={`option-item ${option.isCorrect ? 'correct' : ''}`}
                            >
                              <span className="option-letter">{String.fromCharCode(65 + optIndex)}</span>
                              <span className="option-text">{option.optionText}</span>
                              <span className="option-marks">({option.marks} marks)</span>
                              {option.isCorrect && <span className="correct-indicator">✓</span>}
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <div className="question-explanation">
                            <strong>Explanation:</strong> {question.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div className="participants-section">
            {participants.length === 0 ? (
              <div className="no-participants">
                <div className="no-participants-icon">👥</div>
                <h3>No participants yet</h3>
                <p>Participants will appear here once they register for the test</p>
              </div>
            ) : (
              <div className="participants-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Registered At</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant) => (
                      <tr key={participant.id}>
                        <td>{participant.name}</td>
                        <td>{participant.email}</td>
                        <td>{participant.phone}</td>
                        <td>
                          <span className={`participant-status ${participant.status}`}>
                            {participant.status}
                          </span>
                        </td>
                        <td>{formatDate(participant.registeredAt)}</td>
                        <td>
                          {participant.status === 'completed' ? (
                            <span className="progress-completed">
                              {participant.currentQuestion || questions.length}/{questions.length}
                            </span>
                          ) : participant.status === 'in_progress' ? (
                            <span className="progress-active">
                              {participant.currentQuestion || 0}/{questions.length}
                            </span>
                          ) : (
                            <span className="progress-waiting">Waiting</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Generation Modal */}
      {showCodeModal && (
        <div className="modal-overlay">
          <div className="modal code-modal">
            <div className="modal-header">
              <h3>Test Code Generated</h3>
            </div>
            <div className="modal-body">
              <div className="generated-code-display">
                <div className="code-box">
                  <span className="code-text">{generatedCode}</span>
                  <button 
                    onClick={copyCodeToClipboard}
                    className="copy-btn"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
                <p className="code-instructions">
                  Share this code with participants. They will need to enter this code to access the test.
                </p>
                <div className="code-info">
                  <p>✅ Test is now ACTIVE</p>
                  <p>✅ Participants can now join using this code</p>
                  <p>✅ You can start the test when ready</p>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowCodeModal(false)}
                className="modal-btn primary"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-header">
              <h3>Confirm Action</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to {confirmAction?.replace('_', ' ')} this test?</p>
              {confirmAction === 'end_test' && (
                <p className="warning-text">This will end the test for all active participants and they won't be able to continue.</p>
              )}
              {confirmAction === 'unpublish' && (
                <p className="warning-text">This will make the test unavailable to users and stop any ongoing sessions.</p>
              )}
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="modal-btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleTestAction(confirmAction)}
                className="modal-btn primary"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestDetail;