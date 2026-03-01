import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { settingsAPI } from '../services/api';
import { FiUser, FiMail, FiUpload, FiBell, FiAlertTriangle } from 'react-icons/fi';
import Skeleton from './Skeleton';
import './Settings.css';

const Settings = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { addToast } = useToast();
  const { logout } = useAuth();
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
  const [integrations, setIntegrations] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [statusMessage, setStatusMessage] = useState('');
  const avatarSrc = avatarData || profileForm.avatarUrl || user?.avatar;

  const fetchUserInfo = useCallback(async () => {
    try {
      setLoading(true);
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

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdatePassword = async () => {
    setStatusMessage('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setStatusMessage('Please fill both password fields.');
      addToast('Please fill both password fields.', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setStatusMessage('New password must be at least 6 characters.');
      addToast('New password must be at least 6 characters.', 'error');
      return;
    }
    try {
      await settingsAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setStatusMessage('Password updated.');
      addToast('Password updated.', 'success');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update password.');
      addToast(err.message || 'Failed to update password.', 'error');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    try {
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
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    try {
      const updated = await settingsAPI.updatePreferences(preferences);
      setUser(updated);
      if (preferences.themePreference && setTheme) {
        setTheme(preferences.themePreference);
      } else if (preferences.themePreference !== theme) {
        toggleTheme();
      }
      setStatusMessage('Preferences updated.');
      addToast('Preferences updated.', 'success');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update preferences.');
      addToast(err.message || 'Failed to update preferences.', 'error');
    }
  };

  const handleDeleteAccount = () => {
    const warningMessage = [
      'Delete your account permanently?',
      'This removes your tasks, projects, and workspace data.',
      'If needed, export important data before continuing.',
    ].join('\n');
    const confirmed = window.confirm(warningMessage);
    if (!confirmed) {
      return;
    }

    const password = window.prompt('Enter your current password to confirm account deletion:');
    if (!password) {
      setStatusMessage('Account deletion cancelled. Password not provided.');
      return;
    }

    settingsAPI.deleteAccount(password)
      .then(async () => {
        addToast('Account deleted successfully.', 'success');
        await logout();
      })
      .catch((err) => {
        setStatusMessage(err.message || 'Failed to delete account.');
        addToast(err.message || 'Failed to delete account.', 'error');
      });
  };

  if (loading) {
    return (
      <div className={`settings ${theme}`}>
        <Skeleton className="settings-skeleton-title" />
        <div className="settings-grid">
          <Skeleton className="settings-skeleton-card" />
          <Skeleton className="settings-skeleton-card" />
          <Skeleton className="settings-skeleton-card" />
          <Skeleton className="settings-skeleton-card" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={`settings ${theme}`}>
        <h2 className="section-title">Settings</h2>
        <div className="error-message">{error || 'User not found'}</div>
      </div>
    );
  }

  return (
    <div className={`settings ${theme}`}>
      <h2 className="section-title">User Profile Settings</h2>
      <p className="settings-subtitle">Manage your profile and notification preferences</p>
      {statusMessage && <div className="status-message">{statusMessage}</div>}

      <div className="settings-shell">
        <section className="settings-card section-card">
          <h3 className="section-block-title">Basic Info</h3>
          <div className="basic-grid">
            <div className="basic-left-card">
              <div className="avatar-wrap">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={user.name} className="user-avatar" />
                ) : (
                  <div className="user-avatar-placeholder">
                    <FiUser className="avatar-icon" />
                  </div>
                )}
              </div>

              <label className="upload-btn" htmlFor="avatarUpload">
                <FiUpload />
                Upload New Photo
              </label>
              <input id="avatarUpload" type="file" accept="image/*" onChange={handleAvatarFile} />
              <button type="button" className="text-button" onClick={handleRemoveAvatar}>
                Remove Photo
              </button>

              <div className="password-box">
                <h4>Change Password</h4>
                <input
                  type="password"
                  name="currentPassword"
                  placeholder="Current Password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                />
                <input
                  type="password"
                  name="newPassword"
                  placeholder="Update Password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                />
                <button type="button" className="primary-button muted-btn" onClick={handleUpdatePassword}>
                  Update Password
                </button>
              </div>
            </div>

            <div className="basic-right-card">
              <form className="settings-form" onSubmit={handleSaveProfile}>
                <label>
                  Full Name
                  <input name="name" value={profileForm.name} onChange={handleProfileChange} />
                </label>
                <label>
                  Email Address
                  <input value={user.email || ''} readOnly />
                </label>
                <label>
                  Avatar URL
                  <input name="avatarUrl" value={profileForm.avatarUrl} onChange={handleProfileChange} />
                </label>
                <button type="submit" className="primary-button">Save Changes</button>
              </form>
            </div>
          </div>
        </section>

        <section className="settings-card section-card">
          <h3 className="section-block-title">Notifications</h3>
          <div className="notifications-grid">
            <div className="mini-card">
              <div className="card-header">
                <FiBell />
                <h4>Notifications</h4>
              </div>
              <form className="settings-form compact-form" onSubmit={handleSavePreferences}>
                <label className="switch-row">
                  Daily digest reminders
                  <input
                    type="checkbox"
                    name="notifyEmail"
                    checked={preferences.notifyEmail}
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
                <div className="integrations-strip">
                  {(integrations || []).slice(0, 3).map((integration) => (
                    <span key={integration.id} className="integration-pill">
                      {integration.name}
                    </span>
                  ))}
                  {(integrations || []).length === 0 && (
                    <span className="integration-pill muted">No integrations</span>
                  )}
                </div>
                <button type="submit" className="primary-button">Save Notifications</button>
              </form>
            </div>

            <div className="mini-card">
              <div className="card-header">
                <FiMail />
                <h4>Notification Preferences</h4>
              </div>
              <form className="settings-form compact-form" onSubmit={handleSavePreferences}>
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
                <label className="switch-row">
                  Light mode
                  <input
                    type="checkbox"
                    checked={preferences.themePreference === 'light'}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        themePreference: e.target.checked ? 'light' : 'dark',
                      }))
                    }
                  />
                </label>
                <button type="submit" className="primary-button">Save Preferences</button>
              </form>
            </div>
          </div>
        </section>

        <section className="settings-card section-card">
          <div className="card-header danger-head">
            <FiAlertTriangle />
            <h4>Danger Zone</h4>
          </div>
          <p className="danger-copy">Delete your account permanently. This action cannot be undone.</p>
          <div className="danger-actions">
            <button type="button" className="danger-button" onClick={handleDeleteAccount}>
              Delete Account
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
