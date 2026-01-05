import { useGame, CHALLENGE_ORDER, PROFILE_TRAITS } from '../../context/GameContext';

const CHALLENGE_INFO = {
  'color-blindness': { name: 'Color Test', shortName: 'Color', icon: '🎨' },
  'visual-acuity': { name: 'Acuity Test', shortName: 'Acuity', icon: '👁️' },
  'motor-skills': { name: 'Reflex Game', shortName: 'Reflex', icon: '🎯' },
  'knowledge-quiz': { name: 'Tech Quiz', shortName: 'Quiz', icon: '💡' },
};

const JourneyProgress = ({ minimal = false }) => {
  const { state, progress } = useGame();
  const challenges = CHALLENGE_ORDER.filter(c => c !== 'intro' && c !== 'profile-complete');
  
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
                  backgroundColor: isComplete || isCurrent ? 'var(--primary-color)' : '#374151',
                  boxShadow: isComplete ? '0 0 8px var(--primary-color-glow)' : 'none'
                }}
              />
            );
          })}
        </div>
        <span className="text-xs text-gray-500">
          {progress.current}/4
        </span>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
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
            const info = CHALLENGE_INFO[challenge];
            
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
                    backgroundColor: isComplete || isCurrent ? 'var(--primary-color)' : '#1f2937',
                    borderColor: isComplete || isCurrent ? 'var(--primary-color)' : '#374151',
                    boxShadow: isCurrent ? '0 0 12px var(--primary-color-glow)' : 'none'
                  }}
                >
                  {isComplete && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                
                {/* Label */}
                <span className={`text-xs mt-2 font-medium transition-all duration-300 ${
                  isComplete || isCurrent ? 'text-white' : 'text-gray-600'
                }`}>
                  {info?.shortName}
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

