import { useGame } from '../../context/GameContext';
import JourneyProgress from './JourneyProgress';
import StatsPanel from './StatsPanel';
import ProfileBuilder from './ProfileBuilder';
import TransitionOverlay from './TransitionOverlay';
import IntroScreen from './IntroScreen';
import FinalProfile from './FinalProfile';
import ColorChallenge from './challenges/ColorChallenge';
import AcuityChallenge from './challenges/AcuityChallenge';
import MotorChallenge from './challenges/MotorChallenge';
import QuizChallenge from './challenges/QuizChallenge';
import logo from '../../resources/logo.png';

const GameFlow = () => {
  const { state, progress } = useGame();
  
  // Show intro screen
  if (state.currentPhase === 'intro') {
    return <IntroScreen />;
  }
  
  // Show final profile
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-10">
          <path d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z" fill="url(#swooshGradient)" />
          <defs>
            <linearGradient id="swooshGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.06)' }} />
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.04)', animationDelay: '1s' }} />
      </div>
      
      {/* Transition Overlay */}
      <TransitionOverlay />
      
      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 bg-gray-950/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src={logo} alt="AURA" className="w-8 h-8" />
              <div>
                <span className="font-bold text-white">AURA</span>
                <span className="text-xs text-gray-500 ml-2 hidden sm:inline">Digital Profile</span>
              </div>
            </div>
            
            {/* Progress */}
            <div className="flex items-center gap-4">
              <JourneyProgress minimal />
              <div className="hidden sm:block">
                <StatsPanel compact />
              </div>
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
            <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl mb-6 lg:mb-0">
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
            <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-4">
              <ProfileBuilder />
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 text-center py-4 border-t border-gray-800/50">
        <p className="text-xs text-gray-600">
          Game {progress.current + 1} of 4 • Auto-saved 💾
        </p>
      </footer>
    </div>
  );
};

export default GameFlow;

