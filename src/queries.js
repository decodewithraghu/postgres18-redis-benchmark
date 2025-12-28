const Redis = require('ioredis');
const { pgPool } = require('./database');
const config = require('./config');

const redis = new Redis(config.redis);

/**
 * Query customer dashboard with Redis cache layer
 * This simulates the "old way" with cache-aside pattern
 */
async function getCustomerDashboardWithRedis(customerId) {
  const cacheKey = `dashboard:${customerId}`;
  
  // Step 1: Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Step 2: Cache miss - query database
  const client = await pgPool.connect();
  try {
    const result = await client.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        o.id as order_id,
        o.total_cents,
        o.status,
        o.created_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
        AND o.status IN ('pending', 'processing')
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [customerId]);
    
    const data = {
      customer: {
        id: result.rows[0]?.id,
        name: result.rows[0]?.name,
        email: result.rows[0]?.email,
      },
      orders: result.rows.map(r => ({
        id: r.order_id,
        total_cents: r.total_cents,
        status: r.status,
        created_at: r.created_at,
      })),
    };
    
    // Step 3: Write back to Redis with TTL
    await redis.setex(cacheKey, config.benchmark.redisTTL, JSON.stringify(data));
    
    return data;
  } finally {
    client.release();
  }
}

/**
 * Query customer dashboard directly from PostgreSQL 18
 * This leverages:
 * - Multicolumn index with skip scans
 * - Async I/O improvements
 * - Generated columns for derived data
 */
async function getCustomerDashboardDirectPG(customerId) {
  const client = await pgPool.connect();
  try {
    // This query uses the idx_orders_customer_status_date index
    // PostgreSQL 18's skip scan optimization makes this very efficient
    const result = await client.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        o.id as order_id,
        o.total_cents,
        o.status,
        o.created_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
        AND o.status IN ('pending', 'processing')
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [customerId]);
    
    return {
      customer: {
        id: result.rows[0]?.id,
        name: result.rows[0]?.name,
        email: result.rows[0]?.email,
      },
      orders: result.rows.map(r => ({
        id: r.order_id,
        total_cents: r.total_cents,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  } finally {
    client.release();
  }
}

/**
 * Example of using generated columns for complex calculations
 * This shows how PostgreSQL 18 can replace cached derived data
 */
async function getOrderTotalsDirectPG(customerId) {
  const client = await pgPool.connect();
  try {
    // The total_cents column is automatically calculated
    // No need to compute in application code or cache the result
    const result = await client.query(`
      SELECT 
        id,
        amount_cents,
        tax_rate,
        total_cents,
        status
      FROM orders
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [customerId]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

async function flushRedisCache() {
  await redis.flushall();
}

async function closeConnections() {
  await redis.quit();
  await pgPool.end();
}

module.exports = {
  getCustomerDashboardWithRedis,
  getCustomerDashboardDirectPG,
  getOrderTotalsDirectPG,
  flushRedisCache,
  closeConnections,
};