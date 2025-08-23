import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../assets/styles/EditTest.module.css';

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

  // Categories and subcategories state
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'structure', 'questions'
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Form states
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    displayOrder: 0
  });

  const [newSubcategory, setNewSubcategory] = useState({
    categoryId: '',
    name: '',
    description: '',
    displayOrder: 0
  });

  const [newQuestion, setNewQuestion] = useState({
    categoryId: '',
    subcategoryId: '',
    questionText: '',
    questionOrder: 0,
    subcategoryOrder: 0
  });

  // Fixed options for all questions
  const fixedOptions = [
    { label: 'A', text: 'Strongly Agree', marks: 5 },
    { label: 'B', text: 'Agree', marks: 4 },
    { label: 'C', text: 'Neutral', marks: 3 },
    { label: 'D', text: 'Disagree', marks: 2 },
    { label: 'E', text: 'Strongly Disagree', marks: 1 }
  ];

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

      setCategories(data.categories || []);
      setSubcategories(data.subcategories || []);
      setQuestions(data.questions || []);
      
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

  // Category functions
  const addCategory = async () => {
  try {
    setSaving(true);
    setError(null);

    if (!newCategory.name.trim()) {
      throw new Error('Category name is required');
    }

    const categoryData = {
      ...newCategory,
      displayOrder: categories.length + 1
    };

    const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/categories`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(categoryData)
    });

    if (!response.ok) {
      throw new Error('Failed to add category');
    }

    const responseData = await response.json();
    // FIX: Extract the category from the response structure
    const addedCategory = responseData.category || responseData;
    setCategories(prev => [...prev, addedCategory]);
    
    setNewCategory({ name: '', description: '', displayOrder: 0 });
    setShowCategoryModal(false);
    setSuccess('Category added successfully!');
    setTimeout(() => setSuccess(null), 3000);
    
  } catch (error) {
    console.error('Error adding category:', error);
    setError(error.message || 'Failed to add category. Please try again.');
  } finally {
    setSaving(false);
  }
};

// Fixed updateCategory function
const updateCategory = async () => {
  try {
    setSaving(true);
    setError(null);

    const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/categories/${editingCategory}`, {
      method: 'PUT',
      headers: getApiHeaders(),
      body: JSON.stringify(newCategory)
    });

    if (!response.ok) {
      throw new Error('Failed to update category');
    }

    const responseData = await response.json();
    // FIX: Extract the category from the response structure
    const updatedCategory = responseData.category || responseData;
    setCategories(prev => prev.map(c => 
      c.id === editingCategory ? updatedCategory : c
    ));

    setEditingCategory(null);
    setShowCategoryModal(false);
    setSuccess('Category updated successfully!');
    setTimeout(() => setSuccess(null), 3000);
    
  } catch (error) {
    console.error('Error updating category:', error);
    setError('Failed to update category. Please try again.');
  } finally {
    setSaving(false);
  }
};

  const deleteCategory = async (categoryId) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      setCategories(prev => prev.filter(c => c.id !== categoryId));
      setSubcategories(prev => prev.filter(s => s.categoryId !== categoryId));
      setQuestions(prev => prev.filter(q => q.categoryId !== categoryId));
      
      setShowDeleteConfirm(null);
      setSuccess('Category deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Subcategory functions
  const addSubcategory = async () => {
  try {
    setSaving(true);
    setError(null);

    if (!newSubcategory.name.trim()) {
      throw new Error('Subcategory name is required');
    }

    if (!newSubcategory.categoryId) {
      throw new Error('Please select a category');
    }

    const subcategoryData = {
      ...newSubcategory,
      displayOrder: subcategories.filter(s => s.categoryId === newSubcategory.categoryId).length + 1
    };

    const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/subcategories`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(subcategoryData)
    });

    if (!response.ok) {
      throw new Error('Failed to add subcategory');
    }

    const addedSubcategory = await response.json();
    // FIX: Expecting direct subcategory object from API
    setSubcategories(prev => [...prev, addedSubcategory]);
    
    setNewSubcategory({ categoryId: '', name: '', description: '', displayOrder: 0 });
    setShowSubcategoryModal(false);
    setSuccess('Subcategory added successfully!');
    setTimeout(() => setSuccess(null), 3000);
    
  } catch (error) {
    console.error('Error adding subcategory:', error);
    setError(error.message || 'Failed to add subcategory. Please try again.');
  } finally {
    setSaving(false);
  }
};

const updateSubcategory = async () => {
  try {
    setSaving(true);
    setError(null);

    const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/subcategories/${editingSubcategory}`, {
      method: 'PUT',
      headers: getApiHeaders(),
      body: JSON.stringify(newSubcategory)
    });

    if (!response.ok) {
      throw new Error('Failed to update subcategory');
    }

    const updatedSubcategory = await response.json();
    // FIX: Expecting direct subcategory object from API
    setSubcategories(prev => prev.map(s => 
      s.id === editingSubcategory ? updatedSubcategory : s
    ));

    setEditingSubcategory(null);
    setShowSubcategoryModal(false);
    setSuccess('Subcategory updated successfully!');
    setTimeout(() => setSuccess(null), 3000);
    
  } catch (error) {
    console.error('Error updating subcategory:', error);
    setError('Failed to update subcategory. Please try again.');
  } finally {
    setSaving(false);
  }
};

  const deleteSubcategory = async (subcategoryId) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/subcategories/${subcategoryId}`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete subcategory');
      }

      setSubcategories(prev => prev.filter(s => s.id !== subcategoryId));
      setQuestions(prev => prev.filter(q => q.subcategoryId !== subcategoryId));
      
      setShowDeleteConfirm(null);
      setSuccess('Subcategory deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      setError('Failed to delete subcategory. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Question functions
  const addQuestion = async () => {
  try {
    setSaving(true);
    setError(null);

    if (!newQuestion.questionText.trim()) {
      throw new Error('Question text is required');
    }

    if (!newQuestion.categoryId) {
      throw new Error('Please select a category');
    }

    if (!newQuestion.subcategoryId) {
      throw new Error('Please select a subcategory');
    }

    // FIX: Proper type conversion and order calculation
    const subcategoryId = parseInt(newQuestion.subcategoryId);
    const questionsInSubcategory = questions.filter(q => 
      parseInt(q.subcategoryId) === subcategoryId
    );
    
    // Calculate next available subcategory order
    const maxSubcategoryOrder = questionsInSubcategory.length > 0 
      ? Math.max(...questionsInSubcategory.map(q => q.subcategoryOrder || 0))
      : 0;

    const questionData = {
      ...newQuestion,
      categoryId: parseInt(newQuestion.categoryId),
      subcategoryId: subcategoryId,
      questionOrder: questions.length + 1,
      subcategoryOrder: maxSubcategoryOrder + 1
    };

    const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/questions`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(questionData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to add question');
    }

    const responseData = await response.json();
    
    // Handle different response structures
    const addedQuestion = responseData.question || responseData;
    setQuestions(prev => [...prev, addedQuestion]);
    
    setNewQuestion({
      categoryId: '',
      subcategoryId: '',
      questionText: '',
      questionOrder: 0,
      subcategoryOrder: 0
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

const updateQuestion = async () => {
  try {
    setSaving(true);
    setError(null);

    if (!newQuestion.questionText.trim()) {
      throw new Error('Question text is required');
    }

    // FIX: Ensure proper type conversion
    const questionData = {
      ...newQuestion,
      categoryId: parseInt(newQuestion.categoryId),
      subcategoryId: parseInt(newQuestion.subcategoryId)
    };

    const response = await fetch(`${API_BASE_URL}/admin/tests/${id}/questions/${editingQuestion}`, {
      method: 'PUT',
      headers: getApiHeaders(),
      body: JSON.stringify(questionData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to update question');
    }

    const responseData = await response.json();
    
    // Handle different response structures
    const updatedQuestion = responseData.question || responseData;
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

  // Reset forms
  const resetCategoryForm = () => {
    setNewCategory({ name: '', description: '', displayOrder: 0 });
    setEditingCategory(null);
  };

  const resetSubcategoryForm = () => {
    setNewSubcategory({ categoryId: '', name: '', description: '', displayOrder: 0 });
    setEditingSubcategory(null);
  };

  const resetQuestionForm = () => {
    setNewQuestion({
      categoryId: '',
      subcategoryId: '',
      questionText: '',
      questionOrder: 0,
      subcategoryOrder: 0
    });
    setEditingQuestion(null);
  };

const getSubcategoriesForCategory = (categoryId) => {
  return subcategories.filter(s => {
    // Convert both to numbers for comparison
    return parseInt(s.categoryId) === parseInt(categoryId);
  });
};

// Fixed helper function with proper type conversion
const getQuestionsForSubcategory = (subcategoryId) => {
  return questions.filter(q => {
    // Convert both to numbers for comparison
    return parseInt(q.subcategoryId) === parseInt(subcategoryId);
  });
};

  if (loading) {
    return (
      <div className={styles["loading-container"]}>
        <div className={styles["loading-spinner"]}>
          <div className={styles["spinner"]}></div>
          <p>Loading Test Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["edit-test-container"]}>
      {/* Header */}
      <header className={styles["page-header"]}>
        <div className={styles["header-content"]}>
          <div className={styles["header-left"]}>
            <button 
              onClick={() => navigate('/admin/manage-tests')}
              className={styles["back-button"]}
            >
              ← Back to Manage Tests
            </button>
            <h1 className={styles["page-title"]}>Edit Test</h1>
          </div>
        </div>
      </header>

      {/* Success/Error Messages */}
      {success && (
        <div className={styles["success-message"]}>
          <p>{success}</p>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {error && (
        <div className={styles["error-message"]}>
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles["tabs-container"]}>
        <div className={styles["tabs"]}>
          <button 
            className={`${styles["tab"]} ${activeTab === 'info' ? styles["active"] : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Test Information
          </button>
          <button 
            className={`${styles["tab"]} ${activeTab === 'structure' ? styles["active"] : ''}`}
            onClick={() => setActiveTab('structure')}
          >
            Test Structure ({categories.length} Categories)
          </button>
          <button 
            className={`${styles["tab"]} ${activeTab === 'questions' ? styles["active"] : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            Questions ({questions.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles["tab-content"]}>
        {/* Test Information Tab */}
        {activeTab === 'info' && (
          <div className={styles["test-info-section"]}>
            <div className={styles["form-container"]}>
              <div className={styles["form-group"]}>
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

              <div className={styles["form-group"]}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={testInfo.description}
                  onChange={(e) => handleTestInfoChange('description', e.target.value)}
                  placeholder="Enter test description"
                  rows="3"
                />
              </div>

              <div className={styles["form-group"]}>
                <label htmlFor="instructions">Instructions</label>
                <textarea
                  id="instructions"
                  value={testInfo.instructions}
                  onChange={(e) => handleTestInfoChange('instructions', e.target.value)}
                  placeholder="Enter test instructions"
                  rows="4"
                />
              </div>

              <div className={styles["form-group"]}>
                <label htmlFor="rules">Rules</label>
                <textarea
                  id="rules"
                  value={testInfo.rules}
                  onChange={(e) => handleTestInfoChange('rules', e.target.value)}
                  placeholder="Enter test rules"
                  rows="4"
                />
              </div>

              <div className={styles["form-group"]}>
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

              <div className={styles["form-actions"]}>
                <button 
                  onClick={saveTestInfo}
                  disabled={saving}
                  className={`${styles["save-btn"]} ${styles["primary"]}`}
                >
                  {saving ? 'Saving...' : 'Save Test Information'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Structure Tab */}
        {activeTab === 'structure' && (
          <div className={styles["structure-section"]}>
            <div className={styles["structure-header"]}>
              <h3>Test Structure</h3>
              <button 
                onClick={() => {
                  resetCategoryForm();
                  setShowCategoryModal(true);
                }}
                className={styles["add-category-btn"]}
              >
                + Add Category
              </button>
            </div>

            {categories.length === 0 ? (
              <div className={styles["no-categories"]}>
                <div className={styles["no-categories-icon"]}>📋</div>
                <h4>No categories added yet</h4>
                <p>Start by adding your first category</p>
              </div>
            ) : (
              <div className={styles["categories-list"]}>
                {categories.map((category) => (
                  <div key={category.id} className={styles["category-card"]}>
                    <div className={styles["category-header"]}>
                      <div className={styles["category-info"]}>
                        <h4>{category.name}</h4>
                        <p className={styles["category-description"]}>{category.description}</p>
                        <span className={styles["category-stats"]}>
                          {getSubcategoriesForCategory(category.id).length} subcategories
                        </span>
                      </div>
                      <div className={styles["category-actions"]}>
                        <button 
                          onClick={() => {
                            setNewCategory({
                              name: category.name,
                              description: category.description,
                              displayOrder: category.displayOrder
                            });
                            setEditingCategory(category.id);
                            setShowCategoryModal(true);
                          }}
                          className={styles["edit-btn"]}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm({ type: 'category', id: category.id })}
                          className={styles["delete-btn"]}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Subcategories */}
                    <div className={styles["subcategories-section"]}>
                      <div className={styles["subcategories-header"]}>
                        <h5>Subcategories</h5>
                        <button 
                          onClick={() => {
                            resetSubcategoryForm();
                            setNewSubcategory(prev => ({ ...prev, categoryId: category.id }));
                            setShowSubcategoryModal(true);
                          }}
                          className={styles["add-subcategory-btn"]}
                        >
                          + Add Subcategory
                        </button>
                      </div>

                      {getSubcategoriesForCategory(category.id).length === 0 ? (
                        <div className={styles["no-subcategories"]}>
                          <p>No subcategories in this category</p>
                        </div>
                      ) : (
                        <div className={styles["subcategories-list"]}>
                          {getSubcategoriesForCategory(category.id).map((subcategory) => (
                            <div key={subcategory.id} className={styles["subcategory-card"]}>
                              <div className={styles["subcategory-info"]}>
                                <h6>{subcategory.name}</h6>
                                <p className={styles["subcategory-description"]}>{subcategory.description}</p>
                                <span className={styles["subcategory-stats"]}>
                                  {getQuestionsForSubcategory(subcategory.id).length} questions
                                </span>
                              </div>
                              <div className={styles["subcategory-actions"]}>
                                <button 
                                  onClick={() => {
                                    setNewSubcategory({
                                      categoryId: subcategory.categoryId,
                                      name: subcategory.name,
                                      description: subcategory.description,
                                      displayOrder: subcategory.displayOrder
                                    });
                                    setEditingSubcategory(subcategory.id);
                                    setShowSubcategoryModal(true);
                                  }}
                                  className={`${styles["edit-btn"]} ${styles["small"]}`}
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => setShowDeleteConfirm({ type: 'subcategory', id: subcategory.id })}
                                  className={`${styles["delete-btn"]} ${styles["small"]}`}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className={styles["questions-section"]}>
            <div className={styles["questions-header"]}>
              <h3>Questions</h3>
              <button 
                onClick={() => {
                  resetQuestionForm();
                  setShowQuestionModal(true);
                }}
                className={styles["add-question-btn"]}
                disabled={categories.length === 0}
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className={styles["no-questions"]}>
                <div className={styles["no-questions-icon"]}>❓</div>
                <h4>No questions added yet</h4>
                <p>Add categories and subcategories first, then add questions</p>
              </div>
            ) : (
              <div className={styles["questions-list"]}>
                {categories.map((category) => (
                  <div key={category.id} className={styles["category-questions"]}>
                    <h4 className={styles["category-title"]}>{category.name}</h4>
                    
                    {getSubcategoriesForCategory(category.id).map((subcategory) => {
                      const subcategoryQuestions = getQuestionsForSubcategory(subcategory.id);
                      
                      return (
                        <div key={subcategory.id} className={styles["subcategory-questions"]}>
                          <h5 className={styles["subcategory-title"]}>
                            {subcategory.name} ({subcategoryQuestions.length} questions)
                          </h5>
                          
                          {subcategoryQuestions.length === 0 ? (
                            <div className={styles["no-subcategory-questions"]}>
                              <p>No questions in this subcategory</p>
                            </div>
                          ) : (
                            <div className={styles["questions-grid"]}>
                              {subcategoryQuestions
                                .sort((a, b) => a.subcategoryOrder - b.subcategoryOrder)
                                .map((question) => (
                                <div key={question.id} className={styles["question-card"]}>
                                  <div className={styles["question-header"]}>
                                    <span className={styles["question-number"]}>
                                      Q{question.subcategoryOrder}
                                    </span>
                                    <div className={styles["question-actions"]}>
                                      <button 
                                        onClick={() => {
                                          setNewQuestion({
                                            categoryId: question.categoryId,
                                            subcategoryId: question.subcategoryId,
                                            questionText: question.questionText,
                                            questionOrder: question.questionOrder,
                                            subcategoryOrder: question.subcategoryOrder
                                          });
                                          setEditingQuestion(question.id);
                                          setShowQuestionModal(true);
                                        }}
                                        className={`${styles["edit-btn"]} ${styles["small"]}`}
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        onClick={() => setShowDeleteConfirm({ type: 'question', id: question.id })}
                                        className={`${styles["delete-btn"]} ${styles["small"]}`}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className={styles["question-content"]}>
                                    <p className={styles["question-text"]}>{question.questionText}</p>
                                    <div className={styles["fixed-options"]}>
                                      <p className={styles["options-label"]}>Options (Fixed for all questions):</p>
                                      <div className={styles["options-list"]}>
                                        {fixedOptions.map((option, index) => (
                                          <span key={index} className={styles["option-item"]}>
                                            {option.label}. {option.text} ({option.marks} marks)
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {getSubcategoriesForCategory(category.id).length === 0 && (
                      <div className={styles["no-subcategories-for-questions"]}>
                        <p>No subcategories in this category. Add subcategories first.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal"]}>
            <div className={styles["modal-header"]}>
              <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  resetCategoryForm();
                }}
                className={styles["close-btn"]}
              >
                ×
              </button>
            </div>
            <div className={styles["modal-body"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="categoryName">Category Name *</label>
                <input
                  type="text"
                  id="categoryName"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter category name"
                  required
                />
              </div>
              <div className={styles["form-group"]}>
                <label htmlFor="categoryDescription">Description</label>
                <textarea
                  id="categoryDescription"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter category description"
                  rows="3"
                />
              </div>
            </div>
            <div className={styles["modal-footer"]}>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  resetCategoryForm();
                }}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button 
                onClick={editingCategory ? updateCategory : addCategory}
                disabled={saving || !newCategory.name.trim()}
                className={`${styles["save-btn"]} ${styles["primary"]}`}
              >
                {saving ? 'Saving...' : editingCategory ? 'Update Category' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {showSubcategoryModal && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal"]}>
            <div className={styles["modal-header"]}>
              <h3>{editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}</h3>
              <button 
                onClick={() => {
                  setShowSubcategoryModal(false);
                  resetSubcategoryForm();
                }}
                className={styles["close-btn"]}
              >
                ×
              </button>
            </div>
            <div className={styles["modal-body"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="subcategoryCategory">Category *</label>
                <select
                  id="subcategoryCategory"
                  value={newSubcategory.categoryId}
                  onChange={(e) => setNewSubcategory(prev => ({ ...prev, categoryId: e.target.value }))}
                  required
                  disabled={editingSubcategory}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles["form-group"]}>
                <label htmlFor="subcategoryName">Subcategory Name *</label>
                <input
                  type="text"
                  id="subcategoryName"
                  value={newSubcategory.name}
                  onChange={(e) => setNewSubcategory(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter subcategory name"
                  required
                />
              </div>
              <div className={styles["form-group"]}>
                <label htmlFor="subcategoryDescription">Description</label>
                <textarea
                  id="subcategoryDescription"
                  value={newSubcategory.description}
                  onChange={(e) => setNewSubcategory(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter subcategory description"
                  rows="3"
                />
              </div>
            </div>
            <div className={styles["modal-footer"]}>
              <button 
                onClick={() => {
                  setShowSubcategoryModal(false);
                  resetSubcategoryForm();
                }}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button 
                onClick={editingSubcategory ? updateSubcategory : addSubcategory}
                disabled={saving || !newSubcategory.name.trim() || !newSubcategory.categoryId}
                className={`${styles["save-btn"]} ${styles["primary"]}`}
              >
                {saving ? 'Saving...' : editingSubcategory ? 'Update Subcategory' : 'Add Subcategory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal"]}>
            <div className={styles["modal-header"]}>
              <h3>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
              <button 
                onClick={() => {
                  setShowQuestionModal(false);
                  resetQuestionForm();
                }}
                className={styles["close-btn"]}
              >
                ×
              </button>
            </div>
            <div className={styles["modal-body"]}>
              <div className={styles["form-group"]}>
                <label htmlFor="questionCategory">Category *</label>
                <select
                  id="questionCategory"
                  value={newQuestion.categoryId}
                  onChange={(e) => {
                    setNewQuestion(prev => ({ 
                      ...prev, 
                      categoryId: e.target.value,
                      subcategoryId: '' // Reset subcategory when category changes
                    }));
                  }}
                  required
                  disabled={editingQuestion}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles["form-group"]}>
                <label htmlFor="questionSubcategory">Subcategory *</label>
                <select
                  id="questionSubcategory"
                  value={newQuestion.subcategoryId}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, subcategoryId: e.target.value }))}
                  required
                  disabled={!newQuestion.categoryId || editingQuestion}
                >
                  <option value="">Select a subcategory</option>
                  {newQuestion.categoryId && 
                    getSubcategoriesForCategory(newQuestion.categoryId).map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))
                  }
                </select>
                {/* Add debug info temporarily to see what's happening */}
                {process.env.NODE_ENV === 'development' && (
                  <small style={{color: 'gray'}}>
                    Debug: Category ID: {newQuestion.categoryId}, 
                    Available subcategories: {getSubcategoriesForCategory(newQuestion.categoryId).length}
                  </small>
                )}
              </div>

              <div className={styles["form-group"]}>
                <label htmlFor="questionText">Question Text *</label>
                <textarea
                  id="questionText"
                  value={newQuestion.questionText}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, questionText: e.target.value }))}
                  placeholder="Enter your question here"
                  rows="4"
                  required
                />
              </div>

              <div className={styles["fixed-options-preview"]}>
                <h4>Fixed Options for All Questions:</h4>
                <div className={styles["options-preview"]}>
                  {fixedOptions.map((option, index) => (
                    <div key={index} className={styles["option-preview"]}>
                      <span className={styles["option-label"]}>{option.label}.</span>
                      <span className={styles["option-text"]}>{option.text}</span>
                      <span className={styles["option-marks"]}>({option.marks} marks)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles["modal-footer"]}>
              <button 
                onClick={() => {
                  setShowQuestionModal(false);
                  resetQuestionForm();
                }}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button 
                onClick={editingQuestion ? updateQuestion : addQuestion}
                disabled={saving || !newQuestion.questionText.trim() || !newQuestion.categoryId || !newQuestion.subcategoryId}
                className={`${styles["save-btn"]} ${styles["primary"]}`}
              >
                {saving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles["modal-overlay"]}>
          <div className={`${styles["modal"]} ${styles["delete-modal"]}`}>
            <div className={styles["modal-header"]}>
              <h3>Confirm Delete</h3>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className={styles["close-btn"]}
              >
                ×
              </button>
            </div>
            <div className={styles["modal-body"]}>
              <div className={styles["delete-warning"]}>
                <div className={styles["warning-icon"]}>⚠️</div>
                <p>
                  Are you sure you want to delete this {showDeleteConfirm.type}?
                  {showDeleteConfirm.type === 'category' && (
                    <span className={styles["warning-text"]}>
                      <br />This will also delete all subcategories and questions in this category.
                    </span>
                  )}
                  {showDeleteConfirm.type === 'subcategory' && (
                    <span className={styles["warning-text"]}>
                      <br />This will also delete all questions in this subcategory.
                    </span>
                  )}
                </p>
                <p className={styles["delete-confirmation"]}>This action cannot be undone.</p>
              </div>
            </div>
            <div className={styles["modal-footer"]}>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (showDeleteConfirm.type === 'category') {
                    deleteCategory(showDeleteConfirm.id);
                  } else if (showDeleteConfirm.type === 'subcategory') {
                    deleteSubcategory(showDeleteConfirm.id);
                  } else if (showDeleteConfirm.type === 'question') {
                    deleteQuestion(showDeleteConfirm.id);
                  }
                }}
                disabled={saving}
                className={`${styles["delete-btn"]} ${styles["primary"]}`}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditTest;