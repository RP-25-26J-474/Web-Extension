import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import logo from '../resources/logo.png';
import auraIntegration from '../utils/auraIntegration';

const Home = () => {
  const navigate = useNavigate();
  const completedModules = useStore((state) => state.completedModules);
  const loadSessionData = useStore((state) => state.loadSessionData);
  const [loading, setLoading] = useState(true);

  // Load session data on mount
  useEffect(() => {
    const initializeSession = async () => {
      console.log('🏠 Home page: Loading session data...');
      await loadSessionData();
      
      // In AURA mode, user data comes from registration
      if (auraIntegration.isEnabled()) {
        console.log('✅ AURA mode: User data from registration');
      }
      
      setLoading(false);
    };
    
    initializeSession();
  }, [loadSessionData]);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading) {
        console.log('🔄 Page visible again, reloading session data...');
        loadSessionData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadSessionData, loading]);

  const handleModuleClick = (path, moduleId) => {
    const completed = isModuleCompleted(moduleId);
    if (!completed) {
      navigate(path);
    }
  };

  const modules = [
    {
      id: 'perception',
      name: 'Perception Lab',
      description: 'Visual impairment detection through color blindness and visual acuity tests',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      tests: [
        { name: 'Color Blindness Test', path: '/perception/color-blindness' },
        { name: 'Visual Acuity Test', path: '/perception/visual-acuity' },
      ],
    },
    {
      id: 'reaction',
      name: 'Reaction Lab',
      description: 'Motor skill assessment through interactive target tracking game',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      tests: [
        { name: 'Motor Skills Game', path: '/reaction/motor-skills' },
      ],
    },
    {
      id: 'knowledge',
      name: 'Knowledge Console',
      description: 'Computer literacy evaluation through interactive quiz',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      tests: [
        { name: 'Literacy Quiz', path: '/knowledge/literacy' },
      ],
    },
  ];

  const isModuleCompleted = (moduleName) => {
    return completedModules.some((m) => m.moduleName === moduleName || m.name === moduleName);
  };

  const completedCount = modules.filter(m => isModuleCompleted(m.id)).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <img src={logo} alt="AURA Logo" className="w-16 h-16 mx-auto mb-6 animate-pulse" />
          <p className="text-gray-400 text-sm">Initializing AURA...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black relative overflow-hidden">
        {/* Decorative background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-10">
            <path
              d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z"
              fill="url(#homeGradient)"
            />
            <defs>
              <linearGradient id="homeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary-color-dark)" />
                <stop offset="100%" stopColor="var(--primary-color)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)' }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)', animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero Section */}
          <div className="text-center mb-12 max-w-4xl mx-auto">
            {/* Logo */}
            <div className="inline-flex items-center gap-3 mb-6">
              <img src={logo} alt="AURA Logo" className="w-14 h-14 object-contain" />
              <div className="text-left">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">AURA</h1>
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--primary-color)' }}>Assessment Suite</p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-white">
              Welcome, <span className="text-aura-gradient">Digital Navigator</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
              Complete the assessment modules below to evaluate your sensory perception, 
              motor skills, and cognitive abilities. Your progress is automatically saved.
            </p>

            {/* Progress indicator */}
            <div className="mt-8 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-gray-900/50 border border-gray-800">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div 
                    key={i}
                    className="w-3 h-3 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: i < completedCount ? 'var(--primary-color)' : '#374151',
                      boxShadow: i < completedCount ? '0 0 10px var(--primary-color-glow)' : 'none'
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-400">
                <span className="font-bold" style={{ color: 'var(--primary-color)' }}>{completedCount}</span> of 3 modules complete
              </span>
            </div>
          </div>

          {/* Modules Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            {modules.map((module, index) => {
              const completed = isModuleCompleted(module.id);
              
              return (
                <div
                  key={module.id}
                  className="group relative rounded-2xl p-6 transition-all duration-500 bg-gray-900/70 border"
                  style={{ 
                    borderColor: completed ? 'rgba(var(--primary-color-rgb), 0.3)' : '#1f2937',
                    animationDelay: `${index * 100}ms`
                  }}
                  onMouseEnter={(e) => !completed && (e.currentTarget.style.borderColor = 'rgba(var(--primary-color-rgb), 0.5)')}
                  onMouseLeave={(e) => !completed && (e.currentTarget.style.borderColor = '#1f2937')}
                >
                  {/* Completed overlay glow */}
                  {completed && (
                    <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.05) 0%, transparent 100%)' }} />
                  )}

                  <div className="relative">
                    {/* Icon */}
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                      style={{ 
                        backgroundColor: completed ? 'rgba(var(--primary-color-rgb), 0.2)' : '#1f2937',
                        color: completed ? 'var(--primary-color)' : '#9ca3af'
                      }}
                    >
                      {module.icon}
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold mb-2 text-white">{module.name}</h3>
                    <p className="text-sm text-gray-400 mb-5 leading-relaxed">{module.description}</p>

                    {/* Test buttons */}
                    <div className="space-y-2">
                      {module.tests.map((test) => (
                        <button
                          key={test.path}
                          onClick={() => handleModuleClick(test.path, module.id)}
                          disabled={completed}
                          className="w-full px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-between"
                          style={{ 
                            background: completed 
                              ? 'rgba(31, 41, 55, 0.5)' 
                              : 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                            color: completed ? '#6b7280' : 'white',
                            cursor: completed ? 'not-allowed' : 'pointer',
                            opacity: completed ? 0.5 : 1
                          }}
                        >
                          <span>{test.name}</span>
                          {completed ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: '#6b7280' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Completed badge */}
                    {completed && (
                      <div 
                        className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl"
                        style={{ 
                          backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                          border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--primary-color)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-semibold" style={{ color: 'var(--primary-color)' }}>Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                    border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
                  }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-4">Instructions</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { num: '1', text: 'Complete each module in any order.' },
                      { num: '2', text: 'Ensure you\'re in a quiet environment with good lighting for accurate results.' },
                      { num: '3', text: 'For visual tests, sit approximately 100cm from your screen.' },
                      { num: '4', text: 'Take your time - accuracy matters more than speed (except in Reaction Lab).' },
                    ].map((item) => (
                      <div key={item.num} className="flex items-start gap-3">
                        <span 
                          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ 
                            backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)',
                            color: 'var(--primary-color)'
                          }}
                        >
                          {item.num}
                        </span>
                        <p className="text-sm text-gray-400 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12">
            <p className="text-gray-600 text-xs tracking-wider">
              Powered by <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>AURA</span> • Unleash the Future of UI
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
