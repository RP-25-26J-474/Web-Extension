import { useState, useEffect } from 'react';
import { useGame } from '../../../context/GameContext';
import { useTheme } from '../../../context/ThemeContext';
import useStore from '../../../state/store';
import { ISHIHARA_PLATES, analyzeColorBlindness } from '../../../utils/colorBlindnessAnalysis';
import { saveVisionResults } from '../../../utils/api';
import auraIntegration from '../../../utils/auraIntegration';

// Import Ishihara plate images
import ishihara1 from '../../../resources/Ishihara_1.jpg';
import ishihara3 from '../../../resources/Ishihara_3.jpg';
import ishihara11 from '../../../resources/Ishihara_11.jpg';
import ishihara19 from '../../../resources/Ishihara_19.jpg';

const imageMap = {
  'Ishihara_1.jpg': ishihara1,
  'Ishihara_3.jpg': ishihara3,
  'Ishihara_11.jpg': ishihara11,
  'Ishihara_19.jpg': ishihara19,
};

const ColorChallenge = () => {
  const { completeChallenge, recordCorrectAnswer, recordIncorrectAnswer, state, updateChallengeProgress } = useGame();
  const { isDark } = useTheme();
  const { recordColorBlindnessResponse, completeColorBlindnessTest } = useStore();
  
  // Get saved progress from session
  const savedProgress = state.challengeProgress?.colorBlindness || {};
  
  const [currentPlateIndex, setCurrentPlateIndex] = useState(savedProgress.currentPlate || 0);
  const [userAnswer, setUserAnswer] = useState('');
  const [plateStartTime, setPlateStartTime] = useState(Date.now());
  const [plates, setPlates] = useState(savedProgress.plates || []);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const currentPlate = ISHIHARA_PLATES[currentPlateIndex];
  const isLastPlate = currentPlateIndex === ISHIHARA_PLATES.length - 1;
  
  // Save progress whenever plate changes
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
    
    // Check if correct for normal vision
    const normalAnswer = String(currentPlate.normalAnswer).toLowerCase();
    const isCorrect = userAnswer.trim().toLowerCase() === normalAnswer;
    
    // Update game stats
    if (isCorrect) {
      recordCorrectAnswer(responseTime);
    } else {
      recordIncorrectAnswer(responseTime);
    }
    
    // Record to store
    recordColorBlindnessResponse(plateData);
    
    const newPlates = [...plates, plateData];
    setPlates(newPlates);
    
    if (isLastPlate) {
      // Complete the challenge
      completeColorBlindnessTest();
      const analysis = analyzeColorBlindness(newPlates);
      
      try {
        // Save to backend
        const userId = state.userId || auraIntegration.getUserId();
        await saveVisionResults({
          userId,
          colorBlindness: {
            plates: newPlates,
            ...analysis,
          },
        });
        
        // Save to AURA if enabled
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
      
      // Clear progress since test is complete
      updateChallengeProgress('colorBlindness', { currentPlate: 0, plates: [] });
      
      // Complete with game context (triggers transition)
      await completeChallenge('color-blindness', analysis);
    } else {
      // Animate to next plate
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
      {/* Challenge header */}
      <div className="text-center mb-6">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
          style={{ 
            backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
          }}
        >
          <span className="text-xl">🎨</span>
          <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
            Pattern {currentPlateIndex + 1} of {ISHIHARA_PLATES.length}
          </span>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Pattern Hunt</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Can you spot the hidden number in the dots?</p>
      </div>
      
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {ISHIHARA_PLATES.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
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
        <img
          src={imageMap[currentPlate.imageName]}
          alt={`Color plate ${currentPlate.plateId}`}
          className="w-56 h-56 sm:w-72 sm:h-72 rounded-full object-cover shadow-2xl"
          style={{ boxShadow: 'var(--shadow-xl)' }}
        />
      </div>
      
      {/* Input Section */}
      <div className="space-y-4">
        <input
          type="text"
          value={userAnswer}
          onChange={handleInputChange}
          onFocus={(e) => {
            e.target.style.borderColor = 'rgba(var(--primary-color-rgb), 0.5)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-secondary)';
          }}
          className="w-full px-4 py-4 rounded-xl text-center text-2xl placeholder-gray-500 transition-all duration-300 focus:outline-none"
          style={{ 
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '2px solid var(--border-secondary)'
          }}
          placeholder="Enter the number you see"
          autoFocus
        />
        
        <div className="flex gap-3">
          <button
            onClick={handleNothingClick}
            className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300"
            style={{ 
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-secondary)'
            }}
          >
            I See Nothing
          </button>
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
              boxShadow: '0 4px 20px var(--primary-color-glow)'
            }}
          >
            {isLastPlate ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorChallenge;

