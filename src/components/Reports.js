import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { reportsAPI } from '../services/api';
import { FiBarChart2, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import './Reports.css';

const Reports = () => {
  const { theme } = useTheme();
  const [summary, setSummary] = useState(null);
  const [byStatus, setByStatus] = useState(null);
  const [byPriority, setByPriority] = useState(null);
  const [taskCompletion, setTaskCompletion] = useState(null);
  const [productivity, setProductivity] = useState(null);
  const [productivityTrends, setProductivityTrends] = useState(null);
  const [projectPerformance, setProjectPerformance] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const [s, status, priority, completion, prod, projectPerf] = await Promise.all([
        reportsAPI.getSummary(),
        reportsAPI.getByStatus(),
        reportsAPI.getByPriority(),
        reportsAPI.getTaskCompletion(8),
        reportsAPI.getProductivity('month'),
        reportsAPI.getProjectPerformance(),
      ]);
      setSummary(s);
      setByStatus(status);
      setByPriority(priority);
      setTaskCompletion(completion);
      setProductivity(prod);
      setProjectPerformance(projectPerf);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrends = useCallback(async () => {
    try {
      const trends = await reportsAPI.getProductivityTrends(trendPeriod, 12);
      setProductivityTrends(trends);
    } catch (err) {
      console.error(err);
      setProductivityTrends(null);
    }
  }, [trendPeriod]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const maxValue = (values) => Math.max(1, ...(values || []));

  if (loading) {
    return (
      <div className={`reports-page ${theme}`}>
        <div className="loading-state">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className={`reports-page ${theme}`}>
      <h2 className="section-title">Reports</h2>
      <p className="reports-subtitle">Task and productivity insights</p>

      {summary && (
        <div className="reports-grid">
          <div className="report-card">
            <FiCheckCircle className="report-icon" />
            <div className="report-value">{summary.totalTasks}</div>
            <div className="report-label">Total Tasks</div>
          </div>
          <div className="report-card">
            <FiTrendingUp className="report-icon" />
            <div className="report-value">{summary.completionRate}%</div>
            <div className="report-label">Completion Rate</div>
          </div>
          <div className="report-card">
            <FiBarChart2 className="report-icon" />
            <div className="report-value">{summary.totalProjects}</div>
            <div className="report-label">Projects</div>
          </div>
        </div>
      )}

      <div className="reports-sections">
        {taskCompletion && (
          <div className="report-section">
            <h3>Task Completion Rate</h3>
            <div className="chart">
              <div className="chart-bars">
                {taskCompletion.labels.map((label, index) => (
                  <div key={label} className="chart-bar">
                    <div
                      className="bar-fill"
                      style={{
                        height: `${(taskCompletion.data[index] / maxValue(taskCompletion.data)) * 100}%`,
                      }}
                    />
                    <span className="bar-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {productivity && (
          <div className="report-section">
            <h3>Productivity ({productivity.period})</h3>
            <div className="productivity-cards">
              <div className="productivity-card">
                <span className="metric-label">Score</span>
                <span className="metric-value">{productivity.score}</span>
              </div>
              <div className="productivity-card">
                <span className="metric-label">Trend</span>
                <span className={`metric-value ${productivity.trend >= 0 ? 'up' : 'down'}`}>
                  {productivity.trend}%
                </span>
              </div>
              <div className="productivity-card">
                <span className="metric-label">Completed</span>
                <span className="metric-value">{productivity.tasksCompleted}/{productivity.tasksTotal}</span>
              </div>
            </div>
          </div>
        )}

        {productivityTrends && (
          <div className="report-section">
            <div className="section-header">
              <h3>Productivity Trends</h3>
              <div className="segmented-control">
                <button
                  type="button"
                  className={trendPeriod === 'week' ? 'active' : ''}
                  onClick={() => setTrendPeriod('week')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={trendPeriod === 'month' ? 'active' : ''}
                  onClick={() => setTrendPeriod('month')}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div className="chart">
              <div className="chart-bars">
                {productivityTrends.labels.map((label, index) => (
                  <div key={label} className="chart-bar">
                    <div
                      className="bar-fill secondary"
                      style={{
                        height: `${(productivityTrends.data[index] / maxValue(productivityTrends.data)) * 100}%`,
                      }}
                    />
                    <span className="bar-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {projectPerformance && (
          <div className="report-section">
            <h3>Project Performance</h3>
            <div className="project-performance">
              {(projectPerformance.projects || []).length === 0 ? (
                <div className="empty-state">No projects found</div>
              ) : (
                projectPerformance.projects.map((project) => (
                  <div key={project.id} className="project-row">
                    <div className="project-info">
                      <span className="project-name">{project.name}</span>
                      <span className="project-metric">
                        {project.completedTasks}/{project.totalTasks} tasks
                      </span>
                    </div>
                    <div className="project-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${project.completionRate}%` }}
                        />
                      </div>
                      <span className="progress-value">{project.completionRate}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {byStatus && (
          <div className="report-section">
            <h3>Tasks by Status</h3>
            <div className="status-bars">
              <div className="status-bar">
                <span>To Do</span>
                <span className="count">{byStatus.todo}</span>
              </div>
              <div className="status-bar">
                <span>In Progress</span>
                <span className="count">{byStatus.inProgress}</span>
              </div>
              <div className="status-bar">
                <span>Completed</span>
                <span className="count">{byStatus.completed}</span>
              </div>
            </div>
          </div>
        )}
        {byPriority && (
          <div className="report-section">
            <h3>Tasks by Priority</h3>
            <div className="priority-badges">
              <span className="badge high">High: {byPriority.high}</span>
              <span className="badge medium">Medium: {byPriority.medium}</span>
              <span className="badge low">Low: {byPriority.low}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
