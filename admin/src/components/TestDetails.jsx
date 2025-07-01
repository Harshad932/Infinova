import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/styles/TestDetails.css';

const TestDetail = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [questionsByCategory, setQuestionsByCategory] = useState({});
  const [questionsBySubcategory, setQuestionsBySubcategory] = useState({});

  // Fixed options for all questions
  const FIXED_OPTIONS = [
    { id: 1, label: 'A', text: 'Strongly Agree', marks: 5 },
    { id: 2, label: 'B', text: 'Agree', marks: 4 },
    { id: 3, label: 'C', text: 'Neutral', marks: 3 },
    { id: 4, label: 'D', text: 'Disagree', marks: 2 },
    { id: 5, label: 'E', text: 'Strongly Disagree', marks: 1 }
  ];

  // API base URL
  const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

  // Get auth token
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

  // Organize questions by category and subcategory
  const organizeQuestions = (questionsData, categoriesData, subcategoriesData) => {
    const byCategory = {};
    const bySubcategory = {};

    // Initialize structures
    categoriesData.forEach(category => {
      byCategory[category.id] = {
        ...category,
        subcategories: [],
        questionCount: 0
      };
    });

    subcategoriesData.forEach(subcategory => {
      bySubcategory[subcategory.id] = {
        ...subcategory,
        questions: [],
        questionCount: 0
      };
      
      if (byCategory[subcategory.category_id]) {
        byCategory[subcategory.category_id].subcategories.push(subcategory);
      }
    });

    // Organize questions - Fixed: Use correct property names from backend
    questionsData.forEach(question => {
      // Use subcategoryId from backend data
      const subcategoryId = question.subcategoryId;
      const categoryId = question.categoryId;
      
      if (bySubcategory[subcategoryId]) {
        bySubcategory[subcategoryId].questions.push(question);
        bySubcategory[subcategoryId].questionCount++;
        
        if (byCategory[categoryId]) {
          byCategory[categoryId].questionCount++;
        }
      }
    });

    setQuestionsByCategory(byCategory);
    setQuestionsBySubcategory(bySubcategory);
  };

  // Fetch test details, questions, categories, subcategories, and participants
  const fetchTestDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch test details
      const testResponse = await fetch(`${API_BASE_URL}/admin/tests-d/${testId}`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      if (!testResponse.ok) {
        throw new Error(`Failed to fetch test details: ${testResponse.status}`);
      }

      const testData = await testResponse.json();

      console.log('Test Data:', testData);
      
      // Set test status based on backend flags
      let status = 'draft';
      if (testData.isTestEnded) status = 'completed';
      else if (testData.is_active) status = 'active';
      else if (testData.is_published) status = 'published';

      setTest({ ...testData, status });

      // Fetch categories
      const categoriesResponse = await fetch(`${API_BASE_URL}/admin/tests-d/${testId}/categories`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      let categoriesData = [];
      if (categoriesResponse.ok) {
        const categoriesResult = await categoriesResponse.json();
        categoriesData = categoriesResult.categories || [];
        console.log("categories:", categoriesData);
        setCategories(categoriesData);
      }

      // Fetch subcategories
      const subcategoriesResponse = await fetch(`${API_BASE_URL}/admin/tests-d/${testId}/subcategories`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      let subcategoriesData = [];
      if (subcategoriesResponse.ok) {
        const subcategoriesResult = await subcategoriesResponse.json();
        subcategoriesData = subcategoriesResult.subcategories || [];
        console.log("subcategories:", subcategoriesData);
        setSubcategories(subcategoriesData);
      }

      // Fetch questions
      const questionsResponse = await fetch(`${API_BASE_URL}/admin/tests-d/${testId}/questions`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      let questionsData = [];
      if (questionsResponse.ok) {
        const questionsResult = await questionsResponse.json();
        questionsData = questionsResult.questions || questionsResult || []; // Handle both wrapped and direct array response
        console.log("Questions:", questionsData);
        setQuestions(questionsData);
      }

      // Organize questions by category and subcategory
      organizeQuestions(questionsData, categoriesData, subcategoriesData);

      // Fetch participants
      const participantsResponse = await fetch(`${API_BASE_URL}/admin/tests-d/${testId}/participants`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      if (participantsResponse.ok) {
        const participantsData = await participantsResponse.json();
        console.log("Participants:", participantsData);
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
      const response = await fetch(`${API_BASE_URL}/admin/tests-d/${testId}/generate-code`, {
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
          endpoint = `${API_BASE_URL}/admin/manage-tests/${testId}/unpublish`;
          break;
        case 'end_test':
          endpoint = `${API_BASE_URL}/admin/tests-d/${testId}/end`;
          break;
        case 'activate':
          endpoint = `${API_BASE_URL}/admin/tests-d/${testId}/activate`;
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
      
      if (action === 'unpublish') {
        navigate('/admin/manage-tests');
      }
      
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
    navigator.clipboard.writeText(generatedCode || test.testCode);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  const getSubcategoryName = (subcategoryId) => {
    const subcategory = subcategories.find(subcat => subcat.id === subcategoryId);
    return subcategory ? subcategory.name : 'Unknown Subcategory';
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
                    <span className="stat-number">{test.totalQuestions || questions.length || 0}</span>
                    <span className="stat-label">Total Questions</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{test.total_categories || 0}</span>
                    <span className="stat-label">Categories</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{test.total_subcategories || 0}</span>
                    <span className="stat-label">Subcategories</span>
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

              <div className="hierarchy-card">
                <h3>Test Structure</h3>
                <div className="hierarchy-list">
                  {Object.values(questionsByCategory).map(category => (
                    <div key={category.id} className="category-item">
                      <div className="category-header">
                        <span className="category-name">{category.name}</span>
                        <span className="category-count">({category.questionCount} questions)</span>
                      </div>
                      <div className="subcategories-list">
                        {category.subcategories.map(subcategory => (
                          <div key={subcategory.id} className="subcategory-item">
                            <span className="subcategory-name">{subcategory.name}</span>
                            <span className="subcategory-count">
                              ({questionsBySubcategory[subcategory.id]?.questionCount || 0} questions)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
              <div className="questions-by-category">
                {Object.values(questionsByCategory).map(category => (
                  <div key={category.id} className="category-section">
                    <div className="category-header-section">
                      <h3 className="category-title">{category.name}</h3>
                      <span className="category-question-count">
                        {category.questionCount} questions
                      </span>
                    </div>
                    
                    {category.subcategories.map(subcategory => {
                      const subcategoryQuestions = questionsBySubcategory[subcategory.id]?.questions || [];
                      
                      if (subcategoryQuestions.length === 0) return null;
                      
                      return (
                        <div key={subcategory.id} className="subcategory-section">
                          <div className="subcategory-header">
                            <h4 className="subcategory-title">{subcategory.name}</h4>
                            <span className="subcategory-question-count">
                              {subcategoryQuestions.length} questions
                            </span>
                          </div>
                          
                          <div className="questions-list">
                            {subcategoryQuestions.map((question, index) => (
                              <div key={question.id} className="question-card">
                                <div className="question-header" onClick={() => toggleQuestionExpand(question.id)}>
                                  <div className="question-info">
                                    <span className="question-number">Q{question.questionOrder}</span>
                                    <span className="question-text">{question.questionText}</span>
                                  </div>
                                  <button className="expand-btn">
                                    {expandedQuestion === question.id ? '▼' : '▶'}
                                  </button>
                                </div>
                                
                                {expandedQuestion === question.id && (
                                  <div className="question-details">
                                    <div className="question-meta">
                                      <span className="question-category">
                                        Category: {question.categoryName || getCategoryName(question.categoryId)}
                                      </span>
                                      <span className="question-subcategory">
                                        Subcategory: {question.subcategoryName || getSubcategoryName(question.subcategoryId)}
                                      </span>
                                    </div>
                                    
                                    <div className="fixed-options-info">
                                      <h5>Response Options (Fixed for all questions):</h5>
                                      <div className="options-list">
                                        {(question.options || FIXED_OPTIONS).map((option) => (
                                          <div key={option.id} className="option-item fixed-option">
                                            <span className="option-letter">{option.label}</span>
                                            <span className="option-text">{option.text}</span>
                                            <span className="option-marks">({option.marks} marks)</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    <div className="scoring-info">
                                      <p><strong>Scoring:</strong> Each question uses the same 5-point scale above.</p>
                                      <p><strong>Subcategory Score Formula:</strong> (Sum of all question scores / (Number of questions × 5)) × 100</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
                        <td>{formatDate(participant.registered_at)}</td>
                        <td>
                          {participant.status === 'completed' ? (
                            <span className="progress-completed">
                              {participant.current_question_order || test.totalQuestions}/{test.totalQuestions}
                            </span>
                          ) : participant.status === 'in_progress' ? (
                            <span className="progress-active">
                              {participant.current_question_order || 0}/{test.totalQuestions}
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