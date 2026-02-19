import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import logo from '../../resources/logo.png';
import { 
  TowerControl, 
  Palette, 
  Focus, 
  CloudOff, 
  Settings,
  Sparkles,
  ChevronRight,
  Radio
} from 'lucide-react';

const IntroScreen = () => {
  const { startGame } = useGame();
  const { isDark } = useTheme();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = () => {
    setIsStarting(true);
    setTimeout(() => {
      startGame();
    }, 600);
  };

  const systems = [
    {
      icon: <Palette size={20} />,
      name: 'Calibrate the Light Colors',
      description: 'Align the prism so signals are not lost'
    },
    {
      icon: <Focus size={20} />,
      name: 'Focus the Beam',
      description: 'Sharpen the light to reach distant signals'
    },
    {
      icon: <CloudOff size={20} />,
      name: 'Clear the Rising Fog',
      description: 'Remove corrupted data blocking the path'
    },
    {
      icon: <Settings size={20} />,
      name: 'Restore the Control Panel',
      description: 'Make correct operational decisions'
    }
  ];

  return (
    <div 
      className={`min-h-screen relative overflow-hidden transition-all duration-700 ${isStarting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
      style={{ background: 'var(--gradient-bg)' }}
    >
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main lighthouse glow */}
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse"
          style={{ 
            backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.15 : 0.1})`,
          }}
        />
        
        {/* Secondary glow */}
        <div 
          className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl animate-pulse"
          style={{ 
            backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.08 : 0.06})`,
            animationDelay: '1.5s'
          }}
        />
        
        {/* Accent glow */}
        <div 
          className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full blur-2xl animate-pulse"
          style={{ 
            backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.1 : 0.08})`,
            animationDelay: '2.5s'
          }}
        />

        {/* Floating particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full animate-float"
            style={{
              backgroundColor: `rgba(var(--primary-color-rgb), ${isDark ? 0.5 : 0.4})`,
              left: `${10 + (i * 7)}%`,
              top: `${20 + (i % 4) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + (i % 3)}s`
            }}
          />
        ))}
      </div>

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full text-center">
          
          {/* Logo and Title */}
          <div className="mb-8 animate-fadeIn">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img 
                src={logo} 
                alt="Logo" 
                className="w-12 h-12 object-contain"
              />
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ 
                  background: `linear-gradient(135deg, var(--primary-color), var(--primary-color-dark))`,
                  boxShadow: `0 8px 32px rgba(var(--primary-color-rgb), 0.3)`
                }}
              >
                <TowerControl size={28} className="text-white" />
              </div>
            </div>
            
            <h1 
              className="text-3xl sm:text-4xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              The Lighthouse of Clarity
            </h1>
            
            <p 
              className="text-lg"
              style={{ color: 'var(--text-secondary)' }}
            >
              A journey of restoration
            </p>
          </div>

          {/* Story Card */}
          <div 
            className="backdrop-blur-xl rounded-3xl p-6 sm:p-8 mb-8 text-left animate-fadeInUp"
            style={{ 
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
              animationDelay: '0.2s'
            }}
          >
            {/* Story intro */}
            <div className="flex items-start gap-4 mb-6">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ 
                  background: `rgba(var(--primary-color-rgb), 0.15)`,
                }}
              >
                <Radio size={20} style={{ color: 'var(--primary-color)' }} />
              </div>
              <div>
                <p 
                  className="text-base leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  An ancient digital lighthouse has gone dark. It once guided lost signals — people, 
                  data, and connections — safely through the noise. Now its systems need restoration.
                </p>
              </div>
            </div>

            {/* Mission */}
            <div 
              className="rounded-2xl p-4 mb-6"
              style={{ 
                background: `linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.08), rgba(var(--primary-color-rgb), 0.02))`,
                border: '1px solid rgba(var(--primary-color-rgb), 0.15)'
              }}
            >
              <p 
                className="text-sm font-medium text-center"
                style={{ color: 'var(--primary-color)' }}
              >
                <Sparkles size={16} className="inline-block mr-2" />
                Your mission: Restore the four core systems and reactivate the lighthouse.
              </p>
            </div>

            {/* Systems list */}
            <div className="space-y-3">
              <p 
                className="text-xs uppercase tracking-wider font-semibold mb-3"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Systems to Restore
              </p>
              
              {systems.map((system, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    animationDelay: `${0.4 + index * 0.1}s`
                  }}
                >
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: `rgba(var(--primary-color-rgb), 0.12)`,
                      color: 'var(--primary-color)'
                    }}
                  >
                    {system.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p 
                      className="font-medium text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {system.name}
                    </p>
                    <p 
                      className="text-xs truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {system.description}
                    </p>
                  </div>
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ 
                      backgroundColor: `rgba(var(--primary-color-rgb), 0.1)`,
                      color: 'var(--primary-color)'
                    }}
                  >
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <div className="animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="group relative px-10 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, var(--primary-color), var(--primary-color-dark))`,
                color: 'white',
                boxShadow: `0 8px 32px rgba(var(--primary-color-rgb), 0.35)`
              }}
            >
              <span className="flex items-center gap-2">
                Begin Restoration
                <ChevronRight 
                  size={22} 
                  className="transition-transform duration-300 group-hover:translate-x-1" 
                />
              </span>
              
              {/* Button glow effect */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(135deg, var(--primary-color-light), var(--primary-color))`,
                  filter: 'blur(20px)',
                  zIndex: -1
                }}
              />
            </button>

            <p 
              className="mt-4 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Takes about 5-10 minutes • Progress is auto-saved
            </p>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.8; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default IntroScreen;


