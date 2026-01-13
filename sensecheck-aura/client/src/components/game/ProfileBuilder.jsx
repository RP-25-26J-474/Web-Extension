import { useGame, PROFILE_TRAITS } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import { Lightbulb, Palette, Focus, CloudFog, Zap, Check, Lock } from 'lucide-react';

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
      return <Lightbulb className="w-5 h-5" />;
  }
};

const ProfileBuilder = ({ expanded = false }) => {
  const { state } = useGame();
  const { isDark } = useTheme();
  const allTraits = Object.values(PROFILE_TRAITS);
  
  if (!expanded) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Systems:</span>
        <div className="flex gap-1">
          {allTraits.map((trait) => {
            const isUnlocked = state.unlockedTraits.some(t => t.id === trait.id);
            return (
              <div
                key={trait.id}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${
                  isUnlocked ? 'scale-100' : 'scale-75 opacity-30'
                }`}
                style={{ 
                  backgroundColor: isUnlocked ? 'rgba(var(--primary-color-rgb), 0.2)' : 'var(--bg-input)',
                  border: isUnlocked ? '1px solid var(--primary-color)' : '1px solid transparent',
                  color: isUnlocked ? 'var(--primary-color)' : 'var(--text-muted)'
                }}
                title={trait.name}
              >
                {getTraitIcon(trait.id)}
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
        <Lightbulb className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />
        Lighthouse Systems
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
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    isUnlocked ? '' : 'grayscale'
                  }`}
                  style={{ 
                    backgroundColor: isUnlocked ? 'rgba(var(--primary-color-rgb), 0.15)' : 'var(--bg-input)',
                    color: isUnlocked ? 'var(--primary-color)' : 'var(--text-muted)'
                  }}
                >
                  {getTraitIcon(trait.id)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{trait.name}</h4>
                    {isUnlocked && (
                      <Check className="w-4 h-4" style={{ color: 'var(--primary-color)' }} />
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{trait.description}</p>
                  
                  {isUnlocked && result && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--primary-color)' }}>
                      {getResultSummary(trait.id, result)}
                    </div>
                  )}
                </div>
                
                {!isUnlocked && (
                  <Lock className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Progress indicator */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div className="flex justify-between text-sm mb-2">
          <span style={{ color: 'var(--text-tertiary)' }}>Systems Online</span>
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

function getResultKeyForTrait(traitId) {
  const map = {
    'prism': 'colorBlindness',
    'beam': 'visualAcuity',
    'fog': 'motorSkills',
    'control': 'knowledgeQuiz',
  };
  return map[traitId];
}

function getResultSummary(traitId, result) {
  switch (traitId) {
    case 'prism':
      return '✓ Colors calibrated';
    case 'beam':
      if (result?.finalLevel) {
        return `Focus level ${result.finalLevel} achieved`;
      }
      return '✓ Beam focused';
    case 'fog':
      return result?.accuracy ? `${result.accuracy}% fog cleared` : '✓ Pathway clear';
    case 'control':
      return result?.score ? `${result.score}% systems online` : '✓ Control restored';
    default:
      return '✓ System online';
  }
}

export default ProfileBuilder;
