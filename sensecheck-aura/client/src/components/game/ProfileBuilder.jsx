import { useGame, PROFILE_TRAITS } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';

const ProfileBuilder = ({ expanded = false }) => {
  const { state } = useGame();
  const { isDark } = useTheme();
  const allTraits = Object.values(PROFILE_TRAITS);
  
  if (!expanded) {
    // Compact version - just show unlocked trait icons
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Profile:</span>
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
                  backgroundColor: isUnlocked ? 'rgba(var(--primary-color-rgb), 0.2)' : 'var(--bg-input)',
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
    <div 
      className="backdrop-blur-xl rounded-2xl p-5 transition-colors duration-300"
      style={{ 
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)'
      }}
    >
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <span>⚡</span> Skills Unlocked
      </h3>
      
      <div className="space-y-3">
        {allTraits.map((trait) => {
          const isUnlocked = state.unlockedTraits.some(t => t.id === trait.id);
          const result = state.challengeResults[getResultKeyForTrait(trait.id)];
          
          return (
            <div
              key={trait.id}
              className={`p-4 rounded-xl transition-all duration-500 ${!isUnlocked ? 'opacity-50' : ''}`}
              style={{ 
                background: isUnlocked 
                  ? isDark 
                    ? 'linear-gradient(to right, rgba(31, 41, 55, 0.5), rgba(31, 41, 55, 0.3))'
                    : 'linear-gradient(to right, rgba(243, 244, 246, 0.8), rgba(249, 250, 251, 0.5))'
                  : 'var(--bg-input)',
                borderLeft: isUnlocked ? '3px solid var(--primary-color)' : '3px solid transparent'
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-500 ${
                    isUnlocked ? '' : 'grayscale'
                  }`}
                  style={{ 
                    backgroundColor: isUnlocked ? 'rgba(var(--primary-color-rgb), 0.15)' : 'var(--bg-input)'
                  }}
                >
                  {trait.icon}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{trait.name}</h4>
                    {isUnlocked && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{trait.description}</p>
                  
                  {/* Result preview if available */}
                  {isUnlocked && result && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--primary-color)' }}>
                      {getResultSummary(trait.id, result)}
                    </div>
                  )}
                </div>
                
                {!isUnlocked && (
                  <div style={{ color: 'var(--text-muted)' }}>
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
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div className="flex justify-between text-sm mb-2">
          <span style={{ color: 'var(--text-tertiary)' }}>Skills Collected</span>
          <span style={{ color: 'var(--primary-color)' }}>{state.unlockedTraits.length}/4</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
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

