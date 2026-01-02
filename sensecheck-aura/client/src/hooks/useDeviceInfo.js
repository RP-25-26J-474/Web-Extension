import { useState, useEffect } from 'react';

/**
 * Parse OS from user agent string
 */
function parseOS(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('windows nt 10')) return 'Windows 10/11';
  if (ua.includes('windows nt 6.3')) return 'Windows 8.1';
  if (ua.includes('windows nt 6.2')) return 'Windows 8';
  if (ua.includes('windows nt 6.1')) return 'Windows 7';
  if (ua.includes('windows')) return 'Windows';
  
  if (ua.includes('mac os x')) {
    const match = ua.match(/mac os x (\d+[._]\d+)/);
    if (match) return `macOS ${match[1].replace('_', '.')}`;
    return 'macOS';
  }
  
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('android')) {
    const match = ua.match(/android (\d+(\.\d+)?)/);
    if (match) return `Android ${match[1]}`;
    return 'Android';
  }
  
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('cros')) return 'ChromeOS';
  
  return 'unknown';
}

/**
 * Parse browser from user agent string
 */
function parseBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  // Order matters - check more specific patterns first
  if (ua.includes('edg/')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }
  
  if (ua.includes('opr/') || ua.includes('opera')) {
    const match = userAgent.match(/OPR\/(\d+)/i);
    return match ? `Opera ${match[1]}` : 'Opera';
  }
  
  if (ua.includes('chrome') && !ua.includes('chromium')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  
  if (ua.includes('safari') && !ua.includes('chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }
  
  if (ua.includes('firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/i);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }
  
  if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';
  
  return 'unknown';
}

/**
 * Detect primary pointer type
 * 
 * NOTE: Browsers cannot reliably distinguish between mouse and touchpad.
 * Both are "fine pointer" devices. We use heuristics but acknowledge limitations.
 * 
 * - 'mouse' = fine pointer on desktop (likely external mouse)
 * - 'touchpad' = fine pointer on laptop (likely built-in trackpad, but could be external mouse)
 * - 'touch' = coarse pointer (touchscreen on mobile/tablet)
 * - 'pen' = stylus/pen input
 */
function detectPointerType() {
  const ua = navigator.userAgent.toLowerCase();
  
  // Check if it's a mobile/tablet device first (these use touch)
  const isMobileDevice = /mobile|tablet|ipad|android|iphone/i.test(ua);
  if (isMobileDevice) return 'touch';
  
  // Check CSS media query for pointer type
  if (window.matchMedia) {
    // Primary pointer is coarse (finger/touch)
    if (window.matchMedia('(pointer: coarse)').matches) return 'touch';
  }
  
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Desktop with touchscreen still primarily uses mouse/touchpad
  if (hasTouch && isMobileDevice) return 'touch';
  
  // For fine pointer devices, we can only make educated guesses
  // We'll use 'mouse' as the default since it's the more common external input
  // ML models should treat mouse/touchpad similarly as both are precision pointers
  return 'mouse';
}

/**
 * Custom hook to gather comprehensive device and environment information
 */
const useDeviceInfo = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    userAgent: '',
    screenResolution: { width: 0, height: 0 },
    deviceType: 'desktop',
    pixelRatio: 1,
    touchSupport: false,
    // Extended info
    viewportWidth: 0,
    viewportHeight: 0,
    devicePixelRatio: 1,
    hardwareConcurrency: 0,
    preferredTheme: 'light',
    highContrastMode: false,
    reducedMotionPreference: false,
    pageLoadTime: 0,
    // Parsed device info (for ML)
    device: {
      pointerPrimary: 'unknown',
      os: 'unknown',
      browser: 'unknown',
    },
    screen: {
      width: 0,
      height: 0,
      dpr: 1,
    },
  });

  useEffect(() => {
    const detectDeviceType = () => {
      const ua = navigator.userAgent;
      if (/mobile/i.test(ua)) return 'mobile';
      if (/tablet|ipad/i.test(ua)) return 'tablet';
      return 'desktop';
    };

    // Detect preferred theme
    const getPreferredTheme = () => {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    };

    // Detect high contrast mode
    const getHighContrastMode = () => {
      if (window.matchMedia) {
        return window.matchMedia('(prefers-contrast: high)').matches;
      }
      return false;
    };

    // Detect reduced motion preference
    const getReducedMotion = () => {
      if (window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
      return false;
    };

    // Calculate page load time
    const getPageLoadTime = () => {
      if (performance.timing) {
        return performance.timing.loadEventEnd - performance.timing.navigationStart;
      }
      return 0;
    };

    const userAgent = navigator.userAgent;

    setDeviceInfo({
      userAgent,
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height,
      },
      deviceType: detectDeviceType(),
      pixelRatio: window.devicePixelRatio || 1,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      
      // Extended information
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      preferredTheme: getPreferredTheme(),
      highContrastMode: getHighContrastMode(),
      reducedMotionPreference: getReducedMotion(),
      pageLoadTime: getPageLoadTime(),
      
      // Additional capabilities
      maxTouchPoints: navigator.maxTouchPoints || 0,
      connectionType: navigator.connection?.effectiveType || 'unknown',
      memory: navigator.deviceMemory || 'unknown',
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      
      // Parsed device info (for ML-ready Session schema)
      device: {
        pointerPrimary: detectPointerType(),
        os: parseOS(userAgent),
        browser: parseBrowser(userAgent),
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        dpr: window.devicePixelRatio || 1,
      },
    });

    // Listen for viewport resize
    const handleResize = () => {
      setDeviceInfo(prev => ({
        ...prev,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
    };

    // Listen for theme changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      setDeviceInfo(prev => ({
        ...prev,
        preferredTheme: e.matches ? 'dark' : 'light',
      }));
    };

    window.addEventListener('resize', handleResize);
    darkModeQuery.addEventListener('change', handleThemeChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      darkModeQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  return deviceInfo;
};

export default useDeviceInfo;

