#!/usr/bin/env node

/**
 * Improved PostgreSQL 18 vs Redis Performance Benchmark
 * 
 * Demonstrates design patterns: Singleton, Strategy, Factory, Builder, 
 * Decorator, Observer for better maintainability and extensibility.
 */

const config = require('./config');
const {
  setupDatabase,
  seedData,
  cleanDatabase,
  getDatabaseStats,
} = require('./database');
const {
  DatabaseConnectionManager,
  QueryExecutorFactory,
  RetryDecorator,
  MetricsDecorator,
  TimeoutDecorator,
  PerformanceMonitor,
  ConsoleObserver,
  MetricsAggregatorObserver,
} = require('./patterns');
const { calculateStats, formatStats, compareStats, showProgress } = require('./utils');

/**
 * Benchmark runner with improved architecture
 */
class BenchmarkRunner {
  constructor() {
    this.dbManager = DatabaseConnectionManager;
    this.monitor = new PerformanceMonitor();
    this.executors = null;
  }

  /**
   * Initialize the benchmark environment
   */
  async initialize() {
    console.log('🔧 Initializing benchmark environment...\n');

    // Initialize database connections (Singleton)
    await this.dbManager.initialize();

    // Check health
    const health = await this.dbManager.getHealthStatus();
    console.log('Health Check:');
    console.log(`  PostgreSQL: ${health.postgres ? '✓' : '✗'}`);
    console.log(`  Redis: ${health.redis ? '✓' : '✗'}\n`);

    if (!health.postgres || !health.redis) {
      throw new Error('Database health check failed');
    }

    // Setup performance monitoring (Observer pattern)
    this.monitor.subscribe(new ConsoleObserver());
    const metricsObserver = new MetricsAggregatorObserver();
    this.monitor.subscribe(metricsObserver);
    this.metricsObserver = metricsObserver;

    // Create query executors with decorators (Factory + Decorator patterns)
    this.executors = this._createExecutors();

    console.log('✓ Benchmark environment ready\n');
  }

  /**
   * Create query executors with decorators
   */
  _createExecutors() {
    const factory = QueryExecutorFactory;

    // Create base strategies
    const redisStrategy = factory.create('redis');
    const postgresStrategy = factory.create('postgres');

    // Apply decorators (Decorator pattern)
    const decorateExecutor = (executor, name) => {
      let decorated = executor;
      decorated = new RetryDecorator(decorated, 3, 100);
      decorated = new TimeoutDecorator(decorated, 5000);
      decorated = new MetricsDecorator(decorated);
      return { executor: decorated, name };
    };

    return {
      redis: decorateExecutor(redisStrategy, 'Redis Cache'),
      postgres: decorateExecutor(postgresStrategy, 'Direct PostgreSQL 18'),
    };
  }

  /**
   * Run benchmark for a specific strategy
   */
  async runStrategyBenchmark(executorInfo, customerIds, requestsPerUser) {
    const { executor, name } = executorInfo;
    const latencies = [];
    const startTime = Date.now();
    let completed = 0;
    const total = customerIds.length * requestsPerUser;

    console.log('='.repeat(60));
    console.log(`TESTING: ${name.toUpperCase()}`);
    console.log('='.repeat(60));

    await Promise.all(
      customerIds.map(async (customerId) => {
        for (let i = 0; i < requestsPerUser; i++) {
          const queryStart = Date.now();
          let success = true;
          let error = null;

          try {
            await executor.getCustomerDashboard(customerId);
          } catch (err) {
            success = false;
            error = err.message;
          }

          const duration = Date.now() - queryStart;
          latencies.push(duration);
          completed++;

          // Record in performance monitor
          this.monitor.recordQuery({
            strategy: name,
            customerId,
            duration,
            success,
            error,
          });

          if (completed % 100 === 0) {
            showProgress(completed, total, startTime);
          }
        }
      })
    );

    showProgress(total, total, startTime);
    const totalTime = Date.now() - startTime;

    return {
      name,
      latencies,
      totalTime,
      metrics: executor.getMetrics ? executor.getMetrics() : null,
    };
  }

  /**
   * Run complete benchmark
   */
  async runBenchmark() {
    const { concurrentUsers, requestsPerUser, numCustomers } = config.benchmark;

    console.log('\n' + '='.repeat(60));
    console.log('BENCHMARK CONFIGURATION');
    console.log('='.repeat(60));
    console.log(`Concurrent Users: ${concurrentUsers}`);
    console.log(`Requests per User: ${requestsPerUser}`);
    console.log(`Total Requests: ${concurrentUsers * requestsPerUser}`);
    console.log('='.repeat(60) + '\n');

    // Generate random customer IDs
    const customerIds = Array.from(
      { length: concurrentUsers },
      () => Math.floor(Math.random() * numCustomers) + 1
    );

    // Warm up Redis cache
    console.log('📦 Warming up Redis cache...');
    const warmupCount = Math.min(50, concurrentUsers);
    for (let i = 0; i < warmupCount; i++) {
      await this.executors.redis.executor.getCustomerDashboard(customerIds[i]);
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\r  Cached ${i + 1}/${warmupCount} customers`);
      }
    }
    console.log(`\n✓ Cache warmed\n`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Run Redis benchmark
    const redisResults = await this.runStrategyBenchmark(
      this.executors.redis,
      customerIds,
      requestsPerUser
    );

    // Flush Redis cache
    console.log('\n🧹 Flushing Redis cache...');
    const redis = this.dbManager.getRedisClient();
    await redis.flushall();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Run PostgreSQL benchmark
    const pgResults = await this.runStrategyBenchmark(
      this.executors.postgres,
      customerIds,
      requestsPerUser
    );

    // Display results
    this._displayResults(redisResults, pgResults);
  }

  /**
   * Display benchmark results
   */
  _displayResults(redisResults, pgResults) {
    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));

    const redisStats = calculateStats(redisResults.latencies);
    const pgStats = calculateStats(pgResults.latencies);

    formatStats(redisResults.name, redisStats, redisResults.totalTime);
    formatStats(pgResults.name, pgStats, pgResults.totalTime);
    compareStats(redisStats, pgStats);

    // Display decorator metrics
    if (redisResults.metrics) {
      console.log('\n📊 Redis Executor Metrics:');
      console.log(`  Success Rate: ${redisResults.metrics.successRate}%`);
      console.log(`  Total Queries: ${redisResults.metrics.totalQueries}`);
    }

    if (pgResults.metrics) {
      console.log('\n📊 PostgreSQL Executor Metrics:');
      console.log(`  Success Rate: ${pgResults.metrics.successRate}%`);
      console.log(`  Total Queries: ${pgResults.metrics.totalQueries}`);
    }

    // Display observer metrics
    const aggregatedMetrics = this.metricsObserver.getMetrics();
    console.log('\n📈 Aggregated Metrics by Strategy:');
    for (const [strategy, metrics] of Object.entries(aggregatedMetrics)) {
      console.log(`\n  ${strategy}:`);
      console.log(`    Total: ${metrics.count}`);
      console.log(`    Avg Duration: ${metrics.avgDuration}ms`);
      console.log(`    Success Rate: ${metrics.successRate}%`);
    }

    // Display connection pool stats
    const poolStats = this.dbManager.getPoolStats();
    if (poolStats) {
      console.log('\n🔌 Connection Pool Stats:');
      console.log(`  Total: ${poolStats.total}`);
      console.log(`  Idle: ${poolStats.idle}`);
      console.log(`  Waiting: ${poolStats.waiting}`);
    }

    console.log('\n💡 Design Patterns Applied:');
    console.log('   ✓ Singleton - Database connection management');
    console.log('   ✓ Strategy - Swappable query strategies');
    console.log('   ✓ Factory - Query executor creation');
    console.log('   ✓ Decorator - Retry, metrics, timeout');
    console.log('   ✓ Observer - Performance monitoring');
    console.log('');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.dbManager.closeAll();
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Improved PostgreSQL 18 vs Redis Benchmark             ║');
  console.log('║  With Design Patterns & Best Practices                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const runner = new BenchmarkRunner();

  try {
    // Handle clean command
    if (args.includes('--clean')) {
      await runner.initialize();
      await cleanDatabase();
      console.log('\n✓ Cleanup complete\n');
      await runner.cleanup();
      return;
    }

    // Initialize
    await runner.initialize();

    // Handle benchmark-only command
    if (args.includes('--benchmark-only')) {
      console.log('📊 Running benchmark only...\n');
      const stats = await getDatabaseStats();
      console.log(`Database: ${stats.customers} customers, ${stats.orders} orders\n`);
      await runner.runBenchmark();
      await runner.cleanup();
      return;
    }

    // Default: Check if setup needed
    if (!args.includes('--setup-only')) {
      try {
        const stats = await getDatabaseStats();
        if (stats.customers > 0) {
          console.log(`⚠️  Database has data (${stats.customers} customers)`);
          console.log('   Skipping setup. Use --clean to reset.\n');
        }
      } catch (error) {
        console.log('📦 Setting up database...\n');
        await setupDatabase();
        await seedData(
          config.benchmark.numCustomers,
          config.benchmark.ordersPerCustomer
        );
      }
    } else {
      console.log('📦 Setting up database...\n');
      await setupDatabase();
      await seedData(
        config.benchmark.numCustomers,
        config.benchmark.ordersPerCustomer
      );
      console.log('\n✓ Setup complete\n');
      await runner.cleanup();
      return;
    }

    // Run benchmark
    await runner.runBenchmark();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await runner.cleanup();
    console.log('👋 Benchmark complete.\n');
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { BenchmarkRunner };
