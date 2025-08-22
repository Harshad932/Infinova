import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../assets/styles/ManageTests.module.css';

const ManageTests = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const navigate = useNavigate();

  // API base URL - adjust according to your backend setup
  const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

  // Fetch tests from backend - wrapped in useCallback to prevent unnecessary re-renders
  const fetchTests = useCallback(async (page = 1, search = '', status = 'all') => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (search.trim()) {
        queryParams.append('search', search.trim());
      }
      
      if (status !== 'all') {
        queryParams.append('status', status);
      }

      const response = await fetch(`${API_BASE_URL}/admin/manage-tests?${queryParams}`, {
        method: 'GET',
        headers: getApiHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const processedTests = (data.tests || []).map(test => {
        let status = 'draft';
        // Updated status logic based on new database schema
        if (test.is_test_ended) status = 'completed';
        else if (test.is_active && test.is_live) status = 'active';
        else if (test.is_published) status = 'published';

        return { 
          ...test, 
          status,
          // Map database fields to component expectations
          testCode: test.test_code,
          totalQuestions: test.total_questions,
          totalCategories: test.total_categories,
          totalSubcategories: test.total_subcategories,
          timePerQuestion: test.time_per_question,
          participants: test.participants || 0,
          completedParticipants: test.completed_participants || 0,
          isActive: test.is_active,
          isPublished: test.is_published,
          isLive: test.is_live,
          createdAt: test.created_at
        };
      });
      setTests(processedTests || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching tests:', error);
      setError('Failed to fetch tests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

// Debounce search term with delayed fetch
useEffect(() => {
  const handler = setTimeout(() => {
    setDebouncedSearchTerm(searchTerm);
    setCurrentPage(1); // Reset page after search debounce
  }, 500);

  return () => clearTimeout(handler);
}, [searchTerm]);


  // Reset to page 1 when search or filter changes, but don't trigger fetch here

  useEffect(() => {
    fetchTests(currentPage, debouncedSearchTerm, filterStatus);
  }, [currentPage, debouncedSearchTerm, filterStatus, fetchTests]);
  
  // Main effect that handles API calls
  useEffect(() => {
    fetchTests(currentPage, debouncedSearchTerm, filterStatus);
  }, [currentPage, debouncedSearchTerm, filterStatus, fetchTests]);

  // Handle card click - navigate to test detail page if published
  const handleTestCardClick = (test) => {
    // Navigate to test detail page if test is published or active
    if (test.isPublished || test.isActive) {
      navigate(`/admin/test-detail/${test.id}`);
    }
  };

  const handleConfirmAction = (action, testId, event) => {
    // Prevent card click when clicking action buttons
    if (event) {
      event.stopPropagation();
    }
    setConfirmAction({ action, testId });
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    const { action, testId } = confirmAction;
    
    try {
      let response;
      
      switch(action) {
        case 'publish':
          response = await fetch(`${API_BASE_URL}/admin/manage-tests/${testId}/publish`, {
            method: 'PUT',
            headers: getApiHeaders()
          });
          break;
        case 'unpublish':
          response = await fetch(`${API_BASE_URL}/admin/manage-tests/${testId}/unpublish`, {
            method: 'PUT',
            headers: getApiHeaders()
          });
          break;
        case 'delete':
          response = await fetch(`${API_BASE_URL}/admin/manage-tests/${testId}`, {
            method: 'DELETE',
            headers: getApiHeaders()
          });
          break;
        default:
          throw new Error('Unknown action');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Action failed');
      }

      // Refresh the tests list with current filters
      fetchTests(currentPage, debouncedSearchTerm, filterStatus);
      
    } catch (error) {
      console.error('Error executing action:', error);
      setError(error.message || 'Action failed. Please try again.');
    }
    
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'draft': return styles['ManageTests-status-draft'];
      case 'published': return styles['ManageTests-status-published'];
      case 'active': return styles['ManageTests-status-active'];
      case 'completed': return styles['ManageTests-status-completed'];
      default: return styles['ManageTests-status-draft'];
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle edit button click
  const handleEditClick = (testId, event) => {
    if (event) {
      event.stopPropagation();
    }
    navigate(`/admin/edit-test/${testId}`);
  };

  // Handle results button click
  const handleResultsClick = (testId, event) => {
    if (event) {
      event.stopPropagation();
    }
    navigate(`/admin/test-results/${testId}`);
  };

   const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  // Show loading only on initial load
  if (loading && tests.length === 0) {
    return (
      <div className={styles["ManageTests-loading-container"]}>
        <div className={styles["ManageTests-loading-spinner"]}>
          <div className={styles["ManageTests-spinner"]}></div>
          <p>Loading Tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["ManageTests-container"]}>
      {/* Header */}
      <header className={styles["ManageTests-page-header"]}>
        <div className={styles["ManageTests-header-content"]}>
          <div className={styles["ManageTests-header-left"]}>
            <button 
              onClick={handleLogout}
              className={styles["ManageTests-back-button"]}
            >
              Logout
            </button>
            <h1 className={styles["ManageTests-page-title"]}>Manage Tests</h1>
          </div>
          <button 
            onClick={() => navigate('/admin/create-test')}
            className={styles["ManageTests-create-test-btn"]}
          >
            + Create New Test
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className={styles["ManageTests-error-message"]}>
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className={styles["ManageTests-filters-section"]}>
        <div className={styles["ManageTests-search-bar"]}>
          <input
            type="text"
            placeholder="Search tests by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles["ManageTests-search-input"]}
          />
        </div>
        
        <div className={styles["ManageTests-filter-dropdown"]}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles["ManageTests-filter-select"]}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tests Grid */}
      <div className={styles["ManageTests-tests-grid"]}>
        {tests.length === 0 && !loading ? (
          <div className={styles["ManageTests-no-tests"]}>
            <div className={styles["ManageTests-no-tests-icon"]}>📝</div>
            <h3>No tests found</h3>
            <p>Create your first test or adjust your search filters</p>
          </div>
        ) : (
          tests.map(test => (
            <div 
              key={test.id} 
              className={`${styles["ManageTests-test-card"]} ${(test.status === 'published' || test.status === 'active') ? styles["ManageTests-clickable"] : ''}`}
              onClick={() => handleTestCardClick(test)}
              style={{ 
                cursor: (test.status === 'published' || test.status === 'active') ? 'pointer' : 'default' 
              }}
            >
              <div className={styles["ManageTests-test-card-header"]}>
                <div className={styles["ManageTests-test-title-section"]}>
                  <h3 className={styles["ManageTests-test-title"]}>{test.title}</h3>
                  <span className={`${styles["ManageTests-status-badge"]} ${getStatusBadge(test.status)}`}>
                    {getStatusText(test.status)}
                  </span>
                </div>
                {/* Show test code only if it exists */}
                {test.testCode && (
                  <div className={styles["ManageTests-test-code"]}>
                    Code: <span className={styles["ManageTests-code-text"]}>{test.testCode}</span>
                  </div>
                )}
              </div>

              <div className={styles["ManageTests-test-card-body"]}>
                <p className={styles["ManageTests-test-description"]}>{test.description || 'No description available'}</p>
                
                <div className={styles["ManageTests-test-info"]}>
                  <div className={styles["ManageTests-info-item"]}>
                    <span className={styles["ManageTests-info-label"]}>Questions:</span>
                    <span className={styles["ManageTests-info-value"]}>{test.totalQuestions || 0}</span>
                  </div>
                  <div className={styles["ManageTests-info-item"]}>
                    <span className={styles["ManageTests-info-label"]}>Categories:</span>
                    <span className={styles["ManageTests-info-value"]}>{test.totalCategories || 0}</span>
                  </div>
                  <div className={styles["ManageTests-info-item"]}>
                    <span className={styles["ManageTests-info-label"]}>Subcategories:</span>
                    <span className={styles["ManageTests-info-value"]}>{test.totalSubcategories || 0}</span>
                  </div>
                  <div className={styles["ManageTests-info-item"]}>
                    <span className={styles["ManageTests-info-label"]}>Time per Q:</span>
                    <span className={styles["ManageTests-info-value"]}>{test.timePerQuestion || 0}s</span>
                  </div>
                  <div className={styles["ManageTests-info-item"]}>
                    <span className={styles["ManageTests-info-label"]}>Participants:</span>
                    <span className={styles["ManageTests-info-value"]}>{test.participants || 0}</span>
                  </div>
                  <div className={styles["ManageTests-info-item"]}>
                    <span className={styles["ManageTests-info-label"]}>Completed:</span>
                    <span className={styles["ManageTests-info-value"]}>{test.completedParticipants || 0}</span>
                  </div>
                </div>

                {/* Show category and subcategory breakdown if available */}
                {test.categoryBreakdown && test.categoryBreakdown.length > 0 && (
                  <div className={styles["ManageTests-category-breakdown"]}>
                    <span className={styles["ManageTests-breakdown-label"]}>Structure:</span>
                    <div className={styles["ManageTests-breakdown-list"]}>
                      {test.categoryBreakdown.slice(0, 2).map((category, index) => (
                        <span key={index} className={styles["ManageTests-category-tag"]}>
                          {category.name} ({category.subcategories} subcats)
                        </span>
                      ))}
                      {test.categoryBreakdown.length > 2 && (
                        <span className={`${styles["ManageTests-category-tag"]} ${styles["ManageTests-more"]}`}>
                          +{test.categoryBreakdown.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles["ManageTests-test-meta"]}>
                  <span className={styles["ManageTests-created-date"]}>Created: {formatDate(test.createdAt)}</span>
                </div>

                {/* Show click instruction for published/active tests */}
                {(test.status === 'published' || test.status === 'active') && (
                  <div className={styles["ManageTests-click-instruction"]}>
                    <small>💡 Click card to view test details and manage participants</small>
                  </div>
                )}
              </div>

              <div className={styles["ManageTests-test-card-actions"]}>
                <div className={styles["ManageTests-action-row"]}>
                  {/* Edit Button - Available for all statuses except completed */}
                  {test.status !== 'completed' && (
                    <button 
                      onClick={(e) => handleEditClick(test.id, e)}
                      className={`${styles["ManageTests-action-btn"]} ${styles["ManageTests-edit-btn"]}`}
                    >
                      Edit
                    </button>
                  )}
                  
                  {/* Publish Button - Only for draft tests */}
                  {test.status === 'draft' && (
                    <button 
                      onClick={(e) => handleConfirmAction('publish', test.id, e)}
                      className={`${styles["ManageTests-action-btn"]} ${styles["ManageTests-publish-btn"]}`}
                    >
                      Publish
                    </button>
                  )}

                  {/* Unpublish Button - For published tests only */}
                  {test.status === 'published' && (
                    <button 
                      onClick={(e) => handleConfirmAction('unpublish', test.id, e)}
                      className={`${styles["ManageTests-action-btn"]} ${styles["ManageTests-unpublish-btn"]}`}
                    >
                      Unpublish
                    </button>
                  )}

                  {/* Results Button - For completed tests or active tests with participants */}
                  {(test.status === 'completed' || (test.status === 'active' && test.completedParticipants > 0)) && (
                    <button 
                      onClick={(e) => handleResultsClick(test.id, e)}
                      className={`${styles["ManageTests-action-btn"]} ${styles["ManageTests-results-btn"]}`}      
                    >
                      Results
                    </button>
                  )}

                  {/* Delete Button - Only for draft tests */}
                  {(test.status === 'draft' || test.status === 'completed') && (
                    <button 
                      onClick={(e) => handleConfirmAction('delete', test.id, e)}
                      className={`${styles["ManageTests-action-btn"]} ${styles["ManageTests-delete-btn"]}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className={styles["ManageTests-pagination"]}>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={!pagination.hasPrev}
            className={styles["ManageTests-pagination-btn"]}
          >
            Previous
          </button>
          
          <span className={styles["ManageTests-pagination-info"]}>
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          
          <button 
            onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
            disabled={!pagination.hasNext}
            className={styles["ManageTests-pagination-btn"]}
          >
            Next
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className={styles["ManageTests-modal-overlay"]}>
          <div className={`${styles["ManageTests-modal"]} ${styles["ManageTests-confirm-modal"]}`}>
            <div className={styles["ManageTests-modal-header"]}>
              <h3>Confirm Action</h3>
            </div>
            <div className={styles["ManageTests-modal-body"]}>
              <p>Are you sure you want to {confirmAction?.action.replace(/([A-Z])/g, ' $1').toLowerCase()} this test?</p>
              {confirmAction?.action === 'delete' && (
                <p className={styles["ManageTests-warning-text"]}>This action cannot be undone.</p>
              )}
              {confirmAction?.action === 'publish' && (
                <p className={styles["ManageTests-info-text"]}>Once published, the test will be available for activation and user registration.</p>
              )}
              {confirmAction?.action === 'unpublish' && (
                <p className={styles["ManageTests-warning-text"]}>This will make the test unavailable and deactivate it if currently active.</p>
              )}
            </div>
            <div className={styles["ManageTests-modal-actions"]}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className={`${styles["ManageTests-modal-btn"]} ${styles["ManageTests-secondary"]}`}
              >
                Cancel
              </button>
              <button 
                onClick={executeAction}
                className={`${styles["ManageTests-modal-btn"]} ${styles["ManageTests-primary"]}`}
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

export default ManageTests;