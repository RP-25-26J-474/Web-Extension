import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Circle, Rect } from 'react-konva';
import useStore from '../../state/store';
import MotorSkillsTracker from '../../utils/motorSkillsTracking';
import usePerformanceMetrics from '../../hooks/usePerformanceMetrics';
import logo from '../../resources/logo.png';
import auraIntegration from '../../utils/auraIntegration';

// Get primary color from CSS variable for canvas elements
const getPrimaryColor = () => getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#1FB854';
const getPrimaryColorRGB = () => getComputedStyle(document.documentElement).getPropertyValue('--primary-color-rgb').trim() || '31, 184, 84';

// Bubble patterns for each round - consistent across players
const BUBBLE_PATTERNS = [
  // Round 1: Slow, simple pattern
  {
    speed: 1.5,
    spawnInterval: 1200,
    duration: 20000,
    pattern: [0, 1, 2, 3, 4, 0, 2, 4, 1, 3, 2, 0, 4, 1, 3],
  },
  // Round 2: Medium speed, more bubbles
  {
    speed: 2.5,
    spawnInterval: 900,
    duration: 20000,
    pattern: [1, 3, 0, 4, 2, 1, 3, 0, 2, 4, 1, 0, 3, 2, 4, 1, 3],
  },
  // Round 3: Fast, complex pattern
  {
    speed: 3.5,
    spawnInterval: 700,
    duration: 20000,
    pattern: [2, 0, 4, 1, 3, 2, 4, 0, 3, 1, 4, 2, 0, 3, 1, 4, 2, 0, 1, 3],
  },
];

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const COLUMN_WIDTH = STAGE_WIDTH / 5;
const BUBBLE_RADIUS = 25;

const MotorSkillsGame = () => {
  const navigate = useNavigate();
  const sessionId = useStore((state) => state.sessionId);
  const { setMotorRound, completeMotorSkillsTest, completeModule } = useStore();
  
  // Enhanced motor skills tracking (only for this module)
  const motorTrackerRef = useRef(null);
  
  // Performance metrics tracking
  const perfMetrics = usePerformanceMetrics();
  const perfMetricsRef = useRef(null);

  // Load initial round from sessionStorage (persisted progress)
  const getInitialRound = () => {
    const savedRound = sessionStorage.getItem('sensecheck_motor_current_round');
    return savedRound ? parseInt(savedRound, 10) : 1;
  };

  // Check if user has already started the test (to skip instructions on resume)
  const hasStartedTest = () => {
    return sessionStorage.getItem('sensecheck_motor_started') === 'true';
  };
  
  const [currentRound, setCurrentRound] = useState(getInitialRound);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const [roundStartTime, setRoundStartTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [isComplete, setIsComplete] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false); // Prevent restart during completion
  const [isTransitioning, setIsTransitioning] = useState(false); // Track round transition state
  const [interactions, setInteractions] = useState([]);
  const [showInstructions, setShowInstructions] = useState(!hasStartedTest()); // Show instructions only if not resumed

  const bubblesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const roundTimerRef = useRef(null);
  const patternIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const cursorSamplingRef = useRef(null);
  const stageRef = useRef(null);

  const currentPattern = BUBBLE_PATTERNS[currentRound - 1];
  
  // Initialize motor skills tracker
  useEffect(() => {
    if (!motorTrackerRef.current && sessionId) {
      motorTrackerRef.current = new MotorSkillsTracker(sessionId);
      console.log('🎯 Motor skills enhanced tracking initialized');
    }
  }, [sessionId]);
  
  // Check if motor test was already completed (module marked complete in store)
  const motorCompleted = useStore((state) => state.motorSkillsData.completed);
  useEffect(() => {
    if (motorCompleted) {
      setIsComplete(true);
    }
  }, [motorCompleted]);
  
  // Update isPlaying ref to avoid stale closure issues
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Generate unique bubble ID
  const generateBubbleId = () => {
    return `bubble_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  // Spawn a new bubble
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

    // Track bubble spawn with enhanced tracker
    if (motorTrackerRef.current) {
      motorTrackerRef.current.trackBubbleSpawn(newBubble);
    }
  }, [currentRound]);

  // Animation loop
  const animate = useCallback(() => {
    // Record frame timing for performance metrics
    perfMetrics.recordFrame();
    
    const now = Date.now();
    const updatedBubbles = bubblesRef.current.filter((bubble) => {
      bubble.y -= bubble.speed;
      
      // Remove if off screen (top of canvas)
      if (bubble.y < -BUBBLE_RADIUS) {
        // Track bubble escape with enhanced tracker
        if (motorTrackerRef.current) {
          motorTrackerRef.current.trackBubbleMiss(bubble);
        }
        return false;
      }
      return true;
    });

    bubblesRef.current = updatedBubbles;
    setBubbles([...updatedBubbles]);
    
    // Continue animation loop using ref to avoid stale closure
    if (isPlayingRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [perfMetrics]);

  // Handle bubble click
  const handleBubbleClick = (bubble, event) => {
    // Record input event for input lag estimation
    perfMetrics.recordInputEvent(event.evt?.timeStamp);
    
    // Track bubble hit with enhanced metrics
    if (motorTrackerRef.current) {
      motorTrackerRef.current.trackBubbleHit(bubble, event.evt);
      // NOTE: Don't call trackPointerUp here - it creates duplicate events!
      // trackBubbleHit already logs all the data we need
    }

    // Remove bubble
    bubblesRef.current = bubblesRef.current.filter((b) => b.id !== bubble.id);
    setBubbles([...bubblesRef.current]);
  };

  // Handle stage click (miss)
  const handleStageClick = (event) => {
    // Record input event for input lag estimation
    perfMetrics.recordInputEvent(event.evt?.timeStamp);
    
    // Track missed click with enhanced tracker
    if (motorTrackerRef.current) {
      motorTrackerRef.current.trackPointerUp(event.evt, null, false);
    }
  };

  // Track mouse/touch movement during game
  const handlePointerMove = (event) => {
    if (!isPlaying || !motorTrackerRef.current) return;
    
    // Track movement for velocity, acceleration, trajectory
    motorTrackerRef.current.trackPointerMove(event.evt);
  };
  
  // Track pointer down
  const handlePointerDown = (event) => {
    if (!isPlaying || !motorTrackerRef.current) return;
    
    motorTrackerRef.current.trackPointerDown(event.evt);
  };

  // Track distance history for overshoot debug
  const distanceHistoryRef = useRef([]);
  const lastDebugLogRef = useRef(0);
  
  // Continuous cursor sampling at 60Hz for better feature extraction
  const sampleCursorPosition = useCallback(() => {
    if (!isPlayingRef.current) return;
    
    const stage = stageRef.current;
    if (stage && motorTrackerRef.current) {
      const pointerPos = stage.getPointerPosition();
      if (pointerPos) {
        // Create a fake event object with the cursor position
        const fakeEvent = {
          clientX: pointerPos.x,
          clientY: pointerPos.y,
        };
        motorTrackerRef.current.trackPointerMove(fakeEvent);
        
        // DEBUG: Track distance to nearest bubble for overshoot detection
        if (bubblesRef.current.length > 0) {
          let minDist = Infinity;
          let nearestBubble = null;
          
          for (const bubble of bubblesRef.current) {
            const dx = pointerPos.x - bubble.x;
            const dy = pointerPos.y - bubble.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              nearestBubble = bubble;
            }
          }
          
          // Add to history
          distanceHistoryRef.current.push(minDist);
          if (distanceHistoryRef.current.length > 100) {
            distanceHistoryRef.current.shift();
          }
          
          // Check for overshoot (distance was decreasing, now increasing)
          const history = distanceHistoryRef.current;
          if (history.length >= 3) {
            const prev2 = history[history.length - 3];
            const prev1 = history[history.length - 2];
            const curr = history[history.length - 1];
            
            const wasApproaching = prev1 < prev2;
            const nowReceding = curr > prev1;
            const nearTarget = curr < BUBBLE_RADIUS * 4; // Within 4x radius (~100px)
            
            // Log every 500ms OR when overshoot detected
            const now = Date.now();
            if (wasApproaching && nowReceding && nearTarget) {
              console.log(`🎯 OVERSHOOT DETECTED! Distance: ${curr.toFixed(1)}px (was ${prev1.toFixed(1)}px, now ${curr.toFixed(1)}px)`);
              distanceHistoryRef.current = []; // Reset to avoid double-counting
            } else if (now - lastDebugLogRef.current > 500 && nearTarget) {
              console.log(`📍 Near bubble: ${minDist.toFixed(1)}px (threshold: ${(BUBBLE_RADIUS * 4).toFixed(1)}px)`);
              lastDebugLogRef.current = now;
            }
          }
        }
      }
    }
    
    // Continue sampling
    cursorSamplingRef.current = requestAnimationFrame(sampleCursorPosition);
  }, []);

  // Dismiss instructions and start the game
  const handleStartGame = () => {
    sessionStorage.setItem('sensecheck_motor_started', 'true');
    setShowInstructions(false);
  };

  // Start round
  const startRound = () => {
    setIsPlaying(true);
    isPlayingRef.current = true; // Set ref synchronously for animation loop
    setRoundStartTime(Date.now());
    setTimeRemaining(currentPattern.duration / 1000);
    patternIndexRef.current = 0;
    bubblesRef.current = [];
    setBubbles([]);

    setMotorRound(currentRound);
    
    // Update tracker round
    if (motorTrackerRef.current) {
      motorTrackerRef.current.setRound(currentRound); // Use setRound method instead of direct assignment
    }
    
    // Start performance tracking on first round
    if (currentRound === 1) {
      perfMetrics.startTracking();
      console.log('📊 Performance tracking started');
    }

    // Start spawning bubbles
    spawnTimerRef.current = setInterval(() => {
      spawnBubble();
    }, currentPattern.spawnInterval);

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Start continuous cursor sampling at 60Hz
    cursorSamplingRef.current = requestAnimationFrame(sampleCursorPosition);

    // Round timer
    const startTime = Date.now();
    roundTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((currentPattern.duration - elapsed) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        endRound();
      }
    }, 100);
  };

  // End round
  const endRound = async () => {
    setIsPlaying(false);
    isPlayingRef.current = false; // Set ref synchronously to stop animation
    
    // Clear timers
    if (spawnTimerRef.current) {
      clearInterval(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (cursorSamplingRef.current) {
      cancelAnimationFrame(cursorSamplingRef.current);
      cursorSamplingRef.current = null;
    }

    // Track round completion and send to ML schemas
    if (motorTrackerRef.current) {
      try {
        // Calculate hits and misses from tracker's logged interactions
        const allInteractions = motorTrackerRef.current.getAllInteractions();
        const roundInteractions = allInteractions.filter(i => i.round === currentRound);
        const hits = roundInteractions.filter(i => i.eventType === 'bubble_hit').length;
        const misses = roundInteractions.filter(i => i.eventType === 'bubble_miss').length;
        
        await motorTrackerRef.current.trackRoundComplete({
          hits: hits,
          misses: misses,
          escaped: misses, // Escaped bubbles are the same as misses
          duration: BUBBLE_PATTERNS[currentRound - 1].duration,
          averageReactionTime: 0, // Could calculate this if needed
        });
      } catch (error) {
        console.error('Error tracking round completion:', error);
        // Continue game even if tracking fails
      }
    }

    // Clear remaining bubbles
    bubblesRef.current = [];
    setBubbles([]);

    // Move to next round or complete
    if (currentRound < 3) {
      // Set transitioning state to keep button disabled
      setIsTransitioning(true);
      setTimeout(() => {
        const nextRound = currentRound + 1;
        setCurrentRound(nextRound);
        // Save progress to sessionStorage for persistence across refresh
        sessionStorage.setItem('sensecheck_motor_current_round', nextRound.toString());
        // Allow button to be clickable again after round is updated
        setIsTransitioning(false);
      }, 2000);
    } else {
      // Mark as completing to prevent button from showing
      setIsCompleting(true);
      // Clear motor round progress on completion
      sessionStorage.removeItem('sensecheck_motor_current_round');
      sessionStorage.removeItem('sensecheck_motor_started');
      setTimeout(() => {
        completeTest();
      }, 500);
    }
  };

  // Complete test
  const completeTest = async () => {
    completeMotorSkillsTest();
    
    // Stop performance tracking and get final metrics
    const finalPerfMetrics = perfMetrics.stopTracking();
    perfMetricsRef.current = finalPerfMetrics;
    console.log('📊 Performance metrics:', finalPerfMetrics);
    
    // Flush remaining motor skills interactions
    if (motorTrackerRef.current) {
      try {
        await motorTrackerRef.current.complete();
        const totalInteractions = motorTrackerRef.current.getAllInteractions().length;
        console.log(`🎯 Motor skills tracking complete: ${totalInteractions} enhanced events tracked`);
        
        // Save to AURA backend if in AURA mode
        if (auraIntegration.isEnabled()) {
          console.log('🎯 Saving motor results to AURA backend');
          const allInteractions = motorTrackerRef.current.getAllInteractions();
          
          // Prepare simplified motor data for AURA
          // TODO: In future, compute proper attempts/roundSummaries from interactions
          const motorData = {
            attempts: allInteractions.filter(i => i.type === 'bubble_pop' || i.type === 'bubble_miss'),
            roundSummaries: [], // Can be computed from attempts if needed
            overallMetrics: {
              totalInteractions: allInteractions.length,
              performanceMetrics: finalPerfMetrics,
            },
          };
          
          await auraIntegration.saveMotorResults(
            motorData.attempts,
            motorData.roundSummaries,
            motorData.overallMetrics
          );
        }
      } catch (error) {
        console.error('Error completing motor skills tracking:', error);
      }
    }
    
    // Save performance metrics to session
    try {
      const { updateSessionPerformance } = await import('../../utils/api');
      await updateSessionPerformance(sessionId, finalPerfMetrics);
      console.log('📊 Performance metrics saved to session');
    } catch (error) {
      console.error('Error saving performance metrics:', error);
      // Continue even if saving fails
    }
    
    // Mark module as completed
    try {
      await completeModule('reaction');
    } catch (error) {
      console.error('Error completing module:', error);
    }
    
    // Always set complete, even if tracking fails
    setIsComplete(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Instructions Screen
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black relative overflow-hidden">
        {/* Decorative background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-15">
            <path
              d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z"
              fill="url(#auraGradientInstr)"
            />
            <defs>
              <linearGradient id="auraGradientInstr" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary-color-dark)" />
                <stop offset="100%" stopColor="var(--primary-color)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)' }} />
          <div className="absolute bottom-1/4 left-1/4 w-48 h-48 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)', animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 px-4 sm:px-6 py-8 sm:py-12 min-h-screen flex flex-col">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <img src={logo} alt="AURA Logo" className="w-12 h-12 object-contain" />
              <div className="text-left">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">AURA <span style={{ color: 'var(--primary-color)' }}>Reaction Lab</span></h1>
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--primary-color)' }}>Motor Skills Assessment</p>
              </div>
            </div>
          </div>

          {/* Instructions Card */}
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-2xl w-full">
              <div className="rounded-3xl bg-gray-900/70 backdrop-blur-xl border border-gray-800 p-6 sm:p-10 shadow-2xl">
                {/* Icon */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)', border: '1px solid rgba(var(--primary-color-rgb), 0.2)' }}>
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">How to Play</h2>
                  <p className="text-gray-400">Read these instructions carefully before starting</p>
                </div>

                {/* Instructions */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}>
                      <span className="text-white font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">Pop the Targets</h3>
                      <p className="text-sm text-gray-400">Green bubbles will rise from the bottom of the screen. Click or tap on them to pop them before they escape!</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}>
                      <span className="text-white font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">3 Rounds, Increasing Difficulty</h3>
                      <p className="text-sm text-gray-400">Complete 3 rounds of 20 seconds each. Speed and complexity increase with each round.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}>
                      <span className="text-white font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">We Track Your Movement</h3>
                      <p className="text-sm text-gray-400">Your cursor movements, click accuracy, and reaction times are recorded for analysis. Move naturally!</p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="rounded-xl p-4 mb-8" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)', border: '1px solid rgba(var(--primary-color-rgb), 0.2)' }}>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: 'var(--primary-color)' }}>Tips for Best Results</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• Use a mouse for better accuracy (touchscreen works too)</li>
                        <li>• Stay focused and keep your hand steady</li>
                        <li>• Don't worry about misses – just do your best!</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={handleStartGame}
                  className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white transition-all duration-300 shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                  style={{ 
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                    boxShadow: '0 4px 20px var(--primary-color-glow)'
                  }}
                >
                  <span>I'm Ready – Let's Start!</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-gray-600 text-xs tracking-wider">
              Powered by <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>AURA</span> • Unleash the Future of UI
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
        {/* Decorative swoosh element */}
        <div className="absolute top-0 left-0 w-full h-64 overflow-hidden pointer-events-none">
          <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-20">
            <path
              d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z"
              fill="url(#auraGradient)"
            />
            <defs>
              <linearGradient id="auraGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary-color-dark)" />
                <stop offset="100%" stopColor="var(--primary-color)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 px-6 py-12">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-tight text-white mb-2">
              AURA <span style={{ color: 'var(--primary-color)' }}>Reaction Lab</span>
            </h1>
            <p className="text-gray-400 text-sm tracking-widest uppercase">Motor Skills Assessment</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-10 shadow-2xl overflow-hidden">
              {/* Success glow effect */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.1) 0%, transparent 50%)' }} />
              
              {/* Checkmark icon */}
              <div className="relative flex justify-center mb-8">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark) 100%)', boxShadow: '0 10px 40px var(--primary-color-glow)' }}>
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              
              <h3 className="relative text-3xl font-bold text-center mb-2 text-white">Assessment Complete!</h3>
              <p className="text-center text-gray-400 mb-8">All rounds finished successfully</p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                  boxShadow: '0 4px 20px var(--primary-color-glow)'
                }}
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top swoosh decoration */}
        <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-15">
          <path
            d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z"
            fill="url(#auraGradientMain)"
          />
          <defs>
            <linearGradient id="auraGradientMain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4a7c23" />
              <stop offset="100%" stopColor="#8BC53F" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Floating orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-[#8BC53F]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-[#8BC53F]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1">
            AURA <span style={{ color: 'var(--primary-color)' }}>Reaction Lab</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm tracking-widest uppercase">Motor Skills Assessment</p>
        </div>

        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Status Bar */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Round Info */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.2) 0%, rgba(var(--primary-color-rgb), 0.05) 100%)', border: '1px solid rgba(var(--primary-color-rgb), 0.3)' }}>
                    <span className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--primary-color)' }}>{currentRound}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center border border-gray-700">
                    <span className="text-[10px] text-gray-400">/3</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Round {currentRound}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {isPlaying ? (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)' }} />
                        Pop the rising targets!
                      </span>
                    ) : isTransitioning ? (
                      'Preparing next round...'
                    ) : isCompleting ? (
                      'Finalizing...'
                    ) : (
                      'Ready when you are'
                    )}
                  </p>
                </div>
              </div>
              
              {/* Timer */}
              <div className="flex items-center gap-4">
                <div className="flex-1 sm:flex-none">
                  {/* Progress bar for mobile */}
                  <div className="sm:hidden h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full transition-all duration-200"
                      style={{ 
                        width: `${(timeRemaining / 20) * 100}%`,
                        background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--primary-color-light) 100%)'
                      }}
                    />
                  </div>
                  <div className="text-center sm:text-right">
                    <div className="text-4xl sm:text-5xl font-black tabular-nums" style={{ 
                      background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 0 40px var(--primary-color-glow)'
                    }}>
                      {timeRemaining}<span className="text-2xl sm:text-3xl">s</span>
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Time Left</div>
                  </div>
                </div>

                {/* Round indicators */}
                <div className="hidden sm:flex flex-col gap-1.5">
                  {[1, 2, 3].map((round) => (
                    <div 
                      key={round}
                      className="w-3 h-3 rounded-full transition-all duration-300"
                      style={
                        round < currentRound 
                          ? { backgroundColor: 'var(--primary-color)', boxShadow: '0 4px 15px var(--primary-color-glow)' }
                          : round === currentRound 
                            ? { backgroundColor: 'rgba(var(--primary-color-rgb), 0.5)', boxShadow: '0 0 0 2px var(--primary-color)', outline: '2px solid transparent', outlineOffset: '2px' }
                            : { backgroundColor: '#374151' }
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!isPlaying && !isCompleting && !isTransitioning && (
              <button
                onClick={startRound}
                className="w-full mt-5 py-4 px-6 rounded-xl font-bold text-base sm:text-lg text-white transition-all duration-300 shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                  boxShadow: '0 4px 20px var(--primary-color-glow)'
                }}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                </svg>
                {currentRound === 1 ? 'Start Assessment' : `Begin Round ${currentRound}`}
              </button>
            )}
            
            {isTransitioning && (
              <div className="mt-5 py-4 flex items-center justify-center gap-3" style={{ color: 'var(--primary-color)' }}>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '300ms' }} />
                </div>
                <span className="font-semibold">Preparing Round {currentRound + 1}</span>
              </div>
            )}
            
            {isCompleting && (
              <div className="mt-5 py-4 flex items-center justify-center gap-3" style={{ color: 'var(--primary-color)' }}>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="font-semibold">Completing Assessment...</span>
              </div>
            )}
          </div>

          {/* Game Stage */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl overflow-hidden">
            <div
              style={{ width: '100%', maxWidth: STAGE_WIDTH, height: STAGE_HEIGHT }}
              className="mx-auto rounded-xl overflow-hidden relative"
            >
              {/* Game canvas background with grid effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-black">
                {/* Grid pattern overlay */}
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(var(--primary-color-rgb), 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(var(--primary-color-rgb), 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />
                {/* Bottom glow */}
                <div className="absolute bottom-0 left-0 right-0 h-32" style={{ background: 'linear-gradient(to top, rgba(var(--primary-color-rgb), 0.1) 0%, transparent 100%)' }} />
              </div>

              <Stage
                ref={stageRef}
                width={STAGE_WIDTH}
                height={STAGE_HEIGHT}
                onClick={handleStageClick}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                style={{ cursor: isPlaying ? 'crosshair' : 'default' }}
              >
                <Layer>
                  {/* Column dividers with gradient effect */}
                  {[1, 2, 3, 4].map((i) => (
                    <Rect
                      key={`divider-${i}`}
                      x={i * COLUMN_WIDTH - 0.5}
                      y={0}
                      width={1}
                      height={STAGE_HEIGHT}
                      fill="rgba(31, 184, 84, 0.15)"
                    />
                  ))}

                  {/* Target bubbles - AURA green themed */}
                  {bubbles.map((bubble) => (
                    <Circle
                      key={bubble.id}
                      x={bubble.x}
                      y={bubble.y}
                      radius={bubble.radius}
                      fill="rgba(31, 184, 84, 0.85)"
                      stroke="rgba(62, 212, 111, 0.8)"
                      strokeWidth={3}
                      onClick={(e) => handleBubbleClick(bubble, e)}
                      onTap={(e) => handleBubbleClick(bubble, e)}
                      shadowColor="#1FB854"
                      shadowBlur={20}
                      shadowOpacity={0.7}
                    />
                  ))}
                </Layer>
              </Stage>

              {/* Column zone indicators */}
              <div className="absolute bottom-0 left-0 right-0 flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    style={{ width: COLUMN_WIDTH, borderTop: '1px solid rgba(var(--primary-color-rgb), 0.2)' }} 
                    className="text-center py-2"
                  >
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(var(--primary-color-rgb), 0.4)' }}>
                      Zone {i}
                    </span>
                  </div>
                ))}
              </div>

              {/* Play overlay when not playing */}
              {!isPlaying && !isTransitioning && !isCompleting && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)', border: '2px solid rgba(var(--primary-color-rgb), 0.5)' }}>
                      <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-color)' }}>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm">Click the button above to start</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Panel */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)', border: '1px solid rgba(var(--primary-color-rgb), 0.2)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white mb-2">How to Play</h4>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--primary-color)' }}>1</span>
                    </span>
                    <span>Click or tap the rising targets</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--primary-color)' }}>2</span>
                    </span>
                    <span>Targets appear in 5 zones</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--primary-color)' }}>3</span>
                    </span>
                    <span>Speed increases each round</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-gray-600 text-xs tracking-wider">
            Powered by <span className="text-[#8BC53F] font-semibold">AURA</span> • Unleash the Future of UI
          </p>
        </div>
      </div>
    </div>
  );
};

export default MotorSkillsGame;

