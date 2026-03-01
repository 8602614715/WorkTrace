import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { taskAPI } from '../services/api';
import { FiX, FiSave, FiMessageSquare, FiActivity } from 'react-icons/fi';
import './TaskModal.css';

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
              required
              placeholder="Enter task title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Enter task description"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="todo">To Do</option>
                <option value="inProgress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
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
            </div>

            {formData.status === 'inProgress' && (
              <div className="form-group">
                <label htmlFor="progress">Progress (%)</label>
                <input
                  id="progress"
                  name="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={handleChange}
                />
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
