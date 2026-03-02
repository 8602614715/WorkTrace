import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { notificationsAPI } from '../services/api';
import { FiBell, FiCheckCircle, FiRefreshCcw, FiMail } from 'react-icons/fi';
import './NotificationsCenter.css';

const NotificationsCenter = () => {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const [items, unread] = await Promise.all([
        notificationsAPI.getAll({ unreadOnly: showUnreadOnly, limit: 60 }),
        notificationsAPI.getUnreadCount(),
      ]);
      setNotifications(Array.isArray(items) ? items : []);
      setUnreadCount(unread?.unreadCount || 0);
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [showUnreadOnly]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id) => {
    try {
      setUpdating(true);
      await notificationsAPI.markRead(id);
      await loadNotifications();
    } finally {
      setUpdating(false);
    }
  };

  const markAllRead = async () => {
    try {
      setUpdating(true);
      await notificationsAPI.markAllRead();
      await loadNotifications();
    } finally {
      setUpdating(false);
    }
  };

  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((item) => !item.isRead).length;
    const read = total - unread;
    return { total, unread, read };
  }, [notifications]);

  return (
    <div className={`notifications-page ${theme}`}>
      <div className="notifications-header">
        <div>
          <h2 className="section-title">Notifications</h2>
          <p className="notifications-subtitle">Track updates, project alerts, and mentions in one place.</p>
        </div>
        <div className="notifications-actions">
          <label className="unread-toggle">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>
          <button type="button" className="secondary-btn" onClick={loadNotifications} disabled={loading || updating}>
            <FiRefreshCcw />
            Refresh
          </button>
          <button type="button" className="primary-btn" onClick={markAllRead} disabled={updating || unreadCount === 0}>
            <FiCheckCircle />
            Mark all read
          </button>
        </div>
      </div>

      <div className="notifications-stats">
        <div className="stat-card">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat-card">
          <span>Unread</span>
          <strong>{unreadCount}</strong>
        </div>
        <div className="stat-card">
          <span>Read</span>
          <strong>{stats.read}</strong>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <FiBell />
          <p>No notifications found.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => (
            <article key={item.id} className={`notification-card ${item.isRead ? 'read' : 'unread'}`}>
              <div className="notification-icon-wrap">
                <FiMail />
              </div>
              <div className="notification-body">
                <h4>{item.title}</h4>
                <p>{item.message}</p>
                <div className="notification-meta">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <span className={`badge ${item.isRead ? 'read' : 'unread'}`}>
                    {item.isRead ? 'Read' : 'Unread'}
                  </span>
                </div>
              </div>
              {!item.isRead && (
                <button
                  type="button"
                  className="mark-read-btn"
                  onClick={() => markRead(item.id)}
                  disabled={updating}
                >
                  Mark read
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsCenter;
