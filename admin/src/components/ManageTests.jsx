import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/ManageTests.css';

const ManageTests = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
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

  // Fetch tests from backend
  const fetchTests = async (page = 1, search = '', status = 'all') => {
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
        if (test.isTestEnded) status = 'completed';
        else if (test.isActive) status = 'active';
        else if (test.isPublished) status = 'published';

        return { ...test, status };
      });
      setTests(processedTests || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching tests:', error);
      setError('Failed to fetch tests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTests(currentPage, searchTerm, filterStatus);
  }, [currentPage, searchTerm, filterStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchTests(1, searchTerm, filterStatus);
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter status change
  useEffect(() => {
    if (currentPage === 1) {
      fetchTests(1, searchTerm, filterStatus);
    } else {
      setCurrentPage(1);
    }
  }, [filterStatus]);

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

      // Refresh the tests list
      fetchTests(currentPage, searchTerm, filterStatus);
      
    } catch (error) {
      console.error('Error executing action:', error);
      setError(error.message || 'Action failed. Please try again.');
    }
    
    setShowConfirmModal(false);
    setConfirmAction(null);
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

  if (loading && tests.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-tests-container">
      {/* Header */}
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="back-button"
            >
              ← Back to Dashboard
            </button>
            <h1 className="page-title">Manage Tests</h1>
          </div>
          <button 
            onClick={() => navigate('/admin/create-test')}
            className="create-test-btn"
          >
            + Create New Test
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search tests by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-dropdown">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
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
      <div className="tests-grid">
        {tests.length === 0 ? (
          <div className="no-tests">
            <div className="no-tests-icon">📝</div>
            <h3>No tests found</h3>
            <p>Create your first test or adjust your search filters</p>
          </div>
        ) : (
          tests.map(test => (
            <div 
              key={test.id} 
              className={`test-card ${(test.status === 'published' || test.status === 'active') ? 'clickable' : ''}`}
              onClick={() => handleTestCardClick(test)}
              style={{ 
                cursor: (test.status === 'published' || test.status === 'active') ? 'pointer' : 'default' 
              }}
            >
              <div className="test-card-header">
                <div className="test-title-section">
                  <h3 className="test-title">{test.title}</h3>
                  <span className={`status-badge ${getStatusBadge(test.status)}`}>
                    {getStatusText(test.status)}
                  </span>
                </div>
                {/* Show test code only if it exists */}
                {test.testCode && (
                  <div className="test-code">
                    Code: <span className="code-text">{test.testCode}</span>
                  </div>
                )}
              </div>

              <div className="test-card-body">
                <p className="test-description">{test.description || 'No description available'}</p>
                
                <div className="test-info">
                  <div className="info-item">
                    <span className="info-label">Questions:</span>
                    <span className="info-value">{test.totalQuestions || 0}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Time per Q:</span>
                    <span className="info-value">{test.timePerQuestion || 0}s</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Participants:</span>
                    <span className="info-value">{test.participants || 0}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Completed:</span>
                    <span className="info-value">{test.completedParticipants || 0}</span>
                  </div>
                </div>

                {test.skillCategories && test.skillCategories.length > 0 && (
                  <div className="skill-categories">
                    <span className="categories-label">Skills:</span>
                    <div className="categories-list">
                      {test.skillCategories.slice(0, 3).map((skill, index) => (
                        <span key={index} className="skill-tag">{skill}</span>
                      ))}
                      {test.skillCategories.length > 3 && (
                        <span className="skill-tag more">+{test.skillCategories.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="test-meta">
                  <span className="created-date">Created: {formatDate(test.createdAt)}</span>
                </div>

                {/* Show click instruction for published tests */}
                {(test.status === 'published' || test.status === 'active') && (
                  <div className="click-instruction">
                    <small>💡 Click card to view test details and manage participants</small>
                  </div>
                )}
              </div>

              <div className="test-card-actions">
                <div className="action-row">
                  {/* Edit Button - Available for all statuses */}
                  <button 
                    onClick={(e) => handleEditClick(test.id, e)}
                    className="action-btn edit-btn"
                  >
                    Edit
                  </button>
                  
                  {/* Publish Button - Only for draft tests */}
                  {test.status === 'draft' && (
                    <button 
                      onClick={(e) => handleConfirmAction('publish', test.id, e)}
                      className="action-btn publish-btn"
                    >
                      Publish
                    </button>
                  )}

                  {/* Unpublish Button - For published and active tests */}
                  {(test.status === 'published' || test.status === 'active') && (
                    <button 
                      onClick={(e) => handleConfirmAction('unpublish', test.id, e)}
                      className="action-btn unpublish-btn"
                    >
                      Unpublish
                    </button>
                  )}

                  {/* Delete Button - Only for draft tests */}
                  {test.status === 'draft' && (
                    <button 
                      onClick={(e) => handleConfirmAction('delete', test.id, e)}
                      className="action-btn delete-btn"
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
        <div className="pagination">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={!pagination.hasPrev}
            className="pagination-btn"
          >
            Previous
          </button>
          
          <span className="pagination-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          
          <button 
            onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
            disabled={!pagination.hasNext}
            className="pagination-btn"
          >
            Next
          </button>
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
              <p>Are you sure you want to {confirmAction?.action.replace(/([A-Z])/g, ' $1').toLowerCase()} this test?</p>
              {confirmAction?.action === 'delete' && (
                <p className="warning-text">This action cannot be undone.</p>
              )}
              {confirmAction?.action === 'publish' && (
                <p className="info-text">Once published, users will be able to see the test and register for it.</p>
              )}
              {confirmAction?.action === 'unpublish' && (
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
                onClick={executeAction}
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

export default ManageTests;