import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiBell, FiMoreVertical, FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';
import './Header.css';

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleLogout = async () => {
    await logout();
    setShowMenu(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showMenu) {
      return undefined;
    }

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu || !menuRef.current) {
      return;
    }

    const firstMenuItem = menuRef.current.querySelector('.dropdown-menu button');
    firstMenuItem?.focus();
  }, [showMenu]);

  const userName = user?.name || user?.email || 'User';
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=667eea&color=fff&size=128`;

  return (
    <header className={`header ${theme}`}>
      <div className="header-left">
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search tasks..."
            className="search-input"
          />
        </div>
      </div>
      <div className="header-right">
        <div className="date-time">{currentDate}</div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <FiSun /> : <FiMoon />}
        </button>
        <div className="user-profile">
          <div className="profile-info">
            <span className="username">{userName}</span>
            {user?.role && (
              <span className="user-role">{user.role}</span>
            )}
          </div>
          <div className="profile-avatar">
            <img src={avatarUrl} alt="Profile" />
          </div>
          <button type="button" className="notification-button" aria-label="Notifications">
            <FiBell className="notification-icon" />
          </button>
          <div className="menu-container" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              className="more-icon-button"
              aria-haspopup="menu"
              aria-expanded={showMenu}
              aria-label="Open user menu"
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <FiMoreVertical className="more-icon" />
            </button>
            {showMenu && (
              <div className="dropdown-menu" role="menu" aria-label="User menu">
                <button type="button" role="menuitem" className="menu-item" onClick={() => setShowMenu(false)}>
                  <FiUser className="menu-icon" />
                  <span>Profile</span>
                </button>
                <div className="menu-divider"></div>
                <button type="button" role="menuitem" className="menu-item" onClick={handleLogout}>
                  <FiLogOut className="menu-icon" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
