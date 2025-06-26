import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../assets/styles/EditTest.css';

const EditTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Test basic info state
  const [testInfo, setTestInfo] = useState({
    title: '',
    description: '',
    instructions: '',
    rules: '',
    timePerQuestion: 15,
    isActive: false,
    isPublished: false
  });

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'questions'
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // New question form state
  const [newQuestion, setNewQuestion] = useState({
    questionText: '',
    skillCategoryName: '',
    options: [
      { text: '', marks: 0 },
      { text: '', marks: 0 },
      { text: '', marks: 0 },
      { text: '', marks: 0 }
    ],
  });

  // API configuration
  const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
  
  const getAuthToken = () => localStorage.getItem('adminToken');
  
  const getApiHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  });

  // Fetch test data
  const fetchTestData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}`, {
        headers: getApiHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch test data');
      }

      const data = await response.json();
      
      setTestInfo({
        title: data.title || '',
        description: data.description || '',
        instructions: data.instructions || '',
        rules: data.rules || '',
        timePerQuestion: data.timePerQuestion || 15,
        isActive: data.isActive || false,
        isPublished: data.isPublished || false
      });

      setQuestions(data.questions || []);
      setAvailableSkills(data.skillCategories || []);
      
    } catch (error) {
      console.error('Error fetching test data:', error);
      setError('Failed to load test data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    if (id) {
      fetchTestData();
    }
  }, [id]);

  // Handle test info changes
  const handleTestInfoChange = (field, value) => {
    setTestInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle question changes
  const handleQuestionChange = (field, value) => {
    setNewQuestion(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle option changes
  const handleOptionChange = (optionIndex, field, value) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options.map((option, index) => 
        index === optionIndex 
          ? { ...option, [field]: value }
          : option
      )
    }));
  };

  // Save test info
  const saveTestInfo = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/info`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(testInfo)
      });

      if (!response.ok) {
        throw new Error('Failed to save test information');
      }

      setSuccess('Test information saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error saving test info:', error);
      setError('Failed to save test information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Add new question
  const addQuestion = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate question
      if (!newQuestion.questionText.trim()) {
        throw new Error('Question text is required');
      }

      if (!newQuestion.skillCategoryName.trim()) {
        throw new Error('Skill category is required');
      }

      const validOptions = newQuestion.options.filter(opt => opt.text.trim());
      if (validOptions.length < 2) {
        throw new Error('At least 2 options are required');
      }

      const questionData = {
        ...newQuestion,
        options: validOptions,
        questionOrder: questions.length + 1
      };

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/questions`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(questionData)
      });

      if (!response.ok) {
        throw new Error('Failed to add question');
      }

      const addedQuestion = await response.json();
      setQuestions(prev => [...prev, addedQuestion]);
      
      // Update available skills if new skill was added
      if (!availableSkills.includes(newQuestion.skillCategoryName)) {
        setAvailableSkills(prev => [...prev, newQuestion.skillCategoryName]);
      }

      // Reset form
      setNewQuestion({
        questionText: '',
        skillCategoryName: '',
        options: [
          { text: '', marks: 0 },
          { text: '', marks: 0 },
          { text: '', marks: 0 },
          { text: '', marks: 0 }
        ],
      });

      setShowQuestionModal(false);
      setSuccess('Question added successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error adding question:', error);
      setError(error.message || 'Failed to add question. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Edit existing question
  const editQuestion = (question) => {
    setEditingQuestion(question.id);
    setNewQuestion({
      questionText: question.questionText,
      skillCategoryName: question.skillCategoryName,
      options: question.options || [
        { text: '', marks: 0 },
        { text: '', marks: 0 },
        { text: '', marks: 0 },
        { text: '', marks: 0 }
      ],
    });
    setShowQuestionModal(true);
  };

  // Update existing question
  const updateQuestion = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/questions/${editingQuestion}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(newQuestion)
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      const updatedQuestion = await response.json();
      setQuestions(prev => prev.map(q => 
        q.id === editingQuestion ? updatedQuestion : q
      ));

      setEditingQuestion(null);
      setShowQuestionModal(false);
      setSuccess('Question updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error updating question:', error);
      setError('Failed to update question. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Delete question
  const deleteQuestion = async (questionId) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/questions/${questionId}`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      setQuestions(prev => prev.filter(q => q.id !== questionId));
      setShowDeleteConfirm(null);
      setSuccess('Question deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error deleting question:', error);
      setError('Failed to delete question. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Reset question form
  const resetQuestionForm = () => {
    setNewQuestion({
      questionText: '',
      skillCategoryName: '',
      options: [
        { text: '', marks: 0 },
        { text: '', marks: 0 },
        { text: '', marks: 0 },
        { text: '', marks: 0 }
      ],
    });
    setEditingQuestion(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Test Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-test-container">
      {/* Header */}
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              onClick={() => navigate('/admin/manage-tests')}
              className="back-button"
            >
              ← Back to Manage Tests
            </button>
            <h1 className="page-title">Edit Test</h1>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => navigate(`/admin/test-results/${id}`)}
              className="view-results-btn"
            >
              View Results
            </button>
          </div>
        </div>
      </header>

      {/* Success/Error Messages */}
      {success && (
        <div className="success-message">
          <p>{success}</p>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Test Information
          </button>
          <button 
            className={`tab ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            Questions ({questions.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'info' && (
          <div className="test-info-section">
            <div className="form-container">
              <div className="form-group">
                <label htmlFor="title">Test Title *</label>
                <input
                  type="text"
                  id="title"
                  value={testInfo.title}
                  onChange={(e) => handleTestInfoChange('title', e.target.value)}
                  placeholder="Enter test title"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={testInfo.description}
                  onChange={(e) => handleTestInfoChange('description', e.target.value)}
                  placeholder="Enter test description"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="instructions">Instructions</label>
                <textarea
                  id="instructions"
                  value={testInfo.instructions}
                  onChange={(e) => handleTestInfoChange('instructions', e.target.value)}
                  placeholder="Enter test instructions"
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label htmlFor="rules">Rules</label>
                <textarea
                  id="rules"
                  value={testInfo.rules}
                  onChange={(e) => handleTestInfoChange('rules', e.target.value)}
                  placeholder="Enter test rules"
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label htmlFor="timePerQuestion">Time per Question (seconds)</label>
                <input
                  type="number"
                  id="timePerQuestion"
                  value={testInfo.timePerQuestion}
                  onChange={(e) => handleTestInfoChange('timePerQuestion', parseInt(e.target.value))}
                  min="5"
                  max="300"
                />
              </div>

              <div className="form-actions">
                <button 
                  onClick={saveTestInfo}
                  disabled={saving}
                  className="save-btn primary"
                >
                  {saving ? 'Saving...' : 'Save Test Information'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="questions-section">
            <div className="questions-header">
              <h3>Questions</h3>
              <button 
                onClick={() => {
                  resetQuestionForm();
                  setShowQuestionModal(true);
                }}
                className="add-question-btn"
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="no-questions">
                <div className="no-questions-icon">❓</div>
                <h4>No questions added yet</h4>
                <p>Start by adding your first question</p>
              </div>
            ) : (
              <div className="questions-list">
                {questions.map((question, index) => (
                  <div key={question.id} className="question-card">
                    <div className="question-header">
                      <div className="question-info">
                        <span className="question-number">Q{index + 1}</span>
                        <span className="skill-category">{question.skillCategoryName}</span>
                      </div>
                      <div className="question-actions">
                        <button 
                          onClick={() => editQuestion(question)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(question.id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="question-content">
                      <p className="question-text">{question.questionText}</p>
                      
                      <div className="options-list">
                        {question.options?.map((option, optIndex) => (
                          <div key={optIndex} className="option">
                            <span className="option-label">{String.fromCharCode(65 + optIndex)}.</span>
                            <span className="option-text">{option.text}</span>
                            <span className="option-marks">({option.marks} marks)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
              <button 
                onClick={() => {
                  setShowQuestionModal(false);
                  resetQuestionForm();
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="questionText">Question Text *</label>
                <textarea
                  id="questionText"
                  value={newQuestion.questionText}
                  onChange={(e) => handleQuestionChange('questionText', e.target.value)}
                  placeholder="Enter your question"
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="skillCategory">Skill Category *</label>
                <input
                  type="text"
                  id="skillCategory"
                  value={newQuestion.skillCategoryName}
                  onChange={(e) => handleQuestionChange('skillCategoryName', e.target.value)}
                  placeholder="e.g., Communication, Technical, Behavioral"
                  list="skillCategories"
                  required
                />
                <datalist id="skillCategories">
                  {availableSkills.map(skill => (
                    <option key={skill} value={skill} />
                  ))}
                </datalist>
              </div>

              <div className="options-section">
                <h4>Answer Options</h4>
                {newQuestion.options.map((option, index) => (
                  <div key={index} className="option-input">
                    <div className="option-header">
                      <span className="option-label">Option {String.fromCharCode(65 + index)}</span>
                    </div>
                    
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                      placeholder={`Enter option ${String.fromCharCode(65 + index)}`}
                    />
                    
                    <div className="marks-input">
                      <label>Marks:</label>
                      <input
                        type="number"
                        value={option.marks}
                        onChange={(e) => handleOptionChange(index, 'marks', parseInt(e.target.value) || 0)}
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowQuestionModal(false);
                  resetQuestionForm();
                }}
                className="modal-btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={editingQuestion ? updateQuestion : addQuestion}
                disabled={saving}
                className="modal-btn primary"
              >
                {saving ? 'Saving...' : (editingQuestion ? 'Update Question' : 'Add Question')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-header">
              <h3>Delete Question</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this question?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="modal-btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteQuestion(showDeleteConfirm)}
                disabled={saving}
                className="modal-btn danger"
              >
                {saving ? 'Deleting...' : 'Delete Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditTest;