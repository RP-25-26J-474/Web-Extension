import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Circle, Rect } from 'react-konva';
import { useGame } from '../../../context/GameContext';
import { useTheme } from '../../../context/ThemeContext';
import useStore from '../../../state/store';
import MotorSkillsTracker from '../../../utils/motorSkillsTracking';
import usePerformanceMetrics from '../../../hooks/usePerformanceMetrics';
import auraIntegration from '../../../utils/auraIntegration';

// Bubble patterns for each round
const BUBBLE_PATTERNS = [
  { speed: 1.5, spawnInterval: 1200, duration: 20000, pattern: [0, 1, 2, 3, 4, 0, 2, 4, 1, 3, 2, 0, 4, 1, 3] },
  { speed: 2.5, spawnInterval: 900, duration: 20000, pattern: [1, 3, 0, 4, 2, 1, 3, 0, 2, 4, 1, 0, 3, 2, 4, 1, 3] },
  { speed: 3.5, spawnInterval: 700, duration: 20000, pattern: [2, 0, 4, 1, 3, 2, 4, 0, 3, 1, 4, 2, 0, 3, 1, 4, 2, 0, 1, 3] },
];

const STAGE_WIDTH = 700;
const STAGE_HEIGHT = 500;
const COLUMN_WIDTH = STAGE_WIDTH / 5;
const BUBBLE_RADIUS = 25;

const getPrimaryColor = () => getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#8BC53F';

const MotorChallenge = () => {
  const { completeChallenge, updateStats, recordCorrectAnswer, recordIncorrectAnswer, state, updateChallengeProgress } = useGame();
  const { isDark } = useTheme();
  const { setMotorRound, completeMotorSkillsTest, completeModule } = useStore();
  
  const motorTrackerRef = useRef(null);
  const perfMetrics = usePerformanceMetrics();
  
  const savedProgress = state.challengeProgress?.motorSkills || {};
  
  const [currentRound, setCurrentRound] = useState(savedProgress.currentRound || 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [showRoundIntro, setShowRoundIntro] = useState(true);
  
  const roundStatsRef = useRef({ hits: 0, misses: 0, streak: 0 });
  const totalStatsRef = useRef(savedProgress.totalStats || { hits: 0, misses: 0, bestStreak: 0 });
  
  const [displayRoundStats, setDisplayRoundStats] = useState({ hits: 0, misses: 0, streak: 0 });
  const [displayTotalStats, setDisplayTotalStats] = useState(savedProgress.totalStats || { hits: 0, misses: 0, bestStreak: 0 });
  
  const bubblesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const roundTimerRef = useRef(null);
  const patternIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isEndingRoundRef = useRef(false);
  
  const currentPattern = BUBBLE_PATTERNS[currentRound - 1];
  
  // Initialize tracker
  useEffect(() => {
    const userId = state.userId || auraIntegration.getUserId();
    if (!motorTrackerRef.current && userId) {
      motorTrackerRef.current = new MotorSkillsTracker(null, userId);
    }
  }, [state.userId]);
  
  // Save progress
  useEffect(() => {
    if (currentRound > 1 || displayTotalStats.hits > 0) {
      updateChallengeProgress('motorSkills', {
        currentRound,
        totalStats: displayTotalStats,
      });
    }
  }, [currentRound, displayTotalStats, updateChallengeProgress]);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  
  const syncDisplayStats = useCallback(() => {
    setDisplayRoundStats({ ...roundStatsRef.current });
  }, []);
  
  const generateBubbleId = () => `bubble_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const spawnBubble = useCallback(() => {
    if (!isPlayingRef.current) return;
    
    const pattern = BUBBLE_PATTERNS[currentRound - 1];
    const columnIndex = pattern.pattern[patternIndexRef.current % pattern.pattern.length];
    patternIndexRef.current++;
    
    const newBubble = {
      id: generateBubbleId(),
      x: columnIndex * COLUMN_WIDTH + COLUMN_WIDTH / 2,
      y: STAGE_HEIGHT,
      column: columnIndex,
      speed: pattern.speed,
      radius: BUBBLE_RADIUS,
      spawnTime: Date.now(),
    };
    
    bubblesRef.current.push(newBubble);
    setBubbles([...bubblesRef.current]);
    
    if (motorTrackerRef.current) {
      motorTrackerRef.current.trackBubbleSpawn(newBubble);
    }
  }, [currentRound]);
  
  const animate = useCallback(() => {
    perfMetrics.recordFrame();
    
    const escapedBubbles = [];
    const updatedBubbles = bubblesRef.current.filter((bubble) => {
      bubble.y -= bubble.speed;
      
      if (bubble.y < -BUBBLE_RADIUS) {
        escapedBubbles.push(bubble);
        return false;
      }
      return true;
    });
    
    escapedBubbles.forEach(bubble => {
      if (motorTrackerRef.current) {
        motorTrackerRef.current.trackBubbleMiss(bubble);
      }
      
      roundStatsRef.current.misses += 1;
      roundStatsRef.current.streak = 0;
      
      totalStatsRef.current.bestStreak = Math.max(
        totalStatsRef.current.bestStreak, 
        roundStatsRef.current.streak
      );
      
      recordIncorrectAnswer();
    });
    
    bubblesRef.current = updatedBubbles;
    setBubbles([...updatedBubbles]);
    syncDisplayStats();
    
    if (isPlayingRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [perfMetrics, recordIncorrectAnswer, syncDisplayStats]);
  
  const handleBubbleClick = (bubble, event) => {
    perfMetrics.recordInputEvent(event.evt?.timeStamp);
    
    if (motorTrackerRef.current) {
      motorTrackerRef.current.trackBubbleHit(bubble, event.evt);
    }
    
    roundStatsRef.current.hits += 1;
    roundStatsRef.current.streak += 1;
    
    totalStatsRef.current.bestStreak = Math.max(
      totalStatsRef.current.bestStreak, 
      roundStatsRef.current.streak
    );
    
    syncDisplayStats();
    
    const reactionTime = Date.now() - bubble.spawnTime;
    recordCorrectAnswer(reactionTime);
    
    bubblesRef.current = bubblesRef.current.filter((b) => b.id !== bubble.id);
    setBubbles([...bubblesRef.current]);
  };
  
  const startRound = () => {
    setShowRoundIntro(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    isEndingRoundRef.current = false;
    setTimeRemaining(currentPattern.duration / 1000);
    patternIndexRef.current = 0;
    bubblesRef.current = [];
    setBubbles([]);
    
    roundStatsRef.current = { hits: 0, misses: 0, streak: 0 };
    setDisplayRoundStats({ hits: 0, misses: 0, streak: 0 });
    
    setMotorRound(currentRound);
    
    if (motorTrackerRef.current) {
      motorTrackerRef.current.round = currentRound;
    }
    
    if (currentRound === 1) {
      perfMetrics.startTracking();
    }
    
    spawnTimerRef.current = setInterval(() => spawnBubble(), currentPattern.spawnInterval);
    animationFrameRef.current = requestAnimationFrame(animate);
    
    const startTime = Date.now();
    roundTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((currentPattern.duration - elapsed) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        clearInterval(roundTimerRef.current);
        endRound();
      }
    }, 100);
  };
  
  const endRound = async () => {
    if (isEndingRoundRef.current) return;
    isEndingRoundRef.current = true;
    
    setIsPlaying(false);
    isPlayingRef.current = false;
    
    clearInterval(spawnTimerRef.current);
    clearInterval(roundTimerRef.current);
    cancelAnimationFrame(animationFrameRef.current);
    
    const finalRoundStats = { ...roundStatsRef.current };
    
    totalStatsRef.current = {
      hits: totalStatsRef.current.hits + finalRoundStats.hits,
      misses: totalStatsRef.current.misses + finalRoundStats.misses,
      bestStreak: Math.max(totalStatsRef.current.bestStreak, finalRoundStats.streak),
    };
    
    const newTotalStats = { ...totalStatsRef.current };
    setDisplayTotalStats(newTotalStats);
    
    // Fire and forget - don't block UI
    if (motorTrackerRef.current) {
      motorTrackerRef.current.trackRoundComplete({
        hits: finalRoundStats.hits,
        misses: finalRoundStats.misses,
        escaped: finalRoundStats.misses,
        duration: currentPattern.duration,
        averageReactionTime: 0,
      }).catch(() => {});
    }
    
    bubblesRef.current = [];
    setBubbles([]);
    
    if (currentRound < 3) {
      setTimeout(() => {
        const nextRound = currentRound + 1;
        setCurrentRound(nextRound);
        setShowRoundIntro(true);
        isEndingRoundRef.current = false;
      }, 500);
    } else {
      await finishChallenge(newTotalStats);
    }
  };
  
  const finishChallenge = async (stats) => {
    completeMotorSkillsTest();
    
    const finalPerfMetrics = perfMetrics.stopTracking();
    const accuracy = stats.hits + stats.misses > 0 
      ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100) 
      : 0;
    
    updateStats({
      totalCorrect: stats.hits,
      totalAttempts: stats.hits + stats.misses,
    });
    
    if (motorTrackerRef.current) {
      await motorTrackerRef.current.complete();
    }
    
    try {
      await completeModule('reaction');
    } catch (error) {
      console.error('Failed to save results:', error);
    }
    
    updateChallengeProgress('motorSkills', { 
      currentRound: 1, 
      totalStats: { hits: 0, misses: 0, bestStreak: 0 } 
    });
    
    await completeChallenge('motor-skills', {
      accuracy,
      totalHits: stats.hits,
      totalMisses: stats.misses,
      bestStreak: stats.bestStreak,
      performanceMetrics: finalPerfMetrics,
    });
  };
  
  useEffect(() => {
    return () => {
      clearInterval(spawnTimerRef.current);
      clearInterval(roundTimerRef.current);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);
  
  const primaryColor = getPrimaryColor();
  
  // Round intro screen
  if (showRoundIntro) {
    return (
      <div className="text-center">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ 
            backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
          }}
        >
          <span className="text-xl">🎯</span>
          <span className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>
            Wave {currentRound} of 3
          </span>
        </div>
        
        <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          {currentRound === 1 ? 'Bubble Pop!' : currentRound === 2 ? 'Faster Bubbles!' : 'Final Wave!'}
        </h3>
        
        <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {currentRound === 1 
            ? 'Pop the rising bubbles before they float away! Tap fast!'
            : currentRound === 2
              ? 'The bubbles are getting faster. Can you keep up?'
              : 'Maximum chaos! Pop everything you can!'}
        </p>
        
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((round) => (
            <div
              key={round}
              className={`h-3 rounded-full transition-all duration-300 ${
                round <= currentRound ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ 
                backgroundColor: round <= currentRound ? 'var(--primary-color)' : 'var(--border-secondary)',
                width: `${40 + round * 10}px`
              }}
            />
          ))}
        </div>
        
        <button
          onClick={startRound}
          className="px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
            boxShadow: '0 4px 20px var(--primary-color-glow)'
          }}
        >
          {currentRound === 1 ? "Let's Go!" : 'Next Wave!'}
        </button>
        
        {displayTotalStats.hits > 0 && (
          <div 
            className="mt-6 p-4 rounded-xl transition-colors duration-300"
            style={{ backgroundColor: 'var(--bg-input)' }}
          >
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Popped:</span>
                <span className="ml-2 font-bold" style={{ color: 'var(--primary-color)' }}>{displayTotalStats.hits}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Best Streak:</span>
                <span className="ml-2 font-bold text-amber-400">{displayTotalStats.bestStreak}🔥</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Game stage
  const stageBgColor = isDark ? '#030712' : '#f1f5f9';
  const columnColor = isDark ? '#1f2937' : '#e2e8f0';
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎯</span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Wave {currentRound}</span>
        </div>
        
        <div 
          className={`px-4 py-2 rounded-xl font-mono font-bold text-xl ${
            timeRemaining <= 5 ? 'text-red-400 animate-pulse' : ''
          }`}
          style={{ 
            backgroundColor: timeRemaining <= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--primary-color-rgb), 0.1)',
            color: timeRemaining <= 5 ? '#f87171' : 'var(--primary-color)'
          }}
        >
          {timeRemaining}s
        </div>
        
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold" style={{ color: 'var(--primary-color)' }}>{displayRoundStats.hits}</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Popped</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-amber-400">{displayRoundStats.streak}🔥</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Streak</div>
          </div>
        </div>
      </div>
      
      <div 
        className="rounded-2xl overflow-hidden flex justify-center transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--bg-stage)',
          border: '1px solid var(--border-primary)'
        }}
      >
        <Stage
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          style={{ cursor: 'crosshair' }}
          onMouseMove={(e) => {
            if (isPlayingRef.current && motorTrackerRef.current) {
              motorTrackerRef.current.trackPointerMove(e.evt);
            }
          }}
          onTouchMove={(e) => {
            if (isPlayingRef.current && motorTrackerRef.current) {
              motorTrackerRef.current.trackPointerMove(e.evt);
            }
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT} fill={stageBgColor} />
            
            {[1, 2, 3, 4].map((i) => (
              <Rect
                key={i}
                x={i * COLUMN_WIDTH - 0.5}
                y={0}
                width={1}
                height={STAGE_HEIGHT}
                fill={columnColor}
              />
            ))}
            
            {bubbles.map((bubble) => (
              <Circle
                key={bubble.id}
                x={bubble.x}
                y={bubble.y}
                radius={bubble.radius}
                fill={primaryColor}
                shadowColor={primaryColor}
                shadowBlur={15}
                shadowOpacity={0.5}
                onClick={(e) => handleBubbleClick(bubble, e)}
                onTap={(e) => handleBubbleClick(bubble, e)}
              />
            ))}
          </Layer>
        </Stage>
      </div>
      
      <div className="mt-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        🎯 Tap fast! Don't let them float away!
      </div>
    </div>
  );
};

export default MotorChallenge;

