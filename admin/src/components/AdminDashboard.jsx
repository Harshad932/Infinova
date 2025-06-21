import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalTests: 0,
    activeTests: 0,
    totalUsers: 0,
    completedTests: 0
  });
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('adminData');

    if (!token || !admin) {
      navigate('/admin/login');
      return;
    }

    setAdminData(JSON.parse(admin));
    fetchDashboardStats(token);
  }, []);

  const fetchDashboardStats = async (token) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Temporarily using dummy values, as your backend doesn't return stats yet
        setStats({
          totalTests: 0,
          activeTests: 0,
          totalUsers: 0,
          completedTests: 0
        });
      } else if (response.status === 401 || response.status === 403) {
        navigate('/admin/login');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  const handleNavigation = (path) => {
    navigate(`/admin/${path}`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">Test Management Dashboard</h1>
          <div className="header-right">
            <span className="welcome-text">
              Welcome, {adminData?.username || 'Admin'}
            </span>
            <button 
              onClick={handleLogout}
              className="logout-button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.totalTests}</h3>
              <p className="stat-label">Total Tests</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🟢</div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.activeTests}</h3>
              <p className="stat-label">Active Tests</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.totalUsers}</h3>
              <p className="stat-label">Total Users</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.completedTests}</h3>
              <p className="stat-label">Completed Tests</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="actions-grid">
          <button 
            onClick={() => handleNavigation('create-test')}
            className="action-button"
          >
            <div className="action-icon">➕</div>
            <div className="action-content">
              <h3>Create New Test</h3>
              <p>Set up questions, categories, and timing</p>
            </div>
          </button>

          <button 
            onClick={() => handleNavigation('manage-tests')}
            className="action-button"
          >
            <div className="action-icon">⚙️</div>
            <div className="action-content">
              <h3>Manage Tests</h3>
              <p>Edit, activate, or generate test codes</p>
            </div>
          </button>

          <button 
            onClick={() => handleNavigation('results')}
            className="action-button"
          >
            <div className="action-icon">📈</div>
            <div className="action-content">
              <h3>View Results</h3>
              <p>Analyze performance and download reports</p>
            </div>
          </button>

          <button 
            onClick={() => handleNavigation('clone-test')}
            className="action-button"
          >
            <div className="action-icon">📋</div>
            <div className="action-content">
              <h3>Clone Previous Test</h3>
              <p>Reuse existing test formats</p>
            </div>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="recent-activity">
          <h2 className="section-title">Recent Activity</h2>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon">🎯</div>
              <div className="activity-content">
                <p className="activity-text">New test session started</p>
                <span className="activity-time">2 minutes ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">✅</div>
              <div className="activity-content">
                <p className="activity-text">Test completed by user</p>
                <span className="activity-time">15 minutes ago</span>   
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">📊</div>
              <div className="activity-content">
                <p className="activity-text">New test created</p>
                <span className="activity-time">1 hour ago</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
