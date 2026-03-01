import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { settingsAPI } from '../services/api';
import {
  FiUser,
  FiBell,
  FiShield,
  FiBriefcase,
  FiAlertTriangle,
  FiUpload,
  FiCheckCircle,
} from 'react-icons/fi';
import Skeleton from './Skeleton';
import './Settings.css';

const TABS = [
  { id: 'profile', label: 'Profile', icon: FiUser },
  { id: 'notifications', label: 'Notifications', icon: FiBell },
  { id: 'security', label: 'Security', icon: FiShield },
  { id: 'workspace', label: 'Workspace', icon: FiBriefcase },
  { id: 'danger', label: 'Danger Zone', icon: FiAlertTriangle },
];

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', avatarUrl: '' });
  const [avatarData, setAvatarData] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [preferences, setPreferences] = useState({
    themePreference: 'dark',
    notifyEmail: true,
    notifyInApp: true,
    reminderHours: 24,
  });
  const [workspaceForm, setWorkspaceForm] = useState({
    workspaceName: '',
    workspaceTimezone: '',
  });
  const [integrations, setIntegrations] = useState([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [dangerForm, setDangerForm] = useState({
    confirmText: '',
    password: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const avatarSrc = avatarData || profileForm.avatarUrl || user?.avatar;

  const fetchUserInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await settingsAPI.getUser();
      setUser(data);
      setProfileForm({ name: data.name || '', avatarUrl: data.avatar || '' });
      setAvatarData('');
      setAvatarFile(null);
      setPreferences({
        themePreference: data.themePreference || theme,
        notifyEmail: data.notifyEmail ?? true,
        notifyInApp: data.notifyInApp ?? true,
        reminderHours: data.reminderHours || 24,
      });
      setWorkspaceForm({
        workspaceName: data.workspaceName || '',
        workspaceTimezone: data.workspaceTimezone || '',
      });
      setIntegrations(data.integrations || []);
    } catch (err) {
      setError('Failed to load user information.');
      addToast('Failed to load user information.', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [addToast, theme]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  const profileCompleteness = useMemo(() => {
    if (!user) return 0;
    const checks = [
      !!profileForm.name?.trim(),
      !!(avatarSrc || '').trim(),
      !!workspaceForm.workspaceName?.trim(),
      !!workspaceForm.workspaceTimezone?.trim(),
      preferences.reminderHours > 0,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [avatarSrc, preferences.reminderHours, profileForm.name, user, workspaceForm.workspaceName, workspaceForm.workspaceTimezone]);

  const passwordStrength = useMemo(() => {
    const pwd = passwordForm.newPassword || '';
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score, label: labels[score] };
  }, [passwordForm.newPassword]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage('Image too large. Please use a file under 2MB.');
      addToast('Image too large. Use a file under 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarData(reader.result);
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarData('');
    setAvatarFile(null);
    setProfileForm((prev) => ({ ...prev, avatarUrl: '' }));
  };

  const handlePreferencesChange = (e) => {
    const { name, value, checked, type } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'reminderHours' ? parseInt(value, 10) : value),
    }));
  };

  const handleWorkspaceChange = (e) => {
    const { name, value } = e.target;
    setWorkspaceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDangerChange = (e) => {
    const { name, value } = e.target;
    setDangerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    try {
      setSavingProfile(true);
      let avatarUrl = profileForm.avatarUrl || '';
      if (avatarFile) {
        const uploaded = await settingsAPI.uploadAvatar(avatarFile);
        avatarUrl = uploaded.avatarUrl;
      }
      const payload = {
        name: profileForm.name,
        avatar: avatarUrl,
      };
      const updated = await settingsAPI.updateUser(payload);
      setUser(updated);
      setProfileForm({ name: updated.name || '', avatarUrl: updated.avatar || '' });
      setAvatarData('');
      setAvatarFile(null);
      setStatusMessage('Profile updated.');
      addToast('Profile updated.', 'success');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update profile.');
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    try {
      setSavingPreferences(true);
      const updated = await settingsAPI.updatePreferences(preferences);
      setUser(updated);
      if (preferences.themePreference && setTheme) {
        setTheme(preferences.themePreference);
      }
      setStatusMessage('Notification preferences updated.');
      addToast('Preferences updated.', 'success');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update preferences.');
      addToast(err.message || 'Failed to update preferences.', 'error');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleSaveWorkspace = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    try {
      setSavingWorkspace(true);
      const updated = await settingsAPI.updateWorkspace(workspaceForm);
      setUser(updated);
      setWorkspaceForm({
        workspaceName: updated.workspaceName || '',
        workspaceTimezone: updated.workspaceTimezone || '',
      });
      setStatusMessage('Workspace settings updated.');
      addToast('Workspace updated.', 'success');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update workspace.');
      addToast(err.message || 'Failed to update workspace.', 'error');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setStatusMessage('Please fill all password fields.');
      addToast('Please fill all password fields.', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setStatusMessage('New password must be at least 6 characters.');
      addToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatusMessage('Password confirmation does not match.');
      addToast('Password confirmation does not match.', 'error');
      return;
    }
    try {
      setSavingPassword(true);
      await settingsAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatusMessage('Password updated.');
      addToast('Password updated.', 'success');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update password.');
      addToast(err.message || 'Failed to update password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    if (dangerForm.confirmText !== 'DELETE') {
      setStatusMessage('Type DELETE to enable account deletion.');
      addToast('Please type DELETE exactly.', 'error');
      return;
    }
    if (!dangerForm.password) {
      setStatusMessage('Current password is required.');
      addToast('Password is required.', 'error');
      return;
    }

    const confirmed = window.confirm(
      'Final confirmation: delete account permanently? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingAccount(true);
      await settingsAPI.deleteAccount(dangerForm.password);
      addToast('Account deleted successfully.', 'success');
      await logout();
    } catch (err) {
      setStatusMessage(err.message || 'Failed to delete account.');
      addToast(err.message || 'Failed to delete account.', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  const renderProfile = () => (
    <section className="settings-card">
      <div className="settings-card-head">
        <h3>Profile</h3>
        <div className="completion-wrap">
          <span>Profile completeness</span>
          <strong>{profileCompleteness}%</strong>
        </div>
      </div>

      <div className="completion-bar">
        <div style={{ width: `${profileCompleteness}%` }} />
      </div>

      <div className="profile-layout">
        <div className="avatar-panel">
          <div className="avatar-ring">
            {avatarSrc ? (
              <img src={avatarSrc} alt={profileForm.name || user?.name || 'User'} className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">
                <FiUser />
              </div>
            )}
          </div>
          <label className="upload-btn" htmlFor="avatarUpload">
            <FiUpload /> Upload Photo
          </label>
          <input id="avatarUpload" type="file" accept="image/*" onChange={handleAvatarFile} />
          <button type="button" className="text-button" onClick={handleRemoveAvatar}>Remove</button>
          <p className="helper-text">PNG/JPG/WEBP, up to 2MB.</p>
        </div>

        <form className="settings-form" onSubmit={handleSaveProfile}>
          <label>
            Full Name
            <input name="name" value={profileForm.name} onChange={handleProfileChange} />
          </label>
          <label>
            Email Address
            <input value={user?.email || ''} readOnly />
          </label>
          <label>
            Avatar URL
            <input name="avatarUrl" value={profileForm.avatarUrl} onChange={handleProfileChange} />
          </label>
          <button type="submit" className="primary-button" disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </section>
  );

  const renderNotifications = () => (
    <section className="settings-card">
      <div className="settings-card-head">
        <h3>Notification Preferences</h3>
      </div>
      <form className="settings-form" onSubmit={handleSavePreferences}>
        <label className="switch-row">
          Email notifications
          <input
            type="checkbox"
            name="notifyEmail"
            checked={preferences.notifyEmail}
            onChange={handlePreferencesChange}
          />
        </label>
        <label className="switch-row">
          In-app notifications
          <input
            type="checkbox"
            name="notifyInApp"
            checked={preferences.notifyInApp}
            onChange={handlePreferencesChange}
          />
        </label>
        <label>
          Reminder Window
          <select name="reminderHours" value={preferences.reminderHours} onChange={handlePreferencesChange}>
            <option value={24}>24 hours before</option>
            <option value={48}>48 hours before</option>
            <option value={72}>72 hours before</option>
          </select>
        </label>
        <label>
          Theme
          <select name="themePreference" value={preferences.themePreference} onChange={handlePreferencesChange}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <div className="integrations-strip">
          {(integrations || []).map((integration) => (
            <span key={integration.id} className="integration-pill">
              {integration.name}
            </span>
          ))}
          {(integrations || []).length === 0 && (
            <span className="integration-pill muted">No integrations configured</span>
          )}
        </div>

        <button type="submit" className="primary-button" disabled={savingPreferences}>
          {savingPreferences ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>
    </section>
  );

  const renderSecurity = () => (
    <section className="settings-card">
      <div className="settings-card-head">
        <h3>Security</h3>
      </div>
      <form className="settings-form" onSubmit={handleUpdatePassword}>
        <label>
          Current Password
          <input
            type="password"
            name="currentPassword"
            placeholder="Current Password"
            value={passwordForm.currentPassword}
            onChange={handlePasswordChange}
          />
        </label>
        <label>
          New Password
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={passwordForm.newPassword}
            onChange={handlePasswordChange}
          />
        </label>
        <div className="strength-meter">
          <div className={`strength-bar strength-${passwordStrength.score}`} />
        </div>
        <p className="helper-text">Strength: {passwordStrength.label}</p>
        <label>
          Confirm New Password
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={passwordForm.confirmPassword}
            onChange={handlePasswordChange}
          />
        </label>
        <button type="submit" className="primary-button" disabled={savingPassword}>
          {savingPassword ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </section>
  );

  const renderWorkspace = () => (
    <section className="settings-card">
      <div className="settings-card-head">
        <h3>Workspace</h3>
      </div>
      <form className="settings-form" onSubmit={handleSaveWorkspace}>
        <label>
          Workspace Name
          <input
            name="workspaceName"
            placeholder="WorkTrace Team"
            value={workspaceForm.workspaceName}
            onChange={handleWorkspaceChange}
          />
        </label>
        <label>
          Timezone
          <input
            name="workspaceTimezone"
            placeholder="Asia/Calcutta"
            value={workspaceForm.workspaceTimezone}
            onChange={handleWorkspaceChange}
          />
        </label>
        <div className="workspace-preview">
          <strong>Preview</strong>
          <span>{workspaceForm.workspaceName || 'Workspace'}</span>
          <small>{workspaceForm.workspaceTimezone || 'No timezone set'}</small>
        </div>
        <button type="submit" className="primary-button" disabled={savingWorkspace}>
          {savingWorkspace ? 'Saving...' : 'Save Workspace'}
        </button>
      </form>
    </section>
  );

  const renderDanger = () => (
    <section className="settings-card danger-card">
      <div className="settings-card-head">
        <h3>Danger Zone</h3>
      </div>
      <p className="danger-copy">
        Deleting your account permanently removes your tasks, comments, projects, and settings.
      </p>
      <form className="settings-form" onSubmit={handleDeleteAccount}>
        <label>
          Type DELETE to confirm
          <input
            name="confirmText"
            placeholder="DELETE"
            value={dangerForm.confirmText}
            onChange={handleDangerChange}
          />
        </label>
        <label>
          Current Password
          <input
            type="password"
            name="password"
            placeholder="Current Password"
            value={dangerForm.password}
            onChange={handleDangerChange}
          />
        </label>
        <button
          type="submit"
          className="danger-button"
          disabled={deletingAccount || dangerForm.confirmText !== 'DELETE'}
        >
          {deletingAccount ? 'Deleting...' : 'Delete Account Permanently'}
        </button>
      </form>
    </section>
  );

  if (loading) {
    return (
      <div className={`settings ${theme}`}>
        <Skeleton className="settings-skeleton-title" />
        <Skeleton className="settings-skeleton-tabs" />
        <Skeleton className="settings-skeleton-card" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={`settings ${theme}`}>
        <h2 className="settings-page-title">Settings</h2>
        <div className="error-message">{error || 'User not found'}</div>
      </div>
    );
  }

  return (
    <div className={`settings ${theme}`}>
      <div className="settings-top">
        <div>
          <h2 className="settings-page-title">Settings</h2>
          <p className="settings-subtitle">Manage profile, notifications, security, and workspace preferences.</p>
        </div>
        {statusMessage && (
          <div className="status-pill" role="status" aria-live="polite">
            <FiCheckCircle />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`settings-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-panel">
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'security' && renderSecurity()}
        {activeTab === 'workspace' && renderWorkspace()}
        {activeTab === 'danger' && renderDanger()}
      </div>
    </div>
  );
};

export default Settings;

