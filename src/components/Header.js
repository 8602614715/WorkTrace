import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiBell, FiMoreVertical, FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';
import { taskAPI, projectAPI, teamAPI } from '../services/api';
import './Header.css';

const Header = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState({
    tasks: [],
    projects: [],
    members: [],
  });
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const searchRef = useRef(null);

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
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
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

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchLoading(false);
      setSearchError('');
      setSearchResults({ tasks: [], projects: [], members: [] });
      return;
    }

    let isCancelled = false;
    setSearchLoading(true);
    setSearchError('');
    const timer = setTimeout(async () => {
      try {
        const [tasks, projects, members] = await Promise.all([
          taskAPI.getAll({ q: query }),
          projectAPI.getAll(),
          teamAPI.getMembers(),
        ]);
        if (isCancelled) {
          return;
        }
        const lowered = query.toLowerCase();
        const projectMatches = (Array.isArray(projects) ? projects : [])
          .filter((project) =>
            (project.name || '').toLowerCase().includes(lowered) ||
            (project.description || '').toLowerCase().includes(lowered)
          );
        const memberMatches = (Array.isArray(members) ? members : [])
          .filter((member) =>
            (member.name || '').toLowerCase().includes(lowered) ||
            (member.email || '').toLowerCase().includes(lowered)
          );
        setSearchResults({
          tasks: Array.isArray(tasks) ? tasks : [],
          projects: projectMatches,
          members: memberMatches,
        });
      } catch (error) {
        if (!isCancelled) {
          setSearchError('Unable to search right now.');
          setSearchResults({ tasks: [], projects: [], members: [] });
        }
      } finally {
        if (!isCancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleNavigateFromSearch = (view) => {
    setShowSearchResults(false);
    onNavigate && onNavigate(view);
  };

  const userName = user?.name || user?.email || 'User';
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=667eea&color=fff&size=128`;
  const hasAnyResults = (
    searchResults.tasks.length + searchResults.projects.length + searchResults.members.length
  ) > 0;

  return (
    <header className={`header ${theme}`}>
      <div className="header-left">
        <div className="search-container" ref={searchRef}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search tasks, projects, team..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {showSearchResults && (
            <div className="search-results-panel" role="listbox" aria-label="Global search results">
              {searchQuery.trim().length < 2 ? (
                <div className="search-empty">Type at least 2 characters to search.</div>
              ) : searchLoading ? (
                <div className="search-empty">Searching...</div>
              ) : searchError ? (
                <div className="search-error">{searchError}</div>
              ) : !hasAnyResults ? (
                <div className="search-empty">No matching tasks, projects, or team members.</div>
              ) : (
                <>
                  {searchResults.tasks.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-title">Tasks</div>
                      {searchResults.tasks.slice(0, 4).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="search-result-item"
                          onClick={() => handleNavigateFromSearch('dashboard')}
                        >
                          <span className="search-result-label">{task.title}</span>
                          <span className="search-result-meta">Task</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.projects.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-title">Projects</div>
                      {searchResults.projects.slice(0, 3).map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className="search-result-item"
                          onClick={() => handleNavigateFromSearch('projects')}
                        >
                          <span className="search-result-label">{project.name}</span>
                          <span className="search-result-meta">Project</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.members.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-title">Team</div>
                      {searchResults.members.slice(0, 3).map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className="search-result-item"
                          onClick={() => handleNavigateFromSearch('team')}
                        >
                          <span className="search-result-label">{member.name || member.email}</span>
                          <span className="search-result-meta">Member</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
