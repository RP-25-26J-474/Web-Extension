import { useState, useEffect } from 'react';
import { useGame } from '../../../context/GameContext';
import { useTheme } from '../../../context/ThemeContext';
import useStore from '../../../state/store';
import { ISHIHARA_PLATES, analyzeColorBlindness } from '../../../utils/colorBlindnessAnalysis';
import { saveVisionResults } from '../../../utils/api';
import auraIntegration from '../../../utils/auraIntegration';
import { Palette, EyeOff, ChevronRight, CheckCircle } from 'lucide-react';

// Import Ishihara plate images
import ishihara1 from '../../../resources/Ishihara_1.jpg';
import ishihara3 from '../../../resources/Ishihara_3.jpg';
import ishihara11 from '../../../resources/Ishihara_11.jpg';
import ishihara19 from '../../../resources/Ishihara_19.jpg';

const imageMap = {
  'ishihara_1.jpg': ishihara1,
  'ishihara_3.jpg': ishihara3,
  'ishihara_11.jpg': ishihara11,
  'ishihara_19.jpg': ishihara19,
  'Ishihara_1.jpg': ishihara1,
  'Ishihara_3.jpg': ishihara3,
  'Ishihara_11.jpg': ishihara11,
  'Ishihara_19.jpg': ishihara19,
};

const ColorChallenge = () => {
  const { completeChallenge, recordCorrectAnswer, recordIncorrectAnswer, state, updateChallengeProgress } = useGame();
  const { isDark } = useTheme();
  const { recordColorBlindnessResponse, completeColorBlindnessTest } = useStore();
  
  const savedProgress = state.challengeProgress?.colorBlindness || {};
  
  const [currentPlateIndex, setCurrentPlateIndex] = useState(savedProgress.currentPlate || 0);
  const [userAnswer, setUserAnswer] = useState('');
  const [plateStartTime, setPlateStartTime] = useState(Date.now());
  const [plates, setPlates] = useState(savedProgress.plates || []);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const currentPlate = ISHIHARA_PLATES[currentPlateIndex];
  const isLastPlate = currentPlateIndex === ISHIHARA_PLATES.length - 1;
  
  useEffect(() => {
    if (currentPlateIndex > 0 || plates.length > 0) {
      updateChallengeProgress('colorBlindness', {
        currentPlate: currentPlateIndex,
        plates,
      });
    }
  }, [currentPlateIndex, plates, updateChallengeProgress]);
  
  useEffect(() => {
    if (currentPlate) {
      setPlateStartTime(Date.now());
    }
  }, [currentPlateIndex, currentPlate]);
  
  const handleInputChange = (e) => {
    setUserAnswer(e.target.value);
  };
  
  const handleNothingClick = () => {
    setUserAnswer('nothing');
  };
  
  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    
    const responseTime = Date.now() - plateStartTime;
    const plateData = {
      plateId: currentPlate.plateId,
      imageName: currentPlate.imageName,
      userAnswer: userAnswer.trim(),
      responseTime,
    };
    
    const normalAnswer = String(currentPlate.normalAnswer).toLowerCase();
    const isCorrect = userAnswer.trim().toLowerCase() === normalAnswer;
    
    if (isCorrect) {
      recordCorrectAnswer(responseTime);
    } else {
      recordIncorrectAnswer(responseTime);
    }
    
    recordColorBlindnessResponse(plateData);
    
    const newPlates = [...plates, plateData];
    setPlates(newPlates);
    
    if (isLastPlate) {
      completeColorBlindnessTest();
      const analysis = analyzeColorBlindness(newPlates);
      
      try {
        const userId = state.userId || auraIntegration.getUserId();
        await saveVisionResults({
          userId,
          colorBlindness: {
            plates: newPlates,
            ...analysis,
          },
        });
        
        if (auraIntegration.isEnabled()) {
          await auraIntegration.saveVisionResults({
            plates: newPlates,
            ...analysis,
          }, null, {
            device: navigator.userAgent,
          });
        }
      } catch (error) {
        console.error('Failed to save results:', error);
      }
      
      updateChallengeProgress('colorBlindness', { currentPlate: 0, plates: [] });
      await completeChallenge('color-blindness', analysis);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPlateIndex(prev => prev + 1);
        setUserAnswer('');
        setIsAnimating(false);
      }, 200);
    }
  };
  
  return (
    <div className={`transition-all duration-200 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
          style={{ 
            backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
          }}
        >
          <Palette className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
            Pattern {currentPlateIndex + 1} of {ISHIHARA_PLATES.length}
          </span>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Calibrating the Light Colors
        </h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          The lighthouse prism is misaligned. Which signal pattern do you see?
        </p>
      </div>
      
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {ISHIHARA_PLATES.map((_, index) => (
          <div
            key={index}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              index < currentPlateIndex ? 'scale-100' : index === currentPlateIndex ? 'scale-125' : 'scale-75 opacity-50'
            }`}
            style={{ 
              backgroundColor: index <= currentPlateIndex ? 'var(--primary-color)' : 'var(--border-secondary)',
              boxShadow: index === currentPlateIndex ? '0 0 8px var(--primary-color-glow)' : 'none'
            }}
          />
        ))}
      </div>
      
      {/* Image Container */}
      <div 
        className="rounded-2xl p-6 mb-6 flex justify-center items-center min-h-[300px] transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--bg-stage)',
          border: '1px solid var(--border-primary)'
        }}
      >
        <div className="relative">
          <div 
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(var(--primary-color-rgb), 0.15) 0%, transparent 70%)',
              transform: 'scale(1.2)',
              filter: 'blur(20px)'
            }}
          />
          <img
            src={imageMap[currentPlate.imageName]}
            alt={`Light pattern ${currentPlate.plateId}`}
            className="w-56 h-56 sm:w-72 sm:h-72 rounded-full object-cover shadow-2xl relative z-10"
            style={{ 
              boxShadow: 'var(--shadow-xl)',
              border: '3px solid var(--border-primary)'
            }}
          />
        </div>
      </div>
      
      {/* Input Section */}
      <div className="space-y-4">
        <div className="text-center mb-2">
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Enter the signal number you see in the pattern
          </span>
        </div>
        
        <input
          type="text"
          value={userAnswer}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full px-4 py-4 rounded-xl text-center text-2xl transition-all duration-300 focus:outline-none"
          style={{ 
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '2px solid var(--border-secondary)'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--primary-color)';
            e.target.style.boxShadow = '0 0 0 3px rgba(var(--primary-color-rgb), 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-secondary)';
            e.target.style.boxShadow = 'none';
          }}
          placeholder="Enter signal number"
          autoFocus
        />
        
        <div className="flex gap-3">
          <button
            onClick={handleNothingClick}
            className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2"
            style={{ 
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-secondary)'
            }}
          >
            <EyeOff className="w-4 h-4" />
            No Signal Visible
          </button>
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] flex items-center justify-center gap-2"
            style={{ 
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
              boxShadow: '0 4px 20px var(--primary-color-glow)'
            }}
          >
            {isLastPlate ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Complete
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorChallenge;
