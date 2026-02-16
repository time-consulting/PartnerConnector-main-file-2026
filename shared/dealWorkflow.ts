export const DEAL_STAGES = [
  'submitted',
  'quote_request_received',
  'quote_sent',
  'quote_approved',
  'signup_submitted',
  'agreement_sent',
  'signed_awaiting_docs',
  'under_review',
  'approved',
  'live_confirm_ltr',
  'invoice_received',
  'completed',
  'declined',
] as const;

export type DealStage = typeof DEAL_STAGES[number];

export const PRODUCT_TYPES = [
  'card_payments',
  'business_funding',
  'bookings',
  'websites',
  'business_automation',
  'marketing',
  'epos',
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

export interface StageConfig {
  id: DealStage;
  adminLabel: string;
  partnerLabel: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  order: number;
}

export const STAGE_CONFIG: Record<DealStage, StageConfig> = {
  submitted: {
    id: 'submitted',
    adminLabel: 'Submitted',
    partnerLabel: 'Submitted',
    shortLabel: 'Submitted',
    description: 'New deal submitted',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500/50',
    iconColor: 'text-blue-400',
    order: 0,
  },
  quote_request_received: {
    id: 'quote_request_received',
    adminLabel: 'Quote Requests',
    partnerLabel: 'Quote Requested',
    shortLabel: 'Requested',
    description: 'New submissions requiring review',
    color: 'bg-cyan-500',
    bgColor: 'bg-cyan-900/30',
    borderColor: 'border-cyan-500/50',
    iconColor: 'text-cyan-400',
    order: 1,
  },
  quote_sent: {
    id: 'quote_sent',
    adminLabel: 'Sent Quotes',
    partnerLabel: 'Quote Received',
    shortLabel: 'Received',
    description: 'Quotes sent to clients',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-900/30',
    borderColor: 'border-purple-500/50',
    iconColor: 'text-purple-400',
    order: 2,
  },
  quote_approved: {
    id: 'quote_approved',
    adminLabel: 'Quote Approved - Awaiting Signup',
    partnerLabel: 'Approved – Awaiting Signup',
    shortLabel: 'Approved',
    description: 'Client ready to proceed',
    color: 'bg-green-500',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500/50',
    iconColor: 'text-green-400',
    order: 3,
  },
  signup_submitted: {
    id: 'signup_submitted',
    adminLabel: 'Signup Submitted',
    partnerLabel: 'Application Submitted',
    shortLabel: 'Applied',
    description: 'Signup form completed by partner',
    color: 'bg-lime-500',
    bgColor: 'bg-lime-900/30',
    borderColor: 'border-lime-500/50',
    iconColor: 'text-lime-400',
    order: 4,
  },
  agreement_sent: {
    id: 'agreement_sent',
    adminLabel: 'Agreement Sent',
    partnerLabel: 'Application Sent to Client',
    shortLabel: 'Agreement',
    description: 'Contract sent to client',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500/50',
    iconColor: 'text-yellow-400',
    order: 5,
  },
  signed_awaiting_docs: {
    id: 'signed_awaiting_docs',
    adminLabel: 'Signed - Awaiting Documents',
    partnerLabel: 'Signed – Awaiting Documents',
    shortLabel: 'Documents',
    description: 'Contract signed, waiting for docs',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500/50',
    iconColor: 'text-orange-400',
    order: 6,
  },
  under_review: {
    id: 'under_review',
    adminLabel: 'Under Review',
    partnerLabel: 'Under Review by Dojo',
    shortLabel: 'Review',
    description: 'Application under Dojo review',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-900/30',
    borderColor: 'border-amber-500/50',
    iconColor: 'text-amber-400',
    order: 7,
  },
  approved: {
    id: 'approved',
    adminLabel: 'Approved',
    partnerLabel: 'Approved (Terminals on the way)',
    shortLabel: 'Approved',
    description: 'Dojo approved, terminals dispatched',
    color: 'bg-teal-500',
    bgColor: 'bg-teal-900/30',
    borderColor: 'border-teal-500/50',
    iconColor: 'text-teal-400',
    order: 8,
  },
  live_confirm_ltr: {
    id: 'live_confirm_ltr',
    adminLabel: 'Live - Confirm LTR',
    partnerLabel: 'Live',
    shortLabel: 'Live',
    description: 'Deal is live, confirm long-term relationship',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-900/30',
    borderColor: 'border-indigo-500/50',
    iconColor: 'text-indigo-400',
    order: 9,
  },
  invoice_received: {
    id: 'invoice_received',
    adminLabel: 'Invoice Received - Awaiting Payment',
    partnerLabel: 'Awaiting Payment',
    shortLabel: 'Payment',
    description: 'Partner invoice submitted',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-900/30',
    borderColor: 'border-pink-500/50',
    iconColor: 'text-pink-400',
    order: 10,
  },
  completed: {
    id: 'completed',
    adminLabel: 'Complete',
    partnerLabel: 'Completed',
    shortLabel: 'Complete',
    description: 'Fully closed deals',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-900/30',
    borderColor: 'border-emerald-500/50',
    iconColor: 'text-emerald-400',
    order: 11,
  },
  declined: {
    id: 'declined',
    adminLabel: 'Declined',
    partnerLabel: 'Declined',
    shortLabel: 'Declined',
    description: 'Deals that did not proceed',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-800/30',
    borderColor: 'border-gray-600/50',
    iconColor: 'text-gray-400',
    order: 12,
  },
};

export const ALLOWED_TRANSITIONS: Record<DealStage, DealStage[]> = {
  submitted: ['quote_request_received', 'declined'],
  quote_request_received: ['quote_sent', 'declined'],
  quote_sent: ['quote_approved', 'declined'],
  quote_approved: ['signup_submitted', 'declined'],
  signup_submitted: ['agreement_sent', 'declined'],
  agreement_sent: ['signed_awaiting_docs', 'declined'],
  signed_awaiting_docs: ['under_review', 'declined'],
  under_review: ['approved', 'declined'],
  approved: ['live_confirm_ltr', 'declined'],
  live_confirm_ltr: ['invoice_received', 'completed', 'declined'],
  invoice_received: ['completed', 'declined'],
  completed: [],
  declined: ['submitted'],
};

export type UserRole = 'partner' | 'admin';

export interface StageCTA {
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'warning' | 'danger';
}

export const STAGE_CTAS: Record<DealStage, Partial<Record<UserRole, StageCTA[]>>> = {
  submitted: {
    admin: [{ label: 'Create Quote', action: 'create_quote', variant: 'primary' }],
  },
  quote_request_received: {
    admin: [{ label: 'Generate Quote', action: 'generate_quote', variant: 'primary' }],
  },
  quote_sent: {
    partner: [
      { label: 'Approve Quote', action: 'approve_quote', variant: 'primary' },
      { label: 'Request Lower Rates', action: 'request_rates', variant: 'warning' },
    ],
    admin: [{ label: 'Resend Quote', action: 'resend_quote', variant: 'secondary' }],
  },
  quote_approved: {
    partner: [{ label: 'Complete Sign Up', action: 'complete_signup', variant: 'primary' }],
    admin: [{ label: 'Awaiting Signup', action: 'view_details', variant: 'secondary' }],
  },
  signup_submitted: {
    admin: [{ label: 'Send Agreement', action: 'send_agreement', variant: 'primary' }],
  },
  agreement_sent: {
    admin: [{ label: 'Mark Signed', action: 'mark_signed', variant: 'primary' }],
  },
  signed_awaiting_docs: {
    partner: [{ label: 'Upload Documents', action: 'upload_docs', variant: 'primary' }],
    admin: [{ label: 'Move to Review', action: 'move_to_review', variant: 'primary' }],
  },
  under_review: {
    admin: [{ label: 'Approve Application', action: 'approve_application', variant: 'primary' }],
  },
  approved: {
    admin: [{ label: 'Confirm Live', action: 'confirm_live', variant: 'primary' }],
  },
  live_confirm_ltr: {
    admin: [
      { label: 'Record Invoice', action: 'record_invoice', variant: 'primary' },
      { label: 'Mark Complete', action: 'mark_complete', variant: 'secondary' },
    ],
  },
  invoice_received: {
    admin: [{ label: 'Confirm Payment', action: 'confirm_payment', variant: 'primary' }],
  },
  completed: {},
  declined: {
    admin: [{ label: 'Reopen Deal', action: 'reopen', variant: 'secondary' }],
  },
};

export const PRODUCT_CONFIG: Record<ProductType, { label: string; icon: string; color: string }> = {
  card_payments: { label: 'Card Payments', icon: 'CreditCard', color: 'text-blue-400' },
  business_funding: { label: 'Business Funding', icon: 'Banknote', color: 'text-green-400' },
  bookings: { label: 'Bookings', icon: 'Calendar', color: 'text-purple-400' },
  websites: { label: 'Websites', icon: 'Globe', color: 'text-cyan-400' },
  business_automation: { label: 'Business Automation', icon: 'Bot', color: 'text-violet-400' },
  marketing: { label: 'Marketing', icon: 'Megaphone', color: 'text-pink-400' },
  epos: { label: 'EPOS', icon: 'Monitor', color: 'text-indigo-400' },
};

/**
 * Products that require a consultation call / demo before quoting.
 * These auto-push to quote_sent with call-scheduling instructions on submission.
 */
export const CONSULTATION_PRODUCTS: ReadonlySet<string> = new Set([
  'business_automation',
  'marketing',
  'epos',
  'websites',
  'bookings',
]);

// Product-specific label overrides for partner-facing badges
// Each product type can override any stage's partnerLabel
export const PRODUCT_STAGE_LABELS: Partial<Record<ProductType, Partial<Record<DealStage, string>>>> = {
  business_funding: {
    quote_approved: 'Funding Application Approved',
    signup_submitted: 'Funding Application Submitted',
    agreement_sent: 'Funding Agreement Sent',
    under_review: 'Under Review by Funding Team',
    approved: 'Funding Agreed',
    live_confirm_ltr: 'Funds Received – Live',
  },
  business_automation: {
    quote_sent: 'Consultation Scheduled',
    quote_approved: 'Requirements Confirmed',
    approved: 'Project Approved',
    live_confirm_ltr: 'Live',
  },
  marketing: {
    quote_sent: 'Consultation Scheduled',
    quote_approved: 'Campaign Agreed',
    approved: 'Campaign Approved',
    live_confirm_ltr: 'Live',
  },
  epos: {
    quote_sent: 'Demo Scheduled',
    quote_approved: 'Quote Accepted',
    approved: 'Setup Approved',
    live_confirm_ltr: 'Live',
  },
  websites: {
    quote_sent: 'Consultation Scheduled',
    quote_approved: 'Quote Accepted',
    approved: 'Project Approved',
    live_confirm_ltr: 'Website Live',
  },
  bookings: {
    quote_sent: 'Demo Scheduled',
    quote_approved: 'Quote Accepted',
    approved: 'Setup Approved',
    live_confirm_ltr: 'Live',
  },
};

/**
 * Get the correct partner-facing label for a deal stage, considering the product type.
 * Falls back to the default STAGE_CONFIG.partnerLabel if no product override exists.
 */
export function getPartnerStageLabel(stage: DealStage, productType?: string | null): string {
  if (productType && PRODUCT_STAGE_LABELS[productType as ProductType]?.[stage]) {
    return PRODUCT_STAGE_LABELS[productType as ProductType]![stage]!;
  }
  return STAGE_CONFIG[stage]?.partnerLabel || stage;
}

/**
 * Get the correct approved step label for the partner progress stepper.
 */
export function getApprovedStepLabel(productType?: string | null): string {
  if (productType === 'business_funding') return 'Funding Agreed';
  if (productType && CONSULTATION_PRODUCTS.has(productType)) return 'Approved';
  return 'Approved (Dojo)';
}

export function getStagesForAdmin(): StageConfig[] {
  return DEAL_STAGES.map(id => STAGE_CONFIG[id]).sort((a, b) => a.order - b.order);
}

export function getStagesForPartner(): StageConfig[] {
  return DEAL_STAGES
    .filter(id => !['invoice_received'].includes(id))
    .map(id => STAGE_CONFIG[id])
    .sort((a, b) => a.order - b.order);
}

export function getStageLabel(stage: DealStage, role: UserRole, productType?: string | null): string {
  if (role === 'partner') return getPartnerStageLabel(stage, productType);
  const config = STAGE_CONFIG[stage];
  return config.adminLabel;
}

export function getCTAsForStage(stage: DealStage, role: UserRole): StageCTA[] {
  return STAGE_CTAS[stage]?.[role] || [];
}

export function canTransitionTo(currentStage: DealStage, targetStage: DealStage): boolean {
  return ALLOWED_TRANSITIONS[currentStage]?.includes(targetStage) ?? false;
}

export function getNextStages(currentStage: DealStage): DealStage[] {
  return ALLOWED_TRANSITIONS[currentStage] || [];
}

export interface PartnerTab {
  id: string;
  label: string;
  stages: DealStage[];
  color: string;
}

export interface PartnerProgressStep {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  order: number;
}

export const PARTNER_PROGRESS_STEPS: PartnerProgressStep[] = [
  {
    id: 'submitted',
    label: 'Submitted',
    shortLabel: 'Submitted',
    description: 'Deal submitted for review',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500/50',
    iconColor: 'text-blue-400',
    order: 0,
  },
  {
    id: 'quote_received',
    label: 'Quote Received',
    shortLabel: 'Quote',
    description: 'Quote ready for review',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-900/30',
    borderColor: 'border-purple-500/50',
    iconColor: 'text-purple-400',
    order: 1,
  },
  {
    id: 'application_submitted',
    label: 'Application Submitted',
    shortLabel: 'Applied',
    description: 'Application being processed',
    color: 'bg-lime-500',
    bgColor: 'bg-lime-900/30',
    borderColor: 'border-lime-500/50',
    iconColor: 'text-lime-400',
    order: 2,
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    shortLabel: 'Processing',
    description: 'Application under review',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500/50',
    iconColor: 'text-yellow-400',
    order: 3,
  },
  {
    id: 'approved',
    label: 'Approved (Dojo)',
    shortLabel: 'Approved',
    description: 'Terminals on the way',
    color: 'bg-teal-500',
    bgColor: 'bg-teal-900/30',
    borderColor: 'border-teal-500/50',
    iconColor: 'text-teal-400',
    order: 4,
  },
  {
    id: 'live',
    label: 'Live',
    shortLabel: 'Live',
    description: 'Deal is live and active',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-900/30',
    borderColor: 'border-indigo-500/50',
    iconColor: 'text-indigo-400',
    order: 5,
  },
  {
    id: 'complete',
    label: 'Complete',
    shortLabel: 'Complete',
    description: 'Deal completed successfully',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-900/30',
    borderColor: 'border-emerald-500/50',
    iconColor: 'text-emerald-400',
    order: 6,
  },
  {
    id: 'declined',
    label: 'Declined',
    shortLabel: 'Declined',
    description: 'Deal did not proceed',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-800/30',
    borderColor: 'border-gray-600/50',
    iconColor: 'text-gray-400',
    order: 7,
  },
];

export function mapDealToPartnerProgress(dealStage: DealStage, signupCompletedAt?: string | null): PartnerProgressStep {
  if (dealStage === 'declined') {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'declined')!;
  }
  if (['completed', 'invoice_received'].includes(dealStage)) {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'complete')!;
  }
  if (dealStage === 'live_confirm_ltr') {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'live')!;
  }
  if (dealStage === 'approved') {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'approved')!;
  }
  if (['agreement_sent', 'signed_awaiting_docs', 'under_review'].includes(dealStage)) {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'in_progress')!;
  }
  if (dealStage === 'signup_submitted' || (signupCompletedAt && ['quote_approved'].includes(dealStage))) {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'application_submitted')!;
  }
  if (['quote_sent', 'quote_approved'].includes(dealStage)) {
    return PARTNER_PROGRESS_STEPS.find(s => s.id === 'quote_received')!;
  }
  return PARTNER_PROGRESS_STEPS.find(s => s.id === 'submitted')!;
}

export function getPartnerProgressSteps(): PartnerProgressStep[] {
  return PARTNER_PROGRESS_STEPS.filter(s => s.id !== 'declined');
}

export function getAdminProgressSteps(): { id: DealStage; label: string; shortLabel: string }[] {
  return DEAL_STAGES.filter(s => s !== 'declined').map(id => ({
    id,
    label: STAGE_CONFIG[id].adminLabel,
    shortLabel: STAGE_CONFIG[id].shortLabel,
  }));
}

export const PARTNER_TAB_CONFIG: PartnerTab[] = [
  {
    id: 'all',
    label: 'All Deals',
    stages: [],
    color: 'bg-slate-500',
  },
  {
    id: 'submitted',
    label: 'Submitted',
    stages: ['submitted', 'quote_request_received'],
    color: 'bg-blue-500',
  },
  {
    id: 'quote_received',
    label: 'Quote Received',
    stages: ['quote_sent'],
    color: 'bg-purple-500',
  },
  {
    id: 'application_submitted',
    label: 'Application Submitted',
    stages: ['quote_approved', 'signup_submitted'],
    color: 'bg-lime-500',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    stages: ['agreement_sent', 'signed_awaiting_docs', 'under_review'],
    color: 'bg-yellow-500',
  },
  {
    id: 'approved',
    label: 'Approved (Dojo)',
    stages: ['approved'],
    color: 'bg-teal-500',
  },
  {
    id: 'live',
    label: 'Live',
    stages: ['live_confirm_ltr'],
    color: 'bg-indigo-500',
  },
  {
    id: 'complete',
    label: 'Complete',
    stages: ['invoice_received', 'completed'],
    color: 'bg-emerald-500',
  },
  {
    id: 'declined',
    label: 'Declined',
    stages: ['declined'],
    color: 'bg-gray-500',
  },
];
