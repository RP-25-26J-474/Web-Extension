import assert from 'node:assert/strict';

import {
  ISHIHARA_PLATES,
  analyzeColorBlindness,
  summarizeColorBlindnessResponses,
  getBinaryColorBlindnessScore,
} from './colorBlindnessAnalysis.js';

function buildPlateResponses(answers) {
  return answers.map((userAnswer, index) => ({
    plateId: ISHIHARA_PLATES[index].plateId,
    imageName: ISHIHARA_PLATES[index].imageName,
    userAnswer,
    responseTime: 500 + index,
  }));
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('returns an inconclusive zero score when no plate data exists', () => {
  const analysis = analyzeColorBlindness([]);

  assert.equal(analysis.colorBlindnessScore, 0);
  assert.equal(analysis.colorVisionScore, 0);
  assert.equal(analysis.diagnosis, 'Inconclusive');
});

runTest('scores fully normal diagnostic answers as normal vision', () => {
  const analysis = analyzeColorBlindness(
    buildPlateResponses(['12', '6', '6', 'nothing'])
  );

  assert.equal(analysis.controlPlateCorrect, true);
  assert.equal(analysis.normalVisionCount, 3);
  assert.equal(analysis.colorBlindCount, 0);
  assert.equal(analysis.anomalyCount, 0);
  assert.equal(analysis.colorBlindnessScore, 0);
  assert.equal(analysis.diagnosis, 'Normal');
});

runTest('keeps the score at zero for a single color-blind pattern match', () => {
  const analysis = analyzeColorBlindness(
    buildPlateResponses(['12', '5', '6', 'nothing'])
  );

  assert.equal(analysis.controlPlateCorrect, true);
  assert.equal(analysis.colorBlindCount, 1);
  assert.equal(analysis.colorBlindnessScore, 0);
});

runTest('scores two diagnostic color-blind pattern matches as color blind', () => {
  const analysis = analyzeColorBlindness(
    buildPlateResponses(['12', '5', 'nothing', 'nothing'])
  );

  assert.equal(analysis.controlPlateCorrect, true);
  assert.equal(analysis.colorBlindCount, 2);
  assert.equal(analysis.colorBlindnessScore, 1);
  assert.equal(analysis.diagnosis, 'Suspected Red-Green Deficiency');
});

runTest('treats unmatched diagnostic answers as anomalies and keeps the score at zero', () => {
  const analysis = analyzeColorBlindness(
    buildPlateResponses(['12', 'blur', 'unknown', 'n/a'])
  );

  assert.equal(analysis.controlPlateCorrect, true);
  assert.equal(analysis.normalVisionCount, 0);
  assert.equal(analysis.colorBlindCount, 0);
  assert.equal(analysis.anomalyCount, 3);
  assert.equal(analysis.colorBlindnessScore, 0);
});

runTest('forces the score to zero when the control plate is incorrect', () => {
  const analysis = analyzeColorBlindness(
    buildPlateResponses(['wrong', '5', 'nothing', '2'])
  );

  assert.equal(analysis.controlPlateCorrect, false);
  assert.equal(analysis.colorBlindCount, 3);
  assert.equal(analysis.colorBlindnessScore, 0);
  assert.equal(analysis.diagnosis, 'Inconclusive');
});

runTest('binary helper enforces the control-plate gate and count threshold', () => {
  assert.equal(getBinaryColorBlindnessScore({
    controlPlateCorrect: true,
    diagnosticPlateCount: 3,
    colorBlindCount: 1,
  }), 0);

  assert.equal(getBinaryColorBlindnessScore({
    controlPlateCorrect: true,
    diagnosticPlateCount: 3,
    colorBlindCount: 2,
  }), 1);

  assert.equal(getBinaryColorBlindnessScore({
    controlPlateCorrect: false,
    diagnosticPlateCount: 3,
    colorBlindCount: 3,
  }), 0);
});

runTest('summary separates control, normal, color-blind, and anomalous answers', () => {
  const summary = summarizeColorBlindnessResponses(
    buildPlateResponses(['12', '5', 'unknown', 'nothing'])
  );

  assert.deepEqual(summary, {
    controlPlateCorrect: true,
    normalVisionCount: 1,
    colorBlindCount: 1,
    anomalyCount: 1,
    diagnosticPlateCount: 3,
    totalResponseTime: 2006,
  });
});
