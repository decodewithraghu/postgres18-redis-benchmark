/**
 * Decorator Pattern - Query Execution Decorators
 * 
 * Adds cross-cutting concerns (retry logic, logging, metrics, caching)
 * to query executors without modifying their core logic.
 */

const { QueryError, TimeoutError } = require('./Errors');

/**
 * Base decorator class
 */
class QueryExecutorDecorator {
  constructor(executor) {
    this.executor = executor;
  }

  async getCustomerDashboard(customerId) {
    return await this.executor.getCustomerDashboard(customerId);
  }

  getName() {
    return this.executor.getName();
  }
}

/**
 * Retry Decorator - Adds retry logic with exponential backoff
 */
class RetryDecorator extends QueryExecutorDecorator {
  constructor(executor, maxRetries = 3, initialDelay = 100) {
    super(executor);
    this.maxRetries = maxRetries;
    this.initialDelay = initialDelay;
  }

  async getCustomerDashboard(customerId) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.executor.getCustomerDashboard(customerId);
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors
        if (error.name === 'ValidationError') {
          throw error;
        }

        // Last attempt - throw error
        if (attempt === this.maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = this.initialDelay * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
        
        await this._sleep(delay);
      }
    }

    throw new QueryError(
      `Failed after ${this.maxRetries + 1} attempts`,
      null,
      lastError
    );
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getName() {
    return `${this.executor.getName()} (with Retry)`;
  }
}

/**
 * Logging Decorator - Adds detailed logging
 */
class LoggingDecorator extends QueryExecutorDecorator {
  constructor(executor, logger = console) {
    super(executor);
    this.logger = logger;
  }

  async getCustomerDashboard(customerId) {
    const startTime = Date.now();
    this.logger.log(`[Query] Starting: customerId=${customerId}`);

    try {
      const result = await this.executor.getCustomerDashboard(customerId);
      const duration = Date.now() - startTime;
      this.logger.log(`[Query] Success: customerId=${customerId}, duration=${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[Query] Failed: customerId=${customerId}, duration=${duration}ms, error=${error.message}`);
      throw error;
    }
  }
}

/**
 * Metrics Decorator - Collects performance metrics
 */
class MetricsDecorator extends QueryExecutorDecorator {
  constructor(executor) {
    super(executor);
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalDuration: 0,
      latencies: [],
    };
  }

  async getCustomerDashboard(customerId) {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      const result = await this.executor.getCustomerDashboard(customerId);
      const duration = Date.now() - startTime;
      
      this.metrics.successfulQueries++;
      this.metrics.totalDuration += duration;
      this.metrics.latencies.push(duration);
      
      return result;
    } catch (error) {
      this.metrics.failedQueries++;
      throw error;
    }
  }

  getMetrics() {
    const latencies = [...this.metrics.latencies].sort((a, b) => a - b);
    
    return {
      ...this.metrics,
      averageLatency: this.metrics.totalQueries > 0 
        ? (this.metrics.totalDuration / this.metrics.totalQueries).toFixed(2)
        : 0,
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      successRate: this.metrics.totalQueries > 0
        ? ((this.metrics.successfulQueries / this.metrics.totalQueries) * 100).toFixed(2)
        : 0,
    };
  }

  resetMetrics() {
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalDuration: 0,
      latencies: [],
    };
  }
}

/**
 * Timeout Decorator - Adds timeout protection
 */
class TimeoutDecorator extends QueryExecutorDecorator {
  constructor(executor, timeoutMs = 5000) {
    super(executor);
    this.timeoutMs = timeoutMs;
  }

  async getCustomerDashboard(customerId) {
    return await Promise.race([
      this.executor.getCustomerDashboard(customerId),
      this._createTimeout(),
    ]);
  }

  _createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `Query timeout after ${this.timeoutMs}ms`,
          'getCustomerDashboard'
        ));
      }, this.timeoutMs);
    });
  }

  getName() {
    return `${this.executor.getName()} (with Timeout)`;
  }
}

/**
 * Circuit Breaker Decorator - Prevents cascading failures
 */
class CircuitBreakerDecorator extends QueryExecutorDecorator {
  constructor(executor, threshold = 5, resetTimeout = 60000) {
    super(executor);
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
  }

  async getCustomerDashboard(customerId) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await this.executor.getCustomerDashboard(customerId);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  _onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn(`Circuit breaker OPEN - will retry after ${this.resetTimeout}ms`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
    };
  }

  getName() {
    return `${this.executor.getName()} (with Circuit Breaker)`;
  }
}

module.exports = {
  QueryExecutorDecorator,
  RetryDecorator,
  LoggingDecorator,
  MetricsDecorator,
  TimeoutDecorator,
  CircuitBreakerDecorator,
};
