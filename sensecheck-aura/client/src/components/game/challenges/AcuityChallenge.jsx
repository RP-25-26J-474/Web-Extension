import { useState, useEffect, useMemo, useRef } from 'react';
import { useGame } from '../../../context/GameContext';
import { useTheme } from '../../../context/ThemeContext';
import useStore from '../../../state/store';
import { calculateVisualAcuityFromThreshold, getVisionCategory } from '../../../utils/visualAcuityCalculations';
import { saveVisionResults } from '../../../utils/api';
import auraIntegration from '../../../utils/auraIntegration';
import { Focus, Ruler, Glasses, MoveHorizontal, Target, Send, AlertTriangle } from 'lucide-react';

const calculateAdaptiveSizes = () => {
  const dpr = window.devicePixelRatio || 1;
  const ppi = dpr * 96;
  
  const VIEWING_DISTANCE_MM = 500;
  const ARC_MINUTES_20_20 = 5;
  
  const angleRadians = (ARC_MINUTES_20_20 / 60) * (Math.PI / 180);
  const physicalSizeMM = 2 * VIEWING_DISTANCE_MM * Math.tan(angleRadians / 2);
  const pixelsPerMM = ppi / 25.4;
  const calculated2020Pixels = physicalSizeMM * pixelsPerMM;
  
  const MIN_LEGIBLE_SIZE_PX = 10;
  const twentyTwentyPixels = Math.max(MIN_LEGIBLE_SIZE_PX, Math.round(calculated2020Pixels));
  
  const level7Size = twentyTwentyPixels;
  const level1Size = Math.max(80, twentyTwentyPixels * 4);
  
  const sizes = [];
  for (let i = 0; i < 7; i++) {
    sizes.push(Math.round(level1Size - (level1Size - level7Size) * (i / 6)));
  }
  
  return { sizes, twentyTwentyPixels, ppi, dpr };
};

const REQUIRED_DISTANCE_CM = 50;

const AcuityChallenge = () => {
  const { completeChallenge, recordCorrectAnswer, recordIncorrectAnswer, state, updateChallengeProgress } = useGame();
  const { isDark } = useTheme();
  const { recordVisualAcuityAttempt, setVisualAcuitySize, completeVisualAcuityTest, completeModule } = useStore();
  
  const screenCalibration = useMemo(() => calculateAdaptiveSizes(), []);
  const { sizes: levelSizes, twentyTwentyPixels } = screenCalibration;
  
  const savedProgress = state.challengeProgress?.visualAcuity || {};
  
  const [showDistanceSetup, setShowDistanceSetup] = useState(!savedProgress.distanceConfirmed);
  const [distanceConfirmed, setDistanceConfirmed] = useState(savedProgress.distanceConfirmed || false);
  
  const [currentLevel, setCurrentLevel] = useState(savedProgress.currentLevel || 1);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [attemptStartTime, setAttemptStartTime] = useState(Date.now());
  const [lastCorrectLevel, setLastCorrectLevel] = useState(savedProgress.lastCorrectLevel || 1);
  const [attempts, setAttempts] = useState(savedProgress.attempts || []);
  const isCompletingRef = useRef(false);
  
  const currentSize = levelSizes[currentLevel - 1];
  
  const generateNumber = () => Math.floor(Math.random() * 90) + 10;
  
  useEffect(() => {
    if (distanceConfirmed && currentLevel > 1) {
      updateChallengeProgress('visualAcuity', {
        currentLevel,
        lastCorrectLevel,
        distanceConfirmed: true,
        attempts,
      });
    }
  }, [currentLevel, lastCorrectLevel, distanceConfirmed, attempts, updateChallengeProgress]);
  
  useEffect(() => {
    if (distanceConfirmed) {
      const number = generateNumber();
      setCurrentNumber(number);
      setAttemptStartTime(Date.now());
    }
  }, [currentLevel, attemptNumber, currentSize, distanceConfirmed]);
  
  const handleDistanceConfirm = () => {
    setDistanceConfirmed(true);
    setShowDistanceSetup(false);
    updateChallengeProgress('visualAcuity', { distanceConfirmed: true });
  };
  
  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    if (isCompletingRef.current) return;
    
    const isCorrect = parseInt(userAnswer) === currentNumber;
    const willComplete = (currentLevel >= 7 && isCorrect) || (attemptNumber === 2 && !isCorrect);
    if (willComplete) isCompletingRef.current = true;
    
    const responseTime = Date.now() - attemptStartTime;
    
    const attemptData = {
      level: currentLevel,
      size: currentSize,
      number: currentNumber,
      userAnswer: parseInt(userAnswer),
      isCorrect,
      responseTime,
      attemptNumber,
      twentyTwentyThreshold: twentyTwentyPixels,
    };
    
    recordVisualAcuityAttempt(attemptData);
    
    const newAttempts = [...attempts, attemptData];
    setAttempts(newAttempts);
    
    if (isCorrect) {
      recordCorrectAnswer(responseTime);
      setLastCorrectLevel(currentLevel);
      
      if (currentLevel >= 7) {
        await completeTest(newAttempts, currentLevel);
      } else {
        setCurrentLevel(currentLevel + 1);
        setVisualAcuitySize(levelSizes[currentLevel]);
        setUserAnswer('');
        setAttemptNumber(1);
      }
    } else {
      recordIncorrectAnswer(responseTime);
      if (attemptNumber === 1) {
        setUserAnswer('');
        setAttemptNumber(2);
      } else {
        await completeTest(newAttempts, lastCorrectLevel);
      }
    }
  };
  
  const completeTest = async (allAttempts, finalLevel) => {
    completeVisualAcuityTest();
    
    const finalSize = levelSizes[finalLevel - 1];
    const metrics = calculateVisualAcuityFromThreshold(finalSize, twentyTwentyPixels);
    const visionCategory = getVisionCategory(metrics.visualAcuityDecimal);
    
    const visionRating = metrics.visualAcuityDecimal >= 1.0 ? '20/20 (Perfect)' 
      : metrics.visualAcuityDecimal >= 0.8 ? '20/25 (Near Perfect)'
      : metrics.visualAcuityDecimal >= 0.5 ? '20/40 (Normal)'
      : '20/60+ (Below Average)';
    
    const resultsData = {
      attempts: allAttempts,
      finalLevel,
      finalResolvedSize: finalSize,
      twentyTwentyThreshold: twentyTwentyPixels,
      screenCalibration,
      visionRating,
      isPerfectVision: metrics.visualAcuityDecimal >= 1.0,
      viewingDistanceCM: REQUIRED_DISTANCE_CM,
      visualAcuityDecimal: metrics.visualAcuityDecimal,
      visionLoss: metrics.visionLoss,
      snellenDenominator: metrics.snellenDenominator,
      snellenEstimate: metrics.snellenEstimate,
      visionCategory: visionCategory.category,
      visionCategoryName: visionCategory.name,
    };
    
    try {
      const userId = state.userId || auraIntegration.getUserId();
      await saveVisionResults({ userId, visualAcuity: resultsData });
      
      if (auraIntegration.isEnabled()) {
        await auraIntegration.saveVisionResults(null, resultsData, {
          device: navigator.userAgent,
        });
      }
      
      await completeModule('perception');
    } catch (error) {
      console.error('Failed to save results:', error);
    }
    
    updateChallengeProgress('visualAcuity', { 
      currentLevel: 1, 
      lastCorrectLevel: 1, 
      distanceConfirmed: false,
      attempts: [] 
    });
    
    await completeChallenge('visual-acuity', resultsData);
  };
  
  const progressPercent = Math.round(((currentLevel - 1) / 6) * 100);
  
  // Distance setup screen
  if (showDistanceSetup) {
    return (
      <div className="text-center">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ 
            backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
          }}
        >
          <Ruler className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
            Distance Setup
          </span>
        </div>
        
        <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Position Yourself</h3>
        <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          For accurate results, maintain the correct viewing distance throughout the test.
        </p>
        
        <div 
          className="rounded-2xl p-8 mb-6 transition-colors duration-300"
          style={{ 
            backgroundColor: 'var(--bg-stage)',
            border: '1px solid var(--border-primary)'
          }}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="relative text-center">
              <div className="text-6xl mb-2">👤</div>
              <div className="flex items-center gap-2 justify-center">
                <MoveHorizontal className="w-32 h-6" style={{ color: 'var(--primary-color)' }} />
                <div className="text-4xl">🖥️</div>
              </div>
              <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
                {REQUIRED_DISTANCE_CM} cm
              </div>
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>≈ arm's length</div>
            </div>
            
            <div className="space-y-3 text-left max-w-sm">
              <div 
                className="flex items-start gap-3 p-3 rounded-xl transition-colors duration-300"
                style={{ backgroundColor: 'var(--bg-input)' }}
              >
                <MoveHorizontal className="w-5 h-5 mt-0.5" style={{ color: 'var(--primary-color)' }} />
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Arm's Length</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Stretch your arm - your fingertips should almost touch the screen</div>
                </div>
              </div>
              
              <div 
                className="flex items-start gap-3 p-3 rounded-xl transition-colors duration-300"
                style={{ backgroundColor: 'var(--bg-input)' }}
              >
                <Glasses className="w-5 h-5 mt-0.5" style={{ color: 'var(--primary-color)' }} />
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Wear Glasses?</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Keep them on if you normally use them for screens</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleDistanceConfirm}
          className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
            boxShadow: '0 4px 20px var(--primary-color-glow)'
          }}
        >
          I'm at {REQUIRED_DISTANCE_CM}cm - Start Test
        </button>
      </div>
    );
  }
  
  // Main test UI
  return (
    <div>
      <div 
        className="mb-4 p-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-secondary)'
        }}
      >
        <Ruler className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>
          Remember: Stay <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{REQUIRED_DISTANCE_CM}cm</span> from screen
        </span>
      </div>
      
      <div className="text-center mb-6">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
          style={{ 
            backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
          }}
        >
          <Focus className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
            Level {currentLevel} of 7
          </span>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Focusing the Beam</h3>
        <p style={{ color: attemptNumber === 2 ? '#f59e0b' : 'var(--text-secondary)' }}>
          {attemptNumber === 1 
            ? currentLevel === 7 
              ? 'Final level - 20/20 vision test!'
              : 'Spot the shrinking number!' 
            : 'One more try!'}
        </p>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between text-xs mb-2">
          <span style={{ color: 'var(--text-tertiary)' }}>Focus Level</span>
          <span style={{ color: 'var(--primary-color)' }}>{currentLevel}/7</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--primary-color-dark) 0%, var(--primary-color) 100%)'
            }}
          />
        </div>
      </div>
      
      <div 
        className="rounded-2xl p-6 mb-6 flex justify-center items-center min-h-[280px] transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--bg-stage)',
          border: '1px solid var(--border-primary)'
        }}
      >
        <div
          className="rounded-full flex items-center justify-center font-bold shadow-2xl transition-all duration-500"
          style={{
            width: `${currentSize}px`,
            height: `${currentSize}px`,
            fontSize: `${currentSize * 0.5}px`,
            backgroundColor: isDark ? '#ffffff' : '#1f2937',
            color: isDark ? '#1f2937' : '#ffffff',
          }}
        >
          {currentNumber}
        </div>
      </div>
      
      <div className="space-y-4">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full px-4 py-4 rounded-xl text-center text-2xl transition-all duration-300 focus:outline-none"
          style={{ 
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: `2px solid ${attemptNumber === 2 ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-secondary)'}`
          }}
          placeholder="Enter number"
          autoFocus
        />
        
        <button
          onClick={handleSubmit}
          disabled={!userAnswer.trim()}
          className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ 
            background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
            boxShadow: '0 4px 20px var(--primary-color-glow)'
          }}
        >
          <Send className="w-4 h-4" />
          Submit Answer
        </button>
      </div>
      
      {attemptNumber === 2 && (
        <div 
          className="mt-4 p-3 rounded-xl text-center flex items-center justify-center gap-2 transition-colors duration-300"
          style={{ 
            backgroundColor: isDark ? 'rgba(120, 53, 15, 0.2)' : 'rgba(254, 243, 199, 0.8)',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(217, 119, 6, 0.4)'
          }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: isDark ? '#fbbf24' : '#b45309' }} />
          <span 
            className="text-sm font-medium"
            style={{ color: isDark ? '#fbbf24' : '#b45309' }}
          >
            Focus - last attempt at Level {currentLevel}!
          </span>
        </div>
      )}
    </div>
  );
};

export default AcuityChallenge;
