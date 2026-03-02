import React from 'react';
import MyTasks from './MyTasks';
import ProjectOverview from './ProjectOverview';
import TeamMembers from './TeamMembers';
import UpcomingDeadlines from './UpcomingDeadlines';
import Analytics from './Analytics';
import Projects from './Projects';
import Reports from './Reports';
import Sprints from './Sprints';
import Settings from './Settings';
import CalendarView from './CalendarView';
import NotificationsCenter from './NotificationsCenter';
import './MainContent.css';

const MainContent = ({ activeView = 'dashboard' }) => {
  if (activeView === 'settings') {
    return (
      <main className="main-content">
        <div className="content-page">
          <Settings />
        </div>
      </main>
    );
  }

  if (activeView === 'projects') {
    return (
      <main className="main-content">
        <div className="content-page">
          <Projects />
        </div>
      </main>
    );
  }

  if (activeView === 'calendar') {
    return (
      <main className="main-content">
        <div className="content-page">
          <CalendarView />
        </div>
      </main>
    );
  }

  if (activeView === 'team') {
    return (
      <main className="main-content">
        <div className="content-page">
          <TeamMembers />
          <UpcomingDeadlines />
        </div>
      </main>
    );
  }

  if (activeView === 'reports') {
    return (
      <main className="main-content">
        <div className="content-page">
          <Reports />
        </div>
      </main>
    );
  }

  if (activeView === 'sprints') {
    return (
      <main className="main-content">
        <div className="content-page">
          <Sprints />
        </div>
      </main>
    );
  }

  if (activeView === 'notifications') {
    return (
      <main className="main-content">
        <div className="content-page">
          <NotificationsCenter />
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <div className="dashboard-layout">
        <div className="dashboard-top">
          <div className="dashboard-main-left">
            <MyTasks />
          </div>
          <div className="dashboard-main-right">
            <ProjectOverview />
            <UpcomingDeadlines />
          </div>
        </div>
        <div className="dashboard-bottom">
          <div className="analytics-section">
            <div className="analytics-header">
              <h2>Analytics & Insights</h2>
            </div>
            <Analytics />
          </div>
        </div>
      </div>
    </main>
  );
};

export default MainContent;
