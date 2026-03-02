import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { taskAPI } from '../services/api';
import { FiX, FiSave, FiMessageSquare, FiActivity } from 'react-icons/fi';
import './TaskModal.css';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'inProgress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TaskModal = ({
  isOpen,
  onClose,
  onSave,
  task = null,
  teamMembers = [],
  saveError = '',
  isSaving = false,
}) => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    assignedTo: '',
    progress: 0,
    recurrence: 'none',
  });
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        dueDate: task.dueDate || '',
        assignedTo: task.assignedTo || '',
        progress: task.progress || 0,
        recurrence: task.recurrence || 'none',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: '',
        assignedTo: '',
        progress: 0,
        recurrence: 'none',
      });
    }
  }, [task, isOpen]);

  useEffect(() => {
    if (!isOpen || !task?.id) {
      setComments([]);
      setActivity([]);
      setCommentInput('');
      return;
    }

    let cancelled = false;
    const loadThread = async () => {
      setThreadLoading(true);
      try {
        const [commentData, activityData] = await Promise.all([
          taskAPI.getComments(task.id),
          taskAPI.getActivity(task.id),
        ]);
        if (cancelled) {
          return;
        }
        setComments(Array.isArray(commentData) ? commentData : []);
        setActivity(Array.isArray(activityData) ? activityData : []);
      } catch (error) {
        if (!cancelled) {
          addToast('Failed to load comments/activity.', 'error');
          setComments([]);
          setActivity([]);
        }
      } finally {
        if (!cancelled) {
          setThreadLoading(false);
        }
      }
    };

    loadThread();
    return () => {
      cancelled = true;
    };
  }, [isOpen, task, addToast]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      progress: parseInt(formData.progress, 10) || 0,
    };
    onSave(payload);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!task?.id) {
      return;
    }
    const content = commentInput.trim();
    if (!content) {
      return;
    }
    try {
      setPostingComment(true);
      await taskAPI.addComment(task.id, content);
      setCommentInput('');
      const [commentData, activityData] = await Promise.all([
        taskAPI.getComments(task.id),
        taskAPI.getActivity(task.id),
      ]);
      setComments(Array.isArray(commentData) ? commentData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);
    } catch (error) {
      addToast(error.message || 'Failed to add comment.', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const setFieldValue = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const applyDueShortcut = (shortcut) => {
    if (shortcut === 'clear') {
      setFieldValue('dueDate', '');
      return;
    }
    const next = new Date();
    if (shortcut === 'tomorrow') {
      next.setDate(next.getDate() + 1);
    } else if (shortcut === 'nextWeek') {
      next.setDate(next.getDate() + 7);
    }
    const iso = new Date(next.getTime() - (next.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
    setFieldValue('dueDate', iso);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${theme}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? 'Edit Task' : 'Add New Task'}</h2>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              maxLength={120}
              required
              placeholder="Enter a concise task title"
            />
            <div className="field-meta">
              <span>Clear action + outcome works best.</span>
              <span>{formData.title.length}/120</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              maxLength={1000}
              placeholder="Context, acceptance criteria, or links"
            />
            <div className="field-meta">
              <span>Optional but helpful for handoffs.</span>
              <span>{formData.description.length}/1000</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <div className="option-chip-group">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-chip ${formData.status === option.value ? 'active' : ''}`}
                    onClick={() => setFieldValue('status', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <div className="option-chip-group priority-group">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-chip ${formData.priority === option.value ? `active priority-${option.value}` : ''}`}
                    onClick={() => setFieldValue('priority', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={handleChange}
              />
              <div className="date-shortcuts">
                <button type="button" onClick={() => applyDueShortcut('today')}>Today</button>
                <button type="button" onClick={() => applyDueShortcut('tomorrow')}>Tomorrow</button>
                <button type="button" onClick={() => applyDueShortcut('nextWeek')}>+7 Days</button>
                <button type="button" onClick={() => applyDueShortcut('clear')}>Clear</button>
              </div>
            </div>

            {formData.status === 'inProgress' && (
              <div className="form-group">
                <label htmlFor="progress">Progress (%)</label>
                <input
                  id="progress"
                  name="progress"
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={handleChange}
                />
                <div className="field-meta">
                  <span>Current completion</span>
                  <span>{formData.progress}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="assignedTo">Assigned To</label>
            <select
              id="assignedTo"
              name="assignedTo"
              value={formData.assignedTo}
              onChange={handleChange}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
            {teamMembers.length === 0 && (
              <div className="field-meta">
                <span>No team members found. Invite members from Team view.</span>
                <span />
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="recurrence">Recurring</label>
            <select
              id="recurrence"
              name="recurrence"
              value={formData.recurrence}
              onChange={handleChange}
            >
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="field-meta">
              <span>When completed, next recurring task is generated automatically.</span>
              <span />
            </div>
          </div>

          {saveError && <div className="modal-error">{saveError}</div>}

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={isSaving}>
              <FiSave />
              <span>{isSaving ? 'Saving...' : `${task ? 'Update' : 'Create'} Task`}</span>
            </button>
          </div>
        </form>

        {task?.id && (
          <div className="task-thread">
            <div className="thread-columns">
              <section className="thread-card">
                <h3><FiMessageSquare /> Comments</h3>
                <form className="comment-form" onSubmit={handleAddComment}>
                  <textarea
                    rows="2"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Write a comment..."
                  />
                  <button type="submit" disabled={postingComment}>
                    {postingComment ? 'Posting...' : 'Post'}
                  </button>
                </form>
                <div className="thread-list">
                  {threadLoading ? (
                    <div className="thread-empty">Loading comments...</div>
                  ) : comments.length === 0 ? (
                    <div className="thread-empty">No comments yet.</div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="thread-item">
                        <div className="thread-item-top">
                          <strong>{comment.userName}</strong>
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p>{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="thread-card">
                <h3><FiActivity /> Activity</h3>
                <div className="thread-list">
                  {threadLoading ? (
                    <div className="thread-empty">Loading activity...</div>
                  ) : activity.length === 0 ? (
                    <div className="thread-empty">No activity yet.</div>
                  ) : (
                    activity.map((event) => (
                      <div key={event.id} className="thread-item">
                        <div className="thread-item-top">
                          <strong>{event.actorName || 'System'}</strong>
                          <span>{new Date(event.createdAt).toLocaleString()}</span>
                        </div>
                        <p>{event.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default TaskModal;
