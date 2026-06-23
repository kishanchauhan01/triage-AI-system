import { useState } from 'react';
import { PRESETS } from './constants/presets';
import InputPanel from './components/InputPanel';
import OutputPanel from './components/OutputPanel';
import MetricsPanel from './components/MetricsPanel';

export default function App() {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [rawJson, setRawJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const handlePresetChange = (e) => {
    const idx = parseInt(e.target.value);
    setSelectedPresetIndex(idx);
    const preset = PRESETS[idx];
    if (preset && preset.payload) {
      setRawJson(JSON.stringify(preset.payload, null, 2));
    } else {
      setRawJson('');
    }
    setError(null);
  };

  const runPipeline = async () => {
    if (!rawJson.trim()) {
      setError('Please provide a JSON payload first.');
      return;
    }

    const trimmed = rawJson.trim();
    const isJsonLike = trimmed.startsWith('{') || trimmed.startsWith('[');
    if (isJsonLike) {
      try {
        JSON.parse(rawJson);
      } catch (err) {
        setError(`Local validation failed: Invalid JSON format. Details: ${err.message}`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const preset = PRESETS[selectedPresetIndex];

    try {
      const response = await fetch('http://127.0.0.1:3000/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: rawJson,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

      const newLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        inputPreview: rawJson.length > 80 ? rawJson.substring(0, 80) + '...' : rawJson,
        category: data.category,
        priority: data.priority,
        needs_human: data.needs_human,
        latency: data._meta?.totalDuration || 0,
        confidence: data.confidence,
        expectedCategory: preset?.expectedCategory || null,
        expectedPriority: preset?.expectedPriority || null
      };

      setLogs((prev) => [newLog, ...prev]);
    } catch (err) {
      setError(`Connection failed: Make sure the backend server is running on http://127.0.0.1:3000. Details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Live aggregated metrics calculations
  const totalProcessed = logs.length;
  const avgLatency = totalProcessed > 0
    ? logs.reduce((acc, log) => acc + log.latency, 0) / totalProcessed
    : 0;

  const evaluatedLogs = logs.filter(l => l.expectedCategory && l.expectedPriority);
  const categoryCorrect = evaluatedLogs.filter(l => l.category === l.expectedCategory).length;
  const priorityCorrect = evaluatedLogs.filter(l => l.priority === l.expectedPriority).length;

  const categoryAccuracy = evaluatedLogs.length > 0
    ? (categoryCorrect / evaluatedLogs.length) * 100
    : 100;

  const priorityAccuracy = evaluatedLogs.length > 0
    ? (priorityCorrect / evaluatedLogs.length) * 100
    : 100;

  const formatPhaseName = (name) => {
    return name.replace(/_/g, ' ');
  };

  const getPhaseColorClass = (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `bar-${slug}`;
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Customer Triage System</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Interactive evaluation dashboard for judging model taxonomy, translation, and security defenses.
          </p>
        </div>
        <span>Judge Portal</span>
      </header>

      {/* Main Grid: Input and Output Panels */}
      <div className="main-panels">
        <InputPanel
          presets={PRESETS}
          selectedPresetIndex={selectedPresetIndex}
          rawJson={rawJson}
          setRawJson={setRawJson}
          handlePresetChange={handlePresetChange}
          runPipeline={runPipeline}
          loading={loading}
          error={error}
        />

        <OutputPanel
          loading={loading}
          result={result}
          formatPhaseName={formatPhaseName}
          getPhaseColorClass={getPhaseColorClass}
        />
      </div>

      {/* Bottom Panel: Aggregate Metrics and Session Logs */}
      <MetricsPanel
        logs={logs}
        totalProcessed={totalProcessed}
        avgLatency={avgLatency}
        evaluatedLogs={evaluatedLogs}
        categoryAccuracy={categoryAccuracy}
        priorityAccuracy={priorityAccuracy}
      />
    </div>
  );
}
