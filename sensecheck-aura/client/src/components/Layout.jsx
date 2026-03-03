import { useNavigate } from 'react-router-dom';
import logo from '../resources/logo.png';

const Layout = ({ children, title, subtitle, showHome = true }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-black relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top swoosh */}
        <svg viewBox="0 0 1200 200" className="absolute -top-20 left-0 w-full opacity-10">
          <path
            d="M0,100 Q300,180 600,100 T1200,100 L1200,0 L0,0 Z"
            fill="url(#auraGradientLayout)"
          />
          <defs>
            <linearGradient id="auraGradientLayout" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--primary-color-dark)" />
              <stop offset="100%" stopColor="var(--primary-color)" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Floating orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)' }} />
        <div className="absolute bottom-1/3 left-1/5 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)' }} />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-gray-800/50">
        <div className="glass">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* AURA Logo */}
                <img src={logo} alt="AURA Logo" className="w-10 h-10 object-contain" />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    AURA
                  </h1>
                  {subtitle && (
                    <p className="text-xs font-medium tracking-wider uppercase" style={{ color: 'var(--primary-color)' }}>{subtitle}</p>
                  )}
                </div>
              </div>
              {showHome && (
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700/50 transition-all duration-300 text-sm font-medium text-gray-300 hover:text-white"
                  style={{ '--hover-border': 'var(--primary-color)' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(var(--primary-color-rgb), 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="hidden sm:inline">Home</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {title && (
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-white">{title}</h2>
            <div className="w-20 h-1 mx-auto rounded-full bg-aura-gradient"></div>
          </div>
        )}
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50">
        <div className="glass py-4">
          <div className="container mx-auto px-4 text-center">
            <p className="text-gray-500 text-xs sm:text-sm">
              Powered by <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>AURA</span> • Unleash the Future of UI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
