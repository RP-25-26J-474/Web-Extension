import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useGame, GAME_TRANSITION_SHOW_MS } from '../../context/GameContext';
import { Palette, Focus, CloudFog, Zap, ChevronRight, Sparkles } from 'lucide-react';

// Lighthouse systems with icons
const LIGHTHOUSE_SYSTEMS = [
  { id: 'color-blindness', name: 'Calibrate Colors', Icon: Palette, shortName: 'Prism' },
  { id: 'visual-acuity', name: 'Focus Beam', Icon: Focus, shortName: 'Beam' },
  { id: 'motor-skills', name: 'Clear Fog', Icon: CloudFog, shortName: 'Pathway' },
  { id: 'knowledge-quiz', name: 'Restore Control', Icon: Zap, shortName: 'Control' },
];

const TRANSITION_ENTER_DELAY_MS = 60;
const OVERLAY_PARTICLE_COUNT = 12;

// Map trait IDs to icons
const getTraitIcon = (traitId) => {
  switch (traitId) {
    case 'prism':
      return Palette;
    case 'beam':
      return Focus;
    case 'fog':
      return CloudFog;
    case 'control':
      return Zap;
    default:
      return Sparkles;
  }
};

const TransitionOverlay = () => {
  const { state } = useGame();
  const [animationPhase, setAnimationPhase] = useState('entering');
  const timerRefs = useRef([]);
  const particles = useMemo(
    () => Array.from({ length: OVERLAY_PARTICLE_COUNT }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random()}s`,
      duration: `${1 + Math.random() * 0.6}s`,
    })),
    [state.showingTransition]
  );
  
  useEffect(() => {
    if (state.showingTransition) {
      setAnimationPhase('entering');
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [
        setTimeout(() => setAnimationPhase('showing'), TRANSITION_ENTER_DELAY_MS),
        setTimeout(() => setAnimationPhase('exiting'), GAME_TRANSITION_SHOW_MS),
      ];
    }

    return () => {
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
    };
  }, [state.showingTransition]);

  const handleKeyDown = useCallback((e) => {
    if (state.showingTransition && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [state.showingTransition]);

  useEffect(() => {
    if (!state.showingTransition) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [state.showingTransition, handleKeyDown]);
  
  if (!state.showingTransition) return null;
  
  const latestTrait = state.unlockedTraits[state.unlockedTraits.length - 1];
  const TraitIcon = latestTrait ? getTraitIcon(latestTrait.id) : Sparkles;
  
  const completedCount = state.completedChallenges.length;
  const nextSystem = completedCount < LIGHTHOUSE_SYSTEMS.length ? LIGHTHOUSE_SYSTEMS[completedCount] : null;
  const isLighthouseComplete = completedCount >= LIGHTHOUSE_SYSTEMS.length;
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        animationPhase === 'entering' ? 'opacity-0' : 
        animationPhase === 'exiting' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              left: particle.left,
              top: particle.top,
              backgroundColor: 'var(--primary-color)',
              opacity: 0.3,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>
      
      {/* Central content */}
      <div className={`text-center transform transition-all duration-500 ${
        animationPhase === 'showing' ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'
      }`}>
        {/* Trait icon with glow */}
        {latestTrait && (
          <div className="relative mb-6">
            <div 
              className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center shadow-2xl"
              style={{ 
                backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)',
                border: '2px solid var(--primary-color)',
                boxShadow: '0 0 60px var(--primary-color-glow)'
              }}
            >
              <TraitIcon className="w-12 h-12" style={{ color: 'var(--primary-color)' }} />
            </div>
            
            {/* Pulsing rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-32 h-32 rounded-2xl animate-ping"
                style={{ 
                  border: '2px solid var(--primary-color)',
                  opacity: 0.3,
                  animationDuration: '1s'
                }}
              />
            </div>
          </div>
        )}
        
        {/* Text */}
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest" style={{ color: 'var(--primary-color)' }}>
            System Restored
          </p>
          <h2 className="text-3xl font-black text-white">
            {state.transitionMessage}
          </h2>
          {latestTrait && (
            <p className="text-gray-400 max-w-xs mx-auto">
              {latestTrait.description}
            </p>
          )}
        </div>
        
        {/* Next Level Indicator */}
        <div className={`mt-6 transition-all duration-500 delay-300 ${
          animationPhase === 'showing' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}>
          {nextSystem ? (
            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gray-800/80 border border-gray-700">
              <span className="text-gray-400 text-sm">Next up:</span>
              <nextSystem.Icon className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />
              <span className="text-white font-semibold">{nextSystem.name}</span>
              <ChevronRight className="w-4 h-4 text-gray-500 animate-pulse" />
            </div>
          ) : isLighthouseComplete ? (
            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-semibold">Final Results Incoming!</span>
            </div>
          ) : null}
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {LIGHTHOUSE_SYSTEMS.map((system) => {
            const isComplete = state.completedChallenges.includes(system.id);
            return (
              <div
                key={system.id}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  isComplete ? 'scale-100' : 'scale-75 opacity-30'
                }`}
                style={{ 
                  backgroundColor: isComplete ? 'var(--primary-color)' : '#374151',
                  boxShadow: isComplete ? '0 0 10px var(--primary-color-glow)' : 'none'
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TransitionOverlay;
