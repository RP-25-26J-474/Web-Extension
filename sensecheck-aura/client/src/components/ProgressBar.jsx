const ProgressBar = ({ current, total, label }) => {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="w-full mb-6">
      {label && (
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">{label}</span>
          <span className="font-medium" style={{ color: 'var(--primary-color)' }}>{current} / {total}</span>
        </div>
      )}
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${percentage}%`,
            background: 'linear-gradient(90deg, var(--primary-color-dark) 0%, var(--primary-color) 50%, var(--primary-color-light) 100%)'
          }}
        />
      </div>
      {/* Step indicators */}
      <div className="flex justify-between mt-2">
        {Array.from({ length: total }, (_, i) => (
          <div 
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{ 
              backgroundColor: i < current ? 'var(--primary-color)' : '#374151',
              boxShadow: i < current ? '0 0 8px var(--primary-color-glow)' : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
