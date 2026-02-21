import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import auraIntegration from '../../utils/auraIntegration';
import logo from '../../resources/logo.png';

const IntroScreen = () => {
  const { startGame, setUserId, state } = useGame();
  const { isDark } = useTheme();
  const [isStarting, setIsStarting] = useState(false);
  
  // Load userId from AURA integration if not already set
  useEffect(() => {
    if (!state.userId) {
      const userId = auraIntegration.getUserId();
      if (userId) {
        setUserId(userId);
      }
    }
  }, [state.userId, setUserId]);
  
  const handleStart = () => {
    setIsStarting(true);
    setTimeout(() => {
      startGame();
    }, 300);
  };
  
  return (
    <div 
      className={`min-h-screen relative overflow-hidden flex items-center justify-center p-4 transition-all duration-300 ${isStarting ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'var(--gradient-bg)' }}
    >
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" 
          style={{ backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.08 : 0.1})` }} 
        />
        <div 
          className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse" 
          style={{ backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.06 : 0.08})`, animationDelay: '1s' }} 
        />
        
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-bounce"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              backgroundColor: 'var(--primary-color)',
              opacity: isDark ? 0.2 : 0.3,
              animationDelay: `${i * 0.3}s`,
              animationDuration: '3s'
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 max-w-2xl w-full">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-6">
            <img src={logo} alt="AURA" className="w-16 h-16 object-contain" />
            <div className="text-left">
              <h1 className="text-4xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>AURA</h1>
              <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--primary-color)' }}>Mind Games</p>
            </div>
          </div>
          
          {state.userId ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Welcome, <span style={{ color: 'var(--primary-color)' }}>Player</span>!
              </h2>
              <p style={{ color: 'var(--text-secondary)' }} className="max-w-lg mx-auto leading-relaxed">
                Ready for another round? Four quick brain games await!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Ready to Challenge Yourself?
              </h2>
              <p style={{ color: 'var(--text-secondary)' }} className="max-w-lg mx-auto leading-relaxed">
                Four quick brain games await! Spot hidden patterns, test your focus, 
                pop bubbles at lightning speed, and prove your digital smarts.
              </p>
            </>
          )}
        </div>
        
        {/* Game preview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: '🎨', name: 'Pattern Hunt', desc: 'Find hidden numbers' },
            { icon: '🦅', name: 'Eagle Eye', desc: 'Shrinking challenge' },
            { icon: '🎯', name: 'Bubble Pop', desc: 'Speed & precision' },
            { icon: '🧠', name: 'Quick Think', desc: 'Digital trivia' },
          ].map((game, index) => (
            <div 
              key={game.name}
              className="p-4 rounded-xl text-center transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                animationDelay: `${index * 100}ms`
              }}
            >
              <div className="text-3xl mb-2">{game.icon}</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{game.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{game.desc}</div>
            </div>
          ))}
        </div>
        
        {/* What to expect */}
        <div 
          className="rounded-2xl p-6 mb-8 transition-colors duration-300"
          style={{ 
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)'
          }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>How It Works</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: '🎮', title: 'Play 4 Mini-Games', desc: 'Quick, fun challenges that take seconds each' },
              { icon: '🔥', title: 'Build Your Streak', desc: 'Chain correct answers for bonus points' },
              { icon: '⚡', title: 'Unlock Skills', desc: 'Earn cool badges as you complete games' },
              { icon: '🏆', title: 'See Your Results', desc: 'Get your personalized player profile' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="text-xl">{item.icon}</div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Time estimate */}
        <div className="text-center mb-6">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-colors duration-300"
            style={{ 
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-secondary)'
            }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Only <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>5 minutes</span> to play
            </span>
          </div>
        </div>
        
        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-5 px-8 rounded-xl font-bold text-lg text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg group"
          style={{ 
            background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
            boxShadow: '0 8px 30px var(--primary-color-glow)'
          }}
        >
          <span className="flex items-center justify-center gap-2">
            Let's Play!
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </button>
        
        {/* Privacy note - subtle */}
        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Your gameplay helps improve our games. All data is anonymous.
        </p>
      </div>
    </div>
  );
};

export default IntroScreen;


