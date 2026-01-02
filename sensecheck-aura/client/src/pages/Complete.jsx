import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import logo from '../resources/logo.png';
import auraIntegration from '../utils/auraIntegration';

const Complete = () => {
  const navigate = useNavigate();
  const completedModules = useStore((state) => state.completedModules);

  useEffect(() => {
    // Complete AURA onboarding if in AURA mode
    if (auraIntegration.isEnabled()) {
      console.log('✅ Completing AURA onboarding');
      auraIntegration.completeOnboarding()
        .then((result) => {
          console.log('🎉 AURA onboarding completed:', result);
          // Close tab and redirect back to extension after 3 seconds
          setTimeout(() => {
            auraIntegration.redirectToExtension();
          }, 3000);
        })
        .catch((error) => {
          console.error('❌ Failed to complete AURA onboarding:', error);
        });
    } else {
      // Standalone mode: redirect to home after 10 seconds
    const timer = setTimeout(() => {
      navigate('/');
    }, 10000);

    return () => clearTimeout(timer);
    }
  }, [navigate]);

  const modules = [
    { id: 'perception', name: 'Perception Lab', icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )},
    { id: 'reaction', name: 'Reaction Lab', icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )},
    { id: 'knowledge', name: 'Knowledge Console', icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black relative overflow-hidden">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-15">
          <path
            d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z"
            fill="url(#completeGradient)"
          />
          <defs>
            <linearGradient id="completeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--primary-color-dark)" />
              <stop offset="100%" stopColor="var(--primary-color)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)' }} />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)', animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 px-4 sm:px-6 py-12 min-h-screen flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full">
          {/* Success Card */}
          <div className="rounded-3xl bg-gray-900/70 backdrop-blur-xl border border-gray-800 p-8 sm:p-10 shadow-2xl text-center relative overflow-hidden">
            {/* Success glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.1) 0%, transparent 50%)' }} />
            
            {/* Checkmark with logo */}
            <div className="relative mb-8">
              <div 
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center shadow-xl"
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark) 100%)',
                  boxShadow: '0 10px 40px var(--primary-color-glow)'
                }}
              >
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {/* Celebration rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full animate-ping" style={{ border: '2px solid rgba(var(--primary-color-rgb), 0.2)', animationDuration: '2s' }} />
              </div>
            </div>
            
            <h2 className="relative text-3xl sm:text-4xl font-bold mb-3 text-white">
              Assessment Complete!
            </h2>
            <p className="relative text-lg text-gray-400 mb-8">
              Thank you for participating in the AURA assessment.
            </p>

            {/* Completed Modules */}
            <div className="relative bg-gray-800/50 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Modules Completed</h3>
              <div className="grid grid-cols-3 gap-3">
                {modules.map((module) => (
                  <div key={module.id} className="p-4 rounded-xl bg-gray-900/50 border border-gray-700/50">
                    <div 
                      className="w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center"
                      style={{ 
                        backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)',
                        color: 'var(--primary-color)'
                      }}
                    >
                      {module.icon}
                    </div>
                    <div className="text-xs text-gray-400">{module.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Thank You Message */}
            <div 
              className="relative rounded-xl p-5 mb-6"
              style={{ 
                backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
              }}
            >
              <div className="flex items-start gap-3 text-left">
                <div 
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--primary-color)' }}>Your Contribution Matters</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Your participation provides valuable data for research. All information is anonymous and used solely for improving digital accessibility.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Badge */}
            <div className="relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-800/50 border border-gray-700/50 mb-6">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs text-gray-500">Data stored anonymously and securely</span>
            </div>

            {/* Action Button */}
            <button
              onClick={() => navigate('/')}
              className="relative w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ 
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
                boxShadow: '0 4px 20px var(--primary-color-glow)'
              }}
            >
              Return to Home
            </button>

            <p className="relative text-gray-600 text-xs mt-4">
              Redirecting automatically in a few seconds...
            </p>
          </div>

          {/* What's Next Card */}
          <div className="mt-6 rounded-2xl bg-gray-900/50 border border-gray-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">What Happens Next?</h3>
            <div className="space-y-3">
              {[
                'Your data has been securely stored in our research database',
                'Researchers will analyze patterns and insights from collected data',
                'Results may contribute to improving digital accessibility',
                'All data remains anonymous and is used exclusively for research',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div 
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--primary-color)' }} />
                  </div>
                  <p className="text-sm text-gray-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-xs tracking-wider">
            Powered by <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>AURA</span> • Unleash the Future of UI
          </p>
        </div>
      </div>
    </div>
  );
};

export default Complete;
