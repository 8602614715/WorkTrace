import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
