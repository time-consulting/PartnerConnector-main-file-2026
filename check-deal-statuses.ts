/**
 * Check deal statuses for User10
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkDealStatuses() {
  const result = await db.execute(sql`
    SELECT 
      d.id,
      d.business_name,
      d.status,
      d.quote_amount,
      d.submitted_at,
      u.email as referrer_email
    FROM deals d
    JOIN users u ON d.referrer_id = u.id
    WHERE u.email = 'darren.business123@hotmail.com'
    ORDER BY d.submitted_at DESC
  `);

  console.log('\nDeals for darren.business123@hotmail.com:\n');

  result.rows.forEach((deal, i) => {
    console.log(`[${i + 1}] ${deal.business_name}`);
    console.log(`    Status: "${deal.status}" ${deal.status === 'approved' ? '✅' : '❌'}`);
    console.log(`    Quote: $${deal.quote_amount || '0'}`);
    console.log(`    Submitted: ${deal.submitted_at}`);
    console.log(`    ID: ${deal.id}\n`);
  });

  console.log('Expected status values for ACTIVE:');
  console.log('  - "approved"');
  console.log('  - "live"');
  console.log('  - "completed"');

  const approvedCount = result.rows.filter(d =>
    d.status === 'approved' || d.status === 'live' || d.status === 'completed'
  ).length;

  console.log(`\nApproved deals: ${approvedCount} / ${result.rows.length}`);

  process.exit(0);
}

checkDealStatuses();
