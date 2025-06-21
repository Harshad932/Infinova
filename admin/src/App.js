import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import CreateTest from './components/CreateTest';
import ManageTests from './components/ManageTests';
import EditTest from './components/EditTest';

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
      </Routes>
    </Router>
  );
}

export default App;

