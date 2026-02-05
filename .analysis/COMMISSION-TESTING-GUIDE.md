# 🧪 Commission Distribution - Testing Guide

## ✅ **All Fixes Implemented**

The commission system has been updated to correctly distribute commissions:

### **Changes Made:**

1. ✅ **Fixed Hierarchy Percentages** (`storage.ts`)
   - Level 1: 60% → 20% (override)
   - Level 2: 20% → 10% (override)
   - Level 3: Removed (no longer exists)

2. ✅ **Added Multi-Level Distribution** (`storage.ts`)
   - New `distributeCommissions()` function
   - Automatically calculates 60% for deal creator
   - Searches `partner_hierarchy` for upline
   - Creates override commissions (20%, 10%)

3. ✅ **Updated Schema** (`schema.ts`)
   - Added `commissionType` field ("direct" or "override")
   - Added `level` field (0, 1, 2)

4. ✅ **Updated Admin Route** (`routes.ts`)
   - Now uses `distributeCommissions()`
   - Creates notifications for all recipients
   - Returns commission breakdown in response

5. ✅ **Database Migration** (`migrations/add_commission_type_level.sql`)
   - Adds new columns with defaults
   - Creates performance indexes

---

## 📊 **Commission Distribution Examples**

### **Example 1: User with Full 2-Level Upline**

```
User A (partnerId: "js001")
  └─ referred User B (partnerId: "jd001")
      └─ referred User C (partnerId: "mk001")
```

**When User C creates £1000 deal:**

```javascript
{
  "approvals": [
    {
      "userId": "user-c-id",
      "commissionAmount": 600.00,
      "commissionType": "direct",
      "level": 0,
      "message": "60% to deal creator"
    },
    {
      "userId": "user-b-id",
      "commissionAmount": 200.00,
      "commissionType": "override",
      "level": 1,
      "message": "20% to level 1 up (User B referred User C)"
    },
    {
      "userId": "user-a-id",
      "commissionAmount": 100.00,
      "commissionType": "override",
      "level": 2,
      "message": "10% to level 2 up (User A referred User B)"
    }
  ],
  "summary": {
    "total": 1000.00,
    "dealCreator": 600.00,
    "level1Override": 200.00,
    "level2Override": 100.00,
    "companyRevenue": 100.00  // 10% leftover
  }
}
```

**Server Logs:**
```
[COMMISSION] Created direct commission: £600 (60%) for user user-c-id
[COMMISSION] Created level 1 override: £200 (20%) for user user-b-id
[COMMISSION] Created level 2 override: £100 (10%) for user user-a-id
[COMMISSION] Deal deal-123 - Total: £1000, Paid: £900 (3 recipients), Company Revenue: £100
```

---

### **Example 2: User with 1-Level Upline**

```
User A (partnerId: "js001")
  └─ referred User B (partnerId: "jd001")
```

**When User B creates £1000 deal:**

```javascript
{
  "approvals": [
    {
      "userId": "user-b-id",
      "commissionAmount": 600.00,
      "commissionType": "direct",
      "level": 0
    },
    {
      "userId": "user-a-id",
      "commissionAmount": 200.00,
      "commissionType": "override",
      "level": 1
    }
  ],
  "summary": {
    "total": 1000.00,
    "dealCreator": 600.00,
    "level1Override": 200.00,
    "level2Override": 0,
    "companyRevenue": 200.00  // 20% leftover
  }
}
```

---

### **Example 3: User with No Upline (Root User)**

```
User A (partnerId: "js001", no referrer)
```

**When User A creates £1000 deal:**

```javascript
{
  "approvals": [
    {
      "userId": "user-a-id",
      "commissionAmount": 600.00,
      "commissionType": "direct",
      "level": 0
    }
  ],
  "summary": {
    "total": 1000.00,
    "dealCreator": 600.00,
    "level1Override": 0,
    "level2Override": 0,
    "companyRevenue": 400.00  // 40% leftover
  }
}
```

---

## 🧪 **Testing Steps**

### **Prerequisites:**

1. Database migration applied
2. Server restarted
3. At least 3 test users with hierarchy:
   ```sql
   -- User A (root)
   INSERT INTO users (id, email, partner_id, referral_code, parent_partner_id)
   VALUES ('user-a', 'usera@test.com', 'ua001', 'ua001', NULL);
   
   -- User B (referred by A)
   INSERT INTO users (id, email, partner_id, referral_code, parent_partner_id)
   VALUES ('user-b', 'userb@test.com', 'ub001', 'ub001', 'user-a');
   
   -- User C (referred by B)
   INSERT INTO users (id, email, partner_id, referral_code, parent_partner_id)
   VALUES ('user-c', 'userc@test.com', 'uc001', 'uc001', 'user-b');
   
   -- Create hierarchy
   INSERT INTO partner_hierarchy (child_id, parent_id, level)
   VALUES 
     ('user-b', 'user-a', 1),
     ('user-c', 'user-b', 1),
     ('user-c', 'user-a', 2);
   ```

### **Test 1: Create Commission for User with Full Hierarchy**

1. **Login as admin**
2. **Navigate to Admin → Deals**
3. **Create test deal for User C**
4. **Mark deal as completed**
5. **Create commission approval with £1000**

**Expected Result:**
- 3 commission approvals created
- User C: £600 (direct)
- User B: £200 (level 1 override)
- User A: £100 (level 2 override)
- 3 notifications sent
- Response shows commission breakdown

**Verify in Database:**
```sql
SELECT 
  ca.user_id,
  u.email,
  ca.commission_amount,
  ca.commission_type,
  ca.level
FROM commission_approvals ca
JOIN users u ON ca.user_id = u.id
WHERE ca.deal_id = 'test-deal-id'
ORDER BY ca.level;
```

**Expected Output:**
```
┌──────────┬────────────────┬───────────────────┬─────────────────┬───────┐
│ user_id  │ email          │ commission_amount │ commission_type │ level │
├──────────┼────────────────┼───────────────────┼─────────────────┼───────┤
│ user-c   │ userc@test.com │ 600.00            │ direct          │ 0     │
│ user-b   │ userb@test.com │ 200.00            │ override        │ 1     │
│ user-a   │ usera@test.com │ 100.00            │ override        │ 2     │
└──────────┴────────────────┴───────────────────┴─────────────────┴───────┘
```

### **Test 2: User Notifications**

1. **Login as User C**
2. **Check notifications**
   - Should see: "Commission Ready - Your commission of £600 (60%) for..."

3. **Login as User B**
4. **Check notifications**
   - Should see: "Level 1 Override Ready - Your level 1 override of £200 (20%) for..."

5. **Login as User A**
6. **Check notifications**
   - Should see: "Level 2 Override Ready - Your level 2 override of £100 (10%) for..."

### **Test 3: Commission Approvals Page**

1. **Login as User C**
2. **Navigate to Commissions**
3. **Should see:**
   - 1 pending approval
   - Amount: £600
   - Type: Direct Commission
   - For: [Business Name]

4. **Login as User B**
5. **Should see:**
   - 1 pending approval
   - Amount: £200
   - Type: Level 1 Override
   - For: [Business Name]

### **Test 4: API Response Format**

**Request:**
```bash
POST /api/admin/referrals/test-deal-id/create-commission-approval
{
  "actualCommission": 1000,
  "adminNotes": "Test commission",
  "ratesData": {}
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Created 3 commission approvals",
  "approvals": [
    {
      "id": "approval-1",
      "userId": "user-c",
      "commissionAmount": "600.00",
      "commissionType": "direct",
      "level": 0,
      "approvalStatus": "pending",
      "createdAt": "2026-02-05T..."
    },
    {
      "id": "approval-2",
      "userId": "user-b",
      "commissionAmount": "200.00",
      "commissionType": "override",
      "level": 1,
      "approvalStatus": "pending",
      "createdAt": "2026-02-05T..."
    },
    {
      "id": "approval-3",
      "userId": "user-a",
      "commissionAmount": "100.00",
      "commissionType": "override",
      "level": 2,
      "approvalStatus": "pending",
      "createdAt": "2026-02-05T..."
    }
  ],
  "summary": {
    "total": 1000,
    "dealCreator": 600,
    "level1Override": 200,
    "level2Override": 100,
    "companyRevenue": 100
  }
}
```

---

## 🔍 **Debugging Queries**

### **Check User Hierarchy:**
```sql
SELECT 
  u.email,
  u.partner_id,
  u.parent_partner_id,
  p.partner_id as referred_by_code
FROM users u
LEFT JOIN users p ON u.parent_partner_id = p.id
WHERE u.email IN ('usera@test.com', 'userb@test.com', 'userc@test.com');
```

### **Check Partner Hierarchy:**
```sql
SELECT 
  ph.level,
  child.email as child_user,
  parent.email as parent_user,
  ph.created_at
FROM partner_hierarchy ph
JOIN users child ON ph.child_id = child.id
JOIN users parent ON ph.parent_id = parent.id
WHERE child.email = 'userc@test.com'
ORDER BY ph.level;
```

### **Check Commission Distribution:**
```sql
SELECT 
  d.business_name,
  d.actual_commission as total_commission,
  ca.user_id,
  u.email,
  ca.commission_amount,
  ca.commission_type,
  ca.level,
  ROUND((ca.commission_amount / d.actual_commission * 100), 2) as percentage
FROM commission_approvals ca
JOIN deals d ON ca.deal_id = d.id
JOIN users u ON ca.user_id = u.id
WHERE d.id = 'test-deal-id'
ORDER BY ca.level;
```

### **Calculate Company Revenue:**
```sql
SELECT 
  d.id as deal_id,
  d.business_name,
  d.actual_commission as total_commission,
  SUM(ca.commission_amount) as total_paid,
  (d.actual_commission - SUM(ca.commission_amount)) as company_revenue,
  ROUND(((d.actual_commission - SUM(ca.commission_amount)) / d.actual_commission * 100), 2) as company_percentage
FROM deals d
JOIN commission_approvals ca ON ca.deal_id = d.id
WHERE d.id = 'test-deal-id'
GROUP BY d.id, d.business_name, d.actual_commission;
```

---

## ⚠️ **Common Issues & Solutions**

### **Issue 1: Only 1 Approval Created (Should be 3)**

**Cause:** User doesn't have hierarchy set up

**Check:**
```sql
SELECT * FROM partner_hierarchy WHERE child_id = 'user-c-id';
```

**Fix:** Run `setupReferralHierarchy()` for the user

---

### **Issue 2: Wrong Commission Amounts**

**Cause:** Old percentage values in existing hierarchy

**Check:**
```sql
SELECT * FROM partner_hierarchy WHERE child_id = 'user-c-id';
```

**Note:** The `distributeCommissions()` function calculates percentages directly (60%, 20%, 10%) and doesn't use the old `commissionPercentage` column. New signups will have correct percentages.

---

### **Issue 3: Commission Type is NULL**

**Cause:** Migration not applied

**Fix:**
```bash
cd partner-connector
npm run migrate  # or apply migration manually
```

---

## ✅ **Success Criteria**

Commission system is working correctly if:

- [ ] Deal creator receives 60% direct commission
- [ ] Level 1 up receives 20% override (if exists)
- [ ] Level 2 up receives 10% override (if exists)
- [ ] Total paid = 60% + 20% + 10% = 90% (or less if no upline)
- [ ] Company revenue = 100% - total paid
- [ ] All recipients receive notifications
- [ ] Database shows correct `commission_type` and `level`
- [ ] Server logs show commission breakdown

---

## 📝 **Next Steps**

1. **Apply Migration:**
   ```bash
   # Run the SQL migration
   psql -d partner_connector -f migrations/add_commission_type_level.sql
   ```

2. **Restart Server:**
   ```bash
   npm run dev
   ```

3. **Test with Real Scenario:**
   - Create 3 users with referral hierarchy
   - Submit deal as the bottom-level user
   - Admin creates commission
   - Verify all 3 users receive correct amounts

4. **Update Frontend (Optional):**
   - Update commission display to show "Direct" vs "Override"
   - Add level indicator (Level 1, Level 2)
   - Show percentage breakdown

---

**All code changes complete! The system now automatically:**
1. ✅ Calculates 60% for deal creator
2. ✅ Searches for upline referrers in `partner_hierarchy`
3. ✅ Distributes 20% to level 1 up (if exists)
4. ✅ Distributes 10% to level 2 up (if exists)
5. ✅ Retains leftover percentage as company revenue
