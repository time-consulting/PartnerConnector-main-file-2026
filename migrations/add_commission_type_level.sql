-- Migration: Add commission type and level fields to commission_approvals
-- Description: Adds fields to track direct vs override commissions and hierarchy level

-- Add commission_type column (default 'direct' for existing records)
ALTER TABLE commission_approvals 
ADD COLUMN IF NOT EXISTS commission_type VARCHAR DEFAULT 'direct';

-- Add level column (default 0 for existing records = deal creator)
ALTER TABLE commission_approvals 
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN commission_approvals.commission_type IS 'Commission type: "direct" (60% to deal creator) or "override" (20%/10% to upline)';
COMMENT ON COLUMN commission_approvals.level IS 'Hierarchy level: 0 = direct (deal creator), 1 = level 1 up (20%), 2 = level 2 up (10%)';

-- Update partner_hierarchy percentages (if you want to update existing data)
-- Note: This is optional - only needed if you have existing partner_hierarchy records with wrong percentages
-- The new setupReferralHierarchy() function will create correct percentages for new signups

-- Optional: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_commission_approvals_type_level ON commission_approvals(commission_type, level);
CREATE INDEX IF NOT EXISTS idx_commission_approvals_deal_type ON commission_approvals(deal_id, commission_type);
