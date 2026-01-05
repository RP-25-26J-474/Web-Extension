import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import auraIntegration from './utils/auraIntegration';

// Game Flow
import { GameProvider } from './context/GameContext';
import GameFlow from './components/game/GameFlow';

// Pages
import Home from './pages/Home';
import Complete from './pages/Complete';

// Legacy individual tests (kept for backwards compatibility)
import ColorBlindnessTest from './modules/Visual/ColorBlindnessTest';
import VisualAcuityTest from './modules/Visual/VisualAcuityTest';
import MotorSkillsGame from './modules/Motor/MotorSkillsGame';
import LiteracyQuiz from './modules/Literacy/LiteracyQuiz';

function App() {
  // Initialize AURA session on app mount if in AURA mode
  useEffect(() => {
    if (auraIntegration.isEnabled()) {
      console.log('🌟 AURA mode detected, starting onboarding session');
      
      // Collect device info
      const deviceInfo = {
        device: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          pixelRatio: window.devicePixelRatio,
        },
        game: {
          canvasWidth: 800,
          canvasHeight: 600,
        },
        perf: {
          memory: performance.memory ? {
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
          } : null,
        },
      };
      
      auraIntegration.startSession(deviceInfo).catch((error) => {
        console.error('❌ Failed to start AURA session:', error);
      });
    }
  }, []);
  
  return (
    <Router>
      <GameProvider>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            
            {/* Unified game flow */}
            <Route path="/play" element={<GameFlow />} />
            
            {/* Legacy routes - kept for backwards compatibility */}
            <Route path="/perception/color-blindness" element={<ColorBlindnessTest />} />
            <Route path="/perception/visual-acuity" element={<VisualAcuityTest />} />
            <Route path="/reaction/motor-skills" element={<MotorSkillsGame />} />
            <Route path="/knowledge/literacy" element={<LiteracyQuiz />} />
            <Route path="/complete" element={<Complete />} />
          </Routes>
        </div>
      </GameProvider>
    </Router>
  );
}

export default App;
