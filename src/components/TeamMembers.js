import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { teamAPI } from '../services/api';
import { FiCheck, FiChevronDown, FiChevronUp, FiClock, FiTrash2, FiUserPlus } from 'react-icons/fi';
import Skeleton from './Skeleton';
import './TeamMembers.css';

const TeamMembers = () => {
  const { theme } = useTheme();
  const { user, hasAnyRole } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'user' });
  const [inviteStatus, setInviteStatus] = useState('');
  const [memberTasks, setMemberTasks] = useState({});
  const [expandedMembers, setExpandedMembers] = useState({});
  const [taskLoading, setTaskLoading] = useState({});
  const inviteNameRef = useRef(null);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const data = await teamAPI.getMembers();
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      addToast('Failed to load team members.', 'error');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const canManage = hasAnyRole(['admin', 'manager']);

  const roleLabel = (role) => {
    if (role === 'admin') return 'Admin';
    if (role === 'manager') return 'Manager';
    return 'Member';
  };

  const roleOptions = user?.role === 'admin'
    ? ['admin', 'manager', 'user']
    : ['manager', 'user'];

  const handleInviteChange = (e) => {
    const { name, value } = e.target;
    setInviteData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteStatus('');
    try {
      const response = await teamAPI.invite(inviteData);
      const passwordMessage = response.tempPassword
        ? ` Temporary password: ${response.tempPassword}`
        : '';
      setInviteStatus(`Member invited successfully.${passwordMessage}`);
      addToast('Member invited successfully.', 'success');
      setInviteData({ name: '', email: '', role: 'user' });
      fetchTeamMembers();
    } catch (error) {
      setInviteStatus(error.message || 'Failed to invite member.');
      addToast(error.message || 'Failed to invite member.', 'error');
    }
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      await teamAPI.updateRole(memberId, role);
      addToast('Member role updated.', 'success');
      fetchTeamMembers();
    } catch (error) {
      addToast('Failed to update role.', 'error');
      console.error('Error updating role:', error);
    }
  };

  const handleRemove = async (memberId) => {
    try {
      await teamAPI.removeMember(memberId);
      addToast('Member removed.', 'success');
      fetchTeamMembers();
    } catch (error) {
      addToast('Failed to remove member.', 'error');
      console.error('Error removing member:', error);
    }
  };

  const toggleTasks = async (memberId) => {
    setExpandedMembers((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
    if (memberTasks[memberId]) return;

    setTaskLoading((prev) => ({ ...prev, [memberId]: true }));
    try {
      const tasks = await teamAPI.getMemberTasks(memberId);
      setMemberTasks((prev) => ({ ...prev, [memberId]: Array.isArray(tasks) ? tasks : [] }));
    } catch (error) {
      console.error('Error fetching member tasks:', error);
      setMemberTasks((prev) => ({ ...prev, [memberId]: [] }));
    } finally {
      setTaskLoading((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const getAvatar = (member) => member.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=111827&color=fff&size=96`;

  const getCompletedCount = (memberId) => (memberTasks[memberId] || []).filter((task) => task.status === 'completed').length;
  const getTaskCount = (memberId) => (memberTasks[memberId] || []).length;
  const getProgress = (memberId) => {
    const total = getTaskCount(memberId);
    if (!total) return 0;
    return Math.round((getCompletedCount(memberId) / total) * 100);
  };

  if (loading) {
    return (
      <div className={`team-members ${theme}`}>
        <Skeleton className="team-skeleton-heading" />
        <Skeleton className="team-skeleton-builder" />
        <div className="team-grid">
          <Skeleton className="team-skeleton-card" />
          <Skeleton className="team-skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className={`team-members ${theme}`}>
      <div className="team-header">
        <h2 className="section-title">Team</h2>
        <p className="section-subtitle">Manage workspace members and responsibilities.</p>
      </div>

      {canManage && (
        <form className="team-builder" onSubmit={handleInviteSubmit}>
          <div className="builder-row three">
            <label>
              Full name
              <input
                ref={inviteNameRef}
                name="name"
                type="text"
                placeholder="Jane Doe"
                value={inviteData.name}
                onChange={handleInviteChange}
                required
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="jane@company.com"
                value={inviteData.email}
                onChange={handleInviteChange}
                required
              />
            </label>
            <label>
              Role
              <select name="role" value={inviteData.role} onChange={handleInviteChange}>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="builder-actions">
            <button type="submit" className="primary-button">
              <FiUserPlus /> Invite member
            </button>
            {inviteStatus && <span className="status-message">{inviteStatus}</span>}
          </div>
        </form>
      )}

      <div className="team-grid">
        {members.length === 0 ? (
          <div className="empty-state empty-state-card">
            <div>No team members found.</div>
            {canManage && (
              <button
                type="button"
                className="primary-button"
                onClick={() => inviteNameRef.current?.focus()}
              >
                <FiUserPlus /> Invite member
              </button>
            )}
          </div>
        ) : (
          members.map((member) => {
            const icon = member.status === 'completed' ? FiCheck : FiClock;
            const Icon = icon;
            const isSelf = user?.id === member.id;
            const isAdminTarget = member.role === 'admin';
            const canRemove = canManage && !isSelf && (!isAdminTarget || user?.role === 'admin');
            const progress = getProgress(member.id);

            return (
              <div key={member.id} className="team-card">
                <div className="team-card-top">
                  <div className="member-identity">
                    <img src={getAvatar(member)} alt={member.name} className="member-avatar" />
                    <div>
                      <h3 className="member-name">{member.name || 'Team Member'}</h3>
                      <div className="member-role">{roleLabel(member.role)}</div>
                    </div>
                  </div>

                  <div className="member-state">
                    <Icon className="state-icon" />
                    <span>{member.status || 'Active'}</span>
                  </div>
                </div>

                <div className="member-progress">
                  <span className="progress-value">{progress}%</span>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="progress-task-count">{getCompletedCount(member.id)}/{getTaskCount(member.id)}</span>
                </div>

                <div className="team-card-actions">
                  <button type="button" className="secondary-button" onClick={() => toggleTasks(member.id)}>
                    {expandedMembers[member.id] ? <FiChevronUp /> : <FiChevronDown />} {expandedMembers[member.id] ? 'Hide tasks' : 'View tasks'}
                  </button>

                  {canManage && !isSelf && (
                    <select
                      className="role-select"
                      value={member.role || 'user'}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={isAdminTarget && user?.role !== 'admin'}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{roleLabel(role)}</option>
                      ))}
                    </select>
                  )}

                  {canRemove && (
                    <button type="button" className="remove-button" onClick={() => handleRemove(member.id)}>
                      <FiTrash2 />
                    </button>
                  )}
                </div>

                {expandedMembers[member.id] && (
                  <div className="member-task-detail">
                    {taskLoading[member.id] ? (
                      <div className="task-loading">Loading tasks...</div>
                    ) : (memberTasks[member.id] || []).length > 0 ? (
                      (memberTasks[member.id] || []).map((taskItem) => (
                        <div key={taskItem.id} className="member-task-row">
                          <span className="task-title">{taskItem.title}</span>
                          <span className={`task-status status-${taskItem.status}`}>{taskItem.status}</span>
                        </div>
                      ))
                    ) : (
                      <div className="task-empty">No assigned tasks</div>
                    )}
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

export default TeamMembers;
