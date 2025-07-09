import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import CreateTest from './components/CreateTest';
import ManageTests from './components/ManageTests';
import EditTest from './components/EditTest';
import TestDetail from './components/TestDetails';
import TestResults from './components/TestResults';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/create-test" element={<CreateTest />} />
        <Route path="/admin/manage-tests" element={<ManageTests />} />
        <Route path="/admin/edit-test/:id" element={<EditTest />} />
        <Route path="/admin/test-detail/:id" element={<TestDetail />} />
        <Route path="/admin/test-results/:id" element={<TestResults />} />
      </Routes>
    </Router>
  );
}

export default App;

