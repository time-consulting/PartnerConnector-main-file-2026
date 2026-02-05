# 🔍 REFERRAL SYSTEM DEBUG - "UU001" Test Case

## ❌ **ISSUE: User7 Not Showing on Referrer's Dashboard**

**Test Case:**
- Referral Link: `/signup?ref=uu001`
- New User: "User7" 
- Problem: Not appearing in referrer's team dashboard

---

## ✅ **COMPLETE FLOW TRACE**

### **1. FRONTEND - SIGNUP COMPONENT** ✅ WORKING

**File:** `client/src/pages/signup.tsx`

**Step 1: Capture URL Parameter (Line 88)**
```typescript
const refCode = params.get('ref');  // Gets "uu001" from URL
```

**Step 2: Store in State (Line 106)**
```typescript
if (refCode) {
  setFormData(prev => ({ 
    ...prev, 
    referralCode: refCode.toUpperCase()  // Converts to "UU001"
  }));
}
```

**Step 3: Display Banner (Lines 256-261)**
```tsx
{formData.referralCode && (
  <div className="p-4 rounded-xl">
    <p>Joining with referral code</p>
    <p className="text-xl">{formData.referralCode}</p>  {/* Shows "UU001" */}
  </div>
)}
```

**Step 4: Send to API (Line 206-210)**
```typescript
const payload = {
  email: formData.email,
  password: formData.password,
  firstName: formData.firstName,
  lastName: formData.lastName,
  referralCode: formData.referralCode || undefined,  // "UU001"
  // ... other fields
};

const response = await apiRequest('POST', '/api/auth/register', payload);
```

**✅ FRONTEND VERDICT:** Working correctly - captures "uu001", converts to "UU001", sends to API

---

### **2. API ENDPOINT - USER CREATION** ✅ WORKING

**File:** `server/routes.ts` (lines 254-305)

**POST /api/auth/register**

**Step 1: Receive Data (Line 264-265)**
```typescript
const data = schema.parse(req.body);
const { email, password, firstName, lastName, referralCode } = data;
// referralCode = "UU001"
```

**Step 2: Call User Creation (Line 270-275)**
```typescript
const user = await storage.createUserWithCredentials(
  email,
  password,
  { firstName, lastName },
  referralCode || req.session.referralCode  // Passes "UU001"
);
```

**✅ API VERDICT:** Working correctly - receives "UU001", passes to storage function

---

### **3. USER CREATION LOGIC** ⚠️ POTENTIAL ISSUE

**File:** `server/storage.ts` (lines 354-425)

**Function:** `createUserWithCredentials()`

**Step 1: Create User Record (Line 384-390)**
```typescript
const [user] = await db.insert(users).values({
  email,
  passwordHash,
  emailVerified: false,
  verificationToken,
  ...userData,
}).returning();
```

**❗ IMPORTANT:** At this point, user is created but `parent_partner_id` is **NULL**

**Step 2: Setup Referral Hierarchy (Lines 394-408)**
```typescript
if (referralCode) {
  console.log('[AUTH] Setting up referral hierarchy for:', user.email);
  try {
    const referrer = await this.getUserByReferralCode(referralCode);  // Looks up "UU001"
    if (referrer && referrer.id !== user.id) {
      referrerPartnerId = referrer.partnerId;
      await this.setupReferralHierarchy(user.id, referrer.id);  // ← CRITICAL
      console.log('[AUTH] Referral hierarchy created successfully');
    }
  } catch (error) {
    console.error('[AUTH] Error setting up referral hierarchy:', error);
  }
}
```

**⚠️ CRITICAL QUESTIONS:**
1. Does user with code "UU001" exist in database?
2. Did `getUserByReferralCode("UU001")` find the referrer?
3. Did `setupReferralHierarchy()` execute?
4. Did it set `parent_partner_id` on User7?

---

### **4. REFERRAL LOOKUP LOGIC** 🔍 CHECK THIS

**File:** `server/storage.ts` (lines 527-530)

**Function:** `getUserByReferralCode()`

```typescript
async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.referralCode, referralCode));  // WHERE referral_code = 'UU001'
  return user;
}
```

**SQL Query:**
```sql
SELECT * FROM users WHERE referral_code = 'UU001';
```

**⚠️ CHECK #1: Does this user exist?**

---

### **5. HIERARCHY SETUP LOGIC** 🔍 CHECK THIS

**File:** `server/storage.ts` (lines 532-610)

**Function:** `setupReferralHierarchy(newUserId, referrerUserId)`

**Critical Lines (599-607):**
```typescript
await db
  .update(users)
  .set({
    parentPartnerId: referrerUserId,  // ← THIS IS THE KEY FIELD!
    referralCode: referralCodeToSet,
    partnerLevel,
    updatedAt: new Date(),
  })
  .where(eq(users.id, newUserId));
```

**SQL Query:**
```sql
UPDATE users SET
  parent_partner_id = '{referrer-user-id}',
  referral_code = 'u7001',
  partner_level = 2,
  updated_at = NOW()
WHERE id = '{user7-id}';
```

**⚠️ CHECK #2: Was this UPDATE executed for User7?**

---

### **6. DASHBOARD QUERY** ⚠️ THIS IS WHERE IT FAILS

**Frontend:** `client/src/pages/team-management.tsx` (line 127)
```typescript
const { data: teamReferrals } = useQuery({
  queryKey: ['/api/team/referrals'],
  enabled: isAuthenticated,
});
```

**API Endpoint:** `server/routes.ts` (line 2169-2178)
```typescript
app.get('/api/team/referrals', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const referrals = await storage.getTeamReferrals(userId);
  res.json(referrals);
});
```

**Storage Function:** `server/storage.ts` (lines 2256-2300)

**THE CRITICAL QUERY (Line 2280):**
```typescript
const teamReferrals = await db
  .select({
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    createdAt: users.createdAt,
    partnerId: users.partnerId,
    referralCode: users.referralCode,
    referralCount: sql<number>`COUNT(${deals.id})`,
    hasChildren: sql<number>`(SELECT COUNT(*) FROM ${users} children WHERE children.parent_partner_id = ${users.id})`
  })
  .from(users)
  .leftJoin(deals, eq(deals.referrerId, users.id))
  .where(eq(users.parentPartnerId, userId))  // ← THIS IS THE FILTER!
  .groupBy(users.id, users.firstName, users.lastName, users.email, users.createdAt, users.partnerId, users.referralCode);
```

**SQL Query:**
```sql
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.created_at,
  u.partner_id,
  u.referral_code,
  COUNT(d.id) as referral_count,
  (SELECT COUNT(*) FROM users children WHERE children.parent_partner_id = u.id) as has_children
FROM users u
LEFT JOIN deals d ON d.referrer_id = u.id
WHERE u.parent_partner_id = '{current-user-id}'  ← THIS MUST MATCH!
GROUP BY u.id, u.first_name, u.last_name, u.email, u.created_at, u.partner_id, u.referral_code;
```

**🎯 THE PROBLEM:**

For User7 to show up on the referrer's dashboard:
```
User7.parent_partner_id MUST = Referrer.id
```

If User7's `parent_partner_id` is NULL or doesn't match, they WON'T appear!

---

## 🔍 **DIAGNOSTIC CHECKLIST**

Run these queries to debug:

### **Check #1: Does referrer with code "UU001" exist?**
```sql
SELECT 
  id,
  email,
  partner_id,
  referral_code
FROM users
WHERE referral_code = 'UU001';
```

**Expected Result:**
```
id: abc-123-uuid
email: referrer@example.com
partner_id: uu001
referral_code: UU001
```

**❌ If returns 0 rows:** The referral code doesn't exist! User would need to sign up WITHOUT a referrer.

---

### **Check #2: Does User7 exist?**
```sql
SELECT 
  id,
  email,
  first_name,
  last_name,
  parent_partner_id,
  created_at
FROM users
WHERE email = 'user7@example.com'
OR first_name = 'User7';
```

**Expected Result:**
```
id: user7-uuid
email: user7@example.com
first_name: User7
parent_partner_id: abc-123-uuid  ← MUST MATCH REFERRER'S ID!
created_at: 2026-02-05 ...
```

**❌ If `parent_partner_id` is NULL:** The link failed!

---

### **Check #3: Is User7 linked to the referrer?**
```sql
SELECT 
  child.email as user7_email,
  child.parent_partner_id,
  parent.email as referrer_email,
  parent.referral_code as referrer_code
FROM users child
LEFT JOIN users parent ON child.parent_partner_id = parent.id
WHERE child.email = 'user7@example.com';
```

**Expected Result:**
```
user7_email: user7@example.com
parent_partner_id: abc-123-uuid
referrer_email: referrer@example.com
referrer_code: UU001
```

**❌ If `parent_partner_id` is NULL or `referrer_email` is NULL:** The hierarchy wasn't set up!

---

### **Check #4: Check partner_hierarchy table**
```sql
SELECT * FROM partner_hierarchy
WHERE child_id = (SELECT id FROM users WHERE email = 'user7@example.com');
```

**Expected Result:**
```
child_id: user7-uuid
parent_id: abc-123-uuid
level: 1
```

**❌ If returns 0 rows:** Hierarchy table wasn't populated!

---

### **Check #5: Check server logs**

Look for these log entries when User7 signed up:

```
✅ SUCCESS LOGS:
[AUTH] Registration attempt: user7@example.com
[AUTH] New user created: user7-uuid user7@example.com
[AUTH] Setting up referral hierarchy for: user7@example.com
[REFERRAL] Referrer found: referrer@example.com (abc-123-uuid)
Referral hierarchy set up for user user7-uuid with referrer abc-123-uuid
[PARTNER_ID] Generated u7001 for user user7-uuid (User7)
[AUTH] Referral hierarchy created successfully
[AUTH] Registration successful: user7-uuid user7@example.com

❌ FAILURE LOGS:
[AUTH] Error setting up referral hierarchy: User not found
[AUTH] Error setting up referral hierarchy: [other error]
```

---

## 🎯 **ROOT CAUSE ANALYSIS**

The issue is likely **ONE** of these:

### **Scenario A: Referral Code Doesn't Exist**
- Someone gave User7 link: `/signup?ref=uu001`
- But no user has `referral_code = 'UU001'` in database
- `getUserByReferralCode()` returns `undefined`
- `setupReferralHierarchy()` never runs
- `parent_partner_id` stays NULL
- **Fix:** Find the correct referral code or create user with code "UU001"

### **Scenario B: Case Sensitivity Mismatch**
- Database has `referral_code = 'uu001'` (lowercase)
- Frontend sends `referralCode = 'UU001'` (uppercase from line 106)
- Query fails to find match
- **Fix:** Make query case-insensitive OR ensure consistent casing

###**Scenario C: setupReferralHierarchy() Failed**
- Referrer found successfully
- But `setupReferralHierarchy()` threw error
- Error caught in try/catch (line 405-407)
- Logs would show: `[AUTH] Error setting up referral hierarchy: ...`
- **Fix:** Check server logs for errors

### **Scenario D: parentPartnerId Not Set**
- Everything ran successfully
- But somehow `parent_partner_id` wasn't set in database
- Could be database constraint issue or trigger
- **Fix:** Check database constraints and triggers

---

## 🛠️ **IMMEDIATE FIXES**

### **Quick Fix #1: Manual Database Update**

If User7 exists but isn't linked:

```sql
-- Find User7's ID
SELECT id FROM user WHERE email = 'user7@example.com';
-- Result: user7-uuid

-- Find referrer's ID
SELECT id FROM users WHERE referral_code = 'UU001';
-- Result: referrer-uuid

-- Manually link them
UPDATE users
SET parent_partner_id = 'referrer-uuid'
WHERE id = 'user7-uuid';

-- Verify
SELECT 
  u.email,
  u.parent_partner_id,
  p.email as referrer_email
FROM users u
LEFT JOIN users p ON u.parent_partner_id = p.id
WHERE u.email = 'user7@example.com';
```

### **Quick Fix #2: Add Case-Insensitive Search**

Update `getUserByReferralCode()`:

```typescript
async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`UPPER(${users.referralCode}) = UPPER(${referralCode})`);  // Case-insensitive
  return user;
}
```

### **Quick Fix #3: Add Better Error Logging**

Update `create UserWithCredentials()` (line 396-408):

```typescript
if (referralCode) {
  console.log('[AUTH] Looking for referral code:', referralCode);
  const referrer = await this.getUserByReferralCode(referralCode);
  
  if (!referrer) {
    console.error('[AUTH] Referral code not found:', referralCode);
    // Continue without referrer
  } else {
    console.log('[AUTH] Referrer found:', referrer.email, referrer.id);
    
    if (referrer.id === user.id) {
      console.error('[AUTH] Self-referral detected, skipping');
    } else {
      try {
        await this.setupReferralHierarchy(user.id, referrer.id);
        console.log('[AUTH] ✅ Hierarchy set up successfully');
      } catch (error) {
        console.error('[AUTH] ❌ Failed to setup hierarchy:', error);
      }
    }
  }
}
```

---

## 📋 **ACTION PLAN**

**Step 1:** Run diagnostic queries above  
**Step 2:** Check server logs from when User7 signed up  
**Step 3:** Identify which scenario (A, B, C, or D) applies  
**Step 4:** Apply appropriate fix  
**Step 5:** Test with new signup to verify  

---

## ✅ **SYSTEM IS CORRECT - NEED TO CHECK DATA**

The code flow is **working correctly**. The issue is likely:
1. Referral code "UU001" doesn't exist in database
2. Case sensitivity mismatch
3. Database constraint preventing update
4. Error during hierarchy setup

**Next step:** Run the diagnostic queries to find the exact issue!
