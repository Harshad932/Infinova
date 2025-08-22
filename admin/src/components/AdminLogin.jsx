import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../assets/styles/AdminLogin.module.css';

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
    <div className={styles["AdminLogin-container"]}>
      <div className={styles["AdminLogin-wrapper"]}>
        <div className={styles["AdminLogin-card"]}>
          <div className={styles["AdminLogin-header"]}>
            <h1 className={styles["AdminLogin-title"]}>Admin Login</h1>
            <p className={styles["AdminLogin-subtitle"]}>Access your test management dashboard</p>
          </div>

          <form className={styles["AdminLogin-form"]} onSubmit={handleSubmit}>
            {error && (
              <div className={styles["AdminLogin-error-message"]}>
                <span className={styles["AdminLogin-error-icon"]}>⚠️</span>
                {error}
              </div>
            )}
            <div className={styles["AdminLogin-form-group"]}>
              <label className={styles["AdminLogin-label"]}>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className={styles["AdminLogin-form-input"]}
              />
            </div>
            <div className={styles["AdminLogin-form-group"]}>
              <label className={styles["AdminLogin-label"]}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={styles["AdminLogin-form-input"]}
              />
            </div>
            <div className={styles["AdminLogin-form-group"]}>
              <label className={styles["AdminLogin-label"]}>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className={styles["AdminLogin-form-input"]}
              />
            </div>
            <button
              type="submit"
              className={`${styles["AdminLogin-button"]} ${loading ? styles["AdminLogin-disabled"] : ''}`}
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