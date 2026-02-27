import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import './Dashboard.css';
import Chatbot from './Chatbot';

const Dashboard = () => {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <div className="dashboard">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <div className="dashboard-main">
        <Header />
        <MainContent activeView={activeView} />
        <Chatbot />
      </div>
    </div>
  );
};

export default Dashboard;
