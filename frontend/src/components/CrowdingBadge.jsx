export default function CrowdingBadge({ level, confidence }) {
  const config = {
    not_crowded: {
      label: 'Not Crowded',
      bg:    'bg-green-100',
      text:  'text-green-700',
      dot:   'bg-green-500',
      icon:  '🟢',
    },
    normal: {
      label: 'Moderate',
      bg:    'bg-yellow-100',
      text:  'text-yellow-700',
      dot:   'bg-yellow-500',
      icon:  '🟡',
    },
    overcrowded: {
      label: 'Overcrowded',
      bg:    'bg-red-100',
      text:  'text-red-700',
      dot:   'bg-red-500',
      icon:  '🔴',
    },
    unknown: {
      label: 'Unknown',
      bg:    'bg-gray-100',
      text:  'text-gray-500',
      dot:   'bg-gray-400',
      icon:  '⚪',
    },
  };

  const c = config[level] || config.unknown;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${c.bg}`}>
      <div className={`w-2 h-2 rounded-full ${c.dot}`} />
      <span className={`text-xs font-semibold ${c.text}`}>
        {c.icon} {c.label}
      </span>
      {confidence && (
        <span className={`text-xs ${c.text} opacity-60`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}