import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { projectAPI, teamAPI } from '../services/api';
import { FiCalendar } from 'react-icons/fi';
import Skeleton from './Skeleton';
import './Projects.css';

const Projects = () => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const projectNameRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [createStatus, setCreateStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingMembers, setEditingMembers] = useState({});
  const [memberEdits, setMemberEdits] = useState({});
  const [savingMembers, setSavingMembers] = useState({});
  const [memberEmailEdits, setMemberEmailEdits] = useState({});
  const [editingProjectDetails, setEditingProjectDetails] = useState({});
  const [projectEdits, setProjectEdits] = useState({});
  const [savingProjectDetails, setSavingProjectDetails] = useState({});
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    deadline: '',
    memberIds: [],
    memberEmailsText: '',
  });

  const parseMemberEmails = (value) => {
    if (!value || !value.trim()) return [];
    return Array.from(
      new Set(
        value
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  };

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectAPI.getAll();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load projects.');
      addToast('Failed to load projects.', 'error');
      setProjects([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const data = await teamAPI.getMembers();
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setTeamMembers([]);
      addToast('Failed to load team members.', 'error');
      console.error(err);
    }
  }, [addToast]);

  useEffect(() => {
    fetchProjects();
    fetchTeamMembers();
  }, [fetchProjects, fetchTeamMembers]);

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateMemberToggle = (memberId) => {
    setCreateForm((prev) => {
      const exists = prev.memberIds.includes(memberId);
      const memberIds = exists
        ? prev.memberIds.filter((id) => id !== memberId)
        : [...prev.memberIds, memberId];
      return { ...prev, memberIds };
    });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateStatus('');

    if (!createForm.name.trim()) {
      setCreateError('Project name is required.');
      addToast('Project name is required.', 'error');
      return;
    }

    try {
      setCreating(true);
      const memberEmails = parseMemberEmails(createForm.memberEmailsText);
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        deadline: createForm.deadline || undefined,
        memberIds: createForm.memberIds.length > 0 ? createForm.memberIds : undefined,
        memberEmails: memberEmails.length > 0 ? memberEmails : undefined,
      };
      await projectAPI.create(payload);
      setCreateStatus('Project created successfully.');
      addToast('Project created successfully.', 'success');
      setCreateForm({ name: '', description: '', deadline: '', memberIds: [], memberEmailsText: '' });
      fetchProjects();
    } catch (err) {
      setCreateError(err.message || 'Failed to create project.');
      addToast(err.message || 'Failed to create project.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const toggleEditMembers = (project) => {
    setEditingMembers((prev) => ({
      ...prev,
      [project.id]: !prev[project.id],
    }));
    if (!memberEdits[project.id]) {
      const initialIds = (project.members || []).map((member) => member.id);
      setMemberEdits((prev) => ({ ...prev, [project.id]: initialIds }));
    }
    if (!memberEmailEdits[project.id]) {
      const initialEmails = (project.members || [])
        .map((member) => member.email)
        .filter(Boolean)
        .join(', ');
      setMemberEmailEdits((prev) => ({ ...prev, [project.id]: initialEmails }));
    }
  };

  const toggleEditProjectDetails = (project) => {
    setEditingProjectDetails((prev) => ({
      ...prev,
      [project.id]: !prev[project.id],
    }));

    if (!projectEdits[project.id]) {
      setProjectEdits((prev) => ({
        ...prev,
        [project.id]: {
          name: project.name || '',
          description: project.description || '',
          deadline: project.deadline || '',
          status: project.status || 'active',
        },
      }));
    }
  };

  const handleProjectEditChange = (projectId, field, value) => {
    setProjectEdits((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || {}),
        [field]: value,
      },
    }));
  };

  const handleMemberEditToggle = (projectId, memberId) => {
    setMemberEdits((prev) => {
      const current = prev[projectId] || [];
      const exists = current.includes(memberId);
      const updated = exists
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [projectId]: updated };
    });
  };

  const handleMemberEmailEditChange = (projectId, value) => {
    setMemberEmailEdits((prev) => ({ ...prev, [projectId]: value }));
  };

  const saveMembers = async (projectId) => {
    setSavingMembers((prev) => ({ ...prev, [projectId]: true }));
    try {
      const memberIds = memberEdits[projectId] || [];
      const memberEmails = parseMemberEmails(memberEmailEdits[projectId] || '');
      await projectAPI.update(projectId, {
        memberIds,
        memberEmails: memberEmails.length > 0 ? memberEmails : [],
      });
      await fetchProjects();
      setEditingMembers((prev) => ({ ...prev, [projectId]: false }));
    } catch (err) {
      addToast('Failed to update project members.', 'error');
      console.error(err);
    } finally {
      setSavingMembers((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  const saveProjectDetails = async (projectId) => {
    const draft = projectEdits[projectId];
    if (!draft || !draft.name?.trim()) {
      addToast('Project name is required.', 'error');
      return;
    }

    setSavingProjectDetails((prev) => ({ ...prev, [projectId]: true }));
    try {
      await projectAPI.update(projectId, {
        name: draft.name.trim(),
        description: draft.description?.trim() || undefined,
        deadline: draft.deadline || undefined,
        status: draft.status || 'active',
      });
      addToast('Project updated successfully.', 'success');
      await fetchProjects();
      setEditingProjectDetails((prev) => ({ ...prev, [projectId]: false }));
    } catch (err) {
      addToast(err.message || 'Failed to update project.', 'error');
      console.error(err);
    } finally {
      setSavingProjectDetails((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  const formatDate = (value) => {
    if (!value) return 'No deadline';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  };

  if (loading) {
    return (
      <div className={`projects-page ${theme}`}>
        <Skeleton className="projects-skeleton-heading" />
        <Skeleton className="projects-skeleton-builder" />
        <div className="projects-list">
          <Skeleton className="projects-skeleton-card" />
          <Skeleton className="projects-skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className={`projects-page ${theme}`}>
      <div className="projects-header">
        <h2 className="section-title">Projects</h2>
        <p className="section-subtitle">Create projects, add team members, and track progress.</p>
      </div>

      <form className="projects-builder" onSubmit={handleCreateProject}>
        <div className="builder-row two">
          <label>
            Project name
            <input
              ref={projectNameRef}
              name="name"
              value={createForm.name}
              onChange={handleCreateChange}
              placeholder="e.g. Mobile Redesign"
            />
          </label>
          <label>
            Deadline
            <input
              name="deadline"
              type="date"
              value={createForm.deadline}
              onChange={handleCreateChange}
            />
          </label>
        </div>

        <div className="builder-row one">
          <label>
            Description
            <div className="description-wrap">
              <input
                name="description"
                value={createForm.description}
                onChange={handleCreateChange}
                placeholder="Describe project scope and goals"
              />
            </div>
          </label>
        </div>

        <div className="builder-members-title">Team members</div>
        <div className="builder-members">
          {(teamMembers || []).length === 0 ? (
            <span className="members-empty">No team members yet</span>
          ) : (
            (teamMembers || []).map((member) => {
              const selected = createForm.memberIds.includes(member.id);
              const avatarUrl = member.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=2d3748&color=fff&size=96`;
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`builder-member ${selected ? 'selected' : ''}`}
                  onClick={() => handleCreateMemberToggle(member.id)}
                  title={member.name || member.email}
                >
                  <img src={avatarUrl} alt={member.name || 'member'} />
                  <span>{member.name || 'Member'}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="builder-row one member-email-row">
          <label>
            Add members by email ID (comma separated)
            <input
              name="memberEmailsText"
              value={createForm.memberEmailsText}
              onChange={handleCreateChange}
              placeholder="alice@company.com, bob@company.com"
            />
          </label>
        </div>

        <div className="builder-actions">
          <button className="primary-button" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create project'}
          </button>
          {createError && <span className="error-message">{createError}</span>}
          {createStatus && <span className="status-message">{createStatus}</span>}
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      <div className="projects-list">
        {projects.length === 0 ? (
          <div className="empty-state empty-state-card">
            <div>No projects yet.</div>
            <button
              type="button"
              className="primary-button"
              onClick={() => projectNameRef.current?.focus()}
            >
              Create first project
            </button>
          </div>
        ) : (
          projects.map((project) => {
            const lead = project.members?.[0];
            const leadAvatar = lead?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(lead?.name || 'P')}&background=111827&color=fff&size=96`;

            return (
              <div key={project.id} className="project-row-card">
                <div className="project-row-top">
                  <div className="project-row-identity">
                    <img src={leadAvatar} alt={lead?.name || project.name} className="project-lead-avatar" />
                    <div>
                      <h3 className="project-name">{project.name}</h3>
                      <div className="project-description">{project.description || 'No description provided'}</div>
                    </div>
                  </div>
                  <div className="project-row-meta">
                    <span className={`project-status status-${project.status || 'active'}`}>{project.status || 'active'}</span>
                    <span className="project-deadline"><FiCalendar /> {formatDate(project.deadline)}</span>
                  </div>
                </div>

                <div className="project-row-progress">
                  <span className="progress-value">{project.progress || 0}%</span>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${project.progress || 0}%` }} />
                  </div>
                  <span className="progress-task-count">{project.completedTasks || 0}/{project.totalTasks || 0}</span>
                </div>

                <div className="project-row-foot">
                  <div className="members-list">
                    {(project.members || []).slice(0, 6).map((member) => (
                      <div key={member.id} className="member-avatar" title={member.name}>
                        {getInitials(member.name)}
                      </div>
                    ))}
                    {(project.members || []).length > 6 && (
                      <div className="member-avatar more">+{project.members.length - 6}</div>
                    )}
                  </div>

                  <div className="project-row-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => toggleEditProjectDetails(project)}
                    >
                      {editingProjectDetails[project.id] ? 'Hide update form' : 'Update project'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => toggleEditMembers(project)}
                    >
                      {editingMembers[project.id] ? 'Hide members' : 'Add members'}
                    </button>
                  </div>
                </div>

                {editingProjectDetails[project.id] && (
                  <div className="project-edit-panel">
                    <div className="project-edit-grid">
                      <label>
                        Project name
                        <input
                          value={projectEdits[project.id]?.name || ''}
                          onChange={(e) => handleProjectEditChange(project.id, 'name', e.target.value)}
                        />
                      </label>
                      <label>
                        Deadline
                        <input
                          type="date"
                          value={projectEdits[project.id]?.deadline || ''}
                          onChange={(e) => handleProjectEditChange(project.id, 'deadline', e.target.value)}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={projectEdits[project.id]?.status || 'active'}
                          onChange={(e) => handleProjectEditChange(project.id, 'status', e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="paused">Paused</option>
                        </select>
                      </label>
                      <label className="project-edit-description">
                        Description
                        <input
                          value={projectEdits[project.id]?.description || ''}
                          onChange={(e) => handleProjectEditChange(project.id, 'description', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="project-edit-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => saveProjectDetails(project.id)}
                        disabled={savingProjectDetails[project.id]}
                      >
                        {savingProjectDetails[project.id] ? 'Saving...' : 'Save project updates'}
                      </button>
                    </div>
                  </div>
                )}

                {editingMembers[project.id] && (
                  <div className="member-edit-panel">
                    <div className="member-edit-title">Select members to add/remove</div>
                    <div className="member-picker">
                      {(teamMembers || []).map((member) => (
                        <label key={member.id} className="member-chip">
                          <input
                            type="checkbox"
                            checked={(memberEdits[project.id] || []).includes(member.id)}
                            onChange={() => handleMemberEditToggle(project.id, member.id)}
                          />
                          <span>{member.name || member.email}</span>
                        </label>
                      ))}
                    </div>
                    <div className="member-email-entry">
                      <label>
                        Member email IDs (comma separated)
                        <input
                          className="member-email-input"
                          value={memberEmailEdits[project.id] || ''}
                          onChange={(e) => handleMemberEmailEditChange(project.id, e.target.value)}
                          placeholder="alice@company.com, bob@company.com"
                        />
                      </label>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => saveMembers(project.id)}
                      disabled={savingMembers[project.id]}
                    >
                      {savingMembers[project.id] ? 'Saving...' : 'Save members'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Projects;
