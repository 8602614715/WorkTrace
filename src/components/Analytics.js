import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { analyticsAPI } from '../services/api';
import { FiStar, FiTrendingUp } from 'react-icons/fi';
import Skeleton from './Skeleton';
import './Analytics.css';

const Analytics = ({ variant = 'full' }) => {
  const { theme } = useTheme();
  const [chartData, setChartData] = useState([30, 45, 60, 75, 80, 85, 90, 88]);
  const [productivityScore, setProductivityScore] = useState({ score: 9.2, trend: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setError('');
      const [completionData, productivityData] = await Promise.all([
        analyticsAPI.getTaskCompletionRate(),
        analyticsAPI.getProductivityScore()
      ]);

      if (completionData && completionData.data) {
        setChartData(completionData.data);
      }

      if (productivityData) {
        setProductivityScore({
          score: productivityData.score || 9.2,
          trend: productivityData.trend || 15
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Unable to load latest analytics.');
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  const maxValue = 100;
  const chartHeight = 120;
  const showChart = variant === 'full' || variant === 'chart';
  const showScore = variant === 'full' || variant === 'score';

  if (loading) {
    return (
      <div className={`analytics ${theme} ${variant === 'score' ? 'score-only' : ''} ${variant === 'chart' ? 'chart-only' : ''}`}>
        <div className="analytics-grid">
          {showChart && <Skeleton className="analytics-skeleton-card" />}
          {showScore && <Skeleton className="analytics-skeleton-card" />}
        </div>
      </div>
    );
  }

  return (
    <div className={`analytics ${theme} ${variant === 'score' ? 'score-only' : ''} ${variant === 'chart' ? 'chart-only' : ''}`}>
      {error && (
        <div className="analytics-error" role="status" aria-live="polite">
          {error}
          <button type="button" className="analytics-retry" onClick={fetchAnalytics}>
            Retry
          </button>
        </div>
      )}
      <div className="analytics-grid">
        {showChart && (
          <div className="analytics-card chart-card">
            <h3 className="card-title">Task Completion Rate</h3>
            <div className="chart-container">
              <svg className="line-chart" viewBox="0 0 300 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#667eea" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  className="chart-line"
                  points={chartData.map((value, index) => {
                    const x = (index / (chartData.length - 1)) * 300;
                    const y = chartHeight - (value / maxValue) * chartHeight;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#667eea"
                  strokeWidth="2"
                />
                <polygon
                  className="chart-area"
                  points={`0,${chartHeight} ${chartData.map((value, index) => {
                    const x = (index / (chartData.length - 1)) * 300;
                    const y = chartHeight - (value / maxValue) * chartHeight;
                    return `${x},${y}`;
                  }).join(' ')} 300,${chartHeight}`}
                  fill="url(#lineGradient)"
                />
              </svg>
              <div className="chart-labels">
                <div className="y-labels">
                  <span>0</span>
                  <span>30</span>
                  <span>60</span>
                  <span>80</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showScore && (
          <div className="analytics-card score-card">
            <div className="score-header">
              <FiTrendingUp className="trend-icon" />
              <div className="trend-info">
                <span className="trend-text">Increased by {productivityScore.trend}%</span>
                <span className="trend-subtext">Increased this month</span>
              </div>
            </div>
            <div className="score-main">
              <div className="score-value">
                <span className="score-number">{productivityScore.score.toFixed(1)}</span>
                <span className="score-divider">/</span>
                <span className="score-total">10</span>
              </div>
              <div className="score-label">
                <FiStar className="star-icon" />
                <span>Productivity Score</span>
              </div>
            </div>
            {variant === 'score' && (
              <button type="button" className="score-cta">
                Start completing tasks to improve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
