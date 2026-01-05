import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../../context/GameContext';
import { useTheme } from '../../../context/ThemeContext';
import useStore from '../../../state/store';
import { LITERACY_QUESTIONS, calculateLiteracyScore, calculateCategoryScores } from '../../../utils/literacyQuestions';
import { saveLiteracyResults } from '../../../utils/api';
import auraIntegration from '../../../utils/auraIntegration';

const QuizChallenge = () => {
  const { completeChallenge, recordCorrectAnswer, recordIncorrectAnswer, state, updateChallengeProgress } = useGame();
  const { isDark } = useTheme();
  const { recordLiteracyResponse, completeLiteracyTest, completeModule } = useStore();
  
  const savedProgress = state.challengeProgress?.knowledgeQuiz || {};
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(savedProgress.currentQuestion || 0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [focusShiftCount, setFocusShiftCount] = useState(0);
  const [hoverEvents, setHoverEvents] = useState([]);
  const [responses, setResponses] = useState(savedProgress.responses || []);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const hoverTimerRef = useRef({});
  
  const currentQuestion = LITERACY_QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === LITERACY_QUESTIONS.length - 1;
  const totalQuestions = LITERACY_QUESTIONS.length;
  
  // Save progress when question changes
  useEffect(() => {
    if (currentQuestionIndex > 0 || responses.length > 0) {
      updateChallengeProgress('knowledgeQuiz', {
        currentQuestion: currentQuestionIndex,
        responses,
      });
    }
  }, [currentQuestionIndex, responses, updateChallengeProgress]);
  
  useEffect(() => {
    setQuestionStartTime(Date.now());
    setFocusShiftCount(0);
    setHoverEvents([]);
  }, [currentQuestionIndex]);
  
  const handleOptionClick = (option) => {
    setSelectedAnswer(option);
  };
  
  const handleOptionHover = (option, isEntering) => {
    if (isEntering) {
      hoverTimerRef.current[option] = Date.now();
    } else {
      if (hoverTimerRef.current[option]) {
        const duration = Date.now() - hoverTimerRef.current[option];
        setHoverEvents((prev) => [...prev, { option, duration, timestamp: Date.now() }]);
      }
    }
  };
  
  const handleFocus = () => {
    setFocusShiftCount((prev) => prev + 1);
  };
  
  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    
    const responseTime = Date.now() - questionStartTime;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
    // Update game stats
    if (isCorrect) {
      recordCorrectAnswer(responseTime);
    } else {
      recordIncorrectAnswer(responseTime);
    }
    
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
    
    const newResponses = [...responses, responseData];
    setResponses(newResponses);
    
    if (isLastQuestion) {
      await finishQuiz(newResponses);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer('');
        setIsAnimating(false);
      }, 200);
    }
  };
  
  const finishQuiz = async (allResponses) => {
    completeLiteracyTest();
    
    const scoreData = calculateLiteracyScore(allResponses);
    const categoryScores = calculateCategoryScores(allResponses);
    
    const userId = state.userId || auraIntegration.getUserId();
    
    const resultsData = {
      userId,
      responses: allResponses,
      score: scoreData.score,
      correctAnswers: scoreData.correctAnswers,
      totalQuestions: scoreData.totalQuestions,
      categoryScores,
    };
    
    try {
      await saveLiteracyResults(resultsData);
      
      if (auraIntegration.isEnabled()) {
        await auraIntegration.saveLiteracyResults(
          allResponses,
          scoreData.score,
          { correctAnswers: scoreData.correctAnswers, totalQuestions: scoreData.totalQuestions },
          categoryScores
        );
      }
      
      await completeModule('knowledge');
    } catch (error) {
      console.error('Failed to save results:', error);
    }
    
    // Clear progress since test is complete
    updateChallengeProgress('knowledgeQuiz', { currentQuestion: 0, responses: [] });
    
    await completeChallenge('knowledge-quiz', resultsData);
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
          <span className="text-xl">🧠</span>
          <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
            Q{currentQuestionIndex + 1} of {totalQuestions}
          </span>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Quick Think!</h3>
        <div 
          className="inline-block px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors duration-300" 
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--primary-color)' }}
        >
          {currentQuestion.category === 'icons' ? '🎨 Icons' : 
           currentQuestion.category === 'terminology' ? '📚 Tech Terms' :
           '🖱️ Interaction'}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full h-1.5 rounded-full overflow-hidden transition-colors duration-300" style={{ backgroundColor: 'var(--bg-input)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary-color-dark) 0%, var(--primary-color) 100%)'
            }}
          />
        </div>
      </div>
      
      {/* Question */}
      <div 
        className="rounded-xl p-5 mb-6 transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-primary)'
        }}
      >
        <p className="text-lg font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {currentQuestion.question}
        </p>
      </div>
      
      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option) => (
          <button
            key={option}
            onClick={() => handleOptionClick(option)}
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
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                  border: '2px solid var(--border-secondary)'
                }
            }
          >
            <div
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300"
              style={selectedAnswer === option
                ? { border: '2px solid white', backgroundColor: 'white' }
                : { border: `2px solid ${isDark ? '#6b7280' : '#9ca3af'}` }
              }
            >
              {selectedAnswer === option && (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary-color)' }} />
              )}
            </div>
            <span className="font-medium">{option}</span>
          </button>
        ))}
      </div>
      
      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedAnswer}
        className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ 
          background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
          boxShadow: '0 4px 20px var(--primary-color-glow)'
        }}
      >
        {isLastQuestion ? 'Final Answer!' : (
          <>
            Lock It In!
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
};

export default QuizChallenge;

