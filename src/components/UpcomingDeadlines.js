import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { deadlineAPI } from '../services/api';
import { FiCalendar } from 'react-icons/fi';
import Skeleton from './Skeleton';
import './UpcomingDeadlines.css';

const UpcomingDeadlines = () => {
  const { theme } = useTheme();
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    try {
      setError('');
      const data = await deadlineAPI.getAll();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Keep only today/future items and sort nearest first.
      const upcoming = (Array.isArray(data) ? data : [])
        .filter((item) => {
          if (!item?.date) return false;
          const date = new Date(item.date);
          if (Number.isNaN(date.getTime())) return false;
          date.setHours(0, 0, 0, 0);
          return date >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setDeadlines(upcoming);
    } catch (error) {
      console.error('Error fetching deadlines:', error);
      setError('Unable to load deadlines.');
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className={`upcoming-deadlines ${theme}`}>
        <Skeleton className="deadlines-skeleton-title" />
        <Skeleton className="deadlines-skeleton-row" />
        <Skeleton className="deadlines-skeleton-row" />
        <Skeleton className="deadlines-skeleton-row" />
      </div>
    );
  }

  if (deadlines.length === 0) {
    return (
      <div className={`upcoming-deadlines ${theme}`}>
        <h2 className="section-title">Upcoming Deadlines</h2>
        <div className="empty-state-card">
          <div className="empty-state">No upcoming deadlines</div>
          <button type="button" className="empty-cta" onClick={fetchDeadlines}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`upcoming-deadlines ${theme}`}>
      <h2 className="section-title">Upcoming Deadlines</h2>
      {error && (
        <div className="deadlines-error" role="status" aria-live="polite">
          {error}
        </div>
      )}
      <div className="deadlines-list">
        {deadlines.map((deadline, index) => (
          <div
            key={deadline.id || index}
            className="deadline-item"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <FiCalendar className="deadline-icon" />
            <div className="deadline-content">
              <span className="deadline-date">{formatDate(deadline.date)}:</span>
              <span className="deadline-title">{deadline.title || deadline.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingDeadlines;
