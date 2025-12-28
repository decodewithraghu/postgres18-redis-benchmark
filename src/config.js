
require('dotenv').config();

module.exports = {
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'benchmark_db',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    max: parseInt(process.env.PG_POOL_SIZE) || 20,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  benchmark: {
    numCustomers: parseInt(process.env.NUM_CUSTOMERS) || 50000,
    ordersPerCustomer: parseInt(process.env.ORDERS_PER_CUSTOMER) || 500,
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 200,
    requestsPerUser: parseInt(process.env.REQUESTS_PER_USER) || 10,
    redisTTL: parseInt(process.env.REDIS_TTL) || 3000,
  },
};