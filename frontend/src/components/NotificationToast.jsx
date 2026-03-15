import { useEffect, useState } from 'react';

export default function NotificationToast({ notifications }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    // show latest notification
    const latest = notifications[notifications.length - 1];
    setVisible([latest]);

    // auto dismiss after 5 seconds
    const timer = setTimeout(() => setVisible([]), 5000);
    return () => clearTimeout(timer);
  }, [notifications]);

  if (visible.length === 0) return null;

  const config = {
    bus_approaching: {
      bg:   'bg-blue-500',
      icon: '🚌',
    },
    prepare_to_exit: {
      bg:   'bg-orange-500',
      icon: '🔔',
    },
    arrived_at_destination: {
      bg:   'bg-green-500',
      icon: '✅',
    },
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-[2000] space-y-2">
      {visible.map((n, i) => {
        const c = config[n.type] || { bg: 'bg-gray-700', icon: '📍' };
        return (
          <div
            key={i}
            className={`${c.bg} rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg`}
          >
            <span className="text-xl">{c.icon}</span>
            <p className="text-white text-sm font-semibold flex-1">
              {n.message}
            </p>
            <button
              onClick={() => setVisible([])}
              className="text-white opacity-70 text-lg leading-none"
            >×</button>
          </div>
        );
      })}
    </div>
  );
}