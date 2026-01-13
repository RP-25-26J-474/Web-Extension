import { useGame, CHALLENGE_ORDER, PROFILE_TRAITS } from '../../context/GameContext';
import { Palette, Focus, CloudFog, Zap, Check } from 'lucide-react';

// Lighthouse system info with Lucide icons
const LIGHTHOUSE_SYSTEMS = {
  'color-blindness': { name: 'Prism', shortName: 'Prism', Icon: Palette },
  'visual-acuity': { name: 'Beam', shortName: 'Beam', Icon: Focus },
  'motor-skills': { name: 'Pathway', shortName: 'Path', Icon: CloudFog },
  'knowledge-quiz': { name: 'Control', shortName: 'Ctrl', Icon: Zap },
};

const JourneyProgress = ({ minimal = false }) => {
  const { state, progress } = useGame();
  const challenges = CHALLENGE_ORDER.filter(c => c !== 'profile-complete');
  
  if (minimal) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {challenges.map((challenge) => {
            const isComplete = state.completedChallenges.includes(challenge);
            const isCurrent = state.currentPhase === challenge;
            
            return (
              <div 
                key={challenge}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  isComplete 
                    ? 'scale-100' 
                    : isCurrent 
                      ? 'scale-110 animate-pulse' 
                      : 'scale-90 opacity-50'
                }`}
                style={{ 
                  backgroundColor: isComplete || isCurrent ? 'var(--primary-color)' : 'var(--border-secondary)',
                  boxShadow: isComplete ? '0 0 8px var(--primary-color-glow)' : 'none'
                }}
              />
            );
          })}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {progress.current}/4
        </span>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ 
              width: `${progress.percentage}%`,
              background: 'linear-gradient(90deg, var(--primary-color-dark) 0%, var(--primary-color) 50%, var(--primary-color-light) 100%)'
            }}
          />
        </div>
        
        {/* Checkpoint dots */}
        <div className="absolute top-1/2 left-0 right-0 flex justify-between -translate-y-1/2 px-0">
          {challenges.map((challenge, index) => {
            const isComplete = state.completedChallenges.includes(challenge);
            const isCurrent = state.currentPhase === challenge;
            const system = LIGHTHOUSE_SYSTEMS[challenge];
            
            return (
              <div 
                key={challenge}
                className="relative flex flex-col items-center"
                style={{ left: `${(index / (challenges.length - 1)) * 100}%` }}
              >
                {/* Dot */}
                <div 
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isCurrent ? 'scale-125' : ''
                  }`}
                  style={{ 
                    backgroundColor: isComplete || isCurrent ? 'var(--primary-color)' : 'var(--bg-primary)',
                    borderColor: isComplete || isCurrent ? 'var(--primary-color)' : 'var(--border-secondary)',
                    boxShadow: isCurrent ? '0 0 12px var(--primary-color-glow)' : 'none'
                  }}
                >
                  {isComplete && (
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                  )}
                </div>
                
                {/* Label */}
                <span className={`text-xs mt-2 font-medium transition-all duration-300`}
                  style={{ color: isComplete || isCurrent ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {system?.shortName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default JourneyProgress;
