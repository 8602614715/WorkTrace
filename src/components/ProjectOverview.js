import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { projectAPI, teamAPI } from '../services/api';
import { FiCheck } from 'react-icons/fi';
import Skeleton from './Skeleton';
import './ProjectOverview.css';

const ProjectOverview = () => {
  const { theme } = useTheme();
  const [progress, setProgress] = useState(0);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjectOverview();
  }, []);

  const fetchProjectOverview = async () => {
    try {
      setError('');
      const [overview, team] = await Promise.all([
        projectAPI.getOverview(),
        teamAPI.getMembers(),
      ]);
      setProgress(overview.progress || overview.completionPercentage || 0);
      setMembers(Array.isArray(team) ? team.slice(0, 2) : []);
    } catch (error) {
      console.error('Error fetching project overview:', error);
      setError('Unable to refresh project overview.');
      setProgress(0);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (progress / 100) * circumference;

  if (loading) {
    return (
      <div className={`project-overview ${theme}`}>
        <Skeleton className="overview-skeleton-title" />
        <Skeleton className="overview-skeleton-ring" />
        <Skeleton className="overview-skeleton-row" />
        <Skeleton className="overview-skeleton-row" />
      </div>
    );
  }

  return (
    <div className={`project-overview ${theme}`}>
      <h2 className="section-title">Project Overview</h2>
      <div className="progress-container">
        <svg className="progress-ring" width="120" height="120">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
          </defs>
          <circle
            className="progress-ring-background"
            strokeWidth="8"
            fill="transparent"
            r="45"
            cx="60"
            cy="60"
          />
          <circle
            className="progress-ring-fill"
            strokeWidth="8"
            fill="transparent"
            r="45"
            cx="60"
            cy="60"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="progress-text">
          <span className="progress-percentage">{Math.round(progress)}%</span>
          <span className="progress-label">Complete</span>
        </div>
      </div>
      <div className="mini-team">
        <h3 className="mini-title">Team Members</h3>
        {error && (
          <div className="mini-error" role="status" aria-live="polite">
            {error}
          </div>
        )}
        <div className="mini-team-list">
          {members.length === 0 ? (
            <div className="mini-empty-card">
              <span className="mini-empty">No team members yet</span>
              <button type="button" className="mini-cta" onClick={fetchProjectOverview}>
                Refresh
              </button>
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="mini-team-row">
                <img
                  className="mini-avatar"
                  src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=667eea&color=fff&size=64`}
                  alt={member.name}
                />
                <div className="mini-info">
                  <span className="mini-name">{member.name || 'Member'}</span>
                  <span className="mini-subtitle">{member.currentTask || 'No active tasks'}</span>
                </div>
                <div className="mini-status">
                  <FiCheck />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;
