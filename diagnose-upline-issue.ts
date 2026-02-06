/**
 * Diagnostic script to investigate upline issues
 * This checks why the wrong upline is being displayed for a user
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { users, deals, partnerHierarchy } from "./shared/schema";
import { eq, or, ilike } from "drizzle-orm";
import 'dotenv/config';

async function diagnose() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });
    const db = drizzle(pool);

    console.log("=== UPLINE DIAGNOSIS ===\n");

    // Check the users mentioned
    const emailsToCheck = [
        'd.skeats@gmail.com',
        'darren.business123@hotmail.com',
        'Darren.skeats@hotmail.com',
        'laurenfuller11@hotmail.com'
    ];

    console.log("STEP 1: Checking all relevant users...\n");

    for (const email of emailsToCheck) {
        const result = await db
            .select()
            .from(users)
            .where(ilike(users.email, email));

        if (result.length === 0) {
            console.log(`❌ User NOT FOUND: ${email}\n`);
        } else {
            const user = result[0];
            console.log(`✅ User FOUND: ${email}`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
            console.log(`   Referral Code: ${user.referralCode}`);
            console.log(`   Parent Partner ID: ${user.parentPartnerId || 'NULL (no upline)'}`);

            // If they have a parent, look up that parent
            if (user.parentPartnerId) {
                const parentResult = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, user.parentPartnerId));

                if (parentResult.length > 0) {
                    const parent = parentResult[0];
                    console.log(`   Parent: ${parent.firstName} ${parent.lastName} (${parent.email})`);
                } else {
                    console.log(`   ⚠️ Parent ID set but user not found!`);
                }
            }
            console.log();
        }
    }

    console.log("\nSTEP 2: Checking deals submitted by Darren.skeats@hotmail.com...\n");

    // First find the user
    const darrenHotmail = await db
        .select()
        .from(users)
        .where(ilike(users.email, 'Darren.skeats@hotmail.com'));

    if (darrenHotmail.length > 0) {
        const user = darrenHotmail[0];
        console.log(`Found user: ${user.email} (ID: ${user.id})`);

        // Get their deals
        const userDeals = await db
            .select()
            .from(deals)
            .where(eq(deals.referrerId, user.id));

        console.log(`Found ${userDeals.length} deals for this user:\n`);

        for (const deal of userDeals) {
            console.log(`   Deal: ${deal.businessName}`);
            console.log(`   Stage: ${deal.dealStage}`);
            console.log(`   Referrer ID: ${deal.referrerId}`);
            console.log(`   Parent Referrer ID: ${deal.parentReferrerId || 'NULL'}`);
            console.log();
        }

        console.log("\nSTEP 3: Checking partner_hierarchy for this user...\n");

        const hierarchyEntries = await db
            .select()
            .from(partnerHierarchy)
            .where(eq(partnerHierarchy.childId, user.id));

        if (hierarchyEntries.length === 0) {
            console.log("❌ No entries in partner_hierarchy for this user");
            console.log("   This means upline lookups will fall back to parentPartnerId chain");
        } else {
            console.log(`Found ${hierarchyEntries.length} hierarchy entries:`);
            for (const entry of hierarchyEntries) {
                const parentUser = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, entry.parentId));
                const parentName = parentUser.length > 0
                    ? `${parentUser[0].firstName} ${parentUser[0].lastName} (${parentUser[0].email})`
                    : 'UNKNOWN';
                console.log(`   Level ${entry.level}: ${parentName}`);
            }
        }

        console.log("\n\nSTEP 4: Simulating getMlmHierarchy for this user...\n");

        // Simulate the getMlmHierarchy function
        let currentUserId = user.id;
        let level = 1;
        const parents: any[] = [];

        while (parents.length < 3) {
            const currentUser = await db
                .select()
                .from(users)
                .where(eq(users.id, currentUserId));

            if (currentUser.length === 0 || !currentUser[0].parentPartnerId) {
                console.log(`   Stopped at level ${level}: no more parents`);
                break;
            }

            const parentResult = await db
                .select()
                .from(users)
                .where(eq(users.id, currentUser[0].parentPartnerId));

            if (parentResult.length === 0) {
                console.log(`   Stopped at level ${level}: parent ID exists but user not found`);
                break;
            }

            const parent = parentResult[0];
            parents.push(parent);
            console.log(`   Level ${level}: ${parent.firstName} ${parent.lastName} (${parent.email})`);
            currentUserId = parent.id;
            level++;
        }

        if (parents.length === 0) {
            console.log("   ❌ No upline parents found - this user has no parentPartnerId set");
        }
    } else {
        console.log("❌ Could not find user Darren.skeats@hotmail.com");
    }

    console.log("\n\nSTEP 5: Checking who 'laurenfuller' and 'user7' are...\n");

    const testUsers = await db
        .select()
        .from(users)
        .where(
            or(
                ilike(users.firstName, '%lauren%'),
                ilike(users.firstName, '%user7%'),
                ilike(users.lastName, '%fuller%'),
                ilike(users.email, '%user7%')
            )
        );

    for (const u of testUsers) {
        console.log(`Found: ${u.firstName} ${u.lastName} (${u.email})`);
        console.log(`   ID: ${u.id}`);
        console.log(`   Parent ID: ${u.parentPartnerId || 'NULL'}`);

        // Check how many users have this as their parent
        const children = await db
            .select()
            .from(users)
            .where(eq(users.parentPartnerId, u.id));

        console.log(`   Number of children: ${children.length}`);
        console.log();
    }

    console.log("\n=== DIAGNOSIS COMPLETE ===\n");
    await pool.end();
}

diagnose().catch(console.error);
