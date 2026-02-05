import { useState, Suspense, lazy } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Filter, ArrowUpDown, Mail, Phone, Building, User, Edit3, MoreHorizontal, TrendingUp, DollarSign, Calendar, Target, Grid3X3, List, Layers, Trash2 } from "lucide-react";
import { DragEndEvent } from '@dnd-kit/core';
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// import { useToast } from "@/hooks/use-toast"; // Temporarily disabled due to React hook violations
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Opportunity } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import { ProfessionalOpportunityForm } from "@/components/professional-opportunity-form";

const OpportunityKanbanView = lazy(() => import("@/components/opportunity-kanban-view"));

interface OpportunityFormData {
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
}

const initialFormData: OpportunityFormData = {
  businessName: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  estimatedValue: "",
  currentMonthlyVolume: "",
  status: "new_contact",
  stage: "new_contact",
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

const statusOptions = [
  { value: "new_contact", label: "New Contact", color: "bg-blue-100 text-blue-800" },
  { value: "qualified", label: "Qualified", color: "bg-yellow-100 text-yellow-800" },
  { value: "needs_analysis", label: "Needs Analysis", color: "bg-purple-100 text-purple-800" },
  { value: "solution_proposed", label: "Solution Proposed", color: "bg-orange-100 text-orange-800" },
  { value: "submit_lead", label: "Submit Lead", color: "bg-indigo-100 text-indigo-800" },
  { value: "quote_received", label: "Quote Received", color: "bg-green-100 text-green-800" },
];

const stageOptions = [
  "new_contact",
  "qualified",
  "needs_analysis",
  "solution_proposed",
  "submit_lead",
  "quote_received",
];

const priorityOptions = [
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-800" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-800" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800" },
];

const productCategories = [
  "Card Machines",
  "Business Funding",
  "Utilities",
  "Insurance",
  "Banking",
  "POS Systems"
];

const businessTypes = [
  "Retail",
  "Restaurant",
  "Professional Services",
  "Healthcare",
  "E-commerce",
  "Manufacturing",
  "Technology",
  "Construction",
  "Other"
];

function OpportunityForm({
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

  return (
    <div className="h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Building className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {opportunity ? formData.businessName || "Edit Opportunity" : "New Opportunity"}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {opportunity ? "Update details and track progress" : "Add a new opportunity to your pipeline"}
              </p>
              {opportunity?.dealId && (
                <>
                  <span className="text-sm text-gray-400 dark:text-gray-500">•</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {opportunity.dealId}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        {/* Split Screen Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT SIDE - 60% width on desktop, full width on mobile */}
          <div className="w-full lg:w-[60%] overflow-y-auto p-6 space-y-6">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-gray-900 dark:text-white font-semibold text-sm">Business Name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                data-testid="input-business-name"
                required
                className="border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg h-11 text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm transition-all duration-200"
                placeholder="Enter business name"
              />
            </div>

            {/* Contact Details Section */}
            <div className="space-y-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contact Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactFirstName">First Name</Label>
                  <Input
                    id="contactFirstName"
                    value={formData.contactFirstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactFirstName: e.target.value }))}
                    data-testid="input-contact-first-name"
                  />
                </div>
                <div>
                  <Label htmlFor="contactLastName">Last Name</Label>
                  <Input
                    id="contactLastName"
                    value={formData.contactLastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactLastName: e.target.value }))}
                    data-testid="input-contact-last-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    data-testid="input-contact-email"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>
            </div>

            {/* Business Details Section */}
            <div className="space-y-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Business Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select
                    value={formData.businessType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}
                  >
                    <SelectTrigger data-testid="select-business-type">
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stage">Stage</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
                  >
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
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
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
              </div>
            </div>

            {/* Deal Information Section */}
            <div className="space-y-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="estimatedValue">Estimated Value (£)</Label>
                  <Input
                    id="estimatedValue"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedValue: e.target.value }))}
                    placeholder="0"
                    data-testid="input-estimated-value"
                  />
                </div>
                <div>
                  <Label htmlFor="currentMonthlyVolume">Monthly Volume (£)</Label>
                  <Input
                    id="currentMonthlyVolume"
                    value={formData.currentMonthlyVolume}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentMonthlyVolume: e.target.value }))}
                    placeholder="0"
                    data-testid="input-monthly-volume"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                  <Input
                    id="expectedCloseDate"
                    type="date"
                    value={formData.expectedCloseDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                    data-testid="input-close-date"
                  />
                </div>
                <div>
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <Input
                    id="assignedTo"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                    placeholder="Partner or team member"
                    data-testid="input-assigned-to"
                  />
                </div>
              </div>
            </div>

            {/* Product Interests Section */}
            <div className="space-y-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Product Interests</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productCategories.map(product => (
                  <label key={product} className="flex items-center space-x-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.productInterest.includes(product)}
                      onChange={() => toggleProductInterest(product)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2 w-4 h-4 transition-all duration-200"
                      data-testid={`checkbox-product-${product.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">{product}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* VERTICAL BORDER - Hidden on mobile */}
          <div className="hidden lg:block w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"></div>

          {/* RIGHT SIDE - 40% width on desktop, full width on mobile */}
          <div className="w-full lg:w-[40%] overflow-y-auto p-6 space-y-6">
            {/* Notes Section - Large Textarea */}
            <div className="space-y-2 flex-1">
              <Label htmlFor="notes" className="text-gray-900 dark:text-white font-semibold text-sm">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="General notes about this opportunity..."
                className="min-h-[250px] resize-y border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                data-testid="textarea-notes"
              />
            </div>

            {/* Next Steps Section */}
            <div className="space-y-2">
              <Label htmlFor="nextSteps" className="text-gray-900 dark:text-white font-semibold text-sm">Next Steps</Label>
              <Textarea
                id="nextSteps"
                value={formData.nextSteps}
                onChange={(e) => setFormData(prev => ({ ...prev, nextSteps: e.target.value }))}
                placeholder="Define next actions and follow-up steps..."
                className="min-h-[120px] resize-y border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                data-testid="textarea-next-steps"
              />
            </div>

            {/* Pain Points Field */}
            <div className="space-y-2">
              <Label htmlFor="painPoints" className="text-gray-900 dark:text-white font-semibold text-sm">Pain Points</Label>
              <Textarea
                id="painPoints"
                value={formData.painPoints}
                onChange={(e) => setFormData(prev => ({ ...prev, painPoints: e.target.value }))}
                placeholder="What challenges is the prospect facing?"
                className="min-h-[100px] resize-y border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                data-testid="textarea-pain-points"
              />
            </div>

            {/* Competitor Info Field */}
            <div className="space-y-2">
              <Label htmlFor="competitorInfo" className="text-gray-900 dark:text-white font-semibold text-sm">Competitor Info</Label>
              <Textarea
                id="competitorInfo"
                value={formData.competitorInfo}
                onChange={(e) => setFormData(prev => ({ ...prev, competitorInfo: e.target.value }))}
                placeholder="Current providers, competitor quotes..."
                className="min-h-[100px] resize-y border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                data-testid="textarea-competitor-info"
              />
            </div>
          </div>
        </div>

        {/* FOOTER - Spans Full Width */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">

          {/* Mobile Layout - Stacked buttons */}
          <div className="flex flex-col space-y-4 sm:hidden">
            {/* Primary action button first on mobile */}
            <Button
              type="submit"
              data-testid="button-save-opportunity"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-xl transition-all duration-200"
            >
              {opportunity ? "🚀 Update" : "✨ Create"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
              className="w-full h-12 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-semibold transition-all duration-200"
            >
              Cancel
            </Button>

            {/* Delete Button - only show when editing existing opportunity */}
            {opportunity && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) {
                    onDelete(opportunity.id);
                  }
                }}
                data-testid="button-delete-opportunity"
                className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>

          {/* Desktop Layout - Horizontal layout */}
          <div className="hidden sm:flex justify-between items-center">
            {/* Delete Button - only show when editing existing opportunity */}
            {opportunity && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) {
                    onDelete(opportunity.id);
                  }
                }}
                data-testid="button-delete-opportunity"
                className="h-12 px-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Opportunity
              </Button>
            )}

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
                className="h-12 px-8 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="button-save-opportunity"
                className="h-12 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-xl transition-all duration-200 transform hover:scale-105 hover:shadow-2xl"
              >
                {opportunity ? "🚀 Update Opportunity" : "✨ Create Opportunity"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function OpportunitiesPage() {
  // const { toast } = useToast(); // Temporarily disabled due to React hook violations
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("business");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterBy, setFilterBy] = useState<string>("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Query for opportunities
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['/api/opportunities'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opportunities");
      if (!response.ok) {
        throw new Error('Failed to fetch opportunities');
      }
      return response.json();
    },
  });

  // Create opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (data: OpportunityFormData) => {
      const response = await apiRequest("POST", "/api/opportunities", data);
      if (!response.ok) {
        throw new Error('Failed to create opportunity');
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Opportunity created successfully");
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
    },
    onError: (error: any) => {
      console.error("Failed to create opportunity:", error.message || error);
    },
  });

  // Update opportunity mutation
  const updateOpportunityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: OpportunityFormData }) => {
      const response = await apiRequest("PUT", `/api/opportunities/${id}`, data);
      if (!response.ok) {
        throw new Error('Failed to update opportunity');
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Opportunity updated successfully");
      setSelectedOpportunity(null);
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
    },
    onError: (error: any) => {
      console.error("Failed to update opportunity:", error.message || error);
    },
  });

  // Delete opportunity mutation
  const deleteOpportunityMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      const response = await apiRequest("DELETE", `/api/opportunities/${opportunityId}`);
      if (!response.ok) {
        throw new Error('Failed to delete opportunity');
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Opportunity deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
    },
    onError: (error: any) => {
      console.error("Failed to delete opportunity:", error.message || error);
    },
  });

  // Drag and drop mutation for Kanban
  const updateOpportunityStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/opportunities/${id}`, { status });
      if (!response.ok) {
        throw new Error('Failed to update opportunity status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
    },
    onError: (error: any) => {
      console.error("Failed to move opportunity:", error.message || error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
    },
  });

  const filteredAndSortedOpportunities = opportunities
    .filter((opportunity: Opportunity) => {
      const matchesSearch = `${opportunity.businessName} ${opportunity.contactFirstName} ${opportunity.contactLastName} ${opportunity.contactEmail}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (filterBy === "all") return matchesSearch;
      if (filterBy === "status") return matchesSearch && opportunity.status === filterBy;
      return matchesSearch;
    })
    .sort((a: Opportunity, b: Opportunity) => {
      let aValue, bValue;

      switch (sortBy) {
        case "business":
          aValue = a.businessName || "";
          bValue = b.businessName || "";
          break;
        case "value":
          aValue = parseFloat(a.estimatedValue || "0");
          bValue = parseFloat(b.estimatedValue || "0");
          break;
        case "stage":
          aValue = a.stage || "";
          bValue = b.stage || "";
          break;
        case "closeDate":
          aValue = a.expectedCloseDate ? new Date(a.expectedCloseDate) : new Date(0);
          bValue = b.expectedCloseDate ? new Date(b.expectedCloseDate) : new Date(0);
          break;
        default:
          aValue = a.businessName;
          bValue = b.businessName;
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const handleCreateOpportunity = (data: OpportunityFormData) => {
    createOpportunityMutation.mutate(data);
  };

  const handleUpdateOpportunity = (data: OpportunityFormData) => {
    if (selectedOpportunity) {
      updateOpportunityMutation.mutate({ id: selectedOpportunity.id, data });
    }
  };

  // Handle drag and drop for Kanban
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const opportunityId = active.id as string;
    const newStatus = over.id as string;

    // Find the opportunity being dragged
    const opportunity = opportunities.find((opp: Opportunity) => opp.id === opportunityId);
    if (!opportunity || opportunity.status === newStatus) return;

    // Special handling for "Submit Lead" stage - navigate to deals form but keep in pipeline
    if (newStatus === "submit_lead") {
      // First update the status to "submit_lead"
      updateOpportunityStatusMutation.mutate({
        id: opportunityId,
        status: newStatus
      });

      // Then navigate to submit-deals page with pre-populated data
      const params = new URLSearchParams({
        opportunityId: opportunity.id,
        dealId: opportunity.dealId || "",
        businessName: opportunity.businessName || "",
        contactFirstName: opportunity.contactFirstName || "",
        contactLastName: opportunity.contactLastName || "",
        contactEmail: opportunity.contactEmail || "",
        contactPhone: opportunity.contactPhone || "",
        businessType: opportunity.businessType || "",
        currentMonthlyVolume: opportunity.currentMonthlyVolume || "",
        productInterest: JSON.stringify(opportunity.productInterest || []),
        notes: opportunity.notes || "",
      });
      setLocation(`/submit-deal?${params.toString()}`);
      return;
    }

    // Optimistically update the UI
    queryClient.setQueryData(['/api/opportunities'], (old: Opportunity[] = []) =>
      old.map((opp) =>
        opp.id === opportunityId ? { ...opp, status: newStatus } : opp
      )
    );

    // Update on server
    updateOpportunityStatusMutation.mutate({
      id: opportunityId,
      status: newStatus
    });
  };

  const handleEditDetails = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
  };

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return statusOption?.color || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority: string) => {
    const priorityOption = priorityOptions.find(p => p.value === priority);
    return priorityOption?.color || "bg-gray-100 text-gray-800";
  };

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading opportunities...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <p className="text-primary text-sm font-medium tracking-wide uppercase mb-2">Sales Pipeline</p>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
                  Opportunities
                </h1>
                <p className="text-muted-foreground mt-1">
                  Track your sales pipeline and manage deal progression
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* View Toggle */}
                <div className="flex items-center bg-card border border-border p-1 rounded-lg">
                  <Button
                    variant={viewMode === "kanban" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                    className={`h-8 px-3 ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="button-kanban-view"
                  >
                    <Layers className="h-4 w-4 mr-1" />
                    Kanban
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-8 px-3 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="button-list-view"
                  >
                    <List className="h-4 w-4 mr-1" />
                    List
                  </Button>
                </div>

                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      data-testid="button-add-opportunity"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Opportunity
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[95vh] !max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Opportunity</DialogTitle>
                    </DialogHeader>
                    <OpportunityForm
                      onClose={() => setIsFormOpen(false)}
                      onSave={handleCreateOpportunity}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search opportunities by business name, contact, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                  data-testid="input-search-opportunities"
                />
              </div>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 bg-card border-border text-foreground" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Sort by Business</SelectItem>
                    <SelectItem value="value">Sort by Value</SelectItem>
                    <SelectItem value="stage">Sort by Stage</SelectItem>
                    <SelectItem value="closeDate">Sort by Close Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="border-border text-foreground hover:bg-primary hover:text-primary-foreground"
                  data-testid="button-sort-order"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
                <Select value={filterBy} onValueChange={setFilterBy}>
                  <SelectTrigger className="w-40 bg-card border-border text-foreground" data-testid="select-filter-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Opportunities</SelectItem>
                    <SelectItem value="prospect">Prospects</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal Sent</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Opportunities View */}
          {filteredAndSortedOpportunities.length === 0 ? (
            <div className="rocket-card p-12 text-center">
              <div className="rocket-icon-box mx-auto mb-4" style={{ width: '48px', height: '48px' }}>
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No opportunities found
              </h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your sales pipeline by creating your first opportunity
              </p>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-create-first-opportunity"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Opportunity
              </Button>
            </div>
          ) : viewMode === "kanban" ? (
            <Suspense fallback={<div className="text-center py-8">Loading Kanban view...</div>}>
              <OpportunityKanbanView
                opportunities={filteredAndSortedOpportunities}
                isLoading={isLoading}
                onEditDetails={handleEditDetails}
                onDelete={deleteOpportunityMutation.mutate}
                onDragEnd={handleDragEnd}
              />
            </Suspense>
          ) : (
            <div className="grid gap-4" data-testid="opportunities-list">
              {filteredAndSortedOpportunities.map((opportunity: Opportunity) => (
                <Card
                  key={opportunity.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  data-testid={`opportunity-card-${opportunity.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {opportunity.businessName}
                            </h3>
                            <Badge className={getStatusColor(opportunity.status)}>
                              {statusOptions.find(s => s.value === opportunity.status)?.label || opportunity.status}
                            </Badge>
                            <Badge className={getPriorityColor(opportunity.priority || "medium")}>
                              {priorityOptions.find(p => p.value === opportunity.priority)?.label || opportunity.priority || "Medium"}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                            {opportunity.contactFirstName && opportunity.contactLastName && (
                              <div className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {opportunity.contactFirstName} {opportunity.contactLastName}
                              </div>
                            )}
                            {opportunity.contactEmail && (
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {opportunity.contactEmail}
                              </div>
                            )}
                            {opportunity.contactPhone && (
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {opportunity.contactPhone}
                              </div>
                            )}
                            {opportunity.estimatedValue && (
                              <div className="flex items-center">
                                <DollarSign className="w-3 h-3 mr-1" />
                                £{opportunity.estimatedValue}
                              </div>
                            )}
                            {opportunity.expectedCloseDate && (
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(opportunity.expectedCloseDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          <div className="mt-2">
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              {opportunity.stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-menu-${opportunity.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setSelectedOpportunity(opportunity)}
                              data-testid={`menu-edit-${opportunity.id}`}
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit Opportunity
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Edit Opportunity Dialog */}
          <Dialog
            open={!!selectedOpportunity}
            onOpenChange={(open) => !open && setSelectedOpportunity(null)}
          >
            <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[95vh] !max-h-[95vh] overflow-hidden p-0">
              {selectedOpportunity && (
                <ProfessionalOpportunityForm
                  key={selectedOpportunity.id}
                  opportunity={selectedOpportunity}
                  onClose={() => setSelectedOpportunity(null)}
                  onSave={handleUpdateOpportunity}
                  onDelete={(opportunityId) => {
                    deleteOpportunityMutation.mutate(opportunityId, {
                      onSuccess: () => {
                        setSelectedOpportunity(null);
                      }
                    });
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}