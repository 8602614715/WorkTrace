import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { taskAPI, teamAPI } from '../services/api';
import TaskModal from './TaskModal';
import Skeleton from './Skeleton';
import {
  FiCpu,
  FiGrid,
  FiFileText,
  FiSettings,
  FiClock,
  FiShoppingCart,
  FiMonitor,
  FiUsers,
  FiBox,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch
} from 'react-icons/fi';
import './MyTasks.css';

const emptyGroups = { todo: [], inProgress: [], completed: [] };

const MyTasks = () => {
  const { theme } = useTheme();
  const { user, hasRole } = useAuth();
  const { addToast } = useToast();
  const [tasks, setTasks] = useState(emptyGroups);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    priority: '',
    dueFrom: '',
    dueTo: '',
    overdueOnly: false,
  });
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkAction, setBulkAction] = useState({
    status: '',
    priority: '',
    assignedTo: '__keep__',
    recurrence: '',
  });
  const [newSubtaskText, setNewSubtaskText] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);

  const iconMap = {
    cpu: FiCpu,
    grid: FiGrid,
    file: FiFileText,
    settings: FiSettings,
    clock: FiClock,
    cart: FiShoppingCart,
    monitor: FiMonitor,
    users: FiUsers,
    box: FiBox,
  };

  const fetchTasks = useCallback(async (activeFilters = filters) => {
    try {
      setLoading(true);
      setError('');
      const payload = {
        ...activeFilters,
        overdueOnly: activeFilters.overdueOnly ? 'true' : '',
      };
      const data = await taskAPI.getAll(payload);
      const grouped = {
        todo: data.filter((t) => t.status === 'todo' || t.status === 'Todo'),
        inProgress: data.filter((t) => t.status === 'inProgress' || t.status === 'In Progress'),
        completed: data.filter((t) => t.status === 'completed' || t.status === 'Completed'),
      };
      setTasks(grouped);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      addToast('Failed to load tasks.', 'error');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [addToast, filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const members = await teamAPI.getMembers();
        setTeamMembers(Array.isArray(members) ? members : []);
      } catch (err) {
        setTeamMembers([]);
      }
    };
    fetchMembers();
  }, []);

  const handleAddTask = () => {
    setEditingTask(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await taskAPI.delete(taskId);
      addToast('Task deleted successfully.', 'success');
      await fetchTasks();
    } catch (err) {
      setError('Failed to delete task. Please try again.');
      addToast('Failed to delete task.', 'error');
      console.error('Error deleting task:', err);
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      setError('');
      setFormError('');
      setIsSaving(true);
      if (editingTask) {
        await taskAPI.update(editingTask.id, taskData);
        addToast('Task updated successfully.', 'success');
      } else {
        await taskAPI.create(taskData);
        addToast('Task created successfully.', 'success');
      }
      setIsModalOpen(false);
      setEditingTask(null);
      await fetchTasks();
    } catch (err) {
      setFormError(err.message || 'Failed to save task. Please check your inputs and try again.');
      addToast('Failed to save task.', 'error');
      console.error('Error saving task:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskAPI.updateStatus(taskId, newStatus);
      addToast('Task status updated.', 'success');
      await fetchTasks();
    } catch (err) {
      setError('Failed to update task status. Please try again.');
      addToast('Failed to update task status.', 'error');
      console.error('Error updating status:', err);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      await taskAPI.updateStatus(task.id, 'completed');
      const shouldDelete = window.confirm(
        'Task marked as completed. Do you want to delete this task now?'
      );
      if (shouldDelete) {
        await taskAPI.delete(task.id);
        addToast('Task completed and deleted.', 'success');
      } else {
        addToast('Task marked as completed.', 'success');
      }
      await fetchTasks();
    } catch (err) {
      setError('Failed to complete task. Please try again.');
      addToast('Failed to complete task.', 'error');
      console.error('Error completing task:', err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = async () => {
    const next = { ...filters, q: searchInput.trim() };
    setFilters(next);
    await fetchTasks(next);
  };

  const clearFilters = async () => {
    const next = { q: '', priority: '', dueFrom: '', dueTo: '', overdueOnly: false };
    setSearchInput('');
    setFilters(next);
    await fetchTasks(next);
  };

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds((prev) => (
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    ));
  };

  const toggleSelectAllVisible = () => {
    const ids = allVisibleTasks.map((task) => task.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedTaskIds.includes(id));
    setSelectedTaskIds(allSelected ? [] : ids);
  };

  const clearSelection = () => {
    setSelectedTaskIds([]);
  };

  const applyBulkAction = async () => {
    if (selectedTaskIds.length === 0) return;
    const payload = {
      taskIds: selectedTaskIds,
    };
    if (bulkAction.status) payload.status = bulkAction.status;
    if (bulkAction.priority) payload.priority = bulkAction.priority;
    if (bulkAction.assignedTo !== '__keep__') payload.assignedTo = bulkAction.assignedTo;
    if (bulkAction.recurrence) payload.recurrence = bulkAction.recurrence;
    if (
      payload.status === undefined &&
      payload.priority === undefined &&
      payload.assignedTo === undefined &&
      payload.recurrence === undefined
    ) {
      addToast('Choose at least one bulk field to update.', 'info');
      return;
    }
    try {
      await taskAPI.bulkUpdate(payload);
      addToast(`Updated ${selectedTaskIds.length} task(s).`, 'success');
      clearSelection();
      await fetchTasks();
    } catch (err) {
      addToast(err.message || 'Failed to apply bulk action.', 'error');
    }
  };

  const deleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedTaskIds.length} selected task(s)?`)) {
      return;
    }
    try {
      await taskAPI.bulkUpdate({ taskIds: selectedTaskIds, delete: true });
      addToast(`Deleted ${selectedTaskIds.length} task(s).`, 'success');
      clearSelection();
      await fetchTasks();
    } catch (err) {
      addToast(err.message || 'Failed to delete selected tasks.', 'error');
    }
  };

  const handleAddSubtask = async (taskId) => {
    const title = (newSubtaskText[taskId] || '').trim();
    if (!title) return;
    try {
      await taskAPI.createSubtask(taskId, title);
      setNewSubtaskText((prev) => ({ ...prev, [taskId]: '' }));
      await fetchTasks();
    } catch (err) {
      addToast('Failed to add sub-task.', 'error');
    }
  };

  const handleToggleSubtask = async (taskId, subtask) => {
    try {
      await taskAPI.updateSubtask(taskId, subtask.id, { completed: !subtask.completed });
      await fetchTasks();
    } catch (err) {
      addToast('Failed to update sub-task.', 'error');
    }
  };

  const handleDeleteSubtask = async (taskId, subtaskId) => {
    try {
      await taskAPI.deleteSubtask(taskId, subtaskId);
      await fetchTasks();
    } catch (err) {
      addToast('Failed to delete sub-task.', 'error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getIcon = (task) => {
    const iconName = task.icon || 'file';
    return iconMap[iconName] || FiFileText;
  };

  const allVisibleTasks = useMemo(
    () => [...tasks.todo, ...tasks.inProgress, ...tasks.completed],
    [tasks]
  );
  useEffect(() => {
    const visibleIds = new Set(allVisibleTasks.map((task) => task.id));
    setSelectedTaskIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [allVisibleTasks]);
  const memberNameById = useMemo(
    () => Object.fromEntries(teamMembers.map((member) => [member.id, member.name || member.email || member.id])),
    [teamMembers]
  );

  const canEdit = hasRole('admin') || hasRole('manager') || user?.id;
  const canDelete = hasRole('admin') || hasRole('manager');
  const allVisibleSelected = allVisibleTasks.length > 0 && allVisibleTasks.every((task) => selectedTaskIds.includes(task.id));

  if (loading) {
    return (
      <div className={`my-tasks ${theme}`}>
        <div className="tasks-header">
          <Skeleton className="skeleton-title" />
          <Skeleton className="skeleton-button" />
        </div>
        <div className="kanban-board">
          {[1, 2, 3].map((col) => (
            <div key={col} className="kanban-column">
              <div className="column-header">
                <Skeleton className="skeleton-column-title" />
                <Skeleton className="skeleton-chip" />
              </div>
              <div className="task-list">
                {[1, 2].map((item) => (
                  <Skeleton key={`${col}-${item}`} className="skeleton-task-card" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderTask = (task, column) => {
    const Icon = getIcon(task);
    const subtasks = task.subtasks || [];
    return (
      <div
        key={task.id}
        className={`task-card ${column === 'inProgress' ? 'in-progress' : ''} ${column === 'completed' ? 'completed' : ''}`}
        onClick={() => handleEditTask(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleEditTask(task);
        }}
      >
        <div className="task-header">
          <label className="task-select" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedTaskIds.includes(task.id)}
              onChange={() => toggleTaskSelection(task.id)}
            />
          </label>
          <Icon className="task-icon" />
          {task.dueDate && <span className="task-date">{formatDate(task.dueDate)}</span>}
          <div className="task-actions">
            {canEdit && (
              <button
                className="action-btn edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditTask(task);
                }}
                title="Edit task"
              >
                <FiEdit2 />
              </button>
            )}
            {canDelete && (
              <button
                className="action-btn delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task.id);
                }}
                title="Delete task"
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </div>
        <h4 className="task-title">{task.title}</h4>
        {task.description && <p className="task-description">{task.description}</p>}
        {task.priority && (
          <span className={`task-priority priority-${task.priority}`}>
            Priority: {task.priority}
          </span>
        )}
        {task.assignedTo && (
          <div className="task-assigned">Assigned to: {memberNameById[task.assignedTo] || task.assignedTo}</div>
        )}

        <div className="subtasks-block" onClick={(e) => e.stopPropagation()}>
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="subtask-row">
              <label>
                <input
                  type="checkbox"
                  checked={!!subtask.completed}
                  onChange={() => handleToggleSubtask(task.id, subtask)}
                />
                <span className={subtask.completed ? 'done' : ''}>{subtask.title}</span>
              </label>
              <button
                type="button"
                className="subtask-delete"
                onClick={() => handleDeleteSubtask(task.id, subtask.id)}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
          <div className="subtask-add">
            <input
              type="text"
              value={newSubtaskText[task.id] || ''}
              onChange={(e) => setNewSubtaskText((prev) => ({ ...prev, [task.id]: e.target.value }))}
              placeholder="Add sub-task"
            />
            <button type="button" onClick={() => handleAddSubtask(task.id)}>Add</button>
          </div>
        </div>

        {column === 'todo' && (
          <button
            className="task-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange(task.id, 'inProgress');
            }}
          >
            Start
          </button>
        )}
        {column === 'inProgress' && (
          <div className="task-status-buttons">
            <button
              className="task-action-btn secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(task.id, 'todo');
              }}
            >
              Move to Todo
            </button>
            <button
              className="task-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCompleteTask(task);
              }}
            >
              Complete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`my-tasks ${theme}`}>
      <div className="tasks-header">
        <h2 className="section-title">My Tasks</h2>
        {canEdit && (
          <button className="add-task-button" onClick={handleAddTask}>
            <FiPlus />
            <span>Add Task</span>
          </button>
        )}
      </div>

      <div className="task-filters">
        <div className="search-row">
          <FiSearch />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title, description, assignee"
          />
        </div>
        <select value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input type="date" value={filters.dueFrom} onChange={(e) => handleFilterChange('dueFrom', e.target.value)} />
        <input type="date" value={filters.dueTo} onChange={(e) => handleFilterChange('dueTo', e.target.value)} />
        <label className="overdue-toggle">
          <input
            type="checkbox"
            checked={filters.overdueOnly}
            onChange={(e) => handleFilterChange('overdueOnly', e.target.checked)}
          />
          Overdue only
        </label>
        <button type="button" className="filter-btn" onClick={applyFilters}>Apply</button>
        <button type="button" className="filter-btn secondary" onClick={clearFilters}>Clear</button>
      </div>

      {selectedTaskIds.length > 0 && (
        <div className="bulk-toolbar">
          <div className="bulk-summary">
            <label className="bulk-select-all">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
              Select all visible
            </label>
            <span>{selectedTaskIds.length} selected</span>
          </div>
          <div className="bulk-controls">
            <select value={bulkAction.status} onChange={(e) => setBulkAction((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="">Status</option>
              <option value="todo">To Do</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <select value={bulkAction.priority} onChange={(e) => setBulkAction((prev) => ({ ...prev, priority: e.target.value }))}>
              <option value="">Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select value={bulkAction.assignedTo} onChange={(e) => setBulkAction((prev) => ({ ...prev, assignedTo: e.target.value }))}>
              <option value="__keep__">Keep assignee</option>
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
            <select value={bulkAction.recurrence} onChange={(e) => setBulkAction((prev) => ({ ...prev, recurrence: e.target.value }))}>
              <option value="">Recurrence</option>
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button type="button" className="filter-btn" onClick={applyBulkAction}>Apply to Selected</button>
            <button type="button" className="filter-btn secondary" onClick={clearSelection}>Clear</button>
            {canDelete && (
              <button type="button" className="filter-btn danger" onClick={deleteSelectedTasks}>Delete Selected</button>
            )}
          </div>
        </div>
      )}

      <div className="result-count">Showing {allVisibleTasks.length} tasks</div>
      {error && <div className="error-message">{error}</div>}

      <div className="kanban-board">
        <div className="kanban-column">
          <div className="column-header">
            <h3>To Do</h3>
            <span className="task-count">{tasks.todo.length}</span>
          </div>
          <div className="task-list">{tasks.todo.map((task) => renderTask(task, 'todo'))}</div>
        </div>
        <div className="kanban-column">
          <div className="column-header">
            <h3>In Progress</h3>
            <span className="task-count">{tasks.inProgress.length}</span>
          </div>
          <div className="task-list">{tasks.inProgress.map((task) => renderTask(task, 'inProgress'))}</div>
        </div>
        <div className="kanban-column">
          <div className="column-header">
            <h3>Completed</h3>
            <span className="task-count">{tasks.completed.length}</span>
          </div>
          <div className="task-list">{tasks.completed.map((task) => renderTask(task, 'completed'))}</div>
        </div>
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
          setFormError('');
        }}
        onSave={handleSaveTask}
        task={editingTask}
        teamMembers={teamMembers}
        saveError={formError}
        isSaving={isSaving}
      />
    </div>
  );
};

export default MyTasks;
