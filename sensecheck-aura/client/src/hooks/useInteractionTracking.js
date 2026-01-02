import { useEffect, useRef, useCallback } from 'react';
import { logInteraction } from '../utils/api';
import useStore from '../state/store';

/**
 * Custom hook for comprehensive interaction tracking
 * @param {string} module - Module name (e.g., 'colorBlindness', 'visualAcuity', 'motorSkills', 'literacy')
 * @param {boolean} enabled - Whether tracking is enabled
 * @returns {object} Tracking utilities
 */
const useInteractionTracking = (module, enabled = true) => {
  const sessionId = useStore((state) => state.sessionId);
  const interactionQueueRef = useRef([]);
  const startTimeRef = useRef(null);
  const lastEventRef = useRef(null);

  // Initialize start time
  useEffect(() => {
    if (enabled) {
      startTimeRef.current = Date.now();
    }
  }, [enabled]);

  // Log interaction to backend (with batching)
  const logToBackend = useCallback((interactionData) => {
    if (!enabled) return;

    // Queue interaction
    interactionQueueRef.current.push(interactionData);

    // Send to backend asynchronously
    logInteraction(interactionData).catch((error) => {
      console.error('Failed to log interaction:', error);
    });
  }, [enabled]);

  // Track generic event
  const trackEvent = useCallback((eventType, eventData = {}) => {
    if (!enabled) return;

    const now = Date.now();
    const responseTime = lastEventRef.current 
      ? now - lastEventRef.current 
      : now - (startTimeRef.current || now);

    lastEventRef.current = now;

    const interactionData = {
      sessionId,
      module,
      eventType,
      timestamp: now,
      responseTime,
      ...eventData,
    };

    logToBackend(interactionData);
    return interactionData;
  }, [sessionId, module, enabled, logToBackend]);

  // Track click event
  const trackClick = useCallback((event, additionalData = {}) => {
    if (!enabled) return;

    const target = event.target;
    trackEvent('click', {
      coordinates: {
        x: event.clientX,
        y: event.clientY,
      },
      target: {
        id: target.id,
        type: target.tagName,
        value: target.value || target.innerText?.substring(0, 50),
      },
      ...additionalData,
    });
  }, [trackEvent, enabled]);

  // Track hover event
  const trackHover = useCallback((event, additionalData = {}) => {
    if (!enabled) return;

    trackEvent('hover', {
      coordinates: {
        x: event.clientX,
        y: event.clientY,
      },
      target: {
        id: event.target.id,
        type: event.target.tagName,
      },
      ...additionalData,
    });
  }, [trackEvent, enabled]);

  // Track focus event
  const trackFocus = useCallback((event, additionalData = {}) => {
    if (!enabled) return;

    trackEvent('focus', {
      target: {
        id: event.target.id,
        type: event.target.tagName,
      },
      ...additionalData,
    });
  }, [trackEvent, enabled]);

  // Track touch events (for mobile)
  const trackTouch = useCallback((event, eventType, additionalData = {}) => {
    if (!enabled) return;

    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;

    trackEvent(eventType, {
      coordinates: {
        x: touch.clientX,
        y: touch.clientY,
      },
      metadata: {
        touchCount: event.touches.length,
        pressure: touch.force,
        radiusX: touch.radiusX,
        radiusY: touch.radiusY,
      },
      ...additionalData,
    });
  }, [trackEvent, enabled]);

  // Track mouse movement (throttled)
  const trackMouseMove = useCallback((event, additionalData = {}) => {
    if (!enabled) return;

    // Simple throttling: only track every 100ms
    const now = Date.now();
    if (lastEventRef.current && now - lastEventRef.current < 100) {
      return;
    }

    trackEvent('mousemove', {
      coordinates: {
        x: event.clientX,
        y: event.clientY,
      },
      metadata: {
        velocity: event.movementX && event.movementY 
          ? Math.sqrt(event.movementX ** 2 + event.movementY ** 2)
          : 0,
      },
      ...additionalData,
    });
  }, [trackEvent, enabled]);

  // Flush queue on unmount
  useEffect(() => {
    return () => {
      if (interactionQueueRef.current.length > 0) {
        // Final flush could be implemented here
        console.log(`Module ${module} tracked ${interactionQueueRef.current.length} interactions`);
      }
    };
  }, [module]);

  return {
    trackEvent,
    trackClick,
    trackHover,
    trackFocus,
    trackTouch,
    trackMouseMove,
    getElapsedTime: () => Date.now() - (startTimeRef.current || Date.now()),
  };
};

export default useInteractionTracking;

