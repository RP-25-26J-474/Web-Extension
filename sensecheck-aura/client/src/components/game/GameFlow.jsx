import { useGame } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import JourneyProgress from './JourneyProgress';
import StatsPanel from './StatsPanel';
import ProfileBuilder from './ProfileBuilder';
import TransitionOverlay from './TransitionOverlay';
import FinalProfile from './FinalProfile';
import IntroScreen from './IntroScreen';
import ColorChallenge from './challenges/ColorChallenge';
import AcuityChallenge from './challenges/AcuityChallenge';
import MotorChallenge from './challenges/MotorChallenge';
import QuizChallenge from './challenges/QuizChallenge';
import logo from '../../resources/logo.png';
import { Save } from 'lucide-react';

// Lighthouse system names for header display
const SYSTEM_NAMES = {
  'color-blindness': 'Calibrating Light Colors',
  'visual-acuity': 'Focusing the Beam',
  'motor-skills': 'Clearing the Fog',
  'knowledge-quiz': 'Restoring Control Panel',
};

const GameFlow = () => {
  const { state, progress } = useGame();
  const { isDark } = useTheme();
  
  // Show story intro screen first
  if (state.currentPhase === 'intro') {
    return <IntroScreen />;
  }
  
  // Show final profile (Lighthouse activated)
  if (state.currentPhase === 'profile-complete') {
    return <FinalProfile />;
  }
  
  // Get current challenge component
  const getChallengeComponent = () => {
    switch (state.currentPhase) {
      case 'color-blindness':
        return <ColorChallenge />;
      case 'visual-acuity':
        return <AcuityChallenge />;
      case 'motor-skills':
        return <MotorChallenge />;
      case 'knowledge-quiz':
        return <QuizChallenge />;
      default:
        return null;
    }
  };
  
  const currentSystemName = SYSTEM_NAMES[state.currentPhase] || 'Lighthouse Systems';
  
  return (
    <div 
      className="min-h-screen relative overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--gradient-bg)' }}
    >
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" 
          style={{ backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.06 : 0.08})` }} 
        />
        <div 
          className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse" 
          style={{ backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.04 : 0.06})`, animationDelay: '1s' }} 
        />
      </div>
      
      {/* Transition Overlay */}
      <TransitionOverlay />
      
      {/* Header */}
      <header 
        className="relative z-10 backdrop-blur-xl transition-colors duration-300"
        style={{ 
          borderBottom: '1px solid var(--border-primary)',
          background: isDark ? 'rgba(10, 20, 40, 0.7)' : 'rgba(255, 255, 255, 0.9)'
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo / Current System */}
            <div className="flex items-center gap-3">
              <img src={logo} alt="Lighthouse" className="w-9 h-9 object-contain" />
              <div>
                <span 
                  className="font-bold text-sm"
                  style={{ color: 'var(--primary-color)' }}
                >
                  The Lighthouse of Clarity
                </span>
                <span 
                  className="text-xs ml-2 hidden sm:inline"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {currentSystemName}
                </span>
              </div>
            </div>
            
            {/* Progress & Theme Toggle */}
            <div className="flex items-center gap-4">
              <JourneyProgress minimal />
              <div className="hidden sm:block">
                <StatsPanel compact />
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="relative z-10 px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Desktop Layout: Challenge + Sidebar */}
          <div className="lg:grid lg:grid-cols-[1fr,280px] lg:gap-6">
            {/* Challenge Area */}
            <div 
              className="backdrop-blur-xl rounded-2xl p-5 sm:p-6 mb-6 lg:mb-0 transition-colors duration-300"
              style={{ 
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              {getChallengeComponent()}
            </div>
            
            {/* Sidebar - Hidden on mobile */}
            <div className="hidden lg:block space-y-4">
              {/* Stats Panel */}
              <StatsPanel />
              
              {/* Profile Builder */}
              <ProfileBuilder expanded />
            </div>
          </div>
          
          {/* Mobile Stats - Shown only on mobile */}
          <div className="lg:hidden mt-6">
            <div 
              className="backdrop-blur-xl rounded-2xl p-4 transition-colors duration-300"
              style={{ 
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)'
              }}
            >
              <ProfileBuilder />
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer 
        className="relative z-10 text-center py-4 transition-colors duration-300"
        style={{ borderTop: '1px solid var(--border-primary)' }}
      >
        <p 
          className="text-xs flex items-center justify-center gap-1"
          style={{ color: 'var(--text-muted)' }}
        >
          System {progress.current + 1} of 4 • Auto-saved <Save className="w-3 h-3" />
        </p>
      </footer>
    </div>
  );
};

export default GameFlow;
