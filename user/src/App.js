import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './components/Homepage';
import TestInfo from './components/TestInfo';
import LoginVerification from './components/LoginVerification';
import TestInterface from './components/TestInterface';
import ThankYou from './components/ThankYou';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Homepage/>} />
        <Route path="/test-info/:testId" element={<TestInfo/>} />
        <Route path="/login-verification/:testId" element={<LoginVerification/>} />
        <Route path="/test-interface/:testId" element={<TestInterface/>} />
        <Route path="/thank-you" element={<ThankYou/>} />
      </Routes>
    </Router>
  );
}

export default App;

