import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../assets/styles/ThankYou.module.css';

const ThankYou = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className={styles["thank-you-container"]}>
      <div className={styles["thank-you-card"]}>
        <div className={styles["success-icon"]}>
          <svg 
            className={styles["checkmark"]} 
            viewBox="0 0 52 52"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle 
              className={styles["checkmark-circle"]} 
              cx="26" 
              cy="26" 
              r="25" 
              fill="none"
            />
            <path 
              className={styles["checkmark-check"]} 
              fill="none" 
              d="m14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>
        
        <h1 className={styles["thank-you-title"]}>Thank You!</h1>
        
        <p className={styles["thank-you-message"]}>
          Your test has been successfully completed and submitted.
        </p>
        
        <div className={styles["completion-details"]}>
          <div className={styles["detail-item"]}>
            <span className={styles["detail-icon"]}>✓</span>
            <span className={styles["detail-text"]}>Test Completed</span>
          </div>
          <div className={styles["detail-item"]}>
            <span className={styles["detail-icon"]}>📊</span>
            <span className={styles["detail-text"]}>Results Recorded</span>
          </div>
          <div className={styles["detail-item"]}>
            <span className={styles["detail-icon"]}>🎯</span>
            <span className={styles["detail-text"]}>Assessment Submitted</span>
          </div>
        </div>
        
        <p className={styles["appreciation-text"]}>
          We appreciate your time and effort in completing this psychometric assessment. 
          Your responses have been securely recorded and will be processed for analysis.
        </p>
        
        <div className={styles["action-buttons"]}>
          <button 
            className={styles["back-home-btn"]}
            onClick={handleBackToHome}
            type="button"
          >
            <span className={styles["btn-icon"]}>🏠</span>
            Back to Home
          </button>
        </div>
        
        <div className={styles["footer-note"]}>
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