const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadColorBlindnessModule() {
  const sourcePath = path.resolve(
    __dirname,
    '../../../sensecheck-aura/client/src/utils/colorBlindnessAnalysis.js'
  );
  const source = fs.readFileSync(sourcePath, 'utf8');
  const exportedNames = [];

  const transformedSource = `${source.replace(
    /export const (\w+)\s*=/g,
    (_, name) => {
      exportedNames.push(name);
      return `const ${name} =`;
    }
  )}\nmodule.exports = { ${exportedNames.join(', ')} };`;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
  };

  vm.runInNewContext(transformedSource, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

describe('colorBlindnessAnalysis', () => {
  const {
    analyzeColorBlindness,
    summarizeColorBlindnessResponses,
    getBinaryColorBlindnessScore,
    ISHIHARA_PLATES,
  } = loadColorBlindnessModule();

  function buildPlateResponses(answers) {
    return answers.map((userAnswer, index) => ({
      plateId: ISHIHARA_PLATES[index].plateId,
      imageName: ISHIHARA_PLATES[index].imageName,
      userAnswer,
      responseTime: 500 + index,
    }));
  }

  test('returns an inconclusive zero score when no plate data exists', () => {
    const analysis = analyzeColorBlindness([]);

    expect(analysis.colorBlindnessScore).toBe(0);
    expect(analysis.colorVisionScore).toBe(0);
    expect(analysis.diagnosis).toBe('Inconclusive');
  });

  test('scores fully normal diagnostic answers as normal vision', () => {
    const analysis = analyzeColorBlindness(
      buildPlateResponses(['12', '6', '6', 'nothing'])
    );

    expect(analysis.controlPlateCorrect).toBe(true);
    expect(analysis.normalVisionCount).toBe(3);
    expect(analysis.colorBlindCount).toBe(0);
    expect(analysis.anomalyCount).toBe(0);
    expect(analysis.colorBlindnessScore).toBe(0);
    expect(analysis.diagnosis).toBe('Normal');
  });

  test('keeps the score at zero for a single color-blind pattern match', () => {
    const analysis = analyzeColorBlindness(
      buildPlateResponses(['12', '5', '6', 'nothing'])
    );

    expect(analysis.controlPlateCorrect).toBe(true);
    expect(analysis.colorBlindCount).toBe(1);
    expect(analysis.colorBlindnessScore).toBe(0);
  });

  test('scores two diagnostic color-blind pattern matches as color blind', () => {
    const analysis = analyzeColorBlindness(
      buildPlateResponses(['12', '5', 'nothing', 'nothing'])
    );

    expect(analysis.controlPlateCorrect).toBe(true);
    expect(analysis.colorBlindCount).toBe(2);
    expect(analysis.colorBlindnessScore).toBe(1);
    expect(analysis.diagnosis).toBe('Suspected Red-Green Deficiency');
  });

  test('treats unmatched diagnostic answers as anomalies and keeps the score at zero', () => {
    const analysis = analyzeColorBlindness(
      buildPlateResponses(['12', 'blur', 'unknown', 'n/a'])
    );

    expect(analysis.controlPlateCorrect).toBe(true);
    expect(analysis.normalVisionCount).toBe(0);
    expect(analysis.colorBlindCount).toBe(0);
    expect(analysis.anomalyCount).toBe(3);
    expect(analysis.colorBlindnessScore).toBe(0);
  });

  test('forces the score to zero when the control plate is incorrect', () => {
    const analysis = analyzeColorBlindness(
      buildPlateResponses(['wrong', '5', 'nothing', '2'])
    );

    expect(analysis.controlPlateCorrect).toBe(false);
    expect(analysis.colorBlindCount).toBe(3);
    expect(analysis.colorBlindnessScore).toBe(0);
    expect(analysis.diagnosis).toBe('Inconclusive');
  });

  test('binary helper enforces the control-plate gate and count threshold', () => {
    expect(getBinaryColorBlindnessScore({
      controlPlateCorrect: true,
      diagnosticPlateCount: 3,
      colorBlindCount: 1,
    })).toBe(0);

    expect(getBinaryColorBlindnessScore({
      controlPlateCorrect: true,
      diagnosticPlateCount: 3,
      colorBlindCount: 2,
    })).toBe(1);

    expect(getBinaryColorBlindnessScore({
      controlPlateCorrect: false,
      diagnosticPlateCount: 3,
      colorBlindCount: 3,
    })).toBe(0);
  });

  test('summary separates control, normal, color-blind, and anomalous answers', () => {
    const summary = summarizeColorBlindnessResponses(
      buildPlateResponses(['12', '5', 'unknown', 'nothing'])
    );

    expect(summary).toEqual({
      controlPlateCorrect: true,
      normalVisionCount: 1,
      colorBlindCount: 1,
      anomalyCount: 1,
      diagnosticPlateCount: 3,
      totalResponseTime: 2006,
    });
  });
});

