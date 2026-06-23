export default function OutputPanel({
  loading,
  result,
  formatPhaseName = (name) => name.replace(/_/g, ' '),
  getPhaseColorClass = (name) => `bar-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
}) {
  return (
    <div className="panel-card">
      <h2>2. Triage Output & Telemetry</h2>

      {loading && (
        <div className="loading-container">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <span>Executing Pipeline Orchestrator...</span>
        </div>
      )}

      {!loading && !result && (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>Provide input on the left and run the pipeline to inspect results.</span>
        </div>
      )}

      {!loading && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Badges Section */}
          <div className="badge-row">
            <span className={`badge badge-${result.category}`}>
              Category: {result.category}
            </span>
            <span className={`badge badge-${result.priority ? result.priority.toLowerCase() : 'p3'}`}>
              Priority: {result.priority}
            </span>
          </div>

          {/* Escalate Alert Banner */}
          {result.needs_human && (
            <div className={`human-escalation-banner ${result.confidence <= 0.4 ? 'danger' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                {result.confidence <= 0.4 
                  ? "UNCLASSIFIABLE / INJECTION DETECTED - FORCED HUMAN REVIEW Queue" 
                  : "CONFIDENCE CAP/FOREIGN SCRIPT - ROUTED TO HUMAN MANUAL REVIEW"}
              </span>
            </div>
          )}

          {/* Text Fields */}
          <div className="output-field">
            <label>English Summary</label>
            <p>{result.summary}</p>
          </div>

          <div className="output-field">
            <label>Suggested Action</label>
            <p>{result.suggested_action}</p>
          </div>

          {/* Confidence Metric */}
          <div className="confidence-container">
            <div className="confidence-header">
              <label>Confidence Metric</label>
              <span>{((result.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
            <div className="confidence-bar-outer">
              <div 
                className="confidence-bar-inner" 
                style={{ width: `${(result.confidence || 0) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Timing Telemetry Visualizer */}
          {result._meta && result._meta.timings && (
            <div className="telemetry-container">
              <h4>Phase Telemetry Logs</h4>
              {result._meta.timings.map((t, idx) => (
                <div key={idx} className="telemetry-row">
                  <div className="telemetry-label-row">
                    <span>{formatPhaseName(t.name)}</span>
                    <span>{t.duration.toFixed(2)} ms</span>
                  </div>
                  <div className="telemetry-bar-outer">
                    <div 
                      className={`telemetry-bar-inner ${getPhaseColorClass(t.name)}`}
                      style={{ width: `${Math.max(1, (t.duration / result._meta.totalDuration) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '700', color: '#1e3a8a', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>
                <span>Total Time</span>
                <span>{result._meta.totalDuration.toFixed(1)} ms</span>
              </div>
            </div>
          )}

          {/* Raw JSON Response */}
          <div className="output-field" style={{ marginTop: '8px' }}>
            <label>Raw LLM JSON Output</label>
            <pre style={{ 
              margin: 0, 
              backgroundColor: '#f8fafc', 
              padding: '12px', 
              borderRadius: '8px', 
              fontSize: '0.8rem', 
              overflowX: 'auto',
              fontFamily: 'Fira Code, monospace',
              border: '1px solid #e2e8f0',
              color: '#334155'
            }}>
              <code>
                {(() => {
                  const cleanResult = { ...result };
                  delete cleanResult._meta;
                  return JSON.stringify(cleanResult, null, 2);
                })()}
              </code>
            </pre>
          </div>

        </div>
      )}
    </div>
  );
}
