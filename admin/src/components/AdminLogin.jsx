import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/AdminLogin.css';

const AdminLogin = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminData', JSON.stringify(data.admin));
        navigate('/admin/manage-tests');
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="AdminLogin-container">
      <div className="AdminLogin-wrapper">
        <div className="AdminLogin-card">
          <div className="AdminLogin-header">
            <h1 className="AdminLogin-title">Admin Login</h1>
            <p className="AdminLogin-subtitle">Access your test management dashboard</p>
          </div>

          <form className="AdminLogin-form" onSubmit={handleSubmit}>
            {error && (
              <div className="AdminLogin-error-message">
                <span className="AdminLogin-error-icon">⚠️</span>
                {error}
              </div>
            )}
            <div className="AdminLogin-form-group">
              <label className="AdminLogin-label">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="AdminLogin-form-input"
              />
            </div>
            <div className="AdminLogin-form-group">
              <label className="AdminLogin-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="AdminLogin-form-input"
              />
            </div>
            <div className="AdminLogin-form-group">
              <label className="AdminLogin-label">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="AdminLogin-form-input"
              />
            </div>
            <button
              type="submit"
              className={`AdminLogin-button ${loading ? 'AdminLogin-disabled' : ''}`}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;