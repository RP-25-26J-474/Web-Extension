import { useGame, PROFILE_TRAITS } from '../../context/GameContext';

const ProfileBuilder = ({ expanded = false }) => {
  const { state } = useGame();
  const allTraits = Object.values(PROFILE_TRAITS);
  
  if (!expanded) {
    // Compact version - just show unlocked trait icons
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Profile:</span>
        <div className="flex gap-1">
          {allTraits.map((trait) => {
            const isUnlocked = state.unlockedTraits.some(t => t.id === trait.id);
            return (
              <div
                key={trait.id}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all duration-500 ${
                  isUnlocked ? 'scale-100' : 'scale-75 opacity-30 grayscale'
                }`}
                style={{ 
                  backgroundColor: isUnlocked ? 'rgba(var(--primary-color-rgb), 0.2)' : 'rgba(55, 65, 81, 0.3)',
                  border: isUnlocked ? '1px solid var(--primary-color)' : '1px solid transparent'
                }}
                title={trait.name}
              >
                {trait.icon}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-5">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>⚡</span> Skills Unlocked
      </h3>
      
      <div className="space-y-3">
        {allTraits.map((trait) => {
          const isUnlocked = state.unlockedTraits.some(t => t.id === trait.id);
          const result = state.challengeResults[getResultKeyForTrait(trait.id)];
          
          return (
            <div
              key={trait.id}
              className={`p-4 rounded-xl transition-all duration-500 ${
                isUnlocked 
                  ? 'bg-gradient-to-r from-gray-800/50 to-gray-800/30' 
                  : 'bg-gray-800/20 opacity-50'
              }`}
              style={{ 
                borderLeft: isUnlocked ? '3px solid var(--primary-color)' : '3px solid transparent'
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-500 ${
                    isUnlocked ? '' : 'grayscale'
                  }`}
                  style={{ 
                    backgroundColor: isUnlocked ? 'rgba(var(--primary-color-rgb), 0.15)' : 'rgba(55, 65, 81, 0.3)'
                  }}
                >
                  {trait.icon}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">{trait.name}</h4>
                    {isUnlocked && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{trait.description}</p>
                  
                  {/* Result preview if available */}
                  {isUnlocked && result && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--primary-color)' }}>
                      {getResultSummary(trait.id, result)}
                    </div>
                  )}
                </div>
                
                {!isUnlocked && (
                  <div className="text-xs text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Progress indicator */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Skills Collected</span>
          <span style={{ color: 'var(--primary-color)' }}>{state.unlockedTraits.length}/4</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-700"
            style={{ 
              width: `${(state.unlockedTraits.length / 4) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--primary-color-light) 100%)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Helper to map trait IDs to result keys
function getResultKeyForTrait(traitId) {
  const map = {
    'perception': 'colorBlindness',
    'clarity': 'visualAcuity',
    'reflexes': 'motorSkills',
    'literacy': 'knowledgeQuiz',
  };
  return map[traitId];
}

// Helper to get result summary text
function getResultSummary(traitId, result) {
  switch (traitId) {
    case 'perception':
      return '✓ Pattern master!';
    case 'clarity':
      if (result?.finalResolvedSize) {
        const level = Math.floor((80 - result.finalResolvedSize) / 10) + 1;
        return `Level ${level} achieved!`;
      }
      return '✓ Unlocked!';
    case 'reflexes':
      return result?.accuracy ? `${result.accuracy}% hit rate!` : '✓ Unlocked!';
    case 'literacy':
      return result?.score?.percentage ? `${result.score.percentage}% correct!` : '✓ Unlocked!';
    default:
      return '✓ Unlocked!';
  }
}

export default ProfileBuilder;

