import { useEffect, useState, useRef } from 'react';
import { useGame, PROFILE_TRAITS } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import useDeviceInfo from '../../hooks/useDeviceInfo';
import auraIntegration from '../../utils/auraIntegration';
import { buildAndSaveImpairmentProfile } from '../../utils/impairmentProfile';
import { Flame, Clock, Palette, Focus, CloudFog, Zap, Sparkles, RotateCcw, Award, Check } from 'lucide-react';
import logo from '../../resources/logo.png';

// Map trait IDs to Lucide icons
const getTraitIcon = (traitId) => {
  switch (traitId) {
    case 'prism':
      return <Palette className="w-5 h-5" />;
    case 'beam':
      return <Focus className="w-5 h-5" />;
    case 'fog':
      return <CloudFog className="w-5 h-5" />;
    case 'control':
      return <Zap className="w-5 h-5" />;
    default:
      return <Sparkles className="w-5 h-5" />;
  }
};

const FinalProfile = () => {
  const { state, elapsedTime, resetGame } = useGame();
  const { isDark } = useTheme();
  const deviceInfo = useDeviceInfo();
  const [showContent, setShowContent] = useState(false);
  const [celebratePhase, setCelebratePhase] = useState(0);
  const [profileSaved, setProfileSaved] = useState(false);
  const saveAttemptedRef = useRef(false);
  
  useEffect(() => {
    const saveData = async () => {
      if (saveAttemptedRef.current) return;
      
      const userId = state.userId || auraIntegration.getUserId();
      
      if (!userId) return;
      
      const os = deviceInfo.device?.os;
      const browser = deviceInfo.device?.browser;
      
      if (!os || os === 'unknown' || !browser || browser === 'unknown') return;
      
      saveAttemptedRef.current = true;
      
      try {
        await buildAndSaveImpairmentProfile({
          userId,
          challengeResults: state.challengeResults,
          stats: state.stats,
          deviceInfo: {
            os: os,
            browser: browser,
            screenWidth: deviceInfo.screen?.width || window.screen.width,
            screenHeight: deviceInfo.screen?.height || window.screen.height,
            devicePixelRatio: deviceInfo.screen?.dpr || window.devicePixelRatio || 1,
          },
        });
        
        if (auraIntegration.isEnabled()) {
          await auraIntegration.completeOnboarding();
        }
        
        setProfileSaved(true);
      } catch (error) {
        console.error('Failed to save profile:', error);
      }
    };
    
    saveData();
  }, [state.challengeResults, state.stats, state.userId, deviceInfo]);
  
  useEffect(() => {
    setTimeout(() => setShowContent(true), 300);
    setTimeout(() => setCelebratePhase(1), 800);
    setTimeout(() => setCelebratePhase(2), 1500);
  }, []);
  
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const { stats } = state;
  
  const getPlayerTitle = () => {
    if (stats.maxStreak >= 15) return { title: 'Ultimate Champion', color: '#fbbf24' };
    if (stats.maxStreak >= 10) return { title: 'Streak Legend', color: '#f97316' };
    if (stats.maxStreak >= 7) return { title: 'Lighthouse Master', color: 'var(--primary-color)' };
    if (stats.maxStreak >= 5) return { title: 'Rising Star', color: 'var(--primary-color)' };
    if (stats.maxStreak >= 3) return { title: 'Quick Learner', color: 'var(--primary-color)' };
    return { title: 'Beacon Guardian', color: 'var(--primary-color)' };
  };
  
  const playerTitle = getPlayerTitle();
  
  const handlePlayAgain = () => {
    resetGame();
  };
  
  return (
    <div 
      className={`min-h-screen relative overflow-hidden flex items-center justify-center p-4 transition-all duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'var(--gradient-bg)' }}
    >
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      
      {/* Celebration particles */}
      {celebratePhase >= 1 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                backgroundColor: ['var(--primary-color)', '#fbbf24', '#3b82f6', '#ec4899'][Math.floor(Math.random() * 4)],
                animation: `fall ${2 + Math.random() * 3}s linear ${Math.random() * 1}s forwards`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )}
      
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" 
          style={{ backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.1 : 0.12})` }} 
        />
        <div 
          className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse" 
          style={{ backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.08 : 0.1})`, animationDelay: '1s' }} 
        />
      </div>
      
      <div className="relative z-10 max-w-2xl w-full">
        {/* Victory Header */}
        <div className={`text-center mb-8 transition-all duration-700 ${celebratePhase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="relative inline-block mb-6">
            <div 
              className="w-28 h-28 rounded-full flex items-center justify-center shadow-2xl mx-auto"
              style={{ 
                background: `linear-gradient(135deg, ${playerTitle.color} 0%, ${playerTitle.color}99 100%)`,
                boxShadow: `0 10px 40px ${playerTitle.color}40`
              }}
            >
              <Award className="w-14 h-14 text-white" />
            </div>
            {celebratePhase >= 2 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-36 h-36 rounded-full animate-ping" style={{ border: `2px solid ${playerTitle.color}`, opacity: 0.3, animationDuration: '2s' }} />
              </div>
            )}
          </div>
          
          <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
            The Lighthouse Stands Restored!
          </h1>
          <p className="text-xl font-semibold mb-3" style={{ color: playerTitle.color }}>{playerTitle.title}</p>
        </div>
        
        {/* Main Card */}
        <div 
          className={`backdrop-blur-xl rounded-3xl p-6 sm:p-8 mb-6 transition-all duration-700 delay-200 ${celebratePhase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ 
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-xl)'
          }}
        >
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div 
              className="text-center p-5 rounded-xl transition-colors duration-300"
              style={{ backgroundColor: 'var(--bg-input)' }}
            >
              <div className="flex items-center justify-center gap-2 text-4xl font-black" style={{ color: '#f59e0b' }}>
                {stats.maxStreak}
                <Flame className="w-8 h-8" />
              </div>
              <div className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>Best Streak</div>
            </div>
            <div 
              className="text-center p-5 rounded-xl transition-colors duration-300"
              style={{ backgroundColor: 'var(--bg-input)' }}
            >
              <div className="flex items-center justify-center gap-2 text-4xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                <Clock className="w-8 h-8" style={{ color: 'var(--primary-color)' }} />
                {formatTime(elapsedTime)}
              </div>
              <div className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>Total Time</div>
            </div>
          </div>
          
          {/* Skills Unlocked */}
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
            Systems Restored
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {Object.values(PROFILE_TRAITS).map((trait, index) => (
              <div
                key={trait.id}
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-500"
                style={{ 
                  backgroundColor: 'var(--bg-input)',
                  borderLeft: '3px solid var(--primary-color)',
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'rgba(var(--primary-color-rgb), 0.15)',
                    color: 'var(--primary-color)'
                  }}
                >
                  {getTraitIcon(trait.id)}
                </div>
                <div>
                  <div className="font-semibold text-sm flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                    {trait.name}
                    <Check className="w-3 h-3" style={{ color: 'var(--primary-color)' }} />
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{trait.description}</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Fun fact based on streak */}
          <div 
            className="p-4 rounded-xl text-center mb-6"
            style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)' }}
          >
            <p className="text-sm" style={{ color: 'var(--primary-color)' }}>
              {stats.maxStreak >= 10 
                ? 'Incredible streak! You\'re on fire!' 
                : stats.maxStreak >= 5
                  ? 'Nice streak! You\'ve got quick reflexes!'
                  : 'Great effort! Practice makes perfect.'}
            </p>
          </div>
        </div>
        
        
        {/* Footer */}
        <div className="text-center mt-6">
          <div 
            className="p-4 rounded-xl mb-4 text-left"
            style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.08)' }}
          >
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              ✅ You have been successfully registered and logged in.
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You can now close this tab and return to the AURA extension.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={logo} alt="Logo" className="w-5 h-5" />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Powered by <span style={{ color: 'var(--primary-color)' }}>AURA</span>
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Thanks for playing!
          </p>
        </div>
      </div>
      
      {/* CSS for confetti */}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default FinalProfile;
