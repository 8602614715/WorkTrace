import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { sprintsAPI } from '../services/api';
import { FiZap, FiCalendar, FiPlus, FiList, FiMinusCircle, FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import './Sprints.css';

const Sprints = () => {
  const { theme } = useTheme();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    status: 'planned',
  });
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [backlogTasks, setBacklogTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [editingSprintId, setEditingSprintId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [dropZone, setDropZone] = useState('');
  const [editFormData, setEditFormData] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    status: 'planned',
  });

  useEffect(() => {
    fetchSprints();
  }, []);

  const fetchSprints = async () => {
    try {
      setLoading(true);
      const data = await sprintsAPI.getAll();
      setSprints(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load sprints.');
      setSprints([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await sprintsAPI.create(formData);
      setFormData({
        name: '',
        goal: '',
        start_date: '',
        end_date: '',
        status: 'planned',
      });
      fetchSprints();
    } catch (err) {
      setError(err.message || 'Failed to create sprint.');
    }
  };

  const startEditSprint = (sprint) => {
    setEditingSprintId(sprint.id);
    setEditFormData({
      name: sprint.name || '',
      goal: sprint.goal || '',
      start_date: sprint.start_date || '',
      end_date: sprint.end_date || '',
      status: sprint.status || 'planned',
    });
    setError('');
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const cancelEditSprint = () => {
    setEditingSprintId(null);
  };

  const saveSprintEdit = async (sprintId) => {
    try {
      const updated = await sprintsAPI.update(sprintId, editFormData);
      setEditingSprintId(null);
      await fetchSprints();
      if (selectedSprint?.id === sprintId) {
        await loadSprintTasks(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to update sprint.');
    }
  };

  const deleteSprint = async (sprint) => {
    const confirmed = window.confirm(`Delete sprint "${sprint.name}"?`);
    if (!confirmed) return;
    try {
      await sprintsAPI.delete(sprint.id);
      if (selectedSprint?.id === sprint.id) {
        setSelectedSprint(null);
        setSprintTasks([]);
        setBacklogTasks([]);
      }
      await fetchSprints();
    } catch (err) {
      setError(err.message || 'Failed to delete sprint.');
    }
  };

  const loadSprintTasks = async (sprint) => {
    setSelectedSprint(sprint);
    setTaskLoading(true);
    try {
      const [sprintTaskData, backlogData, analyticsData] = await Promise.all([
        sprintsAPI.getTasks(sprint.id),
        sprintsAPI.getBacklog(sprint.project_id || undefined),
        sprintsAPI.getAnalytics(sprint.id),
      ]);
      setSprintTasks(Array.isArray(sprintTaskData) ? sprintTaskData : []);
      setBacklogTasks(Array.isArray(backlogData) ? backlogData : []);
      setAnalytics(analyticsData || null);
    } catch (err) {
      console.error('Failed to load sprint tasks', err);
      setSprintTasks([]);
      setBacklogTasks([]);
      setAnalytics(null);
    } finally {
      setTaskLoading(false);
    }
  };

  const addTaskToSprint = async (taskId) => {
    if (!selectedSprint) return;
    try {
      await sprintsAPI.addTasks(selectedSprint.id, [taskId]);
      loadSprintTasks(selectedSprint);
      fetchSprints();
    } catch (err) {
      console.error('Failed to add task to sprint', err);
    }
  };

  const removeTaskFromSprint = async (taskId) => {
    if (!selectedSprint) return;
    try {
      await sprintsAPI.removeTask(selectedSprint.id, taskId);
      loadSprintTasks(selectedSprint);
      fetchSprints();
    } catch (err) {
      console.error('Failed to remove task from sprint', err);
    }
  };

  const handleTaskDragStart = (taskId, source) => {
    setDragInfo({ taskId, source });
  };

  const handleDrop = async (target) => {
    if (!dragInfo) return;
    if (dragInfo.source === target) {
      setDragInfo(null);
      setDropZone('');
      return;
    }
    if (dragInfo.source === 'backlog' && target === 'sprint') {
      await addTaskToSprint(dragInfo.taskId);
    } else if (dragInfo.source === 'sprint' && target === 'backlog') {
      await removeTaskFromSprint(dragInfo.taskId);
    }
    setDragInfo(null);
    setDropZone('');
  };

  const renderMiniChart = (labels = [], values = [], className = '') => {
    if (!labels.length || !values.length) return <div className="chart-empty">No data</div>;
    const maxVal = Math.max(1, ...values);
    return (
      <div className={`mini-chart ${className}`}>
        {values.map((value, idx) => (
          <div key={`${labels[idx]}-${idx}`} className="mini-bar-wrap" title={`${labels[idx]}: ${value}`}>
            <div className="mini-bar" style={{ height: `${(value / maxVal) * 100}%` }} />
            <span>{labels[idx]}</span>
          </div>
        ))}
      </div>
    );
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <div className={`sprints-page ${theme}`}>
        <div className="loading-state">Loading sprints...</div>
      </div>
    );
  }

  return (
    <div className={`sprints-page ${theme}`}>
      <div className="sprints-header">
        <div>
          <h2 className="section-title">Sprints</h2>
          <p className="sprints-subtitle">Agile sprints and iterations</p>
        </div>
        <form className="sprint-form" onSubmit={handleCreateSprint}>
          <input
            name="name"
            value={formData.name}
            onChange={handleFormChange}
            placeholder="Sprint name"
            required
          />
          <input
            name="goal"
            value={formData.goal}
            onChange={handleFormChange}
            placeholder="Goal (optional)"
          />
          <input
            type="date"
            name="start_date"
            value={formData.start_date}
            onChange={handleFormChange}
            required
          />
          <input
            type="date"
            name="end_date"
            value={formData.end_date}
            onChange={handleFormChange}
            required
          />
          <select name="status" value={formData.status} onChange={handleFormChange}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <button type="submit" className="create-sprint-button">
            <FiPlus /> Create
          </button>
        </form>
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="sprints-list">
        {sprints.length === 0 ? (
          <div className="empty-state">No sprints yet</div>
        ) : (
          sprints.map((sprint) => (
            <div key={sprint.id} className={`sprint-card status-${sprint.status || 'planned'}`}>
              <FiZap className="sprint-icon" />
              <div className="sprint-content">
                {editingSprintId === sprint.id ? (
                  <div className="sprint-edit-form">
                    <input
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditFormChange}
                      placeholder="Sprint name"
                      required
                    />
                    <input
                      name="goal"
                      value={editFormData.goal}
                      onChange={handleEditFormChange}
                      placeholder="Goal (optional)"
                    />
                    <div className="sprint-edit-dates">
                      <input
                        type="date"
                        name="start_date"
                        value={editFormData.start_date}
                        onChange={handleEditFormChange}
                        required
                      />
                      <input
                        type="date"
                        name="end_date"
                        value={editFormData.end_date}
                        onChange={handleEditFormChange}
                        required
                      />
                    </div>
                    <select name="status" value={editFormData.status} onChange={handleEditFormChange}>
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>
                    <div className="sprint-actions-row">
                      <button type="button" className="manage-button save" onClick={() => saveSprintEdit(sprint.id)}>
                        <FiCheck />
                        Save
                      </button>
                      <button type="button" className="manage-button cancel" onClick={cancelEditSprint}>
                        <FiX />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sprint-title-row">
                      <h3 className="sprint-name">{sprint.name}</h3>
                      <div className="sprint-actions-row">
                        <button
                          type="button"
                          className="manage-button"
                          onClick={() => loadSprintTasks(sprint)}
                        >
                          <FiList />
                          Manage Tasks
                        </button>
                        <button
                          type="button"
                          className="manage-button"
                          onClick={() => startEditSprint(sprint)}
                        >
                          <FiEdit2 />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="manage-button delete"
                          onClick={() => deleteSprint(sprint)}
                        >
                          <FiTrash2 />
                          Delete
                        </button>
                      </div>
                    </div>
                    {sprint.goal && <p className="sprint-goal">{sprint.goal}</p>}
                    <div className="sprint-dates">
                      <FiCalendar className="date-icon" />
                      {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                    </div>
                    <div className="sprint-metrics">
                      <span>{sprint.completedTasks || 0}/{sprint.totalTasks || 0} tasks</span>
                      <span>{sprint.progress || 0}% complete</span>
                      <span>{sprint.velocity || 0} / day</span>
                    </div>
                    <div className="sprint-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${sprint.progress || 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="sprint-status">{sprint.status || 'planned'}</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedSprint && (
        <div className="sprint-tasks-panel">
          <div className="panel-head">
            <h3 className="panel-title">Planning Board: {selectedSprint.name}</h3>
            <p className="panel-subtitle">Drag tasks between Backlog and In Sprint to plan scope quickly.</p>
          </div>
          {taskLoading ? (
            <div className="loading-state">Loading tasks...</div>
          ) : (
            <div className="planning-layout">
              <div
                className={`tasks-column drop-column ${dropZone === 'sprint' ? 'drop-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropZone('sprint');
                }}
                onDragLeave={() => setDropZone('')}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop('sprint');
                }}
              >
                <h4>In Sprint</h4>
                {(sprintTasks || []).length === 0 ? (
                  <div className="empty-state">No tasks in this sprint</div>
                ) : (
                  (sprintTasks || []).map((task) => (
                    <div
                      key={task.id}
                      className="task-row"
                      draggable
                      onDragStart={() => handleTaskDragStart(task.id, 'sprint')}
                    >
                      <span>{task.title}</span>
                      <button
                        type="button"
                        className="task-action remove"
                        onClick={() => removeTaskFromSprint(task.id)}
                      >
                        <FiMinusCircle />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div
                className={`tasks-column drop-column ${dropZone === 'backlog' ? 'drop-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropZone('backlog');
                }}
                onDragLeave={() => setDropZone('')}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop('backlog');
                }}
              >
                <h4>Backlog</h4>
                {(backlogTasks || []).length === 0 ? (
                  <div className="empty-state">No backlog tasks</div>
                ) : (
                  (backlogTasks || []).map((task) => (
                    <div
                      key={task.id}
                      className="task-row"
                      draggable
                      onDragStart={() => handleTaskDragStart(task.id, 'backlog')}
                    >
                      <span>{task.title}</span>
                      <button
                        type="button"
                        className="task-action add"
                        onClick={() => addTaskToSprint(task.id)}
                      >
                        <FiPlus />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="analytics-column">
                <h4>Sprint Analytics</h4>
                {analytics ? (
                  <div className="analytics-block">
                    <div className="analytics-summary">
                      <span>Total: {analytics.summary?.totalTasks ?? 0}</span>
                      <span>Done: {analytics.summary?.completedTasks ?? 0}</span>
                      <span>Remaining: {analytics.summary?.remainingTasks ?? 0}</span>
                      <span>Avg/day: {analytics.summary?.avgCompletionPerDay ?? 0}</span>
                    </div>
                    <div className="mini-chart-card">
                      <h5>Burndown (Remaining)</h5>
                      {renderMiniChart(
                        analytics.burndown?.labels || [],
                        analytics.burndown?.actualRemaining || [],
                        'burndown-chart'
                      )}
                    </div>
                    <div className="mini-chart-card">
                      <h5>Velocity (Done/day)</h5>
                      {renderMiniChart(
                        analytics.velocityTrend?.labels || [],
                        analytics.velocityTrend?.data || [],
                        'velocity-chart'
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">No analytics available.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sprints;
