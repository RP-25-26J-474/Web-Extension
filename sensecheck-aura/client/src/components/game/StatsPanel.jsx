import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import { Flame, Trophy, Clock } from 'lucide-react';

const StatsPanel = ({ compact = false }) => {
  const { state } = useGame();
  const { isDark } = useTheme();
  const { stats } = state;
  
  const [displayTime, setDisplayTime] = useState(0);
  
  useEffect(() => {
    if (!state.startTime) return;
    
    const updateTime = () => {
      setDisplayTime(Date.now() - state.startTime);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, [state.startTime]);
  
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const amberColor = '#f59e0b';
  const amberBg = isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(245, 158, 11, 0.15)';
  
  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4" style={{ color: stats.currentStreak >= 3 ? amberColor : 'var(--text-tertiary)' }} />
          <span 
            className="font-bold"
            style={{ color: stats.currentStreak >= 3 ? amberColor : 'var(--text-tertiary)' }}
          >
            {stats.currentStreak}
          </span>
        </div>
        
        {stats.maxStreak > 0 && (
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4" style={{ color: amberColor }} />
            <span className="font-bold" style={{ color: amberColor }}>
              {stats.maxStreak}
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
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
        <div 
          className="flex items-center gap-3 p-3 rounded-xl transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <div 
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.currentStreak >= 5 ? 'animate-pulse' : ''}`} 
            style={{ backgroundColor: stats.currentStreak >= 3 ? amberBg : 'rgba(var(--primary-color-rgb), 0.1)' }}
          >
            <Flame className="w-5 h-5" style={{ color: stats.currentStreak >= 3 ? amberColor : 'var(--primary-color)' }} />
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
        
        <div 
          className="flex items-center gap-3 p-3 rounded-xl transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center" 
            style={{ backgroundColor: amberBg }}
          >
            <Trophy className="w-5 h-5" style={{ color: amberColor }} />
          </div>
          <div>
            <div className="text-xl font-black" style={{ color: amberColor }}>
              {stats.maxStreak}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Best</div>
          </div>
        </div>
        
        <div 
          className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-xl transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center" 
            style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)' }}
          >
            <Clock className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />
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
