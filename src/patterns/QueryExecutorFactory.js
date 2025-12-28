/**
 * Factory Pattern - Query Executor Factory
 * 
 * Creates appropriate query executors based on configuration.
 * Centralizes the creation logic and makes it easy to add new strategies.
 */

const {
  RedisCacheStrategy,
  DirectPostgreSQLStrategy,
  HybridStrategy,
} = require('./QueryStrategy');

class QueryExecutorFactory {
  static STRATEGIES = {
    REDIS: 'redis',
    POSTGRES: 'postgres',
    HYBRID: 'hybrid',
  };

  /**
   * Create a query executor based on strategy type
   */
  static create(strategyType, options = {}) {
    switch (strategyType) {
      case this.STRATEGIES.REDIS:
        return new RedisCacheStrategy();

      case this.STRATEGIES.POSTGRES:
        return new DirectPostgreSQLStrategy();

      case this.STRATEGIES.HYBRID:
        return new HybridStrategy(options.hotDataThreshold);

      default:
        throw new Error(`Unknown strategy type: ${strategyType}`);
    }
  }

  /**
   * Create all available strategies for comparison
   */
  static createAll(options = {}) {
    return {
      redis: this.create(this.STRATEGIES.REDIS, options),
      postgres: this.create(this.STRATEGIES.POSTGRES, options),
      hybrid: this.create(this.STRATEGIES.HYBRID, options),
    };
  }

  /**
   * Get available strategy types
   */
  static getAvailableStrategies() {
    return Object.values(this.STRATEGIES);
  }
}

module.exports = QueryExecutorFactory;
