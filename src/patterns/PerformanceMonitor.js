/**
 * Observer Pattern - Performance Monitor
 * 
 * Monitors query execution and notifies observers of performance events.
 * Useful for real-time monitoring and alerting.
 */

class PerformanceMonitor {
  constructor() {
    this.observers = [];
    this.metrics = {
      queries: [],
      alerts: [],
    };
  }

  /**
   * Subscribe to performance events
   */
  subscribe(observer) {
    if (typeof observer.update !== 'function') {
      throw new Error('Observer must implement update() method');
    }
    this.observers.push(observer);
  }

  /**
   * Unsubscribe from performance events
   */
  unsubscribe(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  /**
   * Notify all observers
   */
  notify(event) {
    for (const observer of this.observers) {
      observer.update(event);
    }
  }

  /**
   * Record query execution
   */
  recordQuery(queryInfo) {
    this.metrics.queries.push({
      ...queryInfo,
      timestamp: Date.now(),
    });

    // Check for performance issues
    this._checkPerformance(queryInfo);

    // Notify observers
    this.notify({
      type: 'QUERY_EXECUTED',
      data: queryInfo,
    });
  }

  /**
   * Check for performance issues and raise alerts
   */
  _checkPerformance(queryInfo) {
    // Slow query alert
    if (queryInfo.duration > 1000) {
      const alert = {
        type: 'SLOW_QUERY',
        message: `Slow query detected: ${queryInfo.duration}ms`,
        data: queryInfo,
        timestamp: Date.now(),
      };
      this.metrics.alerts.push(alert);
      this.notify({ type: 'ALERT', data: alert });
    }

    // Error alert
    if (queryInfo.error) {
      const alert = {
        type: 'QUERY_ERROR',
        message: `Query error: ${queryInfo.error}`,
        data: queryInfo,
        timestamp: Date.now(),
      };
      this.metrics.alerts.push(alert);
      this.notify({ type: 'ALERT', data: alert });
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const queries = this.metrics.queries;
    if (queries.length === 0) {
      return null;
    }

    const durations = queries.map((q) => q.duration);
    const sorted = [...durations].sort((a, b) => a - b);

    return {
      totalQueries: queries.length,
      avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      alerts: this.metrics.alerts.length,
    };
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {
      queries: [],
      alerts: [],
    };
  }
}

/**
 * Console Logger Observer
 */
class ConsoleObserver {
  update(event) {
    if (event.type === 'ALERT') {
      console.warn(`⚠️  [ALERT] ${event.data.message}`);
    } else if (event.type === 'QUERY_EXECUTED') {
      const { strategy, duration, success } = event.data;
      const status = success ? '✓' : '✗';
      console.log(`${status} [${strategy}] ${duration}ms`);
    }
  }
}

/**
 * File Logger Observer
 */
class FileLoggerObserver {
  constructor(filePath) {
    this.filePath = filePath;
    this.fs = require('fs');
  }

  update(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: event.type,
      data: event.data,
    };

    this.fs.appendFileSync(
      this.filePath,
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );
  }
}

/**
 * Metrics Aggregator Observer
 */
class MetricsAggregatorObserver {
  constructor() {
    this.byStrategy = new Map();
  }

  update(event) {
    if (event.type !== 'QUERY_EXECUTED') {
      return;
    }

    const { strategy, duration, success } = event.data;

    if (!this.byStrategy.has(strategy)) {
      this.byStrategy.set(strategy, {
        count: 0,
        totalDuration: 0,
        successes: 0,
        failures: 0,
      });
    }

    const metrics = this.byStrategy.get(strategy);
    metrics.count++;
    metrics.totalDuration += duration;
    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }
  }

  getMetrics() {
    const result = {};
    for (const [strategy, metrics] of this.byStrategy.entries()) {
      result[strategy] = {
        ...metrics,
        avgDuration: (metrics.totalDuration / metrics.count).toFixed(2),
        successRate: ((metrics.successes / metrics.count) * 100).toFixed(2),
      };
    }
    return result;
  }

  reset() {
    this.byStrategy.clear();
  }
}

module.exports = {
  PerformanceMonitor,
  ConsoleObserver,
  FileLoggerObserver,
  MetricsAggregatorObserver,
};
