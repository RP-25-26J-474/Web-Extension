import { useRef, useCallback } from 'react';

/**
 * Performance metrics tracking hook for motor skills game
 * 
 * Tracks:
 * - Frame timing (avgFrameMs, p95FrameMs)
 * - Sampling rate (estimated Hz)
 * - Dropped frames
 * - Input lag estimate
 */
const usePerformanceMetrics = () => {
  const frameTimesRef = useRef([]);
  const lastFrameTimeRef = useRef(null);
  const droppedFramesRef = useRef(0);
  const inputEventsRef = useRef([]);
  const isTrackingRef = useRef(false);

  /**
   * Start tracking performance metrics
   */
  const startTracking = useCallback(() => {
    frameTimesRef.current = [];
    lastFrameTimeRef.current = performance.now();
    droppedFramesRef.current = 0;
    inputEventsRef.current = [];
    isTrackingRef.current = true;
  }, []);

  /**
   * Record a frame (call this in your animation loop)
   */
  const recordFrame = useCallback(() => {
    if (!isTrackingRef.current) return;

    const now = performance.now();
    if (lastFrameTimeRef.current !== null) {
      const frameTime = now - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);

      // Detect dropped frames (frame time > 25ms suggests dropped frame at 60fps)
      // Normal frame at 60fps = ~16.67ms
      if (frameTime > 25) {
        droppedFramesRef.current += Math.floor(frameTime / 16.67) - 1;
      }
    }
    lastFrameTimeRef.current = now;
  }, []);

  /**
   * Record an input event for input lag estimation
   */
  const recordInputEvent = useCallback((eventTimestamp) => {
    if (!isTrackingRef.current) return;
    
    const now = performance.now();
    // eventTimestamp is from the event object (e.timeStamp)
    if (eventTimestamp) {
      inputEventsRef.current.push({
        eventTime: eventTimestamp,
        processTime: now,
        lag: now - eventTimestamp,
      });
    }
  }, []);

  /**
   * Stop tracking and compute final metrics
   */
  const stopTracking = useCallback(() => {
    isTrackingRef.current = false;
    return computeMetrics();
  }, []);

  /**
   * Compute final performance metrics
   */
  const computeMetrics = useCallback(() => {
    const frameTimes = frameTimesRef.current;
    const inputEvents = inputEventsRef.current;

    if (frameTimes.length === 0) {
      return {
        samplingHzTarget: 60,
        samplingHzEstimated: null,
        avgFrameMs: null,
        p95FrameMs: null,
        droppedFrames: 0,
        inputLagMsEstimate: null,
      };
    }

    // Calculate average frame time
    const avgFrameMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

    // Calculate P95 frame time
    const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedFrameTimes.length * 0.95);
    const p95FrameMs = sortedFrameTimes[p95Index] || avgFrameMs;

    // Estimate sampling rate (Hz)
    const samplingHzEstimated = avgFrameMs > 0 ? 1000 / avgFrameMs : 60;

    // Estimate input lag
    let inputLagMsEstimate = null;
    if (inputEvents.length > 0) {
      const validLags = inputEvents
        .map(e => e.lag)
        .filter(lag => lag >= 0 && lag < 500); // Filter out invalid lags
      
      if (validLags.length > 0) {
        inputLagMsEstimate = validLags.reduce((a, b) => a + b, 0) / validLags.length;
      }
    }

    return {
      samplingHzTarget: 60,
      samplingHzEstimated: Math.round(samplingHzEstimated * 10) / 10,
      avgFrameMs: Math.round(avgFrameMs * 100) / 100,
      p95FrameMs: Math.round(p95FrameMs * 100) / 100,
      droppedFrames: droppedFramesRef.current,
      inputLagMsEstimate: inputLagMsEstimate !== null 
        ? Math.round(inputLagMsEstimate * 100) / 100 
        : null,
    };
  }, []);

  /**
   * Get current metrics (without stopping)
   */
  const getCurrentMetrics = useCallback(() => {
    return computeMetrics();
  }, [computeMetrics]);

  return {
    startTracking,
    recordFrame,
    recordInputEvent,
    stopTracking,
    getCurrentMetrics,
  };
};

export default usePerformanceMetrics;

