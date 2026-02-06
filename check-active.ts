/**
 * Quick check for active partners
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkActive() {
    const yourEmail = 'laurenfuller11@hotmail.com';

    // Get your ID
    const userResult = await db.execute(sql`SELECT id FROM users WHERE email = ${yourEmail}`);
    const userId = userResult.rows[0]?.id;

    if (!userId) {
        console.log('User not found');
        process.exit(1);
    }

    console.log(`Checking team for: ${yourEmail}\n`);

    // Get team members and their deals
    const result = await db.execute(sql`
    SELECT 
      u.email,
      u.first_name,
      COUNT(d.id) as total_deals,
      COUNT(CASE WHEN d.status IN ('approved', 'live', 'completed') THEN 1 END) as approved_deals
    FROM users u
    LEFT JOIN deals d ON d.referrer_id = u.id
    WHERE u.parent_partner_id = ${userId}
    GROUP BY u.id, u.email, u.first_name
  `);

    console.log(`Found ${result.rows.length} team members:\n`);

    let activeCount = 0;

    result.rows.forEach((row: any) => {
        const isActive = parseInt(row.approved_deals) > 0;
        if (isActive) activeCount++;

        console.log(`${row.email} (${row.first_name})`);
        console.log(`  Total deals: ${row.total_deals}`);
        console.log(`  Approved deals: ${row.approved_deals}`);
        console.log(`  Status: ${isActive ? '✅ ACTIVE' : '❌ NOT ACTIVE'}\n`);
    });

    console.log(`\nActive Partners: ${activeCount} / ${result.rows.length}`);

    if (activeCount === 0) {
        console.log('\n💡 To make a partner active:');
        console.log('   1. Go to Admin → Deals');
        console.log('   2. Create a deal for a team member');
        console.log('   3. Set status to "approved"');
        console.log('   4. Refresh Team Management');
    }

    process.exit(0);
}

checkActive();
