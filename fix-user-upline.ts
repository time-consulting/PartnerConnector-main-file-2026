/**
 * Fix script to properly link a user to their correct referrer
 * This corrects the parentPartnerId for users who were incorrectly linked
 * 
 * Run with: npx tsx fix-user-upline.ts
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { users, partnerHierarchy } from "./shared/schema";
import { eq, ilike } from "drizzle-orm";
import 'dotenv/config';

async function fixUpline() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
    }

    const sql = neon(databaseUrl);
    const db = drizzle(sql);

    console.log("=== FIX USER UPLINE ===\n");

    // 1. Find the user who needs to be fixed
    const userEmail = 'Darren.skeats@hotmail.com'; // The user with wrong upline
    const correctReferrerEmail = 'd.skeats@gmail.com'; // Their actual referrer (d.skeats@gmail.com is parent of darren.business123@hotmail.com who is parent of Darren.skeats@hotmail.com)
    // Based on the user's description:
    // - d.skeats@gmail.com's team shows darren.business123@hotmail.com as invited
    // - So the correct hierarchy should be: Darren.skeats@hotmail.com -> darren.business123@hotmail.com -> d.skeats@gmail.com

    const intermediateReferrerEmail = 'darren.business123@hotmail.com';

    console.log(`Looking for user: ${userEmail}`);
    console.log(`Expected referrer: ${intermediateReferrerEmail}`);
    console.log(`Expected grandparent: ${correctReferrerEmail}`);
    console.log();

    // Find the user
    const userResult = await db
        .select()
        .from(users)
        .where(ilike(users.email, userEmail));

    if (userResult.length === 0) {
        console.error(`❌ User not found: ${userEmail}`);
        process.exit(1);
    }
    const user = userResult[0];
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
    console.log(`   Current parent: ${user.parentPartnerId || 'NULL'}`);

    // Find the intermediate referrer
    const intermediateResult = await db
        .select()
        .from(users)
        .where(ilike(users.email, intermediateReferrerEmail));

    if (intermediateResult.length === 0) {
        console.error(`❌ Intermediate referrer not found: ${intermediateReferrerEmail}`);

        // Maybe it's directly under d.skeats@gmail.com
        console.log("\nTrying direct link to d.skeats@gmail.com...");
        const directResult = await db
            .select()
            .from(users)
            .where(ilike(users.email, correctReferrerEmail));

        if (directResult.length === 0) {
            console.error(`❌ Grandparent also not found: ${correctReferrerEmail}`);
            process.exit(1);
        }

        // Link directly to grandparent since intermediate doesn't exist
        const grandparent = directResult[0];
        console.log(`✅ Found grandparent: ${grandparent.firstName} ${grandparent.lastName} (ID: ${grandparent.id})`);

        // Update user's parent
        console.log("\n🔧 Updating user's parentPartnerId...");
        await db
            .update(users)
            .set({
                parentPartnerId: grandparent.id,
                updatedAt: new Date()
            })
            .where(eq(users.id, user.id));
        console.log(`   Set parentPartnerId to: ${grandparent.id}`);

        // Clear old hierarchy entries
        console.log("\n🔧 Clearing old partner_hierarchy entries...");
        await db
            .delete(partnerHierarchy)
            .where(eq(partnerHierarchy.childId, user.id));
        console.log("   Deleted old entries");

        // Create new hierarchy entry
        console.log("\n🔧 Creating new partner_hierarchy entry...");
        await db.insert(partnerHierarchy).values({
            childId: user.id,
            parentId: grandparent.id,
            level: 1,
        });
        console.log(`   Created Level 1 entry: ${user.id} -> ${grandparent.id}`);

        // Check if grandparent has a parent
        if (grandparent.parentPartnerId) {
            await db.insert(partnerHierarchy).values({
                childId: user.id,
                parentId: grandparent.parentPartnerId,
                level: 2,
            });
            console.log(`   Created Level 2 entry: ${user.id} -> ${grandparent.parentPartnerId}`);
        }

        console.log("\n✅ Fix complete!");
        process.exit(0);
    }

    const intermediate = intermediateResult[0];
    console.log(`✅ Found intermediate referrer: ${intermediate.firstName} ${intermediate.lastName} (ID: ${intermediate.id})`);
    console.log(`   Their parent: ${intermediate.parentPartnerId || 'NULL'}`);

    // Check grandparent exists
    const grandparentResult = await db
        .select()
        .from(users)
        .where(ilike(users.email, correctReferrerEmail));

    let grandparentId: string | null = null;
    if (grandparentResult.length > 0) {
        const grandparent = grandparentResult[0];
        grandparentId = grandparent.id;
        console.log(`✅ Found grandparent: ${grandparent.firstName} ${grandparent.lastName} (ID: ${grandparent.id})`);

        // Make sure intermediate is linked to grandparent
        if (intermediate.parentPartnerId !== grandparentId) {
            console.log(`\n⚠️ Intermediate's parent is ${intermediate.parentPartnerId}, should be ${grandparentId}`);
            console.log("🔧 Fixing intermediate's parent...");
            await db
                .update(users)
                .set({
                    parentPartnerId: grandparentId,
                    updatedAt: new Date()
                })
                .where(eq(users.id, intermediate.id));
        }
    }

    // 2. Update the user's parentPartnerId to the correct referrer
    console.log("\n🔧 Updating user's parentPartnerId...");
    await db
        .update(users)
        .set({
            parentPartnerId: intermediate.id,
            updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

    console.log(`   Set parentPartnerId to: ${intermediate.id}`);

    // 3. Clear old partner_hierarchy entries for this user
    console.log("\n🔧 Clearing old partner_hierarchy entries...");
    await db
        .delete(partnerHierarchy)
        .where(eq(partnerHierarchy.childId, user.id));
    console.log("   Deleted old entries");

    // 4. Create correct hierarchy entries
    console.log("\n🔧 Creating correct partner_hierarchy entries...");

    // Level 1: intermediate
    await db.insert(partnerHierarchy).values({
        childId: user.id,
        parentId: intermediate.id,
        level: 1,
    });
    console.log(`   Created Level 1 entry: ${user.id} -> ${intermediate.id}`);

    // Level 2: grandparent (if exists)
    if (grandparentId) {
        await db.insert(partnerHierarchy).values({
            childId: user.id,
            parentId: grandparentId,
            level: 2,
        });
        console.log(`   Created Level 2 entry: ${user.id} -> ${grandparentId}`);
    }

    console.log("\n✅ Fix complete!");

    // Verify
    console.log("\n📋 Verification:");
    const verifiedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));

    console.log(`   User: ${verifiedUser[0].email}`);
    console.log(`   Parent ID: ${verifiedUser[0].parentPartnerId}`);

    const hierarchy = await db
        .select()
        .from(partnerHierarchy)
        .where(eq(partnerHierarchy.childId, user.id));

    console.log(`   Hierarchy entries: ${hierarchy.length}`);
    for (const h of hierarchy) {
        const parent = await db.select().from(users).where(eq(users.id, h.parentId));
        console.log(`      Level ${h.level}: ${parent[0]?.email || h.parentId}`);
    }
}

fixUpline().catch(console.error);
