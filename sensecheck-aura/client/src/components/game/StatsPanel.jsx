import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';

const StatsPanel = ({ compact = false }) => {
  const { state } = useGame();
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
  
  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        {/* Current Streak */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🔥</span>
          <span className={`font-bold ${stats.currentStreak >= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
            {stats.currentStreak}
          </span>
        </div>
        
        {/* Best Streak */}
        {stats.maxStreak > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🏆</span>
            <span className="font-bold text-amber-400">
              {stats.maxStreak}
            </span>
          </div>
        )}
        
        {/* Live Time */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <span className="text-lg">⏱️</span>
          <span className="font-mono tabular-nums">{formatTime(displayTime)}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-4">
      <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Your Score</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Current Streak */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
            stats.currentStreak >= 5 ? 'animate-pulse' : ''
          }`} style={{ backgroundColor: stats.currentStreak >= 3 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(var(--primary-color-rgb), 0.1)' }}>
            🔥
          </div>
          <div>
            <div className={`text-xl font-black ${stats.currentStreak >= 3 ? 'text-amber-400' : 'text-white'}`}>
              {stats.currentStreak}
            </div>
            <div className="text-xs text-gray-500">Streak</div>
          </div>
        </div>
        
        {/* Best Streak */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)' }}>
            🏆
          </div>
          <div>
            <div className="text-xl font-black text-amber-400">
              {stats.maxStreak}
            </div>
            <div className="text-xs text-gray-500">Best</div>
          </div>
        </div>
        
        {/* Live Time - Full width */}
        <div className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-xl bg-gray-800/50">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)' }}>
            ⏱️
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-white font-mono tabular-nums">{formatTime(displayTime)}</div>
            <div className="text-xs text-gray-500">Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;

