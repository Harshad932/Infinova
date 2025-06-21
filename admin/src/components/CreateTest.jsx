import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/CreateTest.css';

const CreateTest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // Add this new state for managing skill categories
const [availableSkillCategories, setAvailableSkillCategories] = useState([]);
const [newSkillCategory, setNewSkillCategory] = useState('');
const [showAddSkillCategory, setShowAddSkillCategory] = useState(false);
  
  // Test Basic Info State
  const [testData, setTestData] = useState({
    title: '',
    description: '',
    instructions: '',
    rules: '',
    timePerQuestion: 15,
    totalQuestions: 0,
    isPublished: false
  });

  // Questions State
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    questionText: '',
    skillCategoryId: '',
    options: [
      { optionText: '', marks: 0 },
      { optionText: '', marks: 0 },
      { optionText: '', marks: 0 },
      { optionText: '', marks: 0 }
    ]
  });

  // UI State
  const [activeTab, setActiveTab] = useState('basic');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(-1);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchSkillCategories();
  }, []);

  const fetchSkillCategories = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      // Mock data for now - replace with actual API call
      setAvailableSkillCategories([]);
    } catch (error) {
      console.error('Error fetching skill categories:', error);
    }
  };

  const handleTestDataChange = (field, value) => {
    setTestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleQuestionChange = (field, value) => {
    setCurrentQuestion(prev => ({
      ...prev,
      [field]: value
    }));

    if (field === 'skillCategoryId' && value && !availableSkillCategories.find(cat => cat.name === value)) {
    setAvailableSkillCategories(prev => [...prev, { id: Date.now(), name: value }]);
  }

  };

  const addNewSkillCategory = () => {
  if (newSkillCategory.trim() && !availableSkillCategories.find(cat => cat.name === newSkillCategory.trim())) {
    const newCategory = { id: Date.now(), name: newSkillCategory.trim() };
    setAvailableSkillCategories(prev => [...prev, newCategory]);
    setCurrentQuestion(prev => ({
      ...prev,
      skillCategoryId: newCategory.name
    }));
    setNewSkillCategory('');
    setShowAddSkillCategory(false);
  }
};

const getAvailableCategoriesFromQuestions = () => {
  const categoriesFromQuestions = questions.map(q => q.skillCategoryId).filter(Boolean);
  const uniqueCategories = [...new Set(categoriesFromQuestions)];
  return uniqueCategories.map(cat => ({ id: cat, name: cat }));
};

  const handleOptionChange = (index, field, value) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const validateQuestion = () => {
    const newErrors = {};
    
    if (!currentQuestion.questionText.trim()) {
      newErrors.questionText = 'Question text is required';
    }
    
    if (!currentQuestion.skillCategoryId) {
      newErrors.skillCategoryId = 'Skill category is required';
    }

    const validOptions = currentQuestion.options.filter(opt => opt.optionText.trim());
    if (validOptions.length < 2) {
      newErrors.options = 'At least 2 options are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addOrUpdateQuestion = () => {
    if (!validateQuestion()) return;

    const questionToAdd = {
      ...currentQuestion,
      id: editingQuestionIndex >= 0 ? questions[editingQuestionIndex].id : Date.now(),
      options: currentQuestion.options.filter(opt => opt.optionText.trim())
    };

    if (editingQuestionIndex >= 0) {
      // Update existing question
      setQuestions(prev => prev.map((q, i) => 
        i === editingQuestionIndex ? questionToAdd : q
      ));
    } else {
      // Add new question
      setQuestions(prev => [...prev, questionToAdd]);
    }

    // Update total questions count
    setTestData(prev => ({
      ...prev,
      totalQuestions: editingQuestionIndex >= 0 ? questions.length : questions.length + 1
    }));

    resetQuestionForm();
  };

  const editQuestion = (index) => {
    setCurrentQuestion(questions[index]);
    setEditingQuestionIndex(index);
    setShowQuestionForm(true);
  };

  const deleteQuestion = (index) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuestions(prev => prev.filter((_, i) => i !== index));
      setTestData(prev => ({
        ...prev,
        totalQuestions: questions.length - 1
      }));
    }
  };

  const resetQuestionForm = () => {
    setCurrentQuestion({
      questionText: '',
      skillCategoryId: '',
      options: [
        { optionText: '', marks: 0 },
        { optionText: '', marks: 0 },
        { optionText: '', marks: 0 },
        { optionText: '', marks: 0 }
      ]
    });
    setEditingQuestionIndex(-1);
    setShowQuestionForm(false);
    setErrors({});
  };

  const handleSaveTest = async (isDraft = true) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const testPayload = {
        ...testData,
        questions,
        isDraft
      };

      console.log('Saving test:', testPayload);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/create-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}`, },
        body: JSON.stringify(testPayload),
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(isDraft ? 'Test saved as draft!' : 'Test published successfully!');
      navigate('/admin/dashboard');
      
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Error saving test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSkillCategoryName = (skillId) => {
  // Since we're now storing category names directly, just return the skillId
        return skillId || 'Unknown';
    };

  return (
    <div className="create-test-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <button 
            onClick={() => navigate('/admin/dashboard')}
            className="back-button"
          >
            ← Back to Dashboard
          </button>
          <h1 className="header-title">Create New Test</h1>
          <div className="header-actions">
            <button 
              onClick={() => handleSaveTest(true)}
              className="save-draft-button"
              disabled={loading}
            >
              Save Draft
            </button>
            <button 
              onClick={() => handleSaveTest(false)}
              className="publish-button"
              disabled={loading || questions.length === 0}
            >
              Publish Test
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button 
          className={`tab-button ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          Basic Info
        </button>
        <button 
          className={`tab-button ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          Questions ({questions.length})
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'basic' && (
          <div className="basic-info-section">
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="title">Test Title *</label>
                <input
                  type="text"
                  id="title"
                  value={testData.title}
                  onChange={(e) => handleTestDataChange('title', e.target.value)}
                  placeholder="Enter test title..."
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="description">Test Description</label>
                <textarea
                  id="description"
                  rows="3"
                  value={testData.description}
                  onChange={(e) => handleTestDataChange('description', e.target.value)}
                  placeholder="Enter test description..."
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="instructions">Instructions</label>
                <textarea
                  id="instructions"
                  rows="4"
                  value={testData.instructions}
                  onChange={(e) => handleTestDataChange('instructions', e.target.value)}
                  placeholder="Enter test instructions..."
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="rules">Rules</label>
                <textarea
                  id="rules"
                  rows="4"
                  value={testData.rules}
                  onChange={(e) => handleTestDataChange('rules', e.target.value)}
                  placeholder="Enter test rules..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="timePerQuestion">Time per Question (seconds)</label>
                <select
                  id="timePerQuestion"
                  value={testData.timePerQuestion}
                  onChange={(e) => handleTestDataChange('timePerQuestion', parseInt(e.target.value))}
                >
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>

              <div className="form-group">
                <label>Total Questions</label>
                <div className="readonly-field">
                  {testData.totalQuestions} questions added
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="questions-section">
            <div className="questions-header">
              <h2>Manage Questions</h2>
              <button 
                onClick={() => setShowQuestionForm(true)}
                className="add-question-button"
              >
                + Add Question
              </button>
            </div>

            {/* Question Form Modal */}
            {showQuestionForm && (
              <div className="question-form-modal">
                <div className="question-form">
                  <div className="form-header">
                    <h3>{editingQuestionIndex >= 0 ? 'Edit Question' : 'Add New Question'}</h3>
                    <button 
                      onClick={resetQuestionForm}
                      className="close-button"
                    >
                      ×
                    </button>
                  </div>

                  <div className="form-body">
                    <div className="form-group">
                      <label htmlFor="questionText">Question Text *</label>
                      <textarea
                        id="questionText"
                        rows="3"
                        value={currentQuestion.questionText}
                        onChange={(e) => handleQuestionChange('questionText', e.target.value)}
                        placeholder="Enter your question..."
                        className={errors.questionText ? 'error' : ''}
                      />
                      {errors.questionText && <span className="error-text">{errors.questionText}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="skillCategory">Skill Category *</label>
                        <div className="skill-category-input-group">
                            <select
                            id="skillCategory"
                            value={currentQuestion.skillCategoryId}
                            onChange={(e) => {
                                if (e.target.value === 'add_new') {
                                setShowAddSkillCategory(true);
                                } else {
                                handleQuestionChange('skillCategoryId', e.target.value);
                                }
                            }}
                            className={errors.skillCategoryId ? 'error' : ''}
                            >
                            <option value="">Select or enter skill category...</option>
                            {Array.from(
                                new Map(
                                    [...availableSkillCategories, ...getAvailableCategoriesFromQuestions()].map(cat => [cat.name, cat])
                                ).values()
                                ).map(skill => (
                                <option key={skill.id} value={skill.name}>
                                    {skill.name}
                                </option>
                            ))}

                            <option value="add_new">+ Add New Category</option>
                            </select>
                            {showAddSkillCategory && (
                            <div className="new-category-input">
                                <input
                                type="text"
                                value={newSkillCategory}
                                onChange={(e) => setNewSkillCategory(e.target.value)}
                                placeholder="Enter new skill category..."
                                onKeyPress={(e) => e.key === 'Enter' && addNewSkillCategory()}
                                />
                                <button type="button" onClick={addNewSkillCategory} className="add-category-btn">
                                Add
                                </button>
                                <button type="button" onClick={() => {setShowAddSkillCategory(false); setNewSkillCategory('');}} className="cancel-category-btn">
                                Cancel
                                </button>
                            </div>
                            )}
                        </div>
                        {errors.skillCategoryId && <span className="error-text">{errors.skillCategoryId}</span>}
                    </div>

                    <div className="options-section">
                      <label>Answer Options *</label>
                      {errors.options && <span className="error-text">{errors.options}</span>}
                      {currentQuestion.options.map((option, index) => (
                        <div key={index} className="option-group">
                          <span className="option-label">{String.fromCharCode(65 + index)}.</span>
                          <input
                            type="text"
                            value={option.optionText}
                            onChange={(e) => handleOptionChange(index, 'optionText', e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          />
                          <input
                            type="number"
                            value={option.marks}
                            onChange={(e) => handleOptionChange(index, 'marks', parseInt(e.target.value) || 0)}
                            placeholder="Marks"
                            min="0"
                            max="10"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-footer">
                    <button 
                      onClick={resetQuestionForm}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={addOrUpdateQuestion}
                      className="save-question-button"
                    >
                      {editingQuestionIndex >= 0 ? 'Update Question' : 'Add Question'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Questions List */}
            <div className="questions-list">
              {questions.length === 0 ? (
                <div className="empty-state">
                  <p>No questions added yet. Click "Add Question" to get started.</p>
                </div>
              ) : (
                <div className="questions-grid">
                  {questions.map((question, index) => (
                    <div key={question.id} className="question-card">
                      <div className="question-header">
                        <span className="question-number">Q{index + 1}</span>
                        <span className="skill-badge">
                          {getSkillCategoryName(question.skillCategoryId)}
                        </span>
                        <div className="question-actions">
                          <button 
                            onClick={() => editQuestion(index)}
                            className="edit-button"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => deleteQuestion(index)}
                            className="delete-button"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className="question-content">
                        <p className="question-text">{question.questionText}</p>
                        
                        <div className="options-preview">
                          {question.options.map((option, optIndex) => (
                            <div key={optIndex} className="option-preview">
                              <span className="option-letter">
                                {String.fromCharCode(65 + optIndex)}.
                              </span>
                              <span className="option-text">{option.optionText}</span>
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
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Saving test...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTest;