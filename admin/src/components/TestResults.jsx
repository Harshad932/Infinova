import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/styles/TestResults.css';
import { Eye, Search, Download, Mail, FileText, BarChart3, Users, Send,Filter,ArrowLeft,X} from 'lucide-react';
import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,PieChart,Pie,Cell,LineChart,Line} from 'recharts';

const TestResults = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [testData, setTestData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantResults, setParticipantResults] = useState(null);
  const [overallResults, setOverallResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showParticipantDetail, setShowParticipantDetail] = useState(false);
  const [showOverallResults, setShowOverallResults] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailAllSending, setEmailAllSending] = useState(false);

  const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
  
  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });

  // Chart colors
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];

  // Fetch test results on component mount
  useEffect(() => {
    fetchTestResults();
  }, [testId]);

  // Fetch participants when search term or page changes
  useEffect(() => {
    fetchParticipants();
  }, [searchTerm, currentPage]);

  const fetchTestResults = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/test-results/${testId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch test results');
      }
      
      const data = await response.json();
      setTestData(data.test);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/participants?page=${currentPage}&limit=10&search=${searchTerm}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch participants');
      }
      
      const data = await response.json();
      setParticipants(data.participants);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchParticipantResults = async (participantId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/participant/${participantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch participant results');
      }
      
      const data = await response.json();
      setParticipantResults(data);
      setSelectedParticipant(participantId);
      setShowParticipantDetail(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverallResults = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/overall`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch overall results');
      }
      
      const data = await response.json();
      setOverallResults(data);
      setShowOverallResults(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportParticipant = async (participantId, format) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/participant/${participantId}/export/${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to export ${format}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participant_${participantId}_results.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportOverall = async (format) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/overall/export/${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to export ${format}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overall_results.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendEmailToParticipant = async (participantId) => {
    try {
      setEmailSending(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/participant/${participantId}/send-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            includeReport: true,
            format: 'pdf'
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      const data = await response.json();
      alert(`Email sent successfully to ${data.participant}`);
    } catch (err) {
      setError(err.message);
      alert('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendEmailToAllParticipants = async () => {
    try {
      setEmailAllSending(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/test-results/${testId}/send-all-emails`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            includeReport: true,
            format: 'pdf'
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to send emails');
      }
      
      const data = await response.json();
      alert(`Emails sent to ${data.sentCount} participants`);
    } catch (err) {
      setError(err.message);
      alert('Failed to send emails');
    } finally {
      setEmailAllSending(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const closeParticipantDetail = () => {
    setShowParticipantDetail(false);
    setParticipantResults(null);
    setSelectedParticipant(null);
  };

  const closeOverallResults = () => {
    setShowOverallResults(false);
    setOverallResults(null);
  };

  if (loading && !testData) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="loading-text">Loading test results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-alert">
          Error: {error}
        </div>
      </div>
    );
  }

  // Individual Participant Results Modal
  // Individual Participant Results Modal
const ParticipantDetailModal = () => {
  if (!showParticipantDetail || !participantResults) return null;

  const categoryChartData = participantResults.categoryResults.map(cat => ({
    name: cat.categoryName,
    percentage: parseFloat(cat.averagePercentage),
    questions: cat.totalQuestions,
    marksObtained: cat.totalMarksObtained,
    maxMarks: cat.maxPossibleMarks
  }));

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-padding">
          <div className="modal-header">
            <h2 className="modal-title">
              {participantResults.participant.name} - Results
            </h2>
            <button
              onClick={closeParticipantDetail}
              className="modal-close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Participant Info */}
          <div className="participant-info">
            <div className="participant-info-grid">
              <div className="info-item">
                <p className="info-label">Email</p>
                <p className="info-value">{participantResults.participant.email}</p>
              </div>
              <div className="info-item">
                <p className="info-label">Overall Score</p>
                <p className="info-value score">
                  {participantResults.overallPercentage}%
                </p>
              </div>
              <div className="info-item">
                <p className="info-label">Status</p>
                <p className="info-value">{participantResults.session.status}</p>
              </div>
            </div>
          </div>

          {/* Category-wise Performance with Subcategories */}
          {participantResults.categoryResults.map((category, index) => {
            const categorySubcategories = participantResults.subcategoryResults.filter(
              sub => sub.categoryName === category.categoryName
            );
            
            return (
              <div key={index} className="chart-section">
                <h3 className="chart-title">{category.categoryName}</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categorySubcategories.map(sub => ({
                      name: sub.subcategoryName,
                      percentage: parseFloat(sub.percentageScore)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="percentage" fill={COLORS[index % COLORS.length]} name="Percentage %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}

          {/* Overall Category Performance - Pie Chart */}
          <div className="chart-section">
            <h3 className="chart-title">Overall Category Performance</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => handleExportParticipant(selectedParticipant, 'pdf')}
              className="btn btn-red"
            >
              <FileText size={16} />
              Export PDF
            </button>
            <button
              onClick={() => handleExportParticipant(selectedParticipant, 'excel')}
              className="btn btn-green"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={() => handleExportParticipant(selectedParticipant, 'csv')}
              className="btn btn-blue"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={() => handleSendEmailToParticipant(selectedParticipant)}
              disabled={emailSending}
              className="btn btn-purple"
            >
              <Mail size={16} />
              {emailSending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

  // Overall Results Modal
  const OverallResultsModal = () => {
    if (!showOverallResults || !overallResults) return null;

    const categoryAverageData = overallResults.categoryAverages.map(cat => ({
      name: cat.categoryName,
      average: cat.averageScore,
      participants: cat.participantCount
    }));

    const performanceData = overallResults.performanceDistribution.map(perf => ({
      name: perf.name,
      value: perf.count
    }));

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-padding">
            <div className="modal-header">
              <h2 className="modal-title">
                Overall Test Results - {overallResults.testTitle}
              </h2>
              <button
                onClick={closeOverallResults}
                className="modal-close"
              >
                <X size={24} />
              </button>
            </div>

            {/* Statistics */}
            <div className="stats-grid">
              <div className="stat-card blue">
                <p className="stat-label blue">Total Participants</p>
                <p className="stat-value blue">
                  {overallResults.statistics.totalParticipants}
                </p>
              </div>
              <div className="stat-card green">
                <p className="stat-label green">Completed</p>
                <p className="stat-value green">
                  {overallResults.statistics.completedParticipants}
                </p>
              </div>
              <div className="stat-card purple">
                <p className="stat-label purple">Avg Questions</p>
                <p className="stat-value purple">
                  {overallResults.statistics.averageQuestionsAnswered.toFixed(1)}
                </p>
              </div>
              <div className="stat-card orange">
                <p className="stat-label orange">Overall Average</p>
                <p className="stat-value orange">
                  {overallResults.statistics.overallAveragePercentage.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Category Averages Chart */}
            <div className="chart-section">
              <h3 className="chart-title">Category Average Performance</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryAverageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="average" fill="#8884d8" name="Average Score %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Distribution Chart */}
            <div className="chart-section">
              <h3 className="chart-title">Performance Distribution</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={performanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {performanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="action-buttons">
              <button
                onClick={() => handleExportOverall('csv')}
                className="btn btn-blue"
              >
                <Download size={16} />
                Export CSV
              </button>
              <button
                onClick={() => handleExportOverall('excel')}
                className="btn btn-green"
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="test-results-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-inner">
            <div className="header-left">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="back-button"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="header-title">Test Results</h1>
                {testData && (
                  <p className="header-subtitle">
                    {testData.title} - {testData.completed_participants} participants completed
                  </p>
                )}
              </div>
            </div>
            <div className="header-actions">
              <button
                onClick={fetchOverallResults}
                className="btn btn-primary"
              >
                <BarChart3 size={16} />
                Overall Results
              </button>
              <button
                onClick={handleSendEmailToAllParticipants}
                disabled={emailAllSending}
                className="btn btn-purple"
              >
                <Send size={16} />
                {emailAllSending ? 'Sending...' : 'Email All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="main-content">
        {/* Search and Filters */}
        <div className="search-section">
          <div className="search-container">
            <div className="search-input-container">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search participants..."
                value={searchTerm}
                onChange={handleSearch}
                className="search-input"
              />
            </div>
            <div className="filter-info">
              <Filter size={20} className="filter-icon" />
              <span className="filter-text">
                {participants.length} participants found
              </span>
            </div>
          </div>
        </div>

        {/* Participants List */}
        <div className="participants-section">
          <div className="participants-header">
            <h2 className="participants-title">Participants</h2>
          </div>
          
          <div className="table-container">
            <table className="participants-table">
              <thead className="table-header">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Questions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {participants.map((participant) => (
                  <tr key={participant.id} className="table-row">
                    <td className="table-cell">
                      <div className="participant-name">
                        {participant.name}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="participant-email">{participant.email}</div>
                    </td>
                    <td className="table-cell">
                      <span className={`status-badge ${
                        participant.session_status === 'completed' 
                          ? 'status-completed' 
                          : 'status-incomplete'
                      }`}>
                        {participant.session_status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="score-text">
                        {participant.overall_percentage ? 
                          `${parseFloat(participant.overall_percentage).toFixed(1)}%` : 
                          'N/A'
                        }
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="questions-text">
                        {participant.questions_answered}/{participant.total_questions}
                      </div>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => fetchParticipantResults(participant.id)}
                        className="view-results-btn"
                      >
                        <Eye size={16} />
                        View Results
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-container">
                <div className="pagination-info">
                  Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                  {pagination.totalItems} results
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`pagination-btn ${
                        page === pagination.currentPage ? 'active' : ''
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ParticipantDetailModal />
      <OverallResultsModal />
    </div>
  );
};

export default TestResults;