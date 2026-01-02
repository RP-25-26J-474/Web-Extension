import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import useStore from '../state/store';
import { getSessionResults } from '../utils/api';

const Results = () => {
  const navigate = useNavigate();
  const sessionId = useStore((state) => state.sessionId);
  const completedModules = useStore((state) => state.completedModules);
  
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await getSessionResults(sessionId);
        setResults(response.data);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to load results. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  if (loading) {
    return (
      <Layout title="Loading Results" subtitle="Please wait...">
        <LoadingSpinner message="Fetching your assessment results..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Results" subtitle="Assessment Summary">
        <div className="max-w-2xl mx-auto">
          <div className="card text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold mb-4">Error Loading Results</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Return to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const hasVision = results?.visionResult;
  const hasLiteracy = results?.literacyResult;

  return (
    <Layout title="Assessment Results" subtitle="Your Performance Summary">
      <div className="max-w-5xl mx-auto">
        {/* Session Info */}
        <div className="card mb-6 bg-gradient-to-r from-cyber-blue-900/50 to-cyber-purple-900/50">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold mb-2">Session Information</h3>
              <p className="text-sm text-gray-400">Session ID: {sessionId}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-cyber-blue-400">
                {completedModules.length}
              </div>
              <div className="text-sm text-gray-400">Modules Completed</div>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Vision Results */}
          {hasVision && (
            <div className="card">
              <h3 className="text-2xl font-bold mb-4 flex items-center">
                <span className="mr-2">👁️</span> Perception Lab
              </h3>

              {/* Color Blindness */}
              {hasVision.colorBlindness && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-cyber-blue-400">
                    Color Blindness Test
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-gray-700/50 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">Score</div>
                      <div className="text-2xl font-bold">
                        {hasVision.colorBlindness.colorVisionScore}%
                      </div>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">Diagnosis</div>
                      <div className="text-lg font-semibold">
                        {hasVision.colorBlindness.diagnosis}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Acuity */}
              {hasVision.visualAcuity && (
                <div>
                  <h4 className="text-lg font-semibold mb-3 text-cyber-blue-400">
                    Visual Acuity Test
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-gray-700/50 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">Snellen Estimate</div>
                      <div className="text-3xl font-bold">
                        {hasVision.visualAcuity.snellenEstimate}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-700/50 p-2 rounded-lg">
                        <div className="text-xs text-gray-400">Size</div>
                        <div className="text-sm font-semibold">
                          {hasVision.visualAcuity.finalResolvedSize}px
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-2 rounded-lg">
                        <div className="text-xs text-gray-400">MAR</div>
                        <div className="text-sm font-semibold">
                          {hasVision.visualAcuity.mar}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Literacy Results */}
          {hasLiteracy && (
            <div className="card">
              <h3 className="text-2xl font-bold mb-4 flex items-center">
                <span className="mr-2">💻</span> Knowledge Console
              </h3>

              <div className="space-y-4">
                {/* CLS Score */}
                <div className="bg-gradient-to-r from-cyber-blue-500/30 to-cyber-purple-500/30 p-4 rounded-lg">
                  <div className="text-sm text-gray-300 mb-1">
                    Computer Literacy Score
                  </div>
                  <div className="text-4xl font-bold">
                    {hasLiteracy.score.computerLiteracyScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {hasLiteracy.score.correctAnswers} / {hasLiteracy.score.totalQuestions} Correct
                    ({hasLiteracy.score.percentage}%)
                  </div>
                </div>

                {/* Category Scores */}
                <div>
                  <div className="text-sm font-semibold mb-2">Category Breakdown</div>
                  <div className="space-y-2">
                    {hasLiteracy.categoryScores?.map((cat) => (
                      <div
                        key={cat.category}
                        className="bg-gray-700/50 p-2 rounded-lg flex justify-between items-center"
                      >
                        <span className="text-sm capitalize">{cat.category}</span>
                        <span className="font-bold text-cyber-blue-400">
                          {cat.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-400">Avg Time</div>
                    <div className="text-sm font-semibold">
                      {(hasLiteracy.metrics.averageResponseTime / 1000).toFixed(1)}s
                    </div>
                  </div>
                  <div className="bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-400">Focus Shifts</div>
                    <div className="text-sm font-semibold">
                      {hasLiteracy.metrics.totalFocusShifts}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Motor Skills Note */}
          {completedModules.some((m) => m.name === 'reaction') && (
            <div className="card bg-purple-900/20 border-purple-500/30">
              <h3 className="text-2xl font-bold mb-4 flex items-center">
                <span className="mr-2">🎯</span> Reaction Lab
              </h3>
              <p className="text-gray-300 mb-3">
                Motor skills assessment has been completed. Your interaction data has been
                recorded for analysis.
              </p>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-sm text-gray-400">Status</div>
                <div className="text-lg font-semibold text-green-400">
                  ✓ Data Collected
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Note: This module tracks interactions only. No final score is computed.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={() => navigate('/')}
            className="btn-secondary flex-1"
          >
            ← Back to Home
          </button>
          <button
            onClick={() => window.print()}
            className="btn-primary flex-1"
          >
            🖨️ Print Results
          </button>
        </div>

        {/* Disclaimer */}
        <div className="card mt-6 bg-yellow-900/20 border-yellow-500/30">
          <h4 className="font-bold mb-2 text-yellow-400">⚠️ Important Notice</h4>
          <p className="text-sm text-gray-300">
            These results are for research and screening purposes only. They do not constitute
            a medical diagnosis. If you have concerns about your vision or cognitive abilities,
            please consult a qualified healthcare professional.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Results;

