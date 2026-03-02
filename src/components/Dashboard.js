import React, { useEffect, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import './Dashboard.css';
import Chatbot from './Chatbot';

const Dashboard = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 992);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 992;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (view) => {
    setActiveView(view);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        isMobile={isMobile}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      {isMobile && mobileSidebarOpen && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <div className="dashboard-main">
        <Header
          onNavigate={handleNavigate}
          onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          isMobile={isMobile}
        />
        <MainContent activeView={activeView} />
        <Chatbot />
      </div>
    </div>
  );
};

export default Dashboard;
