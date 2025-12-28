/**
 * Usage Examples - How to Use the Design Patterns
 * 
 * This file demonstrates various usage patterns and best practices.
 */

const {
  DatabaseConnectionManager,
  QueryExecutorFactory,
  RedisCacheStrategy,
  DirectPostgreSQLStrategy,
  HybridStrategy,
  RetryDecorator,
  LoggingDecorator,
  MetricsDecorator,
  TimeoutDecorator,
  CircuitBreakerDecorator,
  PerformanceMonitor,
  ConsoleObserver,
  MetricsAggregatorObserver,
  CustomerDashboardQueryBuilder,
  OrderQueryBuilder,
} = require('./patterns');

/**
 * Example 1: Basic Usage - Single Strategy
 */
async function example1_BasicUsage() {
  console.log('\n=== Example 1: Basic Usage ===\n');

  // Initialize connection manager (Singleton)
  await DatabaseConnectionManager.initialize();

  // Create a strategy
  const strategy = new RedisCacheStrategy();

  // Execute query
  const customerId = 1;
  const result = await strategy.getCustomerDashboard(customerId);
  console.log('Customer:', result.customer);
  console.log('Orders:', result.orders.length);

  // Cleanup
  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 2: Factory Pattern - Create Multiple Strategies
 */
async function example2_FactoryPattern() {
  console.log('\n=== Example 2: Factory Pattern ===\n');

  await DatabaseConnectionManager.initialize();

  // Create strategies using factory
  const redisExecutor = QueryExecutorFactory.create('redis');
  const pgExecutor = QueryExecutorFactory.create('postgres');
  const hybridExecutor = QueryExecutorFactory.create('hybrid', {
    hotDataThreshold: 50,
  });

  console.log('Created strategies:');
  console.log(' -', redisExecutor.getName());
  console.log(' -', pgExecutor.getName());
  console.log(' -', hybridExecutor.getName());

  // Create all at once
  const allExecutors = QueryExecutorFactory.createAll();
  console.log('\nAll available strategies:', Object.keys(allExecutors));

  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 3: Decorator Pattern - Adding Features
 */
async function example3_DecoratorPattern() {
  console.log('\n=== Example 3: Decorator Pattern ===\n');

  await DatabaseConnectionManager.initialize();

  // Start with base strategy
  let executor = new DirectPostgreSQLStrategy();
  console.log('Base:', executor.getName());

  // Add retry capability
  executor = new RetryDecorator(executor, 3, 100);
  console.log('After Retry:', executor.getName());

  // Add timeout protection
  executor = new TimeoutDecorator(executor, 5000);
  console.log('After Timeout:', executor.getName());

  // Add metrics collection
  executor = new MetricsDecorator(executor);

  // Add circuit breaker
  executor = new CircuitBreakerDecorator(executor, 5, 60000);

  // Execute queries
  for (let i = 1; i <= 10; i++) {
    try {
      await executor.getCustomerDashboard(i);
    } catch (error) {
      console.error(`Query ${i} failed:`, error.message);
    }
  }

  // Get metrics from decorator
  const metrics = executor.executor.executor.getMetrics(); // Navigate through decorator chain
  console.log('\nMetrics:', metrics);

  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 4: Observer Pattern - Performance Monitoring
 */
async function example4_ObserverPattern() {
  console.log('\n=== Example 4: Observer Pattern ===\n');

  await DatabaseConnectionManager.initialize();

  // Create performance monitor
  const monitor = new PerformanceMonitor();

  // Subscribe observers
  monitor.subscribe(new ConsoleObserver());
  const metricsObserver = new MetricsAggregatorObserver();
  monitor.subscribe(metricsObserver);

  // Create executor
  const executor = new DirectPostgreSQLStrategy();

  // Execute queries and record performance
  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    try {
      await executor.getCustomerDashboard(i);
      const duration = Date.now() - start;

      monitor.recordQuery({
        strategy: executor.getName(),
        customerId: i,
        duration,
        success: true,
      });
    } catch (error) {
      const duration = Date.now() - start;

      monitor.recordQuery({
        strategy: executor.getName(),
        customerId: i,
        duration,
        success: false,
        error: error.message,
      });
    }
  }

  // Get aggregated metrics
  const aggregated = metricsObserver.getMetrics();
  console.log('\nAggregated Metrics:', aggregated);

  // Get summary
  const summary = monitor.getSummary();
  console.log('Summary:', summary);

  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 5: Builder Pattern - Complex Queries
 */
async function example5_BuilderPattern() {
  console.log('\n=== Example 5: Builder Pattern ===\n');

  await DatabaseConnectionManager.initialize();

  // Build customer dashboard query
  const dashboardBuilder = new CustomerDashboardQueryBuilder();
  const dashboardQuery = dashboardBuilder.buildForCustomer(1);
  console.log('Dashboard Query:');
  console.log(dashboardQuery.text);
  console.log('Parameters:', dashboardQuery.values);

  // Build order query
  const orderBuilder = new OrderQueryBuilder();
  const orderQuery = orderBuilder.buildForCustomerOrders(1, 20);
  console.log('\nOrder Query:');
  console.log(orderQuery.text);
  console.log('Parameters:', orderQuery.values);

  // Execute query
  const pgPool = DatabaseConnectionManager.getPgPool();
  const result = await pgPool.query(orderQuery.text, orderQuery.values);
  console.log(`\nFound ${result.rows.length} orders`);

  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 6: Strategy Pattern - Runtime Switching
 */
async function example6_StrategyPattern() {
  console.log('\n=== Example 6: Strategy Pattern - Runtime Switching ===\n');

  await DatabaseConnectionManager.initialize();

  // Create different strategies
  const strategies = {
    redis: new RedisCacheStrategy(),
    postgres: new DirectPostgreSQLStrategy(),
    hybrid: new HybridStrategy(50),
  };

  // Context that uses a strategy
  class QueryContext {
    constructor(strategy) {
      this.strategy = strategy;
    }

    setStrategy(strategy) {
      this.strategy = strategy;
    }

    async executeQuery(customerId) {
      console.log(`Using: ${this.strategy.getName()}`);
      const start = Date.now();
      const result = await this.strategy.getCustomerDashboard(customerId);
      const duration = Date.now() - start;
      console.log(`  Duration: ${duration}ms`);
      return result;
    }
  }

  const context = new QueryContext(strategies.redis);

  // Execute with Redis
  await context.executeQuery(1);

  // Switch to PostgreSQL
  context.setStrategy(strategies.postgres);
  await context.executeQuery(1);

  // Switch to Hybrid
  context.setStrategy(strategies.hybrid);
  await context.executeQuery(1);

  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 7: Complete Stack - All Patterns Together
 */
async function example7_CompleteStack() {
  console.log('\n=== Example 7: Complete Stack ===\n');

  // 1. Initialize Singleton
  await DatabaseConnectionManager.initialize();
  console.log('✓ Singleton: Connections initialized');

  // 2. Setup Observer
  const monitor = new PerformanceMonitor();
  monitor.subscribe(new ConsoleObserver());
  const metricsObserver = new MetricsAggregatorObserver();
  monitor.subscribe(metricsObserver);
  console.log('✓ Observer: Monitoring setup');

  // 3. Create Strategy with Factory
  let executor = QueryExecutorFactory.create('postgres');
  console.log('✓ Factory: Strategy created');

  // 4. Wrap with Decorators
  executor = new RetryDecorator(executor, 3);
  executor = new MetricsDecorator(executor);
  executor = new TimeoutDecorator(executor, 5000);
  console.log('✓ Decorator: Features added');

  // 5. Use Builder for queries
  const builder = new CustomerDashboardQueryBuilder();
  console.log('✓ Builder: Query builder ready');

  // 6. Execute and monitor
  console.log('\nExecuting queries...');
  for (let i = 1; i <= 10; i++) {
    const start = Date.now();
    try {
      await executor.getCustomerDashboard(i);
      const duration = Date.now() - start;

      monitor.recordQuery({
        strategy: 'PostgreSQL',
        customerId: i,
        duration,
        success: true,
      });
    } catch (error) {
      console.error(`Query ${i} failed:`, error.message);
    }
  }

  // 7. Display results
  console.log('\n=== Results ===');

  const decoratorMetrics = executor.executor.executor.getMetrics();
  console.log('\nDecorator Metrics:', decoratorMetrics);

  const observerMetrics = metricsObserver.getMetrics();
  console.log('\nObserver Metrics:', observerMetrics);

  const poolStats = DatabaseConnectionManager.getPoolStats();
  console.log('\nPool Stats:', poolStats);

  // Cleanup
  await DatabaseConnectionManager.closeAll();
  console.log('\n✓ Cleanup complete');
}

/**
 * Example 8: Error Handling
 */
async function example8_ErrorHandling() {
  console.log('\n=== Example 8: Error Handling ===\n');

  await DatabaseConnectionManager.initialize();

  // Strategy with retry
  let executor = new DirectPostgreSQLStrategy();
  executor = new RetryDecorator(executor, 3, 100);

  try {
    // This will retry on failure
    await executor.getCustomerDashboard(999999);
  } catch (error) {
    console.error('Error after retries:', error.name);
    console.error('Message:', error.message);
    if (error.originalError) {
      console.error('Original:', error.originalError.message);
    }
  }

  await DatabaseConnectionManager.closeAll();
}

/**
 * Example 9: Cache Management
 */
async function example9_CacheManagement() {
  console.log('\n=== Example 9: Cache Management ===\n');

  await DatabaseConnectionManager.initialize();

  const strategy = new RedisCacheStrategy();

  // Execute queries
  await strategy.getCustomerDashboard(1);
  await strategy.getCustomerDashboard(1); // Cache hit
  await strategy.getCustomerDashboard(2);
  await strategy.getCustomerDashboard(2); // Cache hit

  // Check cache stats
  const cacheStats = strategy.getCacheStats();
  console.log('Cache Stats:', cacheStats);
  console.log(`Hit Rate: ${cacheStats.hitRate}%`);

  // Invalidate specific cache
  await strategy.invalidateCache(1);
  console.log('\n✓ Cache invalidated for customer 1');

  // Flush all cache
  await strategy.flushCache();
  console.log('✓ All cache flushed');

  await DatabaseConnectionManager.closeAll();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  const examples = [
    example1_BasicUsage,
    example2_FactoryPattern,
    example3_DecoratorPattern,
    example4_ObserverPattern,
    example5_BuilderPattern,
    example6_StrategyPattern,
    example7_CompleteStack,
    example8_ErrorHandling,
    example9_CacheManagement,
  ];

  for (const example of examples) {
    try {
      await example();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('\nExample failed:', error.message);
    }
  }

  console.log('\n✓ All examples completed\n');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  example1_BasicUsage,
  example2_FactoryPattern,
  example3_DecoratorPattern,
  example4_ObserverPattern,
  example5_BuilderPattern,
  example6_StrategyPattern,
  example7_CompleteStack,
  example8_ErrorHandling,
  example9_CacheManagement,
};
