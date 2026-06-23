export default function MetricsPanel({
  logs,
  totalProcessed,
  avgLatency,
  evaluatedLogs,
  categoryAccuracy,
  priorityAccuracy
}) {
  return (
    <div className="panel-card" style={{ marginTop: '8px' }}>
      <h2>3. Session Telemetry & Accuracy Logs</h2>

      {/* Aggregate Stats Cards */}
      <div className="metrics-grid">
        <div className="metric-stat-card">
          <label>Total Runs</label>
          <span>{totalProcessed}</span>
        </div>
        <div className="metric-stat-card">
          <label>Avg Latency</label>
          <span>{avgLatency.toFixed(0)} ms</span>
        </div>
        <div className="metric-stat-card">
          <label>Category Accuracy</label>
          <span>{evaluatedLogs.length > 0 ? `${categoryAccuracy.toFixed(1)}%` : '100%'}</span>
        </div>
        <div className="metric-stat-card">
          <label>Priority Accuracy</label>
          <span>{evaluatedLogs.length > 0 ? `${priorityAccuracy.toFixed(1)}%` : '100%'}</span>
        </div>
      </div>

      {/* Accumulating log table */}
      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Input Preview</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Escalate</th>
              <th>Confidence</th>
              <th>Latency</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  No sessions logged yet. Try running inputs to populate live evaluation metrics.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const hasExpectation = log.expectedCategory && log.expectedPriority;
                const isMatch = hasExpectation && (log.category === log.expectedCategory && log.priority === log.expectedPriority);

                return (
                  <tr key={log.id}>
                    <td>{log.timestamp}</td>
                    <td title={log.inputPreview}>{log.inputPreview}</td>
                    <td>
                      <span className={`badge badge-${log.category}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                        {log.category}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${log.priority ? log.priority.toLowerCase() : 'p3'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                        {log.priority}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: log.needs_human ? '#b45309' : '#10b981', fontWeight: 'bold' }}>
                        {log.needs_human ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td>{((log.confidence || 0) * 100).toFixed(0)}%</td>
                    <td>{log.latency.toFixed(0)} ms</td>
                    <td>
                      {hasExpectation ? (
                        <span style={{ 
                          color: isMatch ? '#047857' : '#be123c', 
                          backgroundColor: isMatch ? '#ecfdf5' : '#fff1f2',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '600',
                          fontSize: '0.75rem'
                        }}>
                          {isMatch ? 'PASSED' : 'FAILED'}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
