const { Pool } = require('pg');
const config = require('./config');

const pgPool = new Pool(config.pg);

async function setupDatabase() {
  const client = await pgPool.connect();
  
  try {
    console.log('Setting up database schema...');
    
    // Drop existing tables
    await client.query('DROP TABLE IF EXISTS orders CASCADE');
    await client.query('DROP TABLE IF EXISTS customers CASCADE');
    
    // Create customers table
    await client.query(`
      CREATE TABLE customers (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Created customers table');
    
    // Create orders table with PostgreSQL 18 features
    // Virtual generated column: total_cents is automatically calculated
    await client.query(`
      CREATE TABLE orders (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT REFERENCES customers(id),
        amount_cents BIGINT NOT NULL,
        tax_rate NUMERIC(5,4) DEFAULT 0.0825,
        total_cents BIGINT GENERATED ALWAYS AS (
          ROUND(amount_cents * (1 + tax_rate))
        ) STORED,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Created orders table with generated column');
    
    // Create multicolumn B-tree index for skip scans (PostgreSQL 18 optimization)
    // This index allows efficient queries filtering by customer_id and status
    await client.query(`
      CREATE INDEX idx_orders_customer_status_date 
      ON orders(customer_id, status, created_at DESC)
    `);
    
    console.log('Created multicolumn index for skip scans');
    
    // Additional indexes for performance
    await client.query(`
      CREATE INDEX idx_customers_email ON customers(email)
    `);
    
    console.log('Database schema created successfully');
    
    // Verify PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('\nPostgreSQL Version:', versionResult.rows[0].version);
    
  } finally {
    client.release();
  }
}

async function seedData(numCustomers, ordersPerCustomer) {
  const client = await pgPool.connect();
  
  try {
    console.log(`\nSeeding ${numCustomers} customers with ${ordersPerCustomer} orders each...`);
    console.log('This may take a few minutes...\n');
    
    const startTime = Date.now();
    
    // Insert customers in batches
    const customerBatchSize = 1000;
    for (let i = 0; i < numCustomers; i += customerBatchSize) {
      const values = [];
      const placeholders = [];
      
      const batchEnd = Math.min(customerBatchSize, numCustomers - i);
      for (let j = 0; j < batchEnd; j++) {
        const idx = i + j;
        placeholders.push(`($${j * 2 + 1}, $${j * 2 + 2})`);
        values.push(`customer${idx}@example.com`, `Customer ${idx}`);
      }
      
      await client.query(
        `INSERT INTO customers (email, name) VALUES ${placeholders.join(', ')}`,
        values
      );
      
      if ((i + customerBatchSize) % 5000 === 0) {
        console.log(`  Customers: ${i + customerBatchSize}/${numCustomers}`);
      }
    }
    
    console.log(`✓ ${numCustomers} customers created\n`);
    console.log('Seeding orders (this will take longer)...\n');
    
    // Insert orders in batches
    const statuses = ['pending', 'processing', 'shipped', 'delivered'];
    const orderBatchSize = 100;
    
    for (let customerId = 1; customerId <= numCustomers; customerId++) {
      const orderValues = [];
      const orderPlaceholders = [];
      
      for (let j = 0; j < ordersPerCustomer; j++) {
        const idx = j * 3;
        orderPlaceholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3})`);
        orderValues.push(
          customerId,
          Math.floor(Math.random() * 50000) + 1000, // amount_cents
          statuses[Math.floor(Math.random() * statuses.length)]
        );
      }
      
      await client.query(
        `INSERT INTO orders (customer_id, amount_cents, status) 
         VALUES ${orderPlaceholders.join(', ')}`,
        orderValues
      );
      
      if (customerId % 1000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const progress = ((customerId / numCustomers) * 100).toFixed(1);
        console.log(`  Orders: ${customerId * ordersPerCustomer}/${numCustomers * ordersPerCustomer} (${progress}%) - ${elapsed}s elapsed`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✓ Data seeding completed in ${totalTime}s`);
    console.log(`  Total customers: ${numCustomers}`);
    console.log(`  Total orders: ${numCustomers * ordersPerCustomer}`);
    
    // Analyze tables for better query planning
    console.log('\nAnalyzing tables for query optimization...');
    await client.query('ANALYZE customers');
    await client.query('ANALYZE orders');
    console.log('✓ Analysis complete');
    
  } finally {
    client.release();
  }
}

async function cleanDatabase() {
  const client = await pgPool.connect();
  
  try {
    console.log('Cleaning database...');
    await client.query('DROP TABLE IF EXISTS orders CASCADE');
    await client.query('DROP TABLE IF EXISTS customers CASCADE');
    console.log('✓ Database cleaned');
  } finally {
    client.release();
  }
}

async function getDatabaseStats() {
  const client = await pgPool.connect();
  
  try {
    const customerCount = await client.query('SELECT COUNT(*) FROM customers');
    const orderCount = await client.query('SELECT COUNT(*) FROM orders');
    
    return {
      customers: parseInt(customerCount.rows[0].count),
      orders: parseInt(orderCount.rows[0].count),
    };
  } finally {
    client.release();
  }
}

module.exports = {
  pgPool,
  setupDatabase,
  seedData,
  cleanDatabase,
  getDatabaseStats,
};