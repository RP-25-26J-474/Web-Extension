import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ProgressBar from '../../components/ProgressBar';
import useStore from '../../state/store';
import useInteractionTracking from '../../hooks/useInteractionTracking';
import {
  LITERACY_QUESTIONS,
  calculateLiteracyScore,
  calculateCategoryScores,
} from '../../utils/literacyQuestions';
import { saveLiteracyResults } from '../../utils/api';
import auraIntegration from '../../utils/auraIntegration';

const LiteracyQuiz = () => {
  const navigate = useNavigate();
  const sessionId = useStore((state) => state.sessionId);
  const { recordLiteracyResponse, completeLiteracyTest, completeModule } = useStore();
  const { trackEvent, trackClick, trackHover, trackFocus } = useInteractionTracking('literacy', true);

  // Load initial state from sessionStorage for persistence
  const getInitialQuestionIndex = () => {
    const saved = sessionStorage.getItem('sensecheck_literacy_question');
    return saved ? parseInt(saved, 10) : 0;
  };

  const getInitialComplete = () => {
    return sessionStorage.getItem('sensecheck_literacy_complete') === 'true';
  };

  const getSavedResults = () => {
    const saved = sessionStorage.getItem('sensecheck_literacy_results');
    return saved ? JSON.parse(saved) : null;
  };

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(getInitialQuestionIndex);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [focusShiftCount, setFocusShiftCount] = useState(0);
  const [hoverEvents, setHoverEvents] = useState([]);
  const [isComplete, setIsComplete] = useState(getInitialComplete);
  const [results, setResults] = useState(getSavedResults);

  const hoverTimerRef = useRef({});

  const currentQuestion = LITERACY_QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === LITERACY_QUESTIONS.length - 1;
  const totalQuestions = LITERACY_QUESTIONS.length;

  // Check if test was already completed in store
  const storeCompleted = useStore((state) => state.literacyResults.completed);
  useEffect(() => {
    if (storeCompleted && !isComplete) {
      setIsComplete(true);
    }
  }, [storeCompleted, isComplete]);

  useEffect(() => {
    if (!isComplete && currentQuestion) {
      setQuestionStartTime(Date.now());
      setFocusShiftCount(0);
      setHoverEvents([]);
      trackEvent('question_shown', {
        metadata: {
          questionId: currentQuestion.id,
          category: currentQuestion.category,
        },
      });
    }
  }, [currentQuestionIndex, currentQuestion, trackEvent, isComplete]);

  const handleOptionClick = (option, event) => {
    setSelectedAnswer(option);
    trackClick(event, {
      metadata: { questionId: currentQuestion.id, selectedOption: option },
    });
  };

  const handleOptionHover = (option, isEntering) => {
    if (isEntering) {
      hoverTimerRef.current[option] = Date.now();
    } else {
      if (hoverTimerRef.current[option]) {
        const duration = Date.now() - hoverTimerRef.current[option];
        setHoverEvents((prev) => [
          ...prev,
          { option, duration, timestamp: Date.now() },
        ]);
        trackHover(new MouseEvent('hover'), {
          metadata: {
            questionId: currentQuestion.id,
            option,
            duration,
          },
        });
      }
    }
  };

  const handleFocus = (event) => {
    setFocusShiftCount((prev) => prev + 1);
    trackFocus(event, {
      metadata: { questionId: currentQuestion.id, count: focusShiftCount + 1 },
    });
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    const responseTime = Date.now() - questionStartTime;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const responseData = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      userAnswer: selectedAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      responseTime,
      focusShifts: focusShiftCount,
      hoverEvents,
    };

    recordLiteracyResponse(responseData);
    trackEvent('question_submitted', {
      metadata: {
        ...responseData,
        category: currentQuestion.category,
      },
    });

    if (isLastQuestion) {
      await completeQuiz();
    } else {
      const nextQuestion = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextQuestion);
      // Save progress to sessionStorage
      sessionStorage.setItem('sensecheck_literacy_question', nextQuestion.toString());
      setSelectedAnswer('');
    }
  };

  const completeQuiz = async () => {
    completeLiteracyTest();
    
    const allResponses = useStore.getState().literacyResults.responses;
    const score = calculateLiteracyScore(allResponses);
    const categoryScores = calculateCategoryScores(allResponses);

    const totalTime = allResponses.reduce((sum, r) => sum + r.responseTime, 0);
    const totalFocusShifts = allResponses.reduce((sum, r) => sum + r.focusShifts, 0);
    const totalHoverEvents = allResponses.reduce(
      (sum, r) => sum + r.hoverEvents.length,
      0
    );

    const resultsData = {
      sessionId,
      responses: allResponses,
      score,
      metrics: {
        totalTime,
        averageResponseTime: Math.round(totalTime / allResponses.length),
        totalFocusShifts,
        totalHoverEvents,
      },
      categoryScores,
    };

    setResults(resultsData);

    try {
      // Save to original Sensecheck backend (optional - if you want to keep dual tracking)
      await saveLiteracyResults(resultsData);
      
      // Save to AURA backend if in AURA mode
      if (auraIntegration.isEnabled()) {
        console.log('📚 Saving literacy results to AURA backend');
        await auraIntegration.saveLiteracyResults(
          resultsData.responses,
          resultsData.score,
          resultsData.metrics,
          resultsData.categoryScores
        );
      }
      
      await completeModule('knowledge');
    } catch (error) {
      console.error('Failed to save results:', error);
    }

    // Save completion state to sessionStorage
    sessionStorage.setItem('sensecheck_literacy_complete', 'true');
    sessionStorage.setItem('sensecheck_literacy_results', JSON.stringify(resultsData));
    // Clear question progress since quiz is complete
    sessionStorage.removeItem('sensecheck_literacy_question');

    setIsComplete(true);
  };

  if (isComplete && results) {
    return (
      <Layout title="Computer Literacy Quiz Complete" subtitle="Knowledge Console">
        <div className="max-w-3xl mx-auto">
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
            
            <h3 className="relative text-2xl font-bold mb-6 text-white">Quiz Complete!</h3>

            <button
              onClick={() => navigate('/complete')}
              className="relative w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                boxShadow: '0 4px 20px var(--primary-color-glow)'
              }}
            >
              Finish Assessment
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Computer Literacy Quiz" subtitle="Knowledge Console">
      <div className="max-w-3xl mx-auto">
        <ProgressBar
          current={currentQuestionIndex + 1}
          total={totalQuestions}
          label="Question Progress"
        />

        <div className="rounded-2xl bg-gray-900/70 backdrop-blur-xl border border-gray-800 p-6 sm:p-8 shadow-xl">
          {/* Question Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span 
                className="px-3 py-1 rounded-full text-sm font-medium capitalize"
                style={{ 
                  backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                  border: '1px solid rgba(var(--primary-color-rgb), 0.2)',
                  color: 'var(--primary-color)'
                }}
              >
                {currentQuestion.category}
              </span>
              <span className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">{currentQuestion.question}</h3>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                onClick={(e) => handleOptionClick(option, e)}
                onFocus={handleFocus}
                onMouseEnter={() => handleOptionHover(option, true)}
                onMouseLeave={() => handleOptionHover(option, false)}
                className="w-full p-4 rounded-xl text-left transition-all duration-300 flex items-center gap-4"
                style={selectedAnswer === option
                  ? { 
                      backgroundColor: 'var(--primary-color)', 
                      color: 'white',
                      boxShadow: '0 4px 20px var(--primary-color-glow)',
                      border: '2px solid var(--primary-color)'
                    }
                  : { 
                      backgroundColor: 'rgba(31, 41, 55, 0.5)',
                      color: '#d1d5db',
                      border: '2px solid rgba(55, 65, 81, 0.5)'
                    }
                }
              >
                {/* Radio indicator */}
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300"
                  style={selectedAnswer === option
                    ? { border: '2px solid white', backgroundColor: 'white' }
                    : { border: '2px solid #6b7280' }
                  }
                >
                  {selectedAnswer === option && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary-color)' }}></div>
                  )}
                </div>
                <span className="font-medium">{option}</span>
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            style={{ 
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
              boxShadow: '0 4px 20px var(--primary-color-glow)'
            }}
          >
            {isLastQuestion ? 'Finish Quiz' : (
              <>
                Next Question
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
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
                <li>• Select the best answer for each question</li>
                <li>• Take your time to read each option carefully</li>
                <li>• Questions cover icons, terminology, navigation, and security</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LiteracyQuiz;
