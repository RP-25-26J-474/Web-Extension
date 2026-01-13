import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';

const StatsPanel = ({ compact = false }) => {
  const { state } = useGame();
  const { isDark } = useTheme();
  const { stats } = state;
  
  // Live ticking time
  const [displayTime, setDisplayTime] = useState(0);
  
  // Update time every second
  useEffect(() => {
    if (!state.startTime) return;
    
    const updateTime = () => {
      setDisplayTime(Date.now() - state.startTime);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, [state.startTime]);
  
  // Format time as mm:ss
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Theme-aware amber color
  const amberColor = isDark ? '#fbbf24' : '#d97706';
  const amberBg = isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.15)';
  
  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        {/* Current Streak */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🔥</span>
          <span 
            className="font-bold"
            style={{ color: stats.currentStreak >= 3 ? amberColor : 'var(--text-tertiary)' }}
          >
            {stats.currentStreak}
          </span>
        </div>
        
        {/* Best Streak */}
        {stats.maxStreak > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🏆</span>
            <span className="font-bold" style={{ color: amberColor }}>
              {stats.maxStreak}
            </span>
          </div>
        )}
        
        {/* Live Time */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⏱️</span>
          <span className="font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{formatTime(displayTime)}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="backdrop-blur-xl rounded-2xl p-4 transition-colors duration-300"
      style={{ 
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)'
      }}
    >
      <h3 className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Your Score</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Current Streak */}
        <div 
          className="flex items-center gap-3 p-3 rounded-xl transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <div 
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${stats.currentStreak >= 5 ? 'animate-pulse' : ''}`} 
            style={{ backgroundColor: stats.currentStreak >= 3 ? amberBg : 'rgba(var(--primary-color-rgb), 0.1)' }}
          >
            🔥
          </div>
          <div>
            <div 
              className="text-xl font-black"
              style={{ color: stats.currentStreak >= 3 ? amberColor : 'var(--text-primary)' }}
            >
              {stats.currentStreak}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Streak</div>
          </div>
        </div>
        
        {/* Best Streak */}
        <div 
          className="flex items-center gap-3 p-3 rounded-xl transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" 
            style={{ backgroundColor: amberBg }}
          >
            🏆
          </div>
          <div>
            <div className="text-xl font-black" style={{ color: amberColor }}>
              {stats.maxStreak}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Best</div>
          </div>
        </div>
        
        {/* Live Time - Full width */}
        <div 
          className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-xl transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" 
            style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)' }}
          >
            ⏱️
          </div>
          <div className="text-center">
            <div className="text-3xl font-black font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatTime(displayTime)}</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;

