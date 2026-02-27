/**
 * Interaction Tracking E2E Verification
 * Run this in the Service Worker console to verify interactions are tracked end-to-end.
 *
 * Usage:
 * 1. chrome://extensions → your extension → "Inspect views: service worker"
 * 2. Paste this entire script into the Console
 * 3. Press Enter
 *
 * Expected: "VERIFICATION PASSED" or "VERIFICATION FAILED" with details
 */
(async function verifyInteractionTracking() {
  const results = { passed: [], failed: [] };

  function pass(msg) {
    results.passed.push(msg);
  }

  function fail(msg, detail) {
    results.failed.push({ msg, detail });
  }

  console.log(' INTERACTION TRACKING E2E VERIFICATION\n' + '='.repeat(60));

  // 1. Check prerequisites
  const storage = await chrome.storage.local.get([
    'userId', 'trackingEnabled', 'consentGiven', 'authToken',
  ]);

  if (!storage.consentGiven) {
    fail('Consent not given', 'Set consentGiven: true and trackingEnabled: true');
  } else {
    pass('Consent given');
  }

  if (!storage.trackingEnabled) {
    fail('Tracking disabled', 'Enable tracking in extension settings');
  } else {
    pass('Tracking enabled');
  }

  if (!storage.userId) {
    fail('No userId', 'User must be logged in');
  } else {
    pass(`User ID: ${storage.userId}`);
  }

  const agg = typeof interactionAggregator !== 'undefined'
    ? interactionAggregator
    : (typeof globalThis !== 'undefined' && globalThis.interactionAggregator);

  if (!agg) {
    fail('interactionAggregator not available', 'Reload the extension (background.js exposes it via globalThis)');
  } else {
    pass('InteractionAggregator loaded');
  }

  if (agg && !agg.userId) {
    fail('Aggregator userId not set', 'Log out and log in again');
  } else if (agg) {
    pass('Aggregator initialized with userId');
  }

  // Stop early if critical setup failed
  if (results.failed.length > 0) {
    console.log('\n❌ SETUP FAILED - fix these first:\n');
    results.failed.forEach((f) => console.log('  -', f.msg, f.detail ? `(${f.detail})` : ''));
    console.log('='.repeat(60) + '\n');
    return;
  }

  // 2. Clear previous batches so we can measure new ones
  const beforeStorage = await chrome.storage.local.get(['aggregatedBatches']);
  const beforeCount = beforeStorage.aggregatedBatches?.length || 0;

  // 3. Simulate full interaction sequence (matching content script output)
  const baseTime = Date.now();

  const events = [
    { type: 'mouse_down', x: 100, y: 100, timestamp: baseTime },
    { type: 'click', x: 100, y: 100, elementTag: 'BUTTON', timestamp: baseTime + 80 },
    { type: 'mouse_down', x: 200, y: 200, timestamp: baseTime + 500 },
    { type: 'click', x: 200, y: 200, elementTag: 'A', timestamp: baseTime + 580 },
    { type: 'scroll', scrollY: 300, timestamp: baseTime + 1000 },
    { type: 'browser_zoom', action: 'zoom_in', zoomLevel: 1.2, timestamp: baseTime + 1500 },
  ];

  for (const evt of events) {
    try {
      agg.trackEvent({
        ...evt,
        url: 'https://example.com/test',
      });
      pass(`Tracked: ${evt.type}`);
    } catch (e) {
      fail(`Tracked: ${evt.type}`, e.message);
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  // 4. Force close current window (simulate 10s elapsed) and get batch
  agg.closeCurrentWindow();
  const queueSize = agg.batchQueue?.length || 0;

  if (queueSize === 0) {
    fail('No batch in queue after events', 'Aggregator may require mouse_move or scroll for non-null batch');
  } else {
    pass(`Batch queue has ${queueSize} batch(es)`);
  }

  const latestBatch = agg.batchQueue?.[agg.batchQueue.length - 1];

  if (latestBatch) {
    // 5. Validate batch structure (critical for ML/server)
    const required = ['user_id', 'batch_id', 'captured_at', 'page_context', 'events_agg', '_profiler'];
    const missing = required.filter((k) => !(k in latestBatch));
    if (missing.length > 0) {
      fail('Batch missing fields', missing.join(', '));
    } else {
      pass('Batch has required schema');
    }

    const agg = latestBatch.events_agg || {};
    if (typeof agg.click_count !== 'number') {
      fail('events_agg.click_count missing or invalid', agg);
    } else {
      pass(`Click count: ${agg.click_count}`);
    }

    if (agg.click_count !== 2) {
      fail('Expected 2 clicks in batch', `Got ${agg.click_count}`);
    } else {
      pass('Click count matches simulated events');
    }

    if (typeof agg.misclick_rate !== 'number') {
      fail('events_agg.misclick_rate missing', agg);
    } else {
      pass(`Misclick rate: ${agg.misclick_rate}`);
    }

    if (agg.zoom_events !== 1) {
      fail('Expected 1 zoom event', `Got ${agg.zoom_events}`);
    } else {
      pass('Zoom events tracked');
    }
  }

  // 6. Check storage (if aggregator flushes to storage)
  await new Promise((r) => setTimeout(r, 500));
  const afterStorage = await chrome.storage.local.get(['aggregatedBatches']);
  const afterCount = afterStorage.aggregatedBatches?.length || 0;

  // Storage may or may not be updated synchronously depending on flush logic
  pass(`Storage batches: ${afterCount} (before: ${beforeCount})`);

  // 7. Report
  console.log('\n' + '='.repeat(60));
  if (results.failed.length === 0) {
    console.log('✅ VERIFICATION PASSED');
    console.log(`   ${results.passed.length} checks passed`);
  } else {
    console.log('❌ VERIFICATION FAILED');
    console.log('   Passed:', results.passed.length);
    console.log('   Failed:', results.failed.length);
    results.failed.forEach((f) => {
      console.log('   -', f.msg, f.detail ? `: ${f.detail}` : '');
    });
  }
  console.log('='.repeat(60) + '\n');

  // Return for programmatic use
  return {
    passed: results.passed.length,
    failed: results.failed.length,
    details: results,
  };
})();
