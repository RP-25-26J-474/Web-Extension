/**
 * Enhanced Motor Skills Tracking
 * Comprehensive tracking for the bubble-pop game
 * Uses ML-ready GlobalInteractionBucket for storage
 * 
 * AURA INTEGRATION: Sends data to both original sensecheck backend AND AURA backend
 */

import auraIntegration from './auraIntegration';

class MotorSkillsTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.participantId = this.getOrCreateParticipantId();
    this.interactions = [];
    this.touchStartTimes = new Map();
    this.lastTapTime = 0;
    this.lastPosition = null;
    this.velocityHistory = [];
    this.trajectoryPoints = [];
    this.round = 1;
    
    // Batching for performance
    this.interactionBuffer = [];
    this.BATCH_SIZE = 10;
    this.BATCH_TIMEOUT = 2000; // 2 seconds
    this.batchTimer = null;
    
    // ========== AURA INTEGRATION ==========
    // Buffers for sending data to AURA backend
    this.auraPointerSamples = []; // Raw pointer samples
    this.auraAttempts = []; // Bubble attempts
    this.auraGlobalInteractions = []; // Other interactions
    
    // Batching config for AURA
    this.AURA_POINTER_BATCH_SIZE = 100; // Send every 100 samples
    this.AURA_ATTEMPT_BATCH_SIZE = 10;  // Send every 10 attempts
    this.AURA_INTERACTION_BATCH_SIZE = 50; // Send every 50 interactions
    
    this.roundStartTime = Date.now(); // For calculating tms (time since round start)
  }
  
  // Get or create stable participant ID
  getOrCreateParticipantId() {
    let participantId = localStorage.getItem('participantId');
    if (!participantId) {
      participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('participantId', participantId);
    }
    return participantId;
  }
  
  // Update round (resets round start time for AURA)
  setRound(round) {
    this.round = round;
    this.roundStartTime = Date.now(); // Reset for new round
    console.log(`🎯 Round set to ${round}, roundStartTime reset`);
  }

  // Track bubble spawn
  trackBubbleSpawn(bubbleData) {
    this.logInteraction('bubble_spawn', {
      bubbleId: bubbleData.id,
      column: bubbleData.column,
      speed: bubbleData.speed,
      round: this.round,
      spawnTime: bubbleData.spawnTime,
      initialPosition: {
        x: bubbleData.x,
        y: bubbleData.y,
      },
    });
  }

  // Track mouse/touch down
  trackPointerDown(event, bubbleId = null) {
    const now = Date.now();
    const coords = this.getCoordinates(event);
    
    this.touchStartTimes.set(bubbleId || 'screen', now);
    this.lastPosition = coords;
    this.trajectoryPoints = [{ ...coords, time: now }];
    
    this.logInteraction('pointer_down', {
      coordinates: coords,
      bubbleId,
      pointerType: event.pointerType || (event.touches ? 'touch' : 'mouse'),
      pressure: event.pressure || (event.touches?.[0]?.force) || 0,
      touchArea: event.touches?.[0] ? {
        radiusX: event.touches[0].radiusX,
        radiusY: event.touches[0].radiusY,
      } : null,
      round: this.round,
    });
  }

  // Track movement (for velocity, acceleration, trajectory)
  trackPointerMove(event) {
    const now = Date.now();
    const coords = this.getCoordinates(event);
    
    // ========== AURA: Send raw pointer sample ==========
    if (auraIntegration.isEnabled()) {
      const stageCanvas = document.querySelector('canvas'); // Konva canvas
      const canvasWidth = stageCanvas?.width || 800;
      const canvasHeight = stageCanvas?.height || 600;
      
      // Normalize coordinates (0..1)
      const xNorm = coords.x / canvasWidth;
      const yNorm = coords.y / canvasHeight;
      
      this.auraPointerSamples.push({
        round: this.round,
        tms: now - this.roundStartTime, // Time since round start
        x: xNorm,
        y: yNorm,
        isDown: false, // Movement, not click
        pointerType: event.pointerType || (event.touches ? 'touch' : 'mouse'),
        pointerId: event.pointerId,
        pressure: event.pressure || (event.touches?.[0]?.force) || 0,
      });
      
      // Send batch to AURA when buffer is full
      if (this.auraPointerSamples.length >= this.AURA_POINTER_BATCH_SIZE) {
        this.flushAuraPointerSamples();
      }
    }
    
    // ========== ORIGINAL TRACKING (unchanged) ==========
    // Always log pointer position for feature extraction (even on first move)
    if (this.lastPosition) {
      const dt = now - (this.trajectoryPoints[this.trajectoryPoints.length - 1]?.time || now);
      if (dt > 0) {
        const dx = coords.x - this.lastPosition.x;
        const dy = coords.y - this.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / (dt / 1000); // pixels per second
        
        // Calculate acceleration
        const acceleration = this.velocityHistory.length > 0
          ? (velocity - this.velocityHistory[this.velocityHistory.length - 1].velocity) / (dt / 1000)
          : 0;
        
        // Track velocity history
        this.velocityHistory.push({
          velocity,
          acceleration,
          time: now,
        });
        
        // Keep only recent history (last 10 points)
        if (this.velocityHistory.length > 10) {
          this.velocityHistory.shift();
        }
        
        // Add to trajectory
        this.trajectoryPoints.push({
          ...coords,
          time: now,
          velocity,
          acceleration,
        });
        
        // Calculate jerkiness (change in acceleration)
        const jerkiness = this.calculateJerkiness();
        
        this.logInteraction('pointer_move', {
          coordinates: coords,
          velocity: parseFloat(velocity.toFixed(2)),
          acceleration: parseFloat(acceleration.toFixed(2)),
          jerkiness: parseFloat(jerkiness.toFixed(2)),
          round: this.round,
        });
      }
    } else {
      // First pointer move - log it with zero velocity
      this.logInteraction('pointer_move', {
        coordinates: coords,
        velocity: 0,
        acceleration: 0,
        jerkiness: 0,
        round: this.round,
      });
    }
    
    this.lastPosition = coords;
  }

  // Track pointer up (end of tap/click)
  trackPointerUp(event, bubbleId = null, bubbleHit = false) {
    const now = Date.now();
    const coords = this.getCoordinates(event);
    const startTime = this.touchStartTimes.get(bubbleId || 'screen');
    const touchDuration = startTime ? now - startTime : 0;
    
    // Inter-tap interval
    const interTapInterval = this.lastTapTime ? now - this.lastTapTime : 0;
    this.lastTapTime = now;
    
    // Calculate trajectory metrics
    const trajectoryMetrics = this.analyzeTrajectory();
    
    // Clear tracking data
    this.touchStartTimes.delete(bubbleId || 'screen');
    this.velocityHistory = [];
    this.trajectoryPoints = [];
    this.lastPosition = null;
    
    this.logInteraction(bubbleHit ? 'bubble_hit' : 'stage_clicked_miss', {
      coordinates: coords,
      bubbleId,
      touchDuration,
      interTapInterval,
      trajectoryMetrics,
      round: this.round,
      success: bubbleHit,
    });
  }

  // Track bubble hit (successful click)
  trackBubbleHit(bubbleData, event) {
    console.log(`✅ trackBubbleHit called - Bubble ${bubbleData.id}`);
    
    const now = Date.now();
    const reactionTime = now - bubbleData.spawnTime;
    const coords = this.getCoordinates(event);
    
    // Calculate accuracy (distance from bubble center)
    const dx = coords.x - bubbleData.x;
    const dy = coords.y - bubbleData.y;
    const clickAccuracy = Math.sqrt(dx * dx + dy * dy);
    
    this.logInteraction('bubble_hit', {
      bubbleId: bubbleData.id,
      coordinates: coords,
      bubblePosition: { x: bubbleData.x, y: bubbleData.y },
      clickAccuracy: parseFloat(clickAccuracy.toFixed(2)),
      reactionTime,
      bubbleLifetime: now - bubbleData.spawnTime,
      spawnTime: bubbleData.spawnTime, // Add spawn time for feature extraction
      bubbleSpeed: bubbleData.speed,
      column: bubbleData.column,
      round: this.round,
    });
    
    // ========== AURA: Create attempt record ==========
    if (auraIntegration.isEnabled()) {
      this.createAuraAttempt(bubbleData, event, true); // true = hit
    }
  }

  // Track missed bubble (escaped)
  trackBubbleMiss(bubbleData) {
    console.log(`❌ trackBubbleMiss called - Bubble ${bubbleData.id}`);
    
    this.logInteraction('bubble_miss', {
      bubbleId: bubbleData.id,
      column: bubbleData.column,
      bubblePosition: { x: bubbleData.x, y: bubbleData.y }, // Add bubble position for target
      bubbleSpeed: bubbleData.speed,
      bubbleLifetime: Date.now() - bubbleData.spawnTime,
      spawnTime: bubbleData.spawnTime, // Add spawn time for feature extraction
      round: this.round,
    });
    
    // ========== AURA: Create attempt record for miss ==========
    if (auraIntegration.isEnabled()) {
      this.createAuraAttempt(bubbleData, null, false); // false = miss
    }
  }

  // Track round completion
  async trackRoundComplete(roundData) {
    console.log(`🎯 trackRoundComplete called for round ${this.round}`);
    console.log(`   Hits: ${roundData.hits}, Misses: ${roundData.misses}`);
    console.log(`   Total interactions in buffer: ${this.interactions.length}`);
    
    const totalAttempts = roundData.hits + roundData.misses;
    const successRate = totalAttempts > 0 ? parseFloat((roundData.hits / totalAttempts * 100).toFixed(2)) : 0;
    
    this.logInteraction('round_end', {
      round: this.round,
      hits: roundData.hits,
      misses: roundData.misses,
      escaped: roundData.escaped,
      successRate,
      totalAttempts,
      roundDuration: roundData.duration,
      averageReactionTime: roundData.averageReactionTime,
    });
    
    // Flush current batch to ensure data is sent
    try {
      await this.flushBatch();
    } catch (error) {
      console.error('Error flushing batch:', error);
    }
    
    // ========== AURA: Flush round data and compute summary ==========
    if (auraIntegration.isEnabled()) {
      try {
        console.log(`🌟 Flushing AURA data for round ${this.round}...`);
        
        // Flush any remaining pointer samples
        await this.flushAuraPointerSamples();
        
        // Flush any remaining attempts
        await this.flushAuraAttempts();
        
        // Flush any remaining global interactions
        await this.flushAuraGlobalInteractions();
        
        // Compute round summary on AURA backend
        console.log(`📊 Computing AURA round ${this.round} summary...`);
        await auraIntegration.computeRoundSummary(this.round);
        
      } catch (error) {
        console.error(`Error processing AURA round ${this.round} data:`, error);
      }
    }
    
    // NOTE: Original tracking (non-AURA mode) is disabled to prevent 401 errors
    // All backend calls require AURA authentication
    
    this.round++;
  }

  // Helper: Get coordinates from event
  getCoordinates(event) {
    if (event.touches && event.touches[0]) {
      return {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
    return {
      x: event.clientX || 0,
      y: event.clientY || 0,
    };
  }

  // Helper: Calculate jerkiness (variability in acceleration)
  calculateJerkiness() {
    if (this.velocityHistory.length < 3) return 0;
    
    const accelerations = this.velocityHistory.map(v => v.acceleration);
    const mean = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accelerations.length;
    
    return Math.sqrt(variance);
  }

  // Helper: Analyze trajectory path
  analyzeTrajectory() {
    if (this.trajectoryPoints.length < 2) {
      return {
        pathLength: 0,
        straightness: 1,
        smoothness: 1,
        pointCount: this.trajectoryPoints.length,
      };
    }
    
    // Calculate total path length
    let pathLength = 0;
    for (let i = 1; i < this.trajectoryPoints.length; i++) {
      const dx = this.trajectoryPoints[i].x - this.trajectoryPoints[i - 1].x;
      const dy = this.trajectoryPoints[i].y - this.trajectoryPoints[i - 1].y;
      pathLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    // Calculate straight-line distance
    const first = this.trajectoryPoints[0];
    const last = this.trajectoryPoints[this.trajectoryPoints.length - 1];
    const straightDistance = Math.sqrt(
      Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
    );
    
    // Straightness: ratio of straight distance to path length (1 = perfectly straight)
    const straightness = straightDistance / pathLength;
    
    // Smoothness: based on velocity consistency
    const velocities = this.trajectoryPoints.filter(p => p.velocity).map(p => p.velocity);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const velocityVariance = velocities.reduce((sum, v) => 
      sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;
    const smoothness = 1 / (1 + Math.sqrt(velocityVariance) / avgVelocity);
    
    return {
      pathLength: parseFloat(pathLength.toFixed(2)),
      straightDistance: parseFloat(straightDistance.toFixed(2)),
      straightness: parseFloat(straightness.toFixed(3)),
      smoothness: parseFloat(smoothness.toFixed(3)),
      pointCount: this.trajectoryPoints.length,
      averageVelocity: parseFloat(avgVelocity.toFixed(2)),
    };
  }

  // Helper: Add interaction to buffer
  addToBuffer(data) {
    this.interactionBuffer.push(data);
    
    // Auto-flush if buffer is full
    if (this.interactionBuffer.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Reset batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.BATCH_TIMEOUT);
    }
  }

  // Helper: Flush batch to backend
  async flushBatch() {
    if (this.interactionBuffer.length === 0) return;
    
    // ONLY send data in AURA mode (when properly authenticated)
    // This prevents 401 errors when running in standalone mode
    if (!auraIntegration.isEnabled()) {
      this.interactionBuffer = []; // Clear buffer in standalone mode
      return;
    }
    
    const batch = [...this.interactionBuffer];
    this.interactionBuffer = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    try {
      await auraIntegration.saveGlobalInteractions(batch);
      console.log(`📦 Flushed ${batch.length} motor skill interactions via AURA`);
    } catch (error) {
      console.error('Error flushing motor skills batch:', error);
      // Don't re-add to buffer on auth errors to prevent infinite retries
      if (error?.response?.status !== 401 && this.interactionBuffer.length < 100) {
        this.interactionBuffer.unshift(...batch);
      }
    }
  }

  // ========== AURA HELPER METHODS ==========
  
  // Create properly formatted attempt for AURA backend
  createAuraAttempt(bubbleData, event, isHit) {
    const now = Date.now();
    const coords = event ? this.getCoordinates(event) : null;
    
    // Get canvas dimensions for normalization
    const stageCanvas = document.querySelector('canvas');
    const canvasWidth = stageCanvas?.width || 800;
    const canvasHeight = stageCanvas?.height || 600;
    const minDim = Math.min(canvasWidth, canvasHeight);
    
    // Normalize coordinates and radius
    const targetX = bubbleData.x / canvasWidth;
    const targetY = bubbleData.y / canvasHeight;
    const radius = (bubbleData.radius || 25) / minDim;
    
    const clickX = coords ? coords.x / canvasWidth : null;
    const clickY = coords ? coords.y / canvasHeight : null;
    
    const attempt = {
      round: this.round,
      attemptId: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bubbleId: bubbleData.id,
      spawnTms: bubbleData.spawnTime - this.roundStartTime,
      despawnTms: isHit ? null : (now - this.roundStartTime),
      ttlMs: now - bubbleData.spawnTime,
      column: bubbleData.column,
      speedNorm: (bubbleData.speed || 0) / minDim, // Normalized speed
      target: {
        x: targetX,
        y: targetY,
        radius: radius,
      },
      click: {
        clicked: isHit,
        hit: isHit,
        missType: isHit ? 'hit' : 'timeout',
        tms: isHit ? (now - this.roundStartTime) : null,
        x: clickX,
        y: clickY,
      },
    };
    
    this.auraAttempts.push(attempt);
    
    // Send batch if full
    if (this.auraAttempts.length >= this.AURA_ATTEMPT_BATCH_SIZE) {
      this.flushAuraAttempts();
    }
  }
  
  // ========== ORIGINAL HELPER METHODS ==========
  
  // Helper: Log interaction
  logInteraction(eventType, data) {
    const interaction = {
      sessionId: this.sessionId,
      module: 'motorSkills',
      round: this.round,
      eventType,
      timestamp: new Date(),
      ...data,
    };
    
    this.interactions.push(interaction);
    
    // Add to batch buffer (uses bucket pattern)
    this.addToBuffer(interaction);
  }
  
  // ========== AURA FLUSH METHODS ==========
  
  // Flush pointer samples to AURA
  async flushAuraPointerSamples() {
    if (!auraIntegration.isEnabled() || this.auraPointerSamples.length === 0) return;
    
    try {
      console.log(`🖱️ Flushing ${this.auraPointerSamples.length} pointer samples to AURA`);
      await auraIntegration.savePointerSamples([...this.auraPointerSamples]);
      this.auraPointerSamples = []; // Clear buffer after successful send
    } catch (error) {
      console.error('Error flushing AURA pointer samples:', error);
      // Keep samples in buffer to retry later
    }
  }
  
  // Flush attempts to AURA
  async flushAuraAttempts() {
    if (!auraIntegration.isEnabled() || this.auraAttempts.length === 0) return;
    
    try {
      console.log(`🎯 Flushing ${this.auraAttempts.length} attempts to AURA`);
      await auraIntegration.saveMotorAttempts([...this.auraAttempts]);
      this.auraAttempts = []; // Clear buffer after successful send
    } catch (error) {
      console.error('Error flushing AURA attempts:', error);
      // Keep attempts in buffer to retry later
    }
  }
  
  // Flush global interactions to AURA
  async flushAuraGlobalInteractions() {
    if (!auraIntegration.isEnabled() || this.auraGlobalInteractions.length === 0) return;
    
    try {
      console.log(`🌍 Flushing ${this.auraGlobalInteractions.length} global interactions to AURA`);
      await auraIntegration.saveGlobalInteractions([...this.auraGlobalInteractions]);
      this.auraGlobalInteractions = []; // Clear buffer after successful send
    } catch (error) {
      console.error('Error flushing AURA global interactions:', error);
      // Keep interactions in buffer to retry later
    }
  }
  
  // ========== ORIGINAL COMPLETE METHOD ==========
  
  // Complete motor skills session (flush remaining interactions + compute session summary)
  async complete() {
    // ========== FLUSH AURA DATA ==========
    if (auraIntegration.isEnabled()) {
      console.log('🌟 Flushing remaining AURA data...');
      
      // Flush any remaining pointer samples
      await this.flushAuraPointerSamples();
      
      // Flush any remaining attempts
      await this.flushAuraAttempts();
      
      // Flush any remaining global interactions
      await this.flushAuraGlobalInteractions();
      
      // Compute session summary on AURA backend
      try {
        console.log('📈 Computing AURA session summary...');
        await auraIntegration.computeSessionSummary();
      } catch (error) {
        console.error('Error computing AURA session summary:', error);
      }
    }
    
    // Flush remaining raw interactions (only in AURA mode)
    try {
      await this.flushBatch();
    } catch (error) {
      console.error('Error flushing final batch:', error);
    }
    
    // NOTE: Original tracking (non-AURA mode) session summary is disabled
    // All backend calls require AURA authentication
    
    console.log(`✅ Motor skills tracking complete. Total interactions: ${this.interactions.length}`);
  }

  // Get all interactions
  getAllInteractions() {
    return this.interactions;
  }
}

export default MotorSkillsTracker;

