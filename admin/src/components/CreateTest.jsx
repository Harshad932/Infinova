import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/CreateTest.css';

const CreateTest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Categories and Subcategories State
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newSubcategory, setNewSubcategory] = useState({ name: '', description: '', categoryId: '' });
  const [editingCategoryIndex, setEditingCategoryIndex] = useState(-1);
  const [editingSubcategoryIndex, setEditingSubcategoryIndex] = useState(-1);
  
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
    categoryId: '',
    subcategoryId: '',
    // Fixed options - no longer editable
    options: [
      { optionText: 'Strongly Agree', marks: 5 },
      { optionText: 'Agree', marks: 4 },
      { optionText: 'Neutral', marks: 3 },
      { optionText: 'Disagree', marks: 2 },
      { optionText: 'Strongly Disagree', marks: 1 }
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
  }, []);

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
  };

  // Category Management Functions
  const addOrUpdateCategory = () => {
    if (!newCategory.name.trim()) {
      setErrors({ categoryName: 'Category name is required' });
      return;
    }

    const categoryToAdd = {
      ...newCategory,
      id: editingCategoryIndex >= 0 ? categories[editingCategoryIndex].id : Date.now(),
      displayOrder: editingCategoryIndex >= 0 ? categories[editingCategoryIndex].displayOrder : categories.length + 1
    };

    if (editingCategoryIndex >= 0) {
      setCategories(prev => prev.map((cat, i) => 
        i === editingCategoryIndex ? categoryToAdd : cat
      ));
    } else {
      setCategories(prev => [...prev, categoryToAdd]);
    }

    resetCategoryForm();
  };

  const editCategory = (index) => {
    setNewCategory(categories[index]);
    setEditingCategoryIndex(index);
    setShowCategoryForm(true);
  };

  const deleteCategory = (index) => {
    if (window.confirm('Are you sure you want to delete this category? This will also delete all subcategories and questions under it.')) {
      const categoryId = categories[index].id;
      setCategories(prev => prev.filter((_, i) => i !== index));
      setSubcategories(prev => prev.filter(sub => sub.categoryId !== categoryId));
      setQuestions(prev => prev.filter(q => q.categoryId !== categoryId));
      updateTotalQuestions();
    }
  };

  const resetCategoryForm = () => {
    setNewCategory({ name: '', description: '' });
    setEditingCategoryIndex(-1);
    setShowCategoryForm(false);
    setErrors({});
  };

  // Subcategory Management Functions
  const addOrUpdateSubcategory = () => {
    if (!newSubcategory.name.trim()) {
      setErrors({ subcategoryName: 'Subcategory name is required' });
      return;
    }
    if (!newSubcategory.categoryId) {
      setErrors({ subcategoryCategoryId: 'Please select a category' });
      return;
    }

    const subcategoryToAdd = {
      ...newSubcategory,
      id: editingSubcategoryIndex >= 0 ? subcategories[editingSubcategoryIndex].id : Date.now(),
      displayOrder: editingSubcategoryIndex >= 0 ? subcategories[editingSubcategoryIndex].displayOrder : 
        subcategories.filter(sub => sub.categoryId === newSubcategory.categoryId).length + 1
    };

    if (editingSubcategoryIndex >= 0) {
      setSubcategories(prev => prev.map((sub, i) => 
        i === editingSubcategoryIndex ? subcategoryToAdd : sub
      ));
    } else {
      setSubcategories(prev => [...prev, subcategoryToAdd]);
    }

    resetSubcategoryForm();
  };

  const editSubcategory = (index) => {
    setNewSubcategory(subcategories[index]);
    setEditingSubcategoryIndex(index);
    setShowSubcategoryForm(true);
  };

  const deleteSubcategory = (index) => {
    if (window.confirm('Are you sure you want to delete this subcategory? This will also delete all questions under it.')) {
      const subcategoryId = subcategories[index].id;
      setSubcategories(prev => prev.filter((_, i) => i !== index));
      setQuestions(prev => prev.filter(q => q.subcategoryId !== subcategoryId));
      updateTotalQuestions();
    }
  };

  const resetSubcategoryForm = () => {
    setNewSubcategory({ name: '', description: '', categoryId: '' });
    setEditingSubcategoryIndex(-1);
    setShowSubcategoryForm(false);
    setErrors({});
  };

  const validateQuestion = () => {
    const newErrors = {};
    
    if (!currentQuestion.questionText.trim()) {
      newErrors.questionText = 'Question text is required';
    }
    
    if (!currentQuestion.categoryId) {
      newErrors.categoryId = 'Category is required';
    }
    
    if (!currentQuestion.subcategoryId) {
      newErrors.subcategoryId = 'Subcategory is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addOrUpdateQuestion = () => {
  if (!validateQuestion()) return;

  const questionToAdd = {
    ...currentQuestion,
    id: editingQuestionIndex >= 0 ? questions[editingQuestionIndex].id : Date.now(),
  };

  let newQuestions;
  if (editingQuestionIndex >= 0) {
    newQuestions = questions.map((q, i) => 
      i === editingQuestionIndex ? questionToAdd : q
    );
    setQuestions(newQuestions);
  } else {
    newQuestions = [...questions, questionToAdd];
    setQuestions(newQuestions);
  }

  updateTotalQuestions(newQuestions);
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
      updateTotalQuestions();
    }
  };

  const resetQuestionForm = () => {
    setCurrentQuestion({
      questionText: '',
      categoryId: '',
      subcategoryId: '',
      options: [
        { optionText: 'Strongly Agree', marks: 5 },
        { optionText: 'Agree', marks: 4 },
        { optionText: 'Neutral', marks: 3 },
        { optionText: 'Disagree', marks: 2 },
        { optionText: 'Strongly Disagree', marks: 1 }
      ]
    });
    setEditingQuestionIndex(-1);
    setShowQuestionForm(false);
    setErrors({});
  };

  const updateTotalQuestions = (newQuestionsArray = questions) => {
  setTestData(prev => ({
    ...prev,
    totalQuestions: newQuestionsArray.length
  }));
};

  const handleSaveTest = async (isDraft = true) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const testPayload = {
        ...testData,
        categories,
        subcategories,
        questions,
        isDraft
      };

      console.log('Saving test:', testPayload);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/create-test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, 
        },
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

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  const getSubcategoryName = (subcategoryId) => {
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    return subcategory ? subcategory.name : 'Unknown Subcategory';
  };

  const getSubcategoriesForCategory = (categoryId) => {
    return subcategories.filter(sub => sub.categoryId === categoryId);
  };

  const getQuestionsForSubcategory = (subcategoryId) => {
    return questions.filter(q => q.subcategoryId === subcategoryId);
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
          className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories ({categories.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'subcategories' ? 'active' : ''}`}
          onClick={() => setActiveTab('subcategories')}
        >
          Subcategories ({subcategories.length})
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

        {activeTab === 'categories' && (
          <div className="categories-section">
            <div className="section-header">
              <h2>Manage Categories</h2>
              <button 
                onClick={() => setShowCategoryForm(true)}
                className="add-button"
              >
                + Add Category
              </button>
            </div>

            {/* Category Form Modal */}
            {showCategoryForm && (
              <div className="form-modal">
                <div className="form-content">
                  <div className="form-header">
                    <h3>{editingCategoryIndex >= 0 ? 'Edit Category' : 'Add New Category'}</h3>
                    <button onClick={resetCategoryForm} className="close-button">×</button>
                  </div>
                  
                  <div className="form-body">
                    <div className="form-group">
                      <label htmlFor="categoryName">Category Name *</label>
                      <input
                        type="text"
                        id="categoryName"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter category name..."
                        className={errors.categoryName ? 'error' : ''}
                      />
                      {errors.categoryName && <span className="error-text">{errors.categoryName}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="categoryDescription">Description</label>
                      <textarea
                        id="categoryDescription"
                        rows="3"
                        value={newCategory.description}
                        onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter category description..."
                      />
                    </div>
                  </div>

                  <div className="form-footer">
                    <button onClick={resetCategoryForm} className="cancel-button">Cancel</button>
                    <button onClick={addOrUpdateCategory} className="save-button">
                      {editingCategoryIndex >= 0 ? 'Update Category' : 'Add Category'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Categories List */}
            <div className="items-list">
              {categories.length === 0 ? (
                <div className="empty-state">
                  <p>No categories added yet. Click "Add Category" to get started.</p>
                </div>
              ) : (
                <div className="items-grid">
                  {categories.map((category, index) => (
                  <div key={category.id} className="item-card">
                    <div className="item-header">
                      <h4>{category.name}</h4>
                      <div className="item-actions">
                        <button onClick={() => editCategory(index)} className="edit-button">✏️</button>
                        <button onClick={() => deleteCategory(index)} className="delete-button">🗑️</button>
                      </div>
                    </div>
                    <div className="item-content">
                      <p>{category.description}</p>
                      <div className="item-stats">
                        <span className="stat">
                          Subcategories: {subcategories.filter(sub => sub.categoryId === category.id).length}
                        </span>
                        <span className="stat">
                          Questions: {questions.filter(q => q.categoryId === category.id).length}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'subcategories' && (
          <div className="subcategories-section">
            <div className="section-header">
              <h2>Manage Subcategories</h2>
              <button 
                onClick={() => setShowSubcategoryForm(true)}
                className="add-button"
                disabled={categories.length === 0}
              >
                + Add Subcategory
              </button>
            </div>

            {categories.length === 0 && (
              <div className="warning-message">
                <p>Please add at least one category before adding subcategories.</p>
              </div>
            )}

            {/* Subcategory Form Modal */}
            {showSubcategoryForm && (
              <div className="form-modal">
                <div className="form-content">
                  <div className="form-header">
                    <h3>{editingSubcategoryIndex >= 0 ? 'Edit Subcategory' : 'Add New Subcategory'}</h3>
                    <button onClick={resetSubcategoryForm} className="close-button">×</button>
                  </div>
                  
                  <div className="form-body">
                    <div className="form-group">
                      <label htmlFor="subcategoryCategory">Category *</label>
                      <select
                        id="subcategoryCategory"
                        value={newSubcategory.categoryId}
                        onChange={(e) => setNewSubcategory(prev => ({ ...prev, categoryId: e.target.value }))}
                        className={errors.subcategoryCategoryId ? 'error' : ''}
                      >
                        <option value="">Select a category...</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {errors.subcategoryCategoryId && <span className="error-text">{errors.subcategoryCategoryId}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="subcategoryName">Subcategory Name *</label>
                      <input
                        type="text"
                        id="subcategoryName"
                        value={newSubcategory.name}
                        onChange={(e) => setNewSubcategory(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter subcategory name..."
                        className={errors.subcategoryName ? 'error' : ''}
                      />
                      {errors.subcategoryName && <span className="error-text">{errors.subcategoryName}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="subcategoryDescription">Description</label>
                      <textarea
                        id="subcategoryDescription"
                        rows="3"
                        value={newSubcategory.description}
                        onChange={(e) => setNewSubcategory(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter subcategory description..."
                      />
                    </div>
                  </div>

                  <div className="form-footer">
                    <button onClick={resetSubcategoryForm} className="cancel-button">Cancel</button>
                    <button onClick={addOrUpdateSubcategory} className="save-button">
                      {editingSubcategoryIndex >= 0 ? 'Update Subcategory' : 'Add Subcategory'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subcategories List */}
            <div className="items-list">
              {subcategories.length === 0 ? (
                <div className="empty-state">
                  <p>No subcategories added yet. Click "Add Subcategory" to get started.</p>
                </div>
              ) : (
                <div className="items-grid">
                  {subcategories.map((subcategory, index) => (
                    <div key={subcategory.id} className="item-card">
                      <div className="item-header">
                        <h4>{subcategory.name}</h4>
                        <div className="item-actions">
                          <button onClick={() => editSubcategory(index)} className="edit-button">✏️</button>
                          <button onClick={() => deleteSubcategory(index)} className="delete-button">🗑️</button>
                        </div>
                      </div>
                      <div className="item-content">
                        <p>{subcategory.description}</p>
                        <div className="item-stats">
                          <span className="stat">
                            Category: {categories.find(cat => cat.id === subcategory.categoryId)?.name || 'Unknown Category'}
                          </span>
                          <span className="stat">
                            Questions: {questions.filter(q => q.subcategoryId === subcategory.id).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="questions-section">
            <div className="section-header">
              <h2>Manage Questions</h2>
              <button 
                onClick={() => setShowQuestionForm(true)}
                className="add-button"
                disabled={subcategories.length === 0}
              >
                + Add Question
              </button>
            </div>

            {subcategories.length === 0 && (
              <div className="warning-message">
                <p>Please add at least one subcategory before adding questions.</p>
              </div>
            )}

            {/* Question Form Modal */}
            {showQuestionForm && (
              <div className="question-form-modal">
                <div className="question-form">
                  <div className="form-header">
                    <h3>{editingQuestionIndex >= 0 ? 'Edit Question' : 'Add New Question'}</h3>
                    <button onClick={resetQuestionForm} className="close-button">×</button>
                  </div>

                  <div className="form-body">
                    <div className="form-group">
                      <label htmlFor="questionCategory">Category *</label>
                      <select
                        id="questionCategory"
                        value={currentQuestion.categoryId}
                        onChange={(e) => {
                          handleQuestionChange('categoryId', e.target.value);
                          handleQuestionChange('subcategoryId', ''); // Reset subcategory when category changes
                        }}
                        className={errors.categoryId ? 'error' : ''}
                      >
                        <option value="">Select a category...</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {errors.categoryId && <span className="error-text">{errors.categoryId}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="questionSubcategory">Subcategory *</label>
                      <select
                        id="questionSubcategory"
                        value={currentQuestion.subcategoryId}
                        onChange={(e) => handleQuestionChange('subcategoryId', e.target.value)}
                        className={errors.subcategoryId ? 'error' : ''}
                        disabled={!currentQuestion.categoryId}
                      >
                        <option value="">Select a subcategory...</option>
                        {getSubcategoriesForCategory(currentQuestion.categoryId).map(subcategory => (
                          <option key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
                          </option>
                        ))}
                      </select>
                      {errors.subcategoryId && <span className="error-text">{errors.subcategoryId}</span>}
                    </div>

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

                    <div className="fixed-options-section">
                      <label>Fixed Answer Options</label>
                      <div className="fixed-options-note">
                        <p>All questions use the same standardized 5-point scale:</p>
                      </div>
                      {currentQuestion.options.map((option, index) => (
                        <div key={index} className="fixed-option-display">
                          <span className="option-label">{String.fromCharCode(65 + index)}.</span>
                          <span className="option-text">{option.optionText}</span>
                          <span className="option-marks">({option.marks} marks)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-footer">
                    <button onClick={resetQuestionForm} className="cancel-button">Cancel</button>
                    <button onClick={addOrUpdateQuestion} className="save-question-button">
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
                        <div className="question-badges">
                          <span className="category-badge">
                            {categories.find(cat => cat.id === question.categoryId)?.name || 'Unknown Category'}
                          </span>
                          <span className="subcategory-badge">
                            {subcategories.find(sub => sub.id === question.subcategoryId)?.name || 'Unknown Subcategory'}
                          </span>
                        </div>
                        <div className="question-actions">
                          <button onClick={() => editQuestion(index)} className="edit-button">✏️</button>
                          <button onClick={() => deleteQuestion(index)} className="delete-button">🗑️</button>
                        </div>
                      </div>
                      
                      <div className="question-content">
                        <p className="question-text">{question.questionText}</p>
                        
                        <div className="options-preview">
                          <div className="options-note">Fixed 5-point scale options</div>
                          {question.options.map((option, optIndex) => (
                            <div key={optIndex} className="option-preview">
                              <span className="option-letter">{String.fromCharCode(65 + optIndex)}.</span>
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