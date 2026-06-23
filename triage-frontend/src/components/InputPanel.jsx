export default function InputPanel({
  presets,
  selectedPresetIndex,
  rawJson,
  setRawJson,
  handlePresetChange,
  runPipeline,
  loading,
  error
}) {
  return (
    <div className="panel-card">
      <h2>1. Input Simulation</h2>
      
      <div className="form-group">
        <label htmlFor="presets">Scenario Presets</label>
        <select
          id="presets"
          className="preset-select"
          value={selectedPresetIndex}
          onChange={handlePresetChange}
        >
          {presets.map((p, idx) => (
            <option key={idx} value={idx}>
              {p.label} {p.expectedCategory ? `[Expected: ${p.expectedCategory}/${p.expectedPriority}]` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="payload">Raw Request JSON Payload (Max 100KB)</label>
        <textarea
          id="payload"
          className="json-textarea"
          placeholder='{\n  "message": "Enter your test query here..."\n}'
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
        />
      </div>

      {error && (
        <div style={{
          color: '#ef4444',
          backgroundColor: '#fef2f2',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '0.875rem',
          border: '1px solid #fee2e2',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <button
        className="run-btn"
        onClick={runPipeline}
        disabled={loading}
      >
        {loading ? (
          <>
            <div className="spinner"></div>
            Processing...
          </>
        ) : 'Run Triage Pipeline'}
      </button>
    </div>
  );
}
