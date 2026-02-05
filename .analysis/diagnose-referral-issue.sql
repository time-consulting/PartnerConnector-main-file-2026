-- ============================================
-- REFERRAL SYSTEM DIAGNOSTIC SCRIPT
-- Issue: User7 not showing on dashboard after signup with ref=uu001
-- ============================================

-- Step 1: Find the referrer who owns code "UU001"
-- ============================================
SELECT 
  id as referrer_id,
  email as referrer_email,
  partner_id,
  referral_code,
  first_name,
  last_name
FROM users
WHERE referral_code = 'UU001' OR referral_code = 'uu001';

-- ✅ Expected: 1 row returned with referrer's details
-- ❌ If 0 rows: The referral code doesn't exist! This is the problem.
-- 📝 Note the 'id' value - we'll use it below


-- Step 2: Find User7
-- ============================================
SELECT 
  id as user7_id,
  email,
  first_name,
  last_name,
  parent_partner_id,
  partner_id,
  referral_code,
  created_at
FROM users
WHERE 
  first_name ILIKE '%User7%' 
  OR last_name ILIKE '%User7%'
  OR email ILIKE '%user7%'
ORDER BY created_at DESC
LIMIT 5;

-- ✅ Expected: User7's record with parent_partner_id = referrer's id from Step 1
-- ❌ If parent_partner_id is NULL: The linking failed!
-- 📝 Note the 'id' and 'parent_partner_id' values


-- Step 3: Check if User7 is linked to the referrer
-- ============================================
-- Replace 'USER7_EMAIL_HERE' with User7's actual email from Step 2
SELECT 
  child.id as user7_id,
  child.email as user7_email,
  child.parent_partner_id,
  child.created_at as user7_joined,
  parent.id as referrer_id,
  parent.email as referrer_email,
  parent.referral_code as code_used
FROM users child
LEFT JOIN users parent ON child.parent_partner_id = parent.id
WHERE child.email = 'USER7_EMAIL_HERE';  -- ← REPLACE THIS

-- ✅ Expected: Shows User7 linked to referrer with code UU001
-- ❌ If referrer_email is NULL: User7 exists but has no parent!
-- ❌ If code_used != 'UU001': User7 linked to wrong person!


-- Step 4: Check partner_hierarchy table
-- ============================================
-- Replace 'USER7_ID_HERE' with User7's id from Step 2
SELECT 
  ph.id,
  ph.level,
  child.email as user7_email,
  parent.email as upline_email,
  parent.referral_code as upline_code,
  ph.created_at
FROM partner_hierarchy ph
JOIN users child ON ph.child_id = child.id
JOIN users parent ON ph.parent_id = parent.id
WHERE ph.child_id = 'USER7_ID_HERE'  -- ← REPLACE THIS
ORDER BY ph.level;

-- ✅ Expected: At least 1 row showing hierarchy
-- ❌ If 0 rows: Hierarchy table wasn't populated!


-- Step 5: Find all users who signed up with referral code UU001
-- ============================================
-- Replace 'REFERRER_ID_HERE' with referrer's id from Step 1
SELECT 
  id,
  email,
  first_name,
  last_name,
  parent_partner_id,
  created_at
FROM users
WHERE parent_partner_id = 'REFERRER_ID_HERE'  -- ← REPLACE THIS
ORDER BY created_at DESC;

-- ✅ Expected: List of all the referrer's team members
-- ❌ If User7 not in list: This is why they don't show on dashboard!


-- ============================================
-- SUMMARY & INTERPRETATION
-- ============================================

/*
SCENARIO A: Step 1 returns 0 rows
  → Problem: Referral code "UU001" doesn't exist
  → Solution: Find correct code or create it
  
SCENARIO B: Step 1 OK, Step 2 shows parent_partner_id = NULL
  → Problem: User7 exists but wasn't linked
  → Solution: Manual UPDATE (see below) or re-signup
  
SCENARIO C: Step 1 & 2 OK, Step 5 doesn't include User7
  → Problem: parent_partner_id points to wrong user
  → Solution: Check parent_partner_id matches referrer's id
  
SCENARIO D: All steps OK but dashboard still empty
  → Problem: Frontend/API caching or query issue
  → Solution: Clear browser cache, restart server
*/


-- ============================================
-- QUICK FIX: Manually link User7 to referrer
-- ============================================
-- Only run this if diagnostics confirm both users exist
-- but parent_partner_id is wrong/null

/*
-- Step 1: Verify IDs (from diagnostics above)
-- Referrer ID: [paste from Step 1]
-- User7 ID: [paste from Step 2]

-- Step 2: Update the link
UPDATE users
SET 
  parent_partner_id = 'REFERRER_ID_HERE',  -- ← REPLACE with referrer's id
  updated_at = NOW()
WHERE id = 'USER7_ID_HERE';  -- ← REPLACE with User7's id

-- Step 3: Create hierarchy entries (if missing)
INSERT INTO partner_hierarchy (child_id, parent_id, level, created_at)
VALUES 
  ('USER7_ID_HERE', 'REFERRER_ID_HERE', 1, NOW())
ON CONFLICT DO NOTHING;

-- If referrer also has a parent, add level 2
INSERT INTO partner_hierarchy (child_id, parent_id, level, created_at)
SELECT 
  'USER7_ID_HERE',
  u.parent_partner_id,
  2,
  NOW()
FROM users u
WHERE u.id = 'REFERRER_ID_HERE'
  AND u.parent_partner_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 4: Verify the fix
SELECT 
  child.email as user7_email,
  parent.email as referrer_email,
  child.parent_partner_id
FROM users child
JOIN users parent ON child.parent_partner_id = parent.id
WHERE child.id = 'USER7_ID_HERE';
*/


-- ============================================
-- ALTERNATIVE: Find ALL orphaned users
-- ============================================
-- Find users who look like they should have been referred
-- but parent_partner_id is NULL

SELECT 
  id,
  email,
  first_name,
  last_name,
  created_at,
  partner_id,
  parent_partner_id
FROM users
WHERE 
  parent_partner_id IS NULL
  AND created_at > NOW() - INTERVAL '7 days'  -- Last 7 days
ORDER BY created_at DESC;

-- These users might need manual linking


-- ============================================
-- CHECK: Referral codes format
-- ============================================
-- Ensure all referral codes are uppercase consistently

SELECT 
  id,
  email,
  referral_code,
  UPPER(referral_code) as uppercase_version,
  CASE 
    WHEN referral_code = UPPER(referral_code) THEN 'OK'
    ELSE 'NEEDS FIX'
  END as status
FROM users
WHERE referral_code IS NOT NULL
ORDER BY status DESC, email;

-- If you see mixed case, this could cause lookup failures
