import { useState, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Filter, ArrowUpDown, Mail, Phone, Building, User, Edit3, MoreHorizontal, Trash2, ExternalLink, CheckCircle, CreditCard, DollarSign, Zap, Shield, Monitor, Calendar, Globe, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Contact } from "@shared/schema";
import { insertContactSchema, insertOpportunitySchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import Sidebar from "@/components/sidebar";

// Define form schema with proper validation
const contactFormSchema = insertContactSchema.extend({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
}).refine((data) => {
  // Require either email or phone to be provided
  const hasEmail = data.email && data.email.trim() !== "";
  const hasPhone = data.phone && data.phone.trim() !== "";
  return hasEmail || hasPhone;
}, {
  message: "Either email or phone number is required",
  path: ["email"], // Show error on email field
});

type ContactFormData = z.infer<typeof contactFormSchema>;

// Helper function to parse estimated monthly volume into annual value
const parseEstimatedValue = (monthlyVolume: string): number => {
  // Remove currency symbols and spaces
  const cleanValue = monthlyVolume.replace(/[£$€,\s]/g, "");

  // Handle ranges like "5000-25000" or "5,000 - 25,000"
  if (cleanValue.includes("-")) {
    const [min, max] = cleanValue.split("-").map(val => parseFloat(val.trim()));
    if (!isNaN(min) && !isNaN(max)) {
      // Return midpoint of range * 12 months
      return ((min + max) / 2) * 12;
    }
  }

  // Handle "500000+" format
  if (cleanValue.includes("+")) {
    const baseValue = parseFloat(cleanValue.replace("+", ""));
    if (!isNaN(baseValue)) {
      // Use the base value for "+" ranges * 12 months
      return baseValue * 12;
    }
  }

  // Handle single numeric values
  const numericValue = parseFloat(cleanValue);
  if (!isNaN(numericValue)) {
    return numericValue * 12;
  }

  // Default fallback if parsing fails
  return 0;
};

const getInitialFormData = (contact?: Contact): ContactFormData => ({
  partnerId: "", // Will be set by the backend from session
  firstName: contact?.firstName || "",
  lastName: contact?.lastName || "",
  email: contact?.email || "",
  phone: contact?.phone || "",
  company: contact?.company || "",
  jobTitle: contact?.jobTitle || "",
  businessType: contact?.businessType || "",
  contactSource: contact?.contactSource || "",
  tags: contact?.tags || [],
  notes: contact?.notes || "",
  interestedProducts: contact?.interestedProducts || [],
  estimatedMonthlyVolume: contact?.estimatedMonthlyVolume || "",
  preferredContactMethod: contact?.preferredContactMethod || "email",
  lastContact: contact?.lastContact || undefined,
  nextFollowUp: contact?.nextFollowUp || undefined,
  addressLine1: contact?.addressLine1 || "",
  addressLine2: contact?.addressLine2 || "",
  city: contact?.city || "",
  postcode: contact?.postcode || "",
  country: contact?.country || "gb"
});

const contactSources = [
  "Referral",
  "Networking",
  "Cold Outreach",
  "Website",
  "Social Media",
  "Event",
  "Partner",
  "Other"
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

const productCategories = [
  { id: 'card-machines', name: 'Card Machines', icon: CreditCard },
  { id: 'business-funding', name: 'Business Funding', icon: DollarSign },
  { id: 'utilities', name: 'Utilities', icon: Zap },
  { id: 'insurance', name: 'Insurance', icon: Shield },
  { id: 'pos-systems', name: 'POS Systems', icon: Monitor },
  { id: 'restaurant-bookings', name: 'Restaurant Bookings', icon: Calendar },
  { id: 'website', name: 'Website', icon: Globe },
  { id: 'marketing-ai', name: 'Marketing and AI automation', icon: Sparkles }
];

const monthlyVolumeOptions = [
  "£0 - £5,000",
  "£5,000 - £25,000",
  "£25,000 - £100,000",
  "£100,000 - £500,000",
  "£500,000+"
];

function ContactForm({
  contact,
  onClose,
  onSave
}: {
  contact?: Contact;
  onClose: () => void;
  onSave: (data: ContactFormData) => void;
}) {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: getInitialFormData(contact),
  });

  const onSubmit = (data: ContactFormData) => {
    onSave(data);
  };

  const toggleProductInterest = (product: string) => {
    const current = form.getValues("interestedProducts") || [];
    const updated = current.includes(product)
      ? current.filter(p => p !== product)
      : [...current, product];
    form.setValue("interestedProducts", updated);
  };

  return (
    <div className="max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900 rounded-2xl p-6">
      {/* Modern Dialog Header */}
      <div className="text-center mb-8 pb-6 border-b border-gradient-to-r from-gray-200 to-slate-300 dark:from-gray-700 dark:to-gray-600">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-teal-800 dark:from-white dark:via-green-200 dark:to-teal-200 bg-clip-text text-transparent mb-2">
          {contact ? "Edit Contact" : "Add New Contact"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          {contact ? "Update the contact information below" : "Fill in the details to add a new contact to your network"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Tabs defaultValue="contact-info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-gray-100 to-slate-200 dark:from-gray-800 dark:to-gray-700 p-1 rounded-xl shadow-lg">
              <TabsTrigger
                value="contact-info"
                data-testid="tab-contact-info"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold transition-all duration-200"
              >
                Contact Info
              </TabsTrigger>
              <TabsTrigger
                value="product-interest"
                data-testid="tab-product-interest"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold transition-all duration-200"
              >
                Product Interest
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                data-testid="tab-notes"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold transition-all duration-200"
              >
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contact-info" className="space-y-6 mt-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-gray-900 dark:text-white font-semibold text-sm">First Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-first-name"
                          placeholder="Enter first name"
                          className="border-gray-300 dark:border-gray-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 rounded-lg h-11 text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm transition-all duration-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-last-name"
                          placeholder="Enter last name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          data-testid="input-email"
                          placeholder="Enter email address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-phone"
                          placeholder="Enter phone number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Visual separator and Business Info heading */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-green-600" />
                  Business Information
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-company"
                          placeholder="Enter company name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-job-title"
                          placeholder="Enter job title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-business-type">
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {businessTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-source">
                            <SelectValue placeholder="Select contact source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contactSources.map(source => (
                            <SelectItem key={source} value={source}>{source}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Address Line 1</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="input-address-line1"
                        placeholder="Enter business address line 1"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Address Line 2</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="input-address-line2"
                        placeholder="Enter business address line 2 (optional)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-city"
                          placeholder="Enter city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-postcode"
                          placeholder="Enter postcode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gb">United Kingdom</SelectItem>
                          <SelectItem value="ie">Ireland</SelectItem>
                          <SelectItem value="us">United States</SelectItem>
                          <SelectItem value="ca">Canada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="product-interest" className="space-y-6 mt-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <div>
                <Label className="text-lg font-semibold text-gray-900 dark:text-white mb-4 block">Product Interests</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productCategories.map(product => {
                    const currentValues = form.watch("interestedProducts") || [];
                    const isSelected = currentValues.includes(product.name);
                    const IconComponent = product.icon;
                    return (
                      <div
                        key={product.id}
                        onClick={() => toggleProductInterest(product.name)}
                        className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all ${isSelected
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        data-testid={`product-card-${product.id}`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle className="w-6 h-6 text-teal-600" />
                          </div>
                        )}
                        <div className="mb-3">
                          <IconComponent className="w-8 h-8 text-teal-600" />
                        </div>
                        <h5 className="font-semibold text-gray-900 dark:text-white text-sm">{product.name}</h5>
                      </div>
                    );
                  })}
                </div>
              </div>

              <FormField
                control={form.control}
                name="estimatedMonthlyVolume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Monthly Volume</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-monthly-volume">
                          <SelectValue placeholder="Select monthly volume" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {monthlyVolumeOptions.map(volume => (
                          <SelectItem key={volume} value={volume}>{volume}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredContactMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Contact Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-contact-method">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="meeting">In-Person Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="notes" className="space-y-6 mt-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-semibold text-gray-900 dark:text-white">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Add notes about this contact..."
                        className="min-h-[200px] resize-y"
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
          </Tabs>

          {/* Modern Submit Buttons */}
          <div className="flex justify-end space-x-4 pt-8 mt-8 border-t border-gradient-to-r from-gray-200 to-slate-300 dark:from-gray-700 dark:to-gray-600">
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
              data-testid="button-save-contact"
              className="h-12 px-8 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl font-bold shadow-xl transition-all duration-200 transform hover:scale-105 hover:shadow-2xl"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? (contact ? "🔄 Updating..." : "🔄 Creating...")
                : (contact ? "📝 Update Contact" : "⭐ Create Contact")
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterBy, setFilterBy] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Query for contacts
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/contacts");
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      return response.json();
    },
  });

  // Query for opportunities to create contact-opportunity mapping
  const { data: opportunities = [] } = useQuery({
    queryKey: ['/api/opportunities'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opportunities");
      if (!response.ok) {
        throw new Error('Failed to fetch opportunities');
      }
      return response.json();
    },
  });

  // Create mapping of contactId to opportunityId
  const contactOpportunityMap = opportunities.reduce((map: Record<string, string>, opportunity: any) => {
    if (opportunity.contactId) {
      map[opportunity.contactId] = opportunity.id;
    }
    return map;
  }, {});

  const filteredAndSortedContacts = contacts
    .filter((contact: Contact) => {
      const matchesSearch = `${contact.firstName} ${contact.lastName} ${contact.email} ${contact.company}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (filterBy === "all") return matchesSearch;
      // Add more filter logic here
      return matchesSearch;
    })
    .sort((a: Contact, b: Contact) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = `${a.firstName} ${a.lastName}`;
          bValue = `${b.firstName} ${b.lastName}`;
          break;
        case "company":
          aValue = a.company || "";
          bValue = b.company || "";
          break;
        case "createdAt":
          aValue = new Date(a.createdAt || new Date());
          bValue = new Date(b.createdAt || new Date());
          break;
        default:
          aValue = a.firstName;
          bValue = b.firstName;
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/contacts", data);
      if (!response.ok) {
        throw new Error('Failed to create contact');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContactFormData }) => {
      const response = await apiRequest("PUT", `/api/contacts/${id}`, data);
      if (!response.ok) {
        throw new Error('Failed to update contact');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      setSelectedContact(null);
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/contacts/${id}`);
      if (!response.ok) {
        throw new Error('Failed to delete contact');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Convert contact to opportunity mutation
  const convertToOpportunityMutation = useMutation({
    mutationFn: async (contact: Contact) => {
      const opportunityData = {
        businessName: contact.company || `${contact.firstName} ${contact.lastName}`,
        businessType: contact.businessType || "other",
        status: "prospect",
        stage: "initial_contact",
        priority: "medium",
        notes: `Converted from contact: ${contact.notes || "No notes"}`,
        estimatedValue: contact.estimatedMonthlyVolume ? parseEstimatedValue(contact.estimatedMonthlyVolume).toString() : "",
        productInterest: contact.interestedProducts || [],
      };

      const response = await apiRequest("POST", `/api/contacts/${contact.id}/convert-to-opportunity`, { opportunityData });
      if (!response.ok) {
        throw new Error('Failed to convert contact to opportunity');
      }
      return response.json();
    },
    onSuccess: (data, contact) => {
      toast({
        title: "Success",
        description: "Contact successfully converted to opportunity! Check your opportunities pipeline.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      // Store the conversion information for this contact
      queryClient.setQueryData(['contact-opportunity-mapping'], (oldData: any) => {
        const newData = oldData || {};
        newData[contact.id] = data.id;
        return newData;
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert contact to opportunity",
        variant: "destructive",
      });
    },
  });

  const handleCreateContact = (data: ContactFormData) => {
    createContactMutation.mutate(data);
  };

  const handleUpdateContact = (data: ContactFormData) => {
    if (selectedContact?.id) {
      updateContactMutation.mutate({ id: selectedContact.id, data });
    }
  };

  const handleDeleteContact = (id: string) => {
    if (confirm("Are you sure you want to delete this contact? This action cannot be undone.")) {
      deleteContactMutation.mutate(id);
    }
  };

  const handleConvertToOpportunity = (contact: Contact) => {
    convertToOpportunityMutation.mutate(contact);
  };

  const handleGoToOpportunity = (opportunityId: string) => {
    // Navigate to opportunities page with the specific opportunity highlighted
    setLocation('/opportunities');
    // Store the opportunity ID to highlight in local storage for the opportunities page to pick up
    localStorage.setItem('highlightOpportunityId', opportunityId);
  };

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <p className="text-primary text-sm font-medium tracking-wide uppercase mb-2">Contact Management</p>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
                  Contacts
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage your business contacts and relationships
                </p>
              </div>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    data-testid="button-add-contact"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[95vh] !max-h-[95vh] overflow-y-auto !p-8">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Create New Contact</DialogTitle>
                  </DialogHeader>
                  <ContactForm
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleCreateContact}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search contacts by name, email, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-contacts"
                />
              </div>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="company">Sort by Company</SelectItem>
                    <SelectItem value="createdAt">Sort by Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  data-testid="button-sort-order"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
                <Select value={filterBy} onValueChange={setFilterBy}>
                  <SelectTrigger className="w-40" data-testid="select-filter-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="recent">Recent</SelectItem>
                    <SelectItem value="prospects">Prospects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contacts List */}
          <div className="grid gap-4">
            {filteredAndSortedContacts.length === 0 ? (
              <div className="rocket-card p-12 text-center">
                <div className="rocket-icon-box mx-auto mb-4">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No contacts found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first contact
                </p>
                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-create-first-contact"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Contact
                </Button>
              </div>
            ) : (
              filteredAndSortedContacts.map((contact: Contact) => (
                <div
                  key={contact.id}
                  className="rocket-card p-6 cursor-pointer hover:border-primary transition-all"
                  data-testid={`contact-card-${contact.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      <div className="w-14 h-14 bg-primary/20 border border-primary/30 rounded-full flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                        {contact.firstName.charAt(0)}{contact.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-foreground mb-1">
                          {contact.firstName} {contact.lastName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                          {contact.company && (
                            <div className="flex items-center">
                              <Building className="w-4 h-4 mr-1.5 flex-shrink-0" />
                              <span className="truncate">{contact.company}</span>
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-1.5 flex-shrink-0" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-1.5 flex-shrink-0" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                        {contact.interestedProducts && contact.interestedProducts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {contact.interestedProducts.slice(0, 3).map(product => (
                              <Badge key={product} variant="secondary" className="text-xs">
                                {product}
                              </Badge>
                            ))}
                            {contact.interestedProducts.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{contact.interestedProducts.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {contactOpportunityMap[contact.id] ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGoToOpportunity(contactOpportunityMap[contact.id])}
                          data-testid={`button-go-to-opportunity-${contact.id}`}
                          className="border-green-600/50 text-green-400 hover:bg-green-600/10 hover:border-green-500"
                        >
                          <ExternalLink className="w-4 h-4 mr-1.5" />
                          Go to Opportunity
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertToOpportunity(contact)}
                          disabled={convertToOpportunityMutation.isPending}
                          data-testid={`button-convert-${contact.id}`}
                          className="border-primary/50 text-primary hover:bg-primary/10 hover:border-primary"
                        >
                          {convertToOpportunityMutation.isPending ? "Converting..." : "Convert to Opportunity"}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${contact.id}`}>
                            <MoreHorizontal className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setSelectedContact(contact)}
                            data-testid={`menu-edit-${contact.id}`}
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit Contact
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteContact(contact.id)}
                            data-testid={`menu-delete-${contact.id}`}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Contact
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Edit Contact Dialog */}
          <Dialog
            open={!!selectedContact}
            onOpenChange={(open) => !open && setSelectedContact(null)}
          >
            <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[95vh] !max-h-[95vh] overflow-y-auto !p-8">
              <DialogHeader className="sr-only">
                <DialogTitle>
                  Edit Contact: {selectedContact?.firstName} {selectedContact?.lastName}
                </DialogTitle>
              </DialogHeader>
              {selectedContact && (
                <ContactForm
                  contact={selectedContact}
                  onClose={() => setSelectedContact(null)}
                  onSave={handleUpdateContact}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}