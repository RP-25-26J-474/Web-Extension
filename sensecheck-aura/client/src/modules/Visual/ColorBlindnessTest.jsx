import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ProgressBar from '../../components/ProgressBar';
import useStore from '../../state/store';
import useInteractionTracking from '../../hooks/useInteractionTracking';
import { ISHIHARA_PLATES, analyzeColorBlindness } from '../../utils/colorBlindnessAnalysis';
import { saveVisionResults } from '../../utils/api';
import auraIntegration from '../../utils/auraIntegration';

// Import Ishihara plate images
import ishihara1 from '../../resources/ishihara_1.jpg';
import ishihara3 from '../../resources/ishihara_3.jpg';
import ishihara11 from '../../resources/ishihara_11.jpg';
import ishihara19 from '../../resources/ishihara_19.jpg';

// Map image names to imports
const imageMap = {
  'ishihara_1.jpg': ishihara1,
  'ishihara_3.jpg': ishihara3,
  'ishihara_11.jpg': ishihara11,
  'ishihara_19.jpg': ishihara19,
};

const ColorBlindnessTest = () => {
  const navigate = useNavigate();
  const sessionId = useStore((state) => state.sessionId);
  const { recordColorBlindnessResponse, completeColorBlindnessTest } = useStore();
  const { trackEvent, trackClick, trackFocus } = useInteractionTracking('colorBlindness', true);

  // Load initial state from sessionStorage for persistence across refresh
  const getInitialPlateIndex = () => {
    const saved = sessionStorage.getItem('sensecheck_colorblindness_plate');
    return saved ? parseInt(saved, 10) : 0;
  };

  const getInitialComplete = () => {
    return sessionStorage.getItem('sensecheck_colorblindness_complete') === 'true';
  };

  const getSavedResults = () => {
    const saved = sessionStorage.getItem('sensecheck_colorblindness_results');
    return saved ? JSON.parse(saved) : null;
  };

  const [currentPlateIndex, setCurrentPlateIndex] = useState(getInitialPlateIndex);
  const [userAnswer, setUserAnswer] = useState('');
  const [plateStartTime, setPlateStartTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(getInitialComplete);
  const [results, setResults] = useState(getSavedResults);

  const currentPlate = ISHIHARA_PLATES[currentPlateIndex];
  const isLastPlate = currentPlateIndex === ISHIHARA_PLATES.length - 1;

  // Check if test was already completed in store
  const storeCompleted = useStore((state) => state.colorBlindnessResults.completed);
  useEffect(() => {
    if (storeCompleted && !isComplete) {
      setIsComplete(true);
    }
  }, [storeCompleted, isComplete]);

  useEffect(() => {
    if (currentPlate) {
      trackEvent('plate_shown', {
        metadata: { plateId: currentPlate?.plateId, imageName: currentPlate?.imageName },
      });
      setPlateStartTime(Date.now());
    }
  }, [currentPlateIndex, trackEvent, currentPlate]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setUserAnswer(value);
    trackEvent('input_change', {
      target: { id: 'answer-input', value: value.substring(0, 10) },
    });
  };

  const handleNothingClick = () => {
    setUserAnswer('nothing');
    trackClick(new MouseEvent('click'), { customAction: 'nothing_selected' });
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

    recordColorBlindnessResponse(plateData);
    trackEvent('plate_submitted', {
      metadata: { ...plateData },
    });

    if (isLastPlate) {
      completeColorBlindnessTest();
      const allPlates = useStore.getState().colorBlindnessResults.plates;

      const analysis = analyzeColorBlindness(allPlates);
      setResults(analysis);

      try {
        await saveVisionResults({
          sessionId,
          colorBlindness: {
            plates: allPlates,
            ...analysis,
          },
        });
      } catch (error) {
        console.error('Failed to save results:', error);
      }

      // Save completion state to sessionStorage
      sessionStorage.setItem('sensecheck_colorblindness_complete', 'true');
      sessionStorage.setItem('sensecheck_colorblindness_results', JSON.stringify(analysis));
      // Clear plate progress since test is complete
      sessionStorage.removeItem('sensecheck_colorblindness_plate');
      
      setIsComplete(true);
    } else {
      const nextPlate = currentPlateIndex + 1;
      setCurrentPlateIndex(nextPlate);
      // Save progress to sessionStorage
      sessionStorage.setItem('sensecheck_colorblindness_plate', nextPlate.toString());
      setUserAnswer('');
    }
  };

  const handleContinue = () => {
    navigate('/perception/visual-acuity');
  };

  if (isComplete && results) {
    return (
      <Layout title="Color Blindness Test Complete" subtitle="Perception Lab">
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
              className="relative w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
              style={{ 
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                boxShadow: '0 4px 20px var(--primary-color-glow)'
              }}
            >
              Continue to Visual Acuity Test
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Color Blindness Test" subtitle="Perception Lab • Chamber 1">
      <div className="max-w-3xl mx-auto">
        <ProgressBar
          current={currentPlateIndex + 1}
          total={ISHIHARA_PLATES.length}
          label="Plate Progress"
        />

        <div className="rounded-2xl bg-gray-900/70 backdrop-blur-xl border border-gray-800 p-6 sm:p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
              style={{ 
                backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
              }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>Plate {currentPlateIndex + 1} of {ISHIHARA_PLATES.length}</span>
            </div>
            <p className="text-gray-400">
              What number do you see in the image below?
            </p>
          </div>

          {/* Image Container */}
          <div className="bg-gray-950 rounded-2xl p-8 mb-6 flex justify-center items-center min-h-[350px] sm:min-h-[400px] border border-gray-800">
            <div className="relative">
              <img
                src={imageMap[currentPlate.imageName]}
                alt={`Ishihara Plate ${currentPlate.plateId}`}
                className="w-64 h-64 sm:w-80 sm:h-80 rounded-full object-cover shadow-2xl ring-4 ring-gray-800"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div
                className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-red-300 via-green-300 to-yellow-300 items-center justify-center flex-col"
                style={{ display: 'none' }}
              >
                <div className="text-white text-6xl font-bold opacity-50">
                  {currentPlate.plateId}
                </div>
                <p className="text-white text-sm mt-2 opacity-70">
                  Image not found
                </p>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label htmlFor="answer-input" className="block text-sm font-medium text-gray-300 mb-2">
                Enter the number you see:
              </label>
              <input
                id="answer-input"
                type="text"
                value={userAnswer}
                onChange={handleInputChange}
                onFocus={(e) => {
                  trackFocus(e);
                  e.target.style.borderColor = 'rgba(var(--primary-color-rgb), 0.5)';
                  e.target.style.boxShadow = '0 0 15px rgba(var(--primary-color-rgb), 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(55, 65, 81, 0.5)';
                  e.target.style.boxShadow = 'none';
                }}
                className="w-full px-4 py-4 rounded-xl bg-gray-800/50 text-white text-center text-2xl placeholder-gray-500 transition-all duration-300 focus:outline-none"
                style={{ border: '2px solid rgba(55, 65, 81, 0.5)' }}
                placeholder="Type number or click 'Nothing'"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleNothingClick}
                className="flex-1 py-4 px-6 rounded-xl font-medium text-gray-300 bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all duration-300"
              >
                I See Nothing
              </button>
              <button
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
                className="flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                  boxShadow: '0 4px 20px var(--primary-color-glow)'
                }}
              >
                {isLastPlate ? 'Finish Test' : 'Next Plate'}
              </button>
            </div>
          </div>
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
                <li>• Look at the image and identify any number you can see</li>
                <li>• If you cannot see any number, click "I See Nothing"</li>
                <li>• Ensure your screen brightness is adequate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ColorBlindnessTest;
