/**
 * Calculate statistics from an array of latency measurements
 */
function calculateStats(latencies) {
  if (latencies.length === 0) {
    return null;
  }
  
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    count: sorted.length,
    avg: (sum / sorted.length).toFixed(2),
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.90)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Format statistics for console output
 */
function formatStats(label, stats, totalTime) {
  console.log(`\n${label}:`);
  console.log(`  Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`  Requests: ${stats.count}`);
  console.log(`  Throughput: ${(stats.count / (totalTime / 1000)).toFixed(2)} req/s`);
  console.log(`  Latency:`);
  console.log(`    Average: ${stats.avg}ms`);
  console.log(`    p50: ${stats.p50}ms`);
  console.log(`    p75: ${stats.p75}ms`);
  console.log(`    p90: ${stats.p90}ms`);
  console.log(`    p95: ${stats.p95}ms`);
  console.log(`    p99: ${stats.p99}ms`);
  console.log(`    Min: ${stats.min}ms | Max: ${stats.max}ms`);
}

/**
 * Compare two sets of statistics
 */
function compareStats(redisStats, pgStats) {
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON');
  console.log('='.repeat(60));
  
  const metrics = ['avg', 'p50', 'p75', 'p90', 'p95', 'p99'];
  
  console.log('\nLatency Comparison:');
  metrics.forEach(metric => {
    const redis = parseFloat(redisStats[metric]);
    const pg = parseFloat(pgStats[metric]);
    const diff = redis - pg;
    const pct = ((diff / redis) * 100).toFixed(1);
    const symbol = diff > 0 ? '✓' : '✗';
    const direction = diff > 0 ? 'faster' : 'slower';
    
    console.log(`  ${metric.toUpperCase()}: ${symbol} PostgreSQL is ${Math.abs(pct)}% ${direction} (${Math.abs(diff).toFixed(2)}ms)`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  // Key finding from the article
  const p95Diff = parseFloat(redisStats.p95) - parseFloat(pgStats.p95);
  if (p95Diff > 0) {
    console.log(`\n🎯 KEY FINDING: PostgreSQL 18 has ${Math.abs(p95Diff)}ms LOWER p95 latency`);
    console.log('   This matches the article\'s claim that direct PG can be faster than Redis!');
  } else {
    console.log(`\n⚠️  Note: Redis is faster in this test by ${Math.abs(p95Diff)}ms`);
    console.log('   Results vary based on hardware, data distribution, and cache hit rates.');
  }
  console.log('='.repeat(60));
}

/**
 * Progress bar for long-running operations
 */
function showProgress(current, total, startTime) {
  const percent = Math.floor((current / total) * 100);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
  process.stdout.write(`\r  [${bar}] ${percent}% (${current}/${total}) - ${elapsed}s`);
  
  if (current === total) {
    console.log('');
  }
}

module.exports = {
  calculateStats,
  formatStats,
  compareStats,
  showProgress,
};