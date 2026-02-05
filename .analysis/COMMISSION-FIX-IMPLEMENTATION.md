# 🎯 COMMISSION STRUCTURE - COMPLETE FIX GUIDE

## ✅ **CONFIRMED: Your Understanding is CORRECT**

After reviewing the code, I can confirm:

**Your Intended Structure:**
```
Deal Creator:            60% ← Direct commission
├─ Level 1 up (referrer): 20% ← Override commission
└─ Level 2 up:           10% ← Override commission
                        ----
TOTAL PAID OUT:          90%

PartnerConnector:        10% ← Company revenue (leftover)
```

---

## 🚨 **CURRENT CODE ISSUES**

### **Issue #1: Wrong Hierarchy Percentages**

**File:** `server/storage.ts` lines 547-569

**Current (WRONG):**
```typescript
referralChain.push({
  userId: referrerUserId,
  level: 1,
  commissionPercentage: 60.00  // ❌ Should be 20%
});

if (referrer.parentPartnerId) {
  referralChain.push({
    userId: level2User.id,
    level: 2,
    commissionPercentage: 20.00  // ❌ Should be 10%
  });

  if (level2User.parentPartnerId) {
    referralChain.push({
      userId: level3User.id,
      level: 3,
      commissionPercentage: 10.00  // ❌ Should not exist
    });
  }
}
```

### **Issue #2: No Multi-Level Commission Distribution**

**Current Behavior:**
- Only creates ONE commission approval for deal creator
- Does NOT create override commissions for upline
- `partner_hierarchy` table is NOT being used for commissions

**Evidence:**
```typescript
// routes.ts line 2692 - Only creates approval for deal creator
const approval = await storage.createCommissionApproval({
  dealId: dealId,
  userId: deal.referrerId,  // ← Only the deal creator
  commissionAmount: actualCommission,  // ← Full amount
  // ... no upline distribution
});
```

---

## 🔧 **COMPLETE FIX IMPLEMENTATION**

### **Fix #1: Update Hierarchy Percentages**

**File:** `server/storage.ts`  
**Function:** `setupReferralHierarchy()` (lines 545-573)

**Replace with:**
```typescript
const referralChain: { userId: string; level: number; commissionPercentage: number }[] = [];

// Level 1: Direct referrer gets 20% override
referralChain.push({
  userId: referrerUserId,
  level: 1,
  commissionPercentage: 20.00  // ✅ FIXED: Override commission
});

// Level 2: Referrer's referrer gets 10% override
if (referrer.parentPartnerId) {
  const level2User = await this.getUser(referrer.parentPartnerId);
  if (level2User) {
    referralChain.push({
      userId: level2User.id,
      level: 2,
      commissionPercentage: 10.00  // ✅ FIXED: Override commission
    });
    
    // ✅ REMOVED: No level 3 - only 2 levels of overrides
  }
}
```

### **Fix #2: Implement Multi-Level Commission Distribution**

**Add new function to `server/storage.ts`:**

```typescript
/**
 * Distribute commissions for a deal across the referral hierarchy
 * 
 * @param dealId - The deal ID
 * @param totalCommission - Total commission amount from the deal
 * @param dealCreatorId - User who created the deal
 * @returns Array of created commission approvals
 */
async distributeCommissions(
  dealId: string,
  totalCommission: number,
  dealCreatorId: string
): Promise<CommissionApproval[]> {
  const approvals: CommissionApproval[] = [];
  
  // 1. Create commission for deal creator (60%)
  const creatorCommission = totalCommission * 0.60;
  const creatorApproval = await this.createCommissionApproval({
    dealId,
    userId: dealCreatorId,
    commissionAmount: creatorCommission,
    commissionType: 'direct',  // Direct commission
    level: 0,  // Deal creator = level 0
  });
  approvals.push(creatorApproval);
  
  // 2. Get upline from partner_hierarchy
  const uplineEntries = await db
    .select()
    .from(partnerHierarchy)
    .where(eq(partnerHierarchy.childId, dealCreatorId))
    .orderBy(partnerHierarchy.level);
  
  // 3. Create override commissions for upline
  for (const entry of uplineEntries) {
    let overridePercentage = 0;
    
    if (entry.level === 1) {
      overridePercentage = 0.20;  // 20% for level 1 up
    } else if (entry.level === 2) {
      overridePercentage = 0.10;  // 10% for level 2 up
    }
    // Level 3+ gets 0%
    
    if (overridePercentage > 0) {
      const overrideCommission = totalCommission * overridePercentage;
      const overrideApproval = await this.createCommissionApproval({
        dealId,
        userId: entry.parentId,
        commissionAmount: overrideCommission,
        commissionType: 'override',  // Override commission
        level: entry.level,
      });
      approvals.push(overrideApproval);
    }
  }
  
  // 4. Calculate company revenue (leftover)
  const totalPaid = approvals.reduce((sum, a) => sum + Number(a.commissionAmount), 0);
  const companyRevenue = totalCommission - totalPaid;
  
  console.log(`[COMMISSION] Deal ${dealId} - Total: £${totalCommission}, Paid: £${totalPaid}, Company: £${companyRevenue}`);
  
  return approvals;
}
```

### **Fix #3: Update Commission Approval Schema**

**File:** `shared/schema.ts`

**Add fields to `commissionApprovals` table:**
```typescript
export const commissionApprovals = pgTable("commission_approvals", {
  // ... existing fields
  commissionType: varchar("commission_type"),  // "direct" or "override"
  level: integer("level").default(0),  // 0 = direct, 1-3 = override levels
});
```

### **Fix #4: Update Admin Commission Creation Route**

**File:** `server/routes.ts` (lines 2672-2719)

**Replace with:**
```typescript
app.post('/api/admin/referrals/:dealId/create-commission-approval', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { dealId } = req.params;
    const { actualCommission, adminNotes, ratesData } = req.body;

    // Update deal with actual commission
    await storage.updateDeal(dealId, {
      actualCommission: actualCommission,
      adminNotes: adminNotes || null
    });

    // Get deal details
    const allDeals = await storage.getAllDeals();
    const deal = allDeals.find((r) => r.id === dealId);

    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }

    // ✅ NEW: Distribute commissions across hierarchy
    const approvals = await storage.distributeCommissions(
      dealId,
      actualCommission,
      deal.referrerId
    );

    // Create notifications for all recipients
    for (const approval of approvals) {
      const commissionTypeLabel = approval.commissionType === 'direct' 
        ? 'Commission' 
        : `Level ${approval.level} Override`;
        
      await createNotificationForUser(approval.userId, {
        type: 'commission_approval',
        title: `${commissionTypeLabel} Ready`,
        message: `Your ${commissionTypeLabel.toLowerCase()} of £${approval.commissionAmount} for ${deal.businessName} is ready`,
        dealId: dealId,
        businessName: deal.businessName
      });
    }

    res.json({
      success: true,
      message: `Created ${approvals.length} commission approvals`,
      approvals: approvals
    });
  } catch (error) {
    console.error("Error creating commission approvals:", error);
    res.status(500).json({ message: "Failed to create commission approvals" });
  }
});
```

---

## 📊 **EXAMPLE SCENARIOS**

### **Scenario 1: User with 2-Level Upline**

```
User A (Root)
  └─ referred User B
      └─ referred User C
```

**When User C creates £1000 deal:**

| Recipient | Relationship | Commission | Type |
|-----------|-------------|-----------|------|
| User C | Deal Creator | £600 (60%) | Direct |
| User B | 1 level up | £200 (20%) | Override |
| User A | 2 levels up | £100 (10%) | Override |
| **PartnerConnector** | Company | **£100 (10%)** | **Revenue** |
| **TOTAL** | | **£1000** | |

### **Scenario 2: User with 1-Level Upline**

```
User A (Root)
  └─ referred User B
```

**When User B creates £1000 deal:**

| Recipient | Relationship | Commission | Type |
|-----------|-------------|-----------|------|
| User B | Deal Creator | £600 (60%) | Direct |
| User A | 1 level up | £200 (20%) | Override |
| **PartnerConnector** | Company | **£200 (20%)** | **Revenue** |
| **TOTAL** | | **£1000** | |

### **Scenario 3: User with No Upline**

```
User A (Root, no referrer)
```

**When User A creates £1000 deal:**

| Recipient | Relationship | Commission | Type |
|-----------|-------------|-----------|------|
| User A | Deal Creator | £600 (60%) | Direct |
| **PartnerConnector** | Company | **£400 (40%)** | **Revenue** |
| **TOTAL** | | **£1000** | |

---

## ✅ **TESTING CHECKLIST**

After implementing the fixes:

- [ ] **Test 1:** User with no referrer creates deal
  - Should get 60% commission
  - Company keeps 40%

- [ ] **Test 2:** User with 1-level upline creates deal
  - Deal creator: 60%
  - Level 1 up: 20%
  - Company keeps 20%

- [ ] **Test 3:** User with 2-level upline creates deal
  - Deal creator: 60%
  - Level 1 up: 20%
  - Level 2 up: 10%
  - Company keeps 10%

- [ ] **Test 4:** Check database
  ```sql
  SELECT * FROM commission_approvals WHERE deal_id = 'test-deal-id';
  -- Should see multiple rows (one per recipient)
  ```

- [ ] **Test 5:** Verify percentages in `partner_hierarchy`
  ```sql
  SELECT child_id, parent_id, level, commission_percentage
  FROM partner_hierarchy
  WHERE child_id = 'test-user-id';
  -- Should show: level 1 = 20%, level 2 = 10%
  ```

---

## 🎯 **SUMMARY OF CHANGES**

1. ✅ **Update `setupReferralHierarchy()`** 
   - Level 1: 60% → 20%
   - Level 2: 20% → 10%
   - Level 3: Remove

2. ✅ **Add `distributeCommissions()` function**
   - Creates direct commission for deal creator (60%)
   - Creates override commissions for upline (20%, 10%)
   - Logs company revenue

3. ✅ **Update commission approval schema**
   - Add `commissionType` field
   - Add `level` field

4. ✅ **Update admin route**
   - Use new `distributeCommissions()` instead of single approval
   - Send notifications to all recipients

**Company Revenue Calculation:**
- 0 levels: 100% - 60% = **40% to company**
- 1 level: 100% - 60% - 20% = **20% to company**
- 2+ levels: 100% - 60% - 20% - 10% = **10% to company**

---

**Would you like me to implement these fixes now?**
