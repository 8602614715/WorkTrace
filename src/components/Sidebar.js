import React from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  FiLayout,
  FiFolder,
  FiUsers,
  FiBarChart2,
  FiZap,
  FiSettings,
  FiCalendar
} from 'react-icons/fi';
import './Sidebar.css';

const menuItems = [
  { id: 'dashboard', icon: FiLayout, label: 'Dashboard' },
  { id: 'calendar', icon: FiCalendar, label: 'Calendar' },
  { id: 'projects', icon: FiFolder, label: 'Projects' },
  { id: 'team', icon: FiUsers, label: 'Team' },
  { id: 'reports', icon: FiBarChart2, label: 'Reports' },
  { id: 'sprints', icon: FiZap, label: 'Sprints' },
  { id: 'settings', icon: FiSettings, label: 'Settings' },
];

const Sidebar = ({ activeView = 'dashboard', onNavigate }) => {
  const { theme } = useTheme();

  return (
    <aside className={`sidebar ${theme}`}>
      <div className="sidebar-content">
        <div className="sidebar-logo">
          <h2>WorkTrace</h2>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <div
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate && onNavigate(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onNavigate && onNavigate(item.id)}
              >
                <Icon className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
