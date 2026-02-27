import React from 'react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import './ProtectedRoute.css';

const ProtectedRoute = ({ children, requiredRole, requiredAnyRole }) => {
  const { isAuthenticated, loading, hasRole, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Check role-based access
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <p>Required role: {requiredRole}</p>
      </div>
    );
  }

  if (requiredAnyRole && !hasAnyRole(requiredAnyRole)) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <p>Required roles: {requiredAnyRole.join(', ')}</p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
