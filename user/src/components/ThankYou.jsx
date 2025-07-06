import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/ThankYou.css';

const ThankYou = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="thank-you-container">
      <div className="thank-you-card">
        <div className="success-icon">
          <svg 
            className="checkmark" 
            viewBox="0 0 52 52"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle 
              className="checkmark-circle" 
              cx="26" 
              cy="26" 
              r="25" 
              fill="none"
            />
            <path 
              className="checkmark-check" 
              fill="none" 
              d="m14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>
        
        <h1 className="thank-you-title">Thank You!</h1>
        
        <p className="thank-you-message">
          Your test has been successfully completed and submitted.
        </p>
        
        <div className="completion-details">
          <div className="detail-item">
            <span className="detail-icon">✓</span>
            <span className="detail-text">Test Completed</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">📊</span>
            <span className="detail-text">Results Recorded</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🎯</span>
            <span className="detail-text">Assessment Submitted</span>
          </div>
        </div>
        
        <p className="appreciation-text">
          We appreciate your time and effort in completing this psychometric assessment. 
          Your responses have been securely recorded and will be processed for analysis.
        </p>
        
        <div className="action-buttons">
          <button 
            className="back-home-btn"
            onClick={handleBackToHome}
            type="button"
          >
            <span className="btn-icon">🏠</span>
            Back to Home
          </button>
        </div>
        
        <div className="footer-note">
          <p>
            If you have any questions or concerns about your test submission, 
            please contact our support team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;