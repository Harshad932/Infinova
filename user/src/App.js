import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './components/Homepage';
import TestInfo from './components/TestInfo';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Homepage/>} />
        <Route path="/test-info/:testId" element={<TestInfo/>} />
      </Routes>
    </Router>
  );
}

export default App;

