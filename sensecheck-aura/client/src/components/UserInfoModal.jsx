import { useState } from 'react';
import { createSession } from '../utils/api';
import useStore from '../state/store';
import useDeviceInfo from '../hooks/useDeviceInfo';
import logo from '../resources/logo.png';

const UserInfoModal = ({ isOpen, onClose, onSubmit }) => {
  const sessionId = useStore((state) => state.sessionId);
  const deviceInfo = useDeviceInfo();
  
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    const age = parseInt(formData.age);
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (isNaN(age) || age < 1 || age > 120) {
      newErrors.age = 'Please enter a valid age (1-120)';
    }

    if (!formData.gender) {
      newErrors.gender = 'Please select a gender';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await createSession({
        sessionId,
        userAgent: deviceInfo.userAgent,
        screenResolution: deviceInfo.screenResolution,
        deviceType: deviceInfo.deviceType,
        preferredTheme: deviceInfo.preferredTheme,
        viewportWidth: deviceInfo.viewportWidth,
        viewportHeight: deviceInfo.viewportHeight,
        highContrastMode: deviceInfo.highContrastMode,
        reducedMotionPreference: deviceInfo.reducedMotionPreference,
        devicePixelRatio: deviceInfo.devicePixelRatio,
        hardwareConcurrency: deviceInfo.hardwareConcurrency,
        pageLoadTime: deviceInfo.pageLoadTime,
        connectionType: deviceInfo.connectionType,
        memory: deviceInfo.memory,
        platform: deviceInfo.platform,
        language: deviceInfo.language,
        device: deviceInfo.device,
        screen: deviceInfo.screen,
        userInfo: {
          age: parseInt(formData.age),
          gender: formData.gender,
        },
      });

      onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error saving user info:', error);
      setErrors({ submit: 'Failed to save information. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-gray-900/90 backdrop-blur-xl border border-gray-800 p-8 shadow-2xl animate-fade-in relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.2)' }} />
        
        {/* Header */}
        <div className="relative text-center mb-8">
          <img src={logo} alt="AURA Logo" className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to AURA</h2>
          <p className="text-sm text-gray-400">
            Please provide some basic information to begin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-6">
          {/* Age Input */}
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-2">
              Age <span style={{ color: 'var(--primary-color)' }}>*</span>
            </label>
            <input
              id="age"
              name="age"
              type="number"
              min="1"
              max="120"
              value={formData.age}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-gray-800/50 text-white placeholder-gray-500 transition-all duration-300 focus:outline-none"
              style={{
                border: errors.age 
                  ? '2px solid rgba(239, 68, 68, 0.5)' 
                  : '2px solid rgba(55, 65, 81, 0.5)',
              }}
              onFocus={(e) => {
                if (!errors.age) {
                  e.target.style.borderColor = 'rgba(var(--primary-color-rgb), 0.5)';
                  e.target.style.boxShadow = '0 0 15px rgba(var(--primary-color-rgb), 0.1)';
                }
              }}
              onBlur={(e) => {
                if (!errors.age) {
                  e.target.style.borderColor = 'rgba(55, 65, 81, 0.5)';
                  e.target.style.boxShadow = 'none';
                }
              }}
              placeholder="Enter your age"
              autoFocus
            />
            {errors.age && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.age}
              </p>
            )}
          </div>

          {/* Gender Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gender <span style={{ color: 'var(--primary-color)' }}>*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Male', 'Female', 'Other', 'Prefer not to say'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleChange({ target: { name: 'gender', value: option } })}
                  className="p-3 rounded-xl text-sm font-medium transition-all duration-300"
                  style={formData.gender === option 
                    ? { 
                        backgroundColor: 'var(--primary-color)', 
                        color: 'white',
                        boxShadow: '0 0 20px var(--primary-color-glow)'
                      }
                    : { 
                        backgroundColor: 'rgba(31, 41, 55, 0.5)',
                        color: '#d1d5db',
                        border: '1px solid rgba(55, 65, 81, 0.5)'
                      }
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            {errors.gender && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.gender}
              </p>
            )}
          </div>

          {/* Privacy Notice */}
          <div 
            className="rounded-xl p-4"
            style={{ 
              backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
              border: '1px solid rgba(var(--primary-color-rgb), 0.2)'
            }}
          >
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-color)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--primary-color)' }}>Privacy Protected</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your information is collected anonymously for research purposes only. No personal identifying information is stored.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm text-center">{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ 
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light) 100%)',
              boxShadow: '0 4px 20px var(--primary-color-glow)'
            }}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Begin Assessment</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="relative text-center text-gray-600 text-xs mt-4">
          <span style={{ color: 'var(--primary-color)' }}>*</span> Required fields
        </p>
      </div>
    </div>
  );
};

export default UserInfoModal;
