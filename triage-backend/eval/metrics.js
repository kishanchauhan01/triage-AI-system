/**
 * Computes precision, recall, and accuracy statistics for classifications.
 * 
 * @param {Array<{expected: string, actual: string}>} matches Array of match outputs.
 * @returns {{accuracy: number, details: Object}} Compiled metrics.
 */
export function calculateMetrics(matches) {
  let correctCount = 0;
  const classes = new Set();
  
  // Track metrics per class
  // Key: class name, Value: { TP, FP, FN }
  const counts = {};

  for (const match of matches) {
    const { expected, actual } = match;
    classes.add(expected);
    classes.add(actual);

    if (expected === actual) {
      correctCount++;
    }
  }

  const accuracy = matches.length > 0 ? (correctCount / matches.length) : 0.0;

  for (const cls of classes) {
    counts[cls] = { tp: 0, fp: 0, fn: 0 };
  }

  for (const match of matches) {
    const { expected, actual } = match;
    if (expected === actual) {
      counts[expected].tp++;
    } else {
      counts[actual].fp++;
      counts[expected].fn++;
    }
  }

  const details = {};
  for (const cls of classes) {
    const { tp, fp, fn } = counts[cls];
    const precision = (tp + fp) > 0 ? (tp / (tp + fp)) : 0.0;
    const recall = (tp + fn) > 0 ? (tp / (tp + fn)) : 0.0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
    
    details[cls] = {
      precision: parseFloat(precision.toFixed(2)),
      recall: parseFloat(recall.toFixed(2)),
      f1: parseFloat(f1.toFixed(2)),
      support: tp + fn
    };
  }

  return {
    accuracy: parseFloat(accuracy.toFixed(2)),
    details
  };
}
