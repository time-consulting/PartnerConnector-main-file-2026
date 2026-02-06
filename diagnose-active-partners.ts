/**
 * Diagnose Active Partners and check team member deals
 * Run: npx tsx diagnose-active-partners.ts
 */

import { db } from './server/db';
import { users, deals } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

async function diagnoseActivePartners() {
    console.log('🔍 DIAGNOSING ACTIVE PARTNERS\n');
    console.log('='.repeat(60));

    // Get your user ID
    const yourEmail = 'laurenfuller11@hotmail.com';

    const [you] = await db
        .select({ id: users.id, email: users.email, referralCode: users.referralCode })
        .from(users)
        .where(eq(users.email, yourEmail));

    if (!you) {
        console.log('❌ User not found');
        process.exit(1);
    }

    console.log(`\n✅ Logged in as: ${you.email}`);
    console.log(`   Referral Code: ${you.referralCode}`);
    console.log(`   ID: ${you.id}\n`);

    // Get team members
    console.log('📌 STEP 1: Checking team members...\n');

    const teamMembers = await db
        .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.parentPartnerId, you.id));

    console.log(`Found ${teamMembers.length} team member(s):\n`);

    if (teamMembers.length === 0) {
        console.log('❌ No team members found!');
        process.exit(0);
    }

    teamMembers.forEach((member, i) => {
        console.log(`[${i + 1}] ${member.email} (${member.firstName} ${member.lastName})`);
    });

    // Check deals for each team member
    console.log('\n📌 STEP 2: Checking deals for each team member...\n');

    let totalActive = 0;

    for (const member of teamMembers) {
        const memberDeals = await db
            .select({
                id: deals.id,
                businessName: deals.businessName,
                status: deals.status,
                dealValue: deals.dealValue,
                createdAt: deals.createdAt,
            })
            .from(deals)
            .where(eq(deals.referrerId, member.id));

        console.log(`\n${member.email}:`);
        console.log(`  Total deals: ${memberDeals.length}`);

        if (memberDeals.length === 0) {
            console.log('  ❌ No deals → NOT ACTIVE');
            continue;
        }

        // Count approved deals
        const approvedDeals = memberDeals.filter(d =>
            d.status === 'approved' || d.status === 'live' || d.status === 'completed'
        );

        console.log(`  Approved deals: ${approvedDeals.length}`);

        if (approvedDeals.length > 0) {
            console.log('  ✅ HAS APPROVED DEALS → ACTIVE');
            totalActive++;

            approvedDeals.forEach(deal => {
                console.log(`     - ${deal.businessName} (${deal.status}) - $${deal.dealValue}`);
            });
        } else {
            console.log('  ⚠️  Has deals but NONE approved → NOT ACTIVE');
            memberDeals.forEach(deal => {
                console.log(`     - ${deal.businessName} (${deal.status}) - $${deal.dealValue}`);
            });
        }
    }

    // Check what the API returns
    console.log('\n📌 STEP 3: Simulating API response...\n');

    const stats = await db
        .select({
            total: sql<number>`COUNT(*)`,
            registered: sql<number>`COUNT(CASE WHEN ${users.partnerId} IS NOT NULL OR ${users.referralCode} IS NOT NULL THEN 1 END)`,
            active: sql<number>`COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM ${deals}
        WHERE ${deals.referrerId} = ${users.id}
          AND ${deals.status} IN ('approved', 'live', 'completed')
      ) THEN 1 END)`
        })
        .from(users)
        .where(eq(users.parentPartnerId, you.id));

    const result = stats[0] || { total: 0, registered: 0, active: 0 };

    console.log('API Stats (from getTeamReferralStats):');
    console.log(`  Team Members: ${result.total}`);
    console.log(`  Registered: ${result.registered}`);
    console.log(`  Active: ${result.active}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSIS SUMMARY\n');

    console.log(`Team Members: ${teamMembers.length}`);
    console.log(`Expected Active: ${totalActive}`);
    console.log(`API Reports Active: ${result.active}`);

    if (totalActive === 0) {
        console.log('\n⚠️  ISSUE: No team members have approved deals!');
        console.log('\n💡 SOLUTION:');
        console.log('   1. Go to Admin Dashboard');
        console.log('   2. Create a deal for one of your team members');
        console.log('   3. Set referrer to: ' + teamMembers[0].email);
        console.log('   4. Set status to: "approved"');
        console.log('   5. Check Team Management again');
    } else if (totalActive !== result.active) {
        console.log('\n⚠️  BUG: Expected active count doesn\'t match API!');
        console.log('   This is a code issue - the query may be wrong.');
    } else {
        console.log('\n✅ Everything working correctly!');
    }

    console.log('='.repeat(60));
    process.exit(0);
}

diagnoseActivePartners().catch(error => {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
});
