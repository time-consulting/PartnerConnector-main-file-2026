/**
 * REFERRAL SYSTEM DIAGNOSTIC SCRIPT (TypeScript)
 * Run this in Replit: npx tsx diagnose-referral.ts
 * 
 * This will check why User7 isn't showing on the referrer's dashboard
 */

import { db } from './server/db';
import { users, partnerHierarchy } from '@shared/schema';
import { eq, sql, or, ilike } from 'drizzle-orm';

console.log('🔍 REFERRAL SYSTEM DIAGNOSTIC\n');
console.log('='.repeat(60));

async function runDiagnostics() {
    try {
        // ============================================
        // STEP 1: Find referrer with code "UU001"
        // ============================================
        console.log('\n📌 STEP 1: Looking for referrer with code "UU001"...\n');

        const referrers = await db
            .select({
                id: users.id,
                email: users.email,
                partnerId: users.partnerId,
                referralCode: users.referralCode,
                firstName: users.firstName,
                lastName: users.lastName,
            })
            .from(users)
            .where(
                or(
                    eq(users.referralCode, 'UU001'),
                    eq(users.referralCode, 'uu001')
                )
            );

        if (referrers.length === 0) {
            console.log('❌ PROBLEM FOUND: No user has referral code "UU001"!');
            console.log('   This is why the referral link failed.');
            console.log('\n💡 SOLUTION: Check the actual referral code in the database.');
            console.log('\n🔍 Let me find all referral codes that start with "uu" or "UU":\n');

            const similarCodes = await db
                .select({
                    email: users.email,
                    referralCode: users.referralCode,
                })
                .from(users)
                .where(ilike(users.referralCode, 'uu%'));

            if (similarCodes.length > 0) {
                console.log('   Found these similar codes:');
                similarCodes.forEach(u => {
                    console.log(`   - ${u.referralCode} (${u.email})`);
                });
            } else {
                console.log('   No codes starting with "uu" found.');
            }

            process.exit(1);
        }

        const referrer = referrers[0];
        console.log('✅ Referrer found:');
        console.log(`   ID: ${referrer.id}`);
        console.log(`   Email: ${referrer.email}`);
        console.log(`   Name: ${referrer.firstName} ${referrer.lastName}`);
        console.log(`   Code: ${referrer.referralCode}`);

        // ============================================
        // STEP 2: Find User7
        // ============================================
        console.log('\n📌 STEP 2: Looking for User7...\n');

        const user7Results = await db
            .select({
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
                parentPartnerId: users.parentPartnerId,
                partnerId: users.partnerId,
                referralCode: users.referralCode,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(
                or(
                    ilike(users.firstName, '%User7%'),
                    ilike(users.lastName, '%User7%'),
                    ilike(users.email, '%user7%')
                )
            )
            .orderBy(sql`${users.createdAt} DESC`)
            .limit(5);

        if (user7Results.length === 0) {
            console.log('❌ PROBLEM: User7 not found in database!');
            console.log('   Either they never signed up, or they used a different name/email.\n');

            console.log('🔍 Let me show the 5 most recent signups:\n');
            const recentUsers = await db
                .select({
                    email: users.email,
                    firstName: users.firstName,
                    createdAt: users.createdAt,
                })
                .from(users)
                .orderBy(sql`${users.createdAt} DESC`)
                .limit(5);

            recentUsers.forEach((u, i) => {
                console.log(`   [${i + 1}] ${u.email} (${u.firstName}) - ${u.createdAt}`);
            });

            process.exit(1);
        }

        console.log(`✅ Found ${user7Results.length} user(s) matching "User7":\n`);

        user7Results.forEach((u, i) => {
            console.log(`   [${i + 1}] ${u.email}`);
            console.log(`       Name: ${u.firstName} ${u.lastName}`);
            console.log(`       ID: ${u.id}`);
            console.log(`       parent_partner_id: ${u.parentPartnerId || 'NULL ❌'}`);
            console.log(`       Created: ${u.createdAt}`);
            console.log('');
        });

        const user7 = user7Results[0];

        // ============================================
        // STEP 3: Check if User7 is linked to referrer
        // ============================================
        console.log('\n📌 STEP 3: Checking link between User7 and referrer...\n');

        if (!user7.parentPartnerId) {
            console.log('❌ PROBLEM FOUND: User7.parent_partner_id is NULL!');
            console.log('   User7 is NOT linked to any referrer.');
            console.log('\n🔍 POSSIBLE CAUSES:');
            console.log('   1. Referral code lookup failed during signup');
            console.log('   2. setupReferralHierarchy() threw an error');
            console.log('   3. Database constraint prevented update');
            console.log('\n💡 QUICK FIX (run in Neon SQL Editor):');
            console.log(`   UPDATE users SET parent_partner_id = '${referrer.id}' WHERE id = '${user7.id}';`);
            console.log('');
            process.exit(1);
        }

        if (user7.parentPartnerId === referrer.id) {
            console.log('✅ User7 IS linked to the referrer!');
            console.log(`   User7.parent_partner_id = ${user7.parentPartnerId}`);
            console.log(`   Referrer.id = ${referrer.id}`);
            console.log('   ✅ MATCH!');
        } else {
            console.log('⚠️  User7 is linked to a DIFFERENT referrer:');
            console.log(`   User7.parent_partner_id = ${user7.parentPartnerId}`);
            console.log(`   Expected referrer.id = ${referrer.id}`);
            console.log('   ❌ MISMATCH!');

            // Find who they're actually linked to
            const actualParent = await db
                .select({
                    email: users.email,
                    referralCode: users.referralCode,
                })
                .from(users)
                .where(eq(users.id, user7.parentPartnerId))
                .limit(1);

            if (actualParent.length > 0) {
                console.log(`\n   User7 is actually linked to: ${actualParent[0].email}`);
                console.log(`   Their referral code: ${actualParent[0].referralCode}`);
            }
            process.exit(1);
        }

        // ============================================
        // STEP 4: Check partner_hierarchy table
        // ============================================
        console.log('\n📌 STEP 4: Checking partner_hierarchy table...\n');

        const hierarchyEntries = await db
            .select()
            .from(partnerHierarchy)
            .where(eq(partnerHierarchy.childId, user7.id));

        if (hierarchyEntries.length === 0) {
            console.log('⚠️  WARNING: No entries in partner_hierarchy table for User7');
            console.log('   This is needed for commission tracking.');
            console.log('\n💡 FIX (run in Neon SQL Editor):');
            console.log(`   INSERT INTO partner_hierarchy (child_id, parent_id, level) VALUES ('${user7.id}', '${referrer.id}', 1);`);
            console.log('');
        } else {
            console.log(`✅ Found ${hierarchyEntries.length} hierarchy entries for User7:`);
            hierarchyEntries.forEach(entry => {
                console.log(`   Level ${entry.level}: parent_id = ${entry.parentId}`);
            });
        }

        // ============================================
        // STEP 5: Check dashboard query
        // ============================================
        console.log('\n📌 STEP 5: Simulating dashboard query...\n');
        console.log(`   Query: SELECT * FROM users WHERE parent_partner_id = '${referrer.id}'`);

        const dashboardResults = await db
            .select({
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.parentPartnerId, referrer.id))
            .orderBy(sql`${users.createdAt} DESC`);

        console.log(`\n   Found ${dashboardResults.length} team member(s):\n`);

        if (dashboardResults.length === 0) {
            console.log('   ❌ No team members found!');
            console.log('   This is what the dashboard sees.');
        } else {
            dashboardResults.forEach((member, i) => {
                const isUser7 = member.email === user7.email;
                console.log(`   [${i + 1}] ${member.email} ${isUser7 ? '← THIS IS USER7 ✅' : ''}`);
                console.log(`       Name: ${member.firstName} ${member.lastName}`);
                console.log(`       Joined: ${member.createdAt}`);
                console.log('');
            });
        }

        const user7InDashboard = dashboardResults.find(m => m.id === user7.id);

        if (user7InDashboard) {
            console.log('✅ SUCCESS: User7 SHOULD appear on the referrer\'s dashboard!');
            console.log('\n🔍 If they\'re not showing up in the UI, the issue is:');
            console.log('   1. Frontend caching (hard refresh: Ctrl+Shift+R)');
            console.log('   2. Server needs restart in Replit');
            console.log('   3. API response caching');
        } else {
            console.log('❌ PROBLEM: User7 will NOT appear on the dashboard!');
            console.log('   The database link is broken.');
        }

        // ============================================
        // SUMMARY
        // ============================================
        console.log('\n' + '='.repeat(60));
        console.log('📋 SUMMARY\n');
        console.log(`Referrer: ${referrer.email} (code: ${referrer.referralCode})`);
        console.log(`User7: ${user7.email}`);
        console.log(`Linked: ${user7.parentPartnerId === referrer.id ? '✅ YES' : '❌ NO'}`);
        console.log(`Hierarchy: ${hierarchyEntries.length > 0 ? '✅ YES' : '⚠️  NO'}`);
        console.log(`Dashboard: ${user7InDashboard ? '✅ WILL SHOW' : '❌ WON\'T SHOW'}`);
        console.log('='.repeat(60));

    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runDiagnostics();
