import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import useStore from '../../state/store';
import useInteractionTracking from '../../hooks/useInteractionTracking';
import { calculateVisualAcuityMetrics } from '../../utils/visualAcuityCalculations';
import { saveVisionResults } from '../../utils/api';
import auraIntegration from '../../utils/auraIntegration';

const VisualAcuityTest = () => {
  const navigate = useNavigate();
  const sessionId = useStore((state) => state.sessionId);
  const isModuleCompleted = useStore((state) => state.isModuleCompleted);
  const {
    recordVisualAcuityAttempt,
    setVisualAcuitySize,
    completeVisualAcuityTest,
    completeModule,
    isAllModulesCompleted,
  } = useStore();
  const { trackEvent, trackClick } = useInteractionTracking('visualAcuity', true);
  
  // Redirect if perception module is already completed
  useEffect(() => {
    if (isModuleCompleted('perception')) {
      console.log('⚠️ Perception module already completed, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [isModuleCompleted, navigate]);

  // Load initial state from sessionStorage for persistence
  const getInitialSize = () => {
    const saved = sessionStorage.getItem('sensecheck_visualacuity_size');
    return saved ? parseInt(saved, 10) : 80;
  };

  const getInitialComplete = () => {
    return sessionStorage.getItem('sensecheck_visualacuity_complete') === 'true';
  };

  const getSavedResults = () => {
    const saved = sessionStorage.getItem('sensecheck_visualacuity_results');
    return saved ? JSON.parse(saved) : null;
  };

  const [currentSize, setCurrentSize] = useState(getInitialSize);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [attemptStartTime, setAttemptStartTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(getInitialComplete);
  const [finalResults, setFinalResults] = useState(getSavedResults);
  const [lastCorrectSize, setLastCorrectSize] = useState(getInitialSize);

  // Check if test was already completed in store
  const storeCompleted = useStore((state) => state.visualAcuityResults.completed);
  useEffect(() => {
    if (storeCompleted && !isComplete) {
      setIsComplete(true);
    }
  }, [storeCompleted, isComplete]);

  const generateNumber = () => {
    return Math.floor(Math.random() * 90) + 10;
  };

  useEffect(() => {
    if (!isComplete) {
      const number = generateNumber();
      setCurrentNumber(number);
      setAttemptStartTime(Date.now());
      trackEvent('number_shown', {
        metadata: { number, size: currentSize, attempt: attemptNumber },
      });
    }
  }, [currentSize, attemptNumber, trackEvent, isComplete]);

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;

    const responseTime = Date.now() - attemptStartTime;
    const isCorrect = parseInt(userAnswer) === currentNumber;

    const attemptData = {
      size: currentSize,
      number: currentNumber,
      userAnswer: parseInt(userAnswer),
      isCorrect,
      responseTime,
      attemptNumber,
    };

    recordVisualAcuityAttempt(attemptData);
    trackEvent('attempt_submitted', { metadata: attemptData });

    if (isCorrect) {
      setLastCorrectSize(currentSize);
      const newSize = currentSize - 10;
      
      if (newSize < 20) {
        await completeTest();
      } else {
        setCurrentSize(newSize);
        setVisualAcuitySize(newSize);
        // Save progress to sessionStorage
        sessionStorage.setItem('sensecheck_visualacuity_size', newSize.toString());
        setUserAnswer('');
        setAttemptNumber(1);
      }
    } else {
      if (attemptNumber === 1) {
        setUserAnswer('');
        setAttemptNumber(2);
      } else {
        await completeTest();
      }
    }
  };

  const completeTest = async () => {
    completeVisualAcuityTest();
    
    const allAttempts = useStore.getState().visualAcuityResults.attempts;
    const metrics = calculateVisualAcuityMetrics(lastCorrectSize);
    
    const resultsData = {
      attempts: allAttempts,
      finalResolvedSize: lastCorrectSize,
      ...metrics,
    };

    setFinalResults(resultsData);

    try {
      // Get color blindness results from store
      const colorBlindnessData = useStore.getState().colorBlindnessResults;
      
      // Save to original Sensecheck backend (optional)
      await saveVisionResults({
        sessionId,
        visualAcuity: resultsData,
      });
      
      // Save to AURA backend if in AURA mode
      if (auraIntegration.isEnabled()) {
        console.log('👁️ Saving vision results to AURA backend');
        await auraIntegration.saveVisionResults(
          colorBlindnessData.completed ? {
            plates: colorBlindnessData.plates,
          } : null,
          resultsData,
          {
            // Add any test conditions here if needed
            device: navigator.userAgent,
          }
        );
      }
      
      await completeModule('perception');
    } catch (error) {
      console.error('Failed to save results:', error);
    }

    // Save completion state to sessionStorage
    sessionStorage.setItem('sensecheck_visualacuity_complete', 'true');
    sessionStorage.setItem('sensecheck_visualacuity_results', JSON.stringify(resultsData));
    // Clear progress since test is complete
    sessionStorage.removeItem('sensecheck_visualacuity_size');

    setIsComplete(true);
  };

  const handleContinue = () => {
    // Check if all modules are completed
    if (isAllModulesCompleted()) {
      navigate('/complete');
    } else {
      navigate('/');
    }
  };

  // Calculate progress (80 -> 20, so 7 steps: 80, 70, 60, 50, 40, 30, 20)
  const progressSteps = 7;
  const currentStep = Math.max(1, Math.ceil((80 - currentSize) / 10) + 1);

  if (isComplete && finalResults) {
    return (
      <Layout title="Visual Acuity Test Complete" subtitle="Perception Lab">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl bg-gray-900/70 backdrop-blur-xl border border-gray-800 p-8 shadow-xl text-center relative overflow-hidden">
            {/* Success glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.1) 0%, transparent 50%)' }} />
            
            {/* Checkmark */}
            <div className="relative mb-6">
              <div 
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark) 100%)',
                  boxShadow: '0 10px 40px var(--primary-color-glow)'
                }}
              >
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <h3 className="relative text-2xl font-bold mb-6 text-white">Test Complete!</h3>

            <button
              onClick={handleContinue}
              className="relative w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                boxShadow: '0 4px 20px var(--primary-color-glow)'
              }}
            >
              {isAllModulesCompleted() ? 'Finish Assessment' : 'Return to Home'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Visual Acuity Test" subtitle="Perception Lab • Chamber 2">
      <div className="max-w-3xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Size Progress</span>
            <span className="font-medium" style={{ color: 'var(--primary-color)' }}>{currentSize}px</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${((80 - currentSize) / 60) * 100}%`,
                background: 'linear-gradient(90deg, var(--primary-color-dark) 0%, var(--primary-color) 50%, var(--primary-color-light) 100%)'
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-gray-900/70 backdrop-blur-xl border border-gray-800 p-6 sm:p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h3 className={`text-lg font-semibold ${attemptNumber === 2 ? 'text-amber-400' : 'text-gray-300'}`}>
              {attemptNumber === 1 
                ? 'What number do you see in the circle below?' 
                : '⚠️ Incorrect! Try again (Last chance)'}
            </h3>
          </div>

          {/* Number Display */}
          <div className="bg-gray-950 rounded-2xl p-8 mb-6 flex justify-center items-center min-h-[400px] sm:min-h-[450px] border border-gray-800">
            <div
              className="rounded-full bg-white flex items-center justify-center font-bold text-gray-900 shadow-2xl transition-all duration-500"
              style={{
                width: `${currentSize}px`,
                height: `${currentSize}px`,
                fontSize: `${currentSize * 0.5}px`,
              }}
            >
              {currentNumber}
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label htmlFor="number-input" className="block text-sm font-medium text-gray-300 mb-2">
                Enter the number you see:
              </label>
              <input
                id="number-input"
                type="number"
                value={userAnswer}
                onChange={(e) => {
                  setUserAnswer(e.target.value);
                  trackEvent('input_change', { target: { value: e.target.value } });
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(var(--primary-color-rgb), 0.5)';
                  e.target.style.boxShadow = '0 0 15px rgba(var(--primary-color-rgb), 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(55, 65, 81, 0.5)';
                  e.target.style.boxShadow = 'none';
                }}
                className="w-full px-4 py-4 rounded-xl bg-gray-800/50 text-white text-center text-2xl placeholder-gray-500 transition-all duration-300 focus:outline-none"
                style={{ border: '2px solid rgba(55, 65, 81, 0.5)' }}
                placeholder="Enter number"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
              />
            </div>

            <button
              onClick={(e) => {
                trackClick(e);
                handleSubmit();
              }}
              disabled={!userAnswer.trim()}
              className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              style={{ 
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                boxShadow: '0 4px 20px var(--primary-color-glow)'
              }}
            >
              Submit Answer
            </button>
          </div>

          {/* Second Attempt Warning */}
          {attemptNumber === 2 && (
            <div className="mt-4 p-4 rounded-xl bg-amber-900/20 border border-amber-500/30">
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold">Second Attempt - Answer carefully</span>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 rounded-2xl bg-gray-900/50 border border-gray-800 p-5">
          <div className="flex items-start gap-3">
            <div 
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ 
                backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Instructions</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Keep a one meter distance from the screen</li>
                <li>• Identify the number displayed in the white circle</li>
                <li>• The number will get smaller with each correct answer</li>
                <li>• You get two attempts if you answer incorrectly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VisualAcuityTest;
