import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Building,
    Phone,
    Mail,
    Trash2,
    User,
    DollarSign,
    Calendar,
    Target,
    FileText,
    TrendingUp
} from "lucide-react";

type OpportunityFormData = {
    businessName: string;
    contactFirstName: string;
    contactLastName: string;
    contactEmail: string;
    contactPhone: string;
    contactId?: string;
    estimatedValue: string;
    currentMonthlyVolume: string;
    status: string;
    stage: string;
    priority: string;
    assignedTo: string;
    expectedCloseDate: string;
    productInterest: string[];
    businessType: string;
    decisionMakers: string;
    painPoints: string;
    competitorInfo: string;
    notes: string;
    nextSteps: string;
};

type Opportunity = OpportunityFormData & {
    id: string;
    dealId?: string;
};

const initialFormData: OpportunityFormData = {
    businessName: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactPhone: "",
    estimatedValue: "",
    currentMonthlyVolume: "",
    status: "prospect",
    stage: "initial_contact",
    priority: "medium",
    assignedTo: "",
    expectedCloseDate: "",
    productInterest: [],
    businessType: "",
    decisionMakers: "",
    painPoints: "",
    competitorInfo: "",
    notes: "",
    nextSteps: "",
};

const businessTypes = [
    "E-commerce", "Retail", "Restaurant", "Professional Services",
    "Healthcare", "Technology", "Education", "Manufacturing", "Other"
];

const statusOptions = [
    { value: "prospect", label: "Prospect" },
    { value: "qualified", label: "Qualified" },
    { value: "proposal_sent", label: "Proposal Sent" },
    { value: "negotiation", label: "Negotiation" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
];

const stageOptions = [
    "initial_contact", "needs_analysis", "qualified", "proposal",
    "negotiation", "closed_won", "closed_lost"
];

const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
];

const productCategories = [
    "Credit Card Processing", "POS Systems", "E-commerce Solutions",
    "Mobile Payments", "Invoicing", "Recurring Billing"
];

export function ProfessionalOpportunityForm({
    opportunity,
    onClose,
    onSave,
    onDelete
}: {
    opportunity?: Opportunity;
    onClose: () => void;
    onSave: (data: OpportunityFormData) => void;
    onDelete?: (opportunityId: string) => void;
}) {
    const [formData, setFormData] = useState<OpportunityFormData>(
        opportunity ? {
            businessName: opportunity.businessName || "",
            contactFirstName: opportunity.contactFirstName || "",
            contactLastName: opportunity.contactLastName || "",
            contactEmail: opportunity.contactEmail || "",
            contactPhone: opportunity.contactPhone || "",
            contactId: opportunity.contactId || "",
            estimatedValue: opportunity.estimatedValue || "",
            currentMonthlyVolume: opportunity.currentMonthlyVolume || "",
            status: opportunity.status || "prospect",
            stage: opportunity.stage || "initial_contact",
            priority: opportunity.priority || "medium",
            assignedTo: opportunity.assignedTo || "",
            expectedCloseDate: opportunity.expectedCloseDate ? new Date(opportunity.expectedCloseDate).toISOString().split('T')[0] : "",
            productInterest: opportunity.productInterest || [],
            businessType: opportunity.businessType || "",
            decisionMakers: opportunity.decisionMakers || "",
            painPoints: opportunity.painPoints || "",
            competitorInfo: opportunity.competitorInfo || "",
            notes: opportunity.notes || "",
            nextSteps: opportunity.nextSteps || "",
        } : initialFormData
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const toggleProductInterest = (product: string) => {
        setFormData(prev => ({
            ...prev,
            productInterest: prev.productInterest.includes(product)
                ? prev.productInterest.filter(p => p !== product)
                : [...prev.productInterest, product]
        }));
    };

    const handleCall = () => {
        if (formData.contactPhone) {
            window.location.href = `tel:${formData.contactPhone}`;
        }
    };

    const handleEmail = () => {
        if (formData.contactEmail) {
            window.location.href = `mailto:${formData.contactEmail}?subject=Follow up regarding ${formData.businessName}`;
        }
    };

    return (
        <div className="h-[90vh] flex flex-col bg-background rounded-lg">
            {/* Professional CRM Header - Dark theme with teal accents */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center">
                        <Building className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            {opportunity ? formData.businessName || "Edit Opportunity" : "New Opportunity"}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-muted-foreground">
                                {opportunity ? "Update deal details" : "Create new opportunity"}
                            </p>
                            {opportunity?.dealId && (
                                <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm text-primary font-mono">
                                        {opportunity.dealId}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Action Icons - Pipedrive style */}
                <div className="flex items-center gap-2">
                    {formData.contactPhone && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCall}
                            className="h-10 w-10 border-primary/30 hover:bg-primary/10"
                            title={`Call ${formData.contactPhone}`}
                        >
                            <Phone className="h-4 w-4 text-primary" />
                        </Button>
                    )}
                    {formData.contactEmail && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleEmail}
                            className="h-10 w-10 border-primary/30 hover:bg-primary/10"
                            title={`Email ${formData.contactEmail}`}
                        >
                            <Mail className="h-4 w-4 text-primary" />
                        </Button>
                    )}
                    {opportunity && onDelete && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                if (window.confirm('Delete this opportunity?')) {
                                    onDelete(opportunity.id);
                                }
                            }}
                            className="h-10 w-10 border-destructive/30 hover:bg-destructive/10"
                            title="Delete opportunity"
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* Two-Column Layout */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* LEFT: Main Form - 60% */}
                    <div className="w-full lg:w-[60%] overflow-y-auto p-6 space-y-6">
                        {/* Business Name - Prominent */}
                        <div className="space-y-2">
                            <Label htmlFor="businessName" className="text-foreground font-semibold flex items-center gap-2">
                                <Building className="h-4 w-4 text-primary" />
                                Business Name *
                            </Label>
                            <Input
                                id="businessName"
                                value={formData.businessName}
                                onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                                required
                                className="h-11"
                                placeholder="Enter business name"
                                data-testid="input-business-name"
                            />
                        </div>

                        {/* Contact Details - Clean card */}
                        <div className="rocket-card p-5 space-y-4">
                            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                Contact Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contactFirstName" className="text-sm">First Name</Label>
                                    <Input
                                        id="contactFirstName"
                                        value={formData.contactFirstName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contactFirstName: e.target.value }))}
                                        data-testid="input-contact-first-name"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contactLastName" className="text-sm">Last Name</Label>
                                    <Input
                                        id="contactLastName"
                                        value={formData.contactLastName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contactLastName: e.target.value }))}
                                        data-testid="input-contact-last-name"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contactEmail" className="text-sm flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        Email
                                    </Label>
                                    <Input
                                        id="contactEmail"
                                        type="email"
                                        value={formData.contactEmail}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                                        data-testid="input-contact-email"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contactPhone" className="text-sm flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        Phone
                                    </Label>
                                    <Input
                                        id="contactPhone"
                                        value={formData.contactPhone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                                        data-testid="input-contact-phone"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Deal Details */}
                        <div className="rocket-card p-5 space-y-4">
                            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-primary" />
                                Deal Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="businessType" className="text-sm">Business Type</Label>
                                    <Select value={formData.businessType} onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}>
                                        <SelectTrigger data-testid="select-business-type">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {businessTypes.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="priority" className="text-sm flex items-center gap-1">
                                        <Target className="h-3 w-3" />
                                        Priority
                                    </Label>
                                    <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                                        <SelectTrigger data-testid="select-priority">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {priorityOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="status" className="text-sm">Status</Label>
                                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                                        <SelectTrigger data-testid="select-status">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="stage" className="text-sm">Stage</Label>
                                    <Select value={formData.stage} onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}>
                                        <SelectTrigger data-testid="select-stage">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stageOptions.map(stage => (
                                                <SelectItem key={stage} value={stage}>
                                                    {stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="estimatedValue" className="text-sm">Deal Value (£)</Label>
                                    <Input
                                        id="estimatedValue"
                                        value={formData.estimatedValue}
                                        onChange={(e) => setFormData(prev => ({ ...prev, estimatedValue: e.target.value }))}
                                        placeholder="0"
                                        data-testid="input-estimated-value"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="currentMonthlyVolume" className="text-sm">Monthly Volume (£)</Label>
                                    <Input
                                        id="currentMonthlyVolume"
                                        value={formData.currentMonthlyVolume}
                                        onChange={(e) => setFormData(prev => ({ ...prev, currentMonthlyVolume: e.target.value }))}
                                        placeholder="0"
                                        data-testid="input-monthly-volume"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="expectedCloseDate" className="text-sm flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Expected Close
                                    </Label>
                                    <Input
                                        id="expectedCloseDate"
                                        type="date"
                                        value={formData.expectedCloseDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                                        data-testid="input-close-date"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="assignedTo" className="text-sm">Assigned To</Label>
                                    <Input
                                        id="assignedTo"
                                        value={formData.assignedTo}
                                        onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                        placeholder="Team member"
                                        data-testid="input-assigned-to"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Product Interests */}
                        <div className="rocket-card p-5 space-y-3">
                            <h3 className="text-base font-semibold text-foreground">Product Interests</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {productCategories.map(product => (
                                    <label key={product} className="flex items-center space-x-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.productInterest.includes(product)}
                                            onChange={() => toggleProductInterest(product)}
                                            className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                                            data-testid={`checkbox-product-${product.toLowerCase().replace(/\s+/g, '-')}`}
                                        />
                                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">{product}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px bg-border"></div>

                    {/* RIGHT: Notes & Details - 40% */}
                    <div className="w-full lg:w-[40%] overflow-y-auto p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-foreground font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Notes
                            </Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="General notes about this opportunity..."
                                className="min-h-[200px] resize-y"
                                data-testid="textarea-notes"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nextSteps" className="text-foreground font-semibold flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Next Steps
                            </Label>
                            <Textarea
                                id="nextSteps"
                                value={formData.nextSteps}
                                onChange={(e) => setFormData(prev => ({ ...prev, nextSteps: e.target.value }))}
                                placeholder="Define next actions..."
                                className="min-h-[100px] resize-y"
                                data-testid="textarea-next-steps"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="painPoints" className="text-foreground font-semibold">Pain Points</Label>
                            <Textarea
                                id="painPoints"
                                value={formData.painPoints}
                                onChange={(e) => setFormData(prev => ({ ...prev, painPoints: e.target.value }))}
                                placeholder="Customer challenges..."
                                className="min-h-[80px] resize-y"
                                data-testid="textarea-pain-points"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="competitorInfo" className="text-foreground font-semibold">Competitor Info</Label>
                            <Textarea
                                id="competitorInfo"
                                value={formData.competitorInfo}
                                onChange={(e) => setFormData(prev => ({ ...prev, competitorInfo: e.target.value }))}
                                placeholder="Current providers..."
                                className="min-h-[80px] resize-y"
                                data-testid="textarea-competitor-info"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-border px-6 py-4 bg-card/50 flex items-center justify-between">
                    <div>
                        {opportunity && onDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    if (window.confirm('Delete this opportunity?')) {
                                        onDelete(opportunity.id);
                                    }
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                data-testid="button-delete-opportunity"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            data-testid="button-cancel"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="button-save-opportunity"
                        >
                            {opportunity ? "Update Opportunity" : "Create Opportunity"}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
