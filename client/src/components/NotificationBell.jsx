import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, FileText, UserRoundCheck, Scale, Clock, Wallet, BadgeCheck, KeyRound } from 'lucide-react';

// Parse a date string from the server (assumed to be in UTC) into a JavaScript Date object.
// The server sends dates in the format "YYYY-MM-DD HH:MM:SS", which is not directly parseable by Date.parse() in all browsers, so we replace the space with 'T' and append 'Z' to indicate UTC.
// This function is used to convert the created_at and read_at timestamps from the server into Date objects for further processing, such as calculating relative time.
function parseServerDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(value) {
  const diffMs = Date.now() - parseServerDate(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// One bare line icon per kind of notification - shared with the organizer dashboard's
// Recent activity card so the same event always looks the same wherever it shows up.
export function notificationIcon(type = '') {
  if (type.startsWith('application')) return FileText;
  if (type === 'hired') return UserRoundCheck;
  if (type.startsWith('dispute')) return Scale;
  if (type === 'payment_due_reminder') return Clock;
  if (type.startsWith('payment')) return Wallet;
  if (type === 'account_approved') return BadgeCheck;
  if (type.startsWith('password')) return KeyRound;
  return Bell;
}

// This component renders a notification bell icon that, when clicked, displays a dropdown panel with the user's notifications. 
// It fetches notifications from the server, allows marking them as read, and provides navigation to related links.
export default function NotificationBell() {
  const [notifications, setNotifications] = useState(null); // null means still loading
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 25000);
    return () => clearInterval(interval);
  }, []);

  // This effect sets up an event listener to close the notification panel when clicking outside of it.
  // It adds a 'mousedown' event listener to the document that checks if the click occurred outside the wrapperRef (the notification bell and panel). 
  // If so, it sets the open state to false, closing the panel. 
  // The event listener is cleaned up when the component unmounts or when the effect re-runs.
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications/mine');
      if (!response.ok) return; // not logged in, or a blip - just skip this poll
      const data = await response.json();
      setNotifications(data);
    } catch {
      // Network error or server down - just skip this poll, the next one will try again.
    }
  }

  async function handleItemClick(notification) {
    setOpen(false);
    if (!notification.read_at) {
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'POST' });
      } catch {
        // Network error or server down - the next poll will correct the read_at state, so we don't need to do anything here.
      }
    }
    navigate(notification.link || '/dashboard');
  }

  async function handleMarkAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
        // Network error or server down - the next poll will correct the read_at state, so we don't need to do anything here.
    }
  }

  const unreadCount = notifications ? notifications.filter((n) => !n.read_at).length : 0;

  return (
    <div className="krew-notif-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="krew-notif-bell"
        onClick={() => setOpen((current) => !current)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      >
        <Bell size={19} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="krew-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="krew-notif-panel">
          <div className="krew-notif-panel-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="krew-dash-text-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {notifications === null && <div className="krew-notif-empty">Loading…</div>}

          {notifications && notifications.length === 0 && (
            <div className="krew-notif-empty">No notifications yet.</div>
          )}

          {notifications && notifications.length > 0 && (
            <div className="krew-notif-list">
              {notifications.map((notification) => {
                const Icon = notificationIcon(notification.type);
                return (
                <button
                  type="button"
                  key={notification.id}
                  className={`krew-notif-item ${notification.read_at ? '' : 'unread'}`}
                  onClick={() => handleItemClick(notification)}
                >
                  <Icon className="krew-notif-item-icon" size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span className="krew-notif-item-text">
                    <span className="krew-notif-item-message">{notification.message}</span>
                    <span className="krew-notif-item-time">{formatRelativeTime(notification.created_at)}</span>
                  </span>
                  {!notification.read_at && <span className="krew-notif-dot" aria-label="Unread" />}
                </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}