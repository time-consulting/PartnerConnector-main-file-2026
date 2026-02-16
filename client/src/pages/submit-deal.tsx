import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  DollarSign,
  Bot,
  Monitor,
  Globe,
  Calendar,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  FileText,
  AlertCircle,
  Sparkles,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Info,
  Megaphone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

const services = [
  { id: 'card-payments', name: 'Card Payments', icon: CreditCard, description: 'Accept card payments with competitive rates', gradient: 'from-rose-500 via-pink-500 to-purple-500' },
  { id: 'business-funding', name: 'Business Funding', icon: DollarSign, description: 'Fast business loans and funding solutions', gradient: 'from-lime-400 via-green-500 to-emerald-600' },
  { id: 'business-automation', name: 'Business Automation', icon: Bot, description: 'Automate workflows with AI technology', gradient: 'from-violet-500 via-purple-500 to-fuchsia-500' },
  { id: 'epos', name: 'EPOS', icon: Monitor, description: 'Modern point of sale systems', gradient: 'from-cyan-400 via-blue-500 to-indigo-600' },
  { id: 'websites', name: 'Websites', icon: Globe, description: 'Professional website design and hosting', gradient: 'from-amber-400 via-orange-500 to-red-500' },
  { id: 'bookings', name: 'Bookings', icon: Calendar, description: 'Table reservation & booking management', gradient: 'from-teal-400 via-cyan-500 to-blue-500' },
  { id: 'marketing', name: 'Marketing', icon: Megaphone, description: 'Social media, digital marketing & campaigns', gradient: 'from-pink-400 via-rose-500 to-red-500' },
];

const volumeOptions = [
  { id: 'new-business', label: 'New Business', description: 'Just starting out' },
  { id: 'up-to-10k', label: 'Up to £10k', description: 'Small volume' },
  { id: '10k-30k', label: '£10k - £30k', description: 'Growing business' },
  { id: '30k-50k', label: '£30k - £50k', description: 'Established' },
  { id: '50k-100k', label: '£50k - £100k', description: 'High volume' },
  { id: '100k-plus', label: '£100k+', description: 'Enterprise' },
];

const cardMachineOptions = [
  { id: '1', label: '1 Terminal' },
  { id: '2', label: '2 Terminals' },
  { id: '3', label: '3 Terminals' },
  { id: '4', label: '4 Terminals' },
  { id: '5-plus', label: '5+ Terminals' },
];

const fundingAmountOptions = [
  { id: 'up-to-10k', label: 'Up to £10k' },
  { id: '10k-25k', label: '£10k - £25k' },
  { id: '25k-50k', label: '£25k - £50k' },
  { id: '50k-100k', label: '£50k - £100k' },
  { id: '100k-250k', label: '£100k - £250k' },
  { id: '250k-plus', label: '£250k+' },
];

const cardProviderOptions = [
  { id: 'dojo', label: 'Dojo' },
  { id: 'worldpay', label: 'Worldpay' },
  { id: 'take_payments', label: 'Take Payments' },
  { id: 'teya', label: 'Teya' },
  { id: 'sumup_square', label: 'Sum Up / Square' },
  { id: 'clover', label: 'Clover' },
  { id: 'other', label: 'Other' },
];

export default function SubmitDeal() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>('');
  const [businessTypeId, setBusinessTypeId] = useState<string>('');
  const [cardMachines, setCardMachines] = useState<string>('');
  const [fundingAmount, setFundingAmount] = useState<string>('');
  const [showCardMachineDialog, setShowCardMachineDialog] = useState(false);
  const [takesCardPayments, setTakesCardPayments] = useState<string>(''); // 'yes' | 'no' | ''
  const [currentCardProvider, setCurrentCardProvider] = useState<string>('');

  // Fetch business types
  const { data: businessTypes = [] } = useQuery<{ id: string; name: string; description: string }[]>({
    queryKey: ["/api/business-types"],
  });

  // Client info
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);

  // Files
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const isNewBusiness = selectedVolume === 'new-business';
  const hasCardPayments = selectedServices.includes('card-payments');
  const hasBusinessFunding = selectedServices.includes('business-funding');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const submitDealMutation = useMutation({
    mutationFn: async ({ dealData, files }: { dealData: any; files: File[] }) => {
      const response = await apiRequest("POST", "/api/deals", dealData);
      const deal = await response.json();

      if (files && files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('bills', file);
        });

        await fetch(`/api/deals/${deal?.id}/upload-bill`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      }

      return deal;
    },
    onSuccess: (deal: any) => {
      const isAutoQuoted = deal?.dealStage === 'quote_sent' && deal?.quoteType === 'business_funding';
      toast({
        title: isAutoQuoted ? "Deal Submitted & Quote Ready!" : "Deal Submitted!",
        description: isAutoQuoted
          ? "Your funding request has been submitted. View your deal to see next steps and complete the application."
          : "Your deal has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals/with-quotes"] });
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit deal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(s => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const canProceedStep1 = selectedServices.length > 0;
  const canProceedStep2 = selectedVolume !== '' &&
    (!hasCardPayments || cardMachines !== '') &&
    (!hasBusinessFunding || fundingAmount !== '');
  const canProceedStep3 = businessName && contactName && businessEmail && businessAddress;
  const canSubmit = gdprConsent;

  const handleNext = () => {
    if (currentStep === 1 && hasCardPayments && !cardMachines) {
      setShowCardMachineDialog(true);
      return;
    }
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleSubmit = () => {
    // Determine product type based on selected services
    // Priority: business_funding > card_payments > others
    let determinedProductType = 'card_payments';
    if (selectedServices.includes('business-funding')) {
      determinedProductType = 'business_funding';
    } else if (selectedServices.includes('card-payments')) {
      determinedProductType = 'card_payments';
    } else if (selectedServices.length > 0) {
      const serviceToProductType: Record<string, string> = {
        'bookings': 'bookings',
        'websites': 'websites',
        'business-automation': 'business_automation',
        'marketing': 'marketing',
        'epos': 'epos',
      };
      determinedProductType = serviceToProductType[selectedServices[0]] || 'card_payments';
    }

    const dealData: any = {
      businessName,
      contactName,
      businessEmail,
      businessPhone,
      businessAddress,
      businessTypeId: businessTypeId || null,
      selectedProducts: selectedServices,
      productType: determinedProductType,
      monthlyVolume: selectedVolume,
      cardMachineQuantity: cardMachines ? parseInt(cardMachines) || 5 : 0,
      fundingAmount: fundingAmount,
      notes,
      gdprConsent,
      isNewBusiness,
    };

    // Include business funding specific fields
    if (hasBusinessFunding) {
      dealData.takesCardPayments = takesCardPayments === 'yes';
      dealData.currentCardProvider = takesCardPayments === 'yes' ? currentCardProvider : null;
    }

    submitDealMutation.mutate({ dealData, files: uploadedFiles });
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400/30 border-t-lime-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 1, title: 'Select Services' },
    { id: 2, title: 'Business Details' },
    { id: 3, title: 'Client Info' },
    { id: 4, title: 'Review & Submit' },
  ];

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <Sidebar onExpandChange={setSidebarExpanded} />

      <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-lime-400 to-green-500 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Submit a Deal</h1>
            </div>
            <p className="text-gray-500">Connect businesses with the right solutions and earn commissions</p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-2xl">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${currentStep > step.id
                      ? 'bg-lime-500 text-white'
                      : currentStep === step.id
                        ? 'bg-gradient-to-br from-lime-400 to-green-500 text-white'
                        : 'bg-[#2a3441] text-gray-500'
                      }`}>
                      {currentStep > step.id ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="font-semibold">{step.id}</span>
                      )}
                    </div>
                    <span className={`text-xs mt-2 ${currentStep >= step.id ? 'text-white' : 'text-gray-600'}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-1 mx-2 rounded ${currentStep > step.id ? 'bg-lime-500' : 'bg-[#2a3441]'
                      }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Select Services */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Select Services</h2>
                    <p className="text-gray-400 mb-6">Choose the services your client needs (select multiple)</p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {services.map((service) => {
                        const isSelected = selectedServices.includes(service.id);
                        return (
                          <div
                            key={service.id}
                            onClick={() => toggleService(service.id)}
                            className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all hover:scale-[1.02] ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1f26]' : ''
                              }`}
                            data-testid={`service-card-${service.id}`}
                          >
                            <div className={`bg-gradient-to-br ${service.gradient} p-5 h-full`}>
                              {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                              )}
                              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
                                <service.icon className="w-6 h-6 text-white" />
                              </div>
                              <h3 className="font-semibold text-white text-lg mb-1">{service.name}</h3>
                              <p className="text-white/70 text-xs line-clamp-2">{service.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedServices.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        <span className="text-gray-400 text-sm">Selected:</span>
                        {selectedServices.map(id => {
                          const service = services.find(s => s.id === id);
                          return (
                            <Badge key={id} className="bg-lime-500/20 text-lime-400 border-lime-400/30">
                              {service?.name}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    onClick={handleNext}
                    disabled={!canProceedStep1}
                    className="bg-gradient-to-r from-lime-400 to-green-500 text-black font-semibold hover:from-lime-500 hover:to-green-600 disabled:opacity-50"
                    data-testid="button-next-step1"
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Business Details */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Volume Selection */}
                <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">What's the approximate business volume each month?</h2>
                    <p className="text-gray-400 mb-6">Select the monthly card transaction volume</p>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {volumeOptions.map((option) => {
                        const isSelected = selectedVolume === option.id;
                        return (
                          <div
                            key={option.id}
                            onClick={() => setSelectedVolume(option.id)}
                            className={`cursor-pointer rounded-xl p-4 text-center transition-all border-2 ${isSelected
                              ? 'bg-lime-500/20 border-lime-500 text-white'
                              : 'bg-[#2a3441] border-transparent text-gray-300 hover:border-gray-500'
                              }`}
                            data-testid={`volume-option-${option.id}`}
                          >
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-lime-400 mx-auto mb-2" />
                            )}
                            <p className="font-semibold text-sm">{option.label}</p>
                            <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Business Type Selection */}
                <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                      <Building className="w-5 h-5 text-amber-400" />
                      What type of business is this?
                    </h2>
                    <p className="text-gray-400 mb-6">Select the business category</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {businessTypes.map((type) => {
                        const isSelected = businessTypeId === type.id;
                        return (
                          <div
                            key={type.id}
                            onClick={() => setBusinessTypeId(type.id)}
                            className={`cursor-pointer rounded-xl p-4 transition-all border-2 ${isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-white'
                              : 'bg-[#2a3441] border-transparent text-gray-300 hover:border-gray-500'
                              }`}
                            data-testid={`business-type-${type.id}`}
                          >
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-amber-400 mb-2" />
                            )}
                            <p className="font-semibold text-sm">{type.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Card Machines Question - Only if Card Payments selected */}
                {hasCardPayments && (
                  <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                    <CardContent className="p-6">
                      <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-pink-400" />
                        How many card machines do they need?
                      </h2>
                      <p className="text-gray-400 mb-6">Select the number of terminals required</p>

                      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                        {cardMachineOptions.map((option) => {
                          const isSelected = cardMachines === option.id;
                          return (
                            <div
                              key={option.id}
                              onClick={() => setCardMachines(option.id)}
                              className={`cursor-pointer rounded-xl p-4 text-center transition-all border-2 ${isSelected
                                ? 'bg-pink-500/20 border-pink-500 text-white'
                                : 'bg-[#2a3441] border-transparent text-gray-300 hover:border-gray-500'
                                }`}
                              data-testid={`card-machine-option-${option.id}`}
                            >
                              {isSelected && (
                                <CheckCircle className="w-5 h-5 text-pink-400 mx-auto mb-2" />
                              )}
                              <p className="font-semibold text-sm">{option.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Funding Amount Question - Only if Business Funding selected */}
                {hasBusinessFunding && (
                  <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                    <CardContent className="p-6">
                      <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        How much funding do they require?
                      </h2>
                      <p className="text-gray-400 mb-6">Select the approximate funding amount needed</p>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {fundingAmountOptions.map((option) => {
                          const isSelected = fundingAmount === option.id;
                          return (
                            <div
                              key={option.id}
                              onClick={() => setFundingAmount(option.id)}
                              className={`cursor-pointer rounded-xl p-4 text-center transition-all border-2 ${isSelected
                                ? 'bg-green-500/20 border-green-500 text-white'
                                : 'bg-[#2a3441] border-transparent text-gray-300 hover:border-gray-500'
                                }`}
                              data-testid={`funding-option-${option.id}`}
                            >
                              {isSelected && (
                                <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-2" />
                              )}
                              <p className="font-semibold text-sm">{option.label}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Card Payments Question */}
                      <div className="mt-6 pt-6 border-t border-[#2a3441]">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-pink-400" />
                          Does the business take card payments?
                        </h3>
                        <p className="text-gray-400 mb-4 text-sm">This helps us identify cross-sell opportunities</p>

                        <div className="grid grid-cols-2 gap-3 max-w-xs">
                          {[
                            { id: 'yes', label: 'Yes' },
                            { id: 'no', label: 'No' },
                          ].map((option) => {
                            const isSelected = takesCardPayments === option.id;
                            return (
                              <div
                                key={option.id}
                                onClick={() => {
                                  setTakesCardPayments(option.id);
                                  if (option.id === 'no') setCurrentCardProvider('');
                                }}
                                className={`cursor-pointer rounded-xl p-4 text-center transition-all border-2 ${isSelected
                                  ? 'bg-green-500/20 border-green-500 text-white'
                                  : 'bg-[#2a3441] border-transparent text-gray-300 hover:border-gray-500'
                                  }`}
                                data-testid={`card-payments-${option.id}`}
                              >
                                {isSelected && (
                                  <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-2" />
                                )}
                                <p className="font-semibold text-sm">{option.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Provider Dropdown - Only if they take card payments */}
                      {takesCardPayments === 'yes' && (
                        <div className="mt-4">
                          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-pink-400" />
                            Who is their current card provider?
                          </h3>
                          <select
                            value={currentCardProvider}
                            onChange={(e) => setCurrentCardProvider(e.target.value)}
                            className="w-full max-w-md bg-[#2a3441] border border-[#3a4451] text-white h-12 rounded-xl px-4 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                            data-testid="select-card-provider"
                          >
                            <option value="" className="bg-[#2a3441]">Select a provider...</option>
                            {cardProviderOptions.map((option) => (
                              <option key={option.id} value={option.id} className="bg-[#2a3441]">
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Bill Upload Section - Only if NOT a new business */}
                {selectedVolume && !isNewBusiness && (
                  <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                    <CardContent className="p-6">
                      <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-cyan-400" />
                        Upload Current Processor Bill
                      </h2>
                      <p className="text-gray-400 mb-6">Upload their current payment processing statement for comparison (optional)</p>

                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleFileDrop}
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-[#2a3441] hover:border-gray-500'
                          }`}
                      >
                        <Upload className="w-10 h-10 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">Drag and drop files here or</p>
                        <label className="cursor-pointer">
                          <span className="text-cyan-400 hover:text-cyan-300 underline">browse files</span>
                          <input
                            type="file"
                            multiple
                            onChange={handleFileInput}
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            data-testid="input-file-upload"
                          />
                        </label>
                        <p className="text-gray-600 text-xs mt-2">PDF, JPG, PNG up to 10MB</p>
                      </div>

                      {uploadedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-[#2a3441] rounded-lg px-4 py-3">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-cyan-400" />
                                <span className="text-white text-sm">{file.name}</span>
                                <span className="text-gray-500 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-400">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* New Business Notice */}
                {isNewBusiness && (
                  <Card className="bg-gradient-to-r from-lime-500/10 to-green-500/10 border-lime-500/30 rounded-2xl mb-6">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-lime-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Info className="w-5 h-5 text-lime-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-1">New Business - No Bill Needed</h3>
                          <p className="text-gray-400 text-sm">
                            Since this is a new business, there's no need to upload a bill from a current payment processor. We'll help them get set up from scratch!
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-between">
                  <Button
                    onClick={() => setCurrentStep(1)}
                    variant="outline"
                    className="border-[#2a3441] text-gray-300 hover:bg-[#2a3441]"
                    data-testid="button-back-step2"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceedStep2}
                    className="bg-gradient-to-r from-lime-400 to-green-500 text-black font-semibold hover:from-lime-500 hover:to-green-600 disabled:opacity-50"
                    data-testid="button-next-step2"
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Client Info */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Client Information</h2>
                    <p className="text-gray-400 mb-6">Enter the client's contact details</p>

                    <div className="space-y-4">
                      {/* Business Name */}
                      <div>
                        <Label className="text-gray-300 mb-2 flex items-center gap-2">
                          <Building className="w-4 h-4 text-purple-400" />
                          Business Name *
                        </Label>
                        <Input
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="e.g., ABC Coffee Shop"
                          className="bg-[#2a3441] border-[#3a4451] text-white placeholder:text-gray-500 h-12 rounded-xl"
                          data-testid="input-business-name"
                        />
                      </div>

                      {/* Contact Name */}
                      <div>
                        <Label className="text-gray-300 mb-2 flex items-center gap-2">
                          <User className="w-4 h-4 text-cyan-400" />
                          Contact Name *
                        </Label>
                        <Input
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g., John Smith"
                          className="bg-[#2a3441] border-[#3a4451] text-white placeholder:text-gray-500 h-12 rounded-xl"
                          data-testid="input-contact-name"
                        />
                      </div>

                      {/* Email & Phone */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300 mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-pink-400" />
                            Email Address *
                          </Label>
                          <Input
                            type="email"
                            value={businessEmail}
                            onChange={(e) => setBusinessEmail(e.target.value)}
                            placeholder="contact@business.com"
                            className="bg-[#2a3441] border-[#3a4451] text-white placeholder:text-gray-500 h-12 rounded-xl"
                            data-testid="input-business-email"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300 mb-2 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-green-400" />
                            Phone Number
                          </Label>
                          <Input
                            type="tel"
                            value={businessPhone}
                            onChange={(e) => setBusinessPhone(e.target.value)}
                            placeholder="+44 20 1234 5678"
                            className="bg-[#2a3441] border-[#3a4451] text-white placeholder:text-gray-500 h-12 rounded-xl"
                            data-testid="input-business-phone"
                          />
                        </div>
                      </div>

                      {/* Business Address */}
                      <div>
                        <Label className="text-gray-300 mb-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-amber-400" />
                          Business Address
                        </Label>
                        <Textarea
                          value={businessAddress}
                          onChange={(e) => setBusinessAddress(e.target.value)}
                          placeholder="Enter full business address"
                          rows={3}
                          className="bg-[#2a3441] border-[#3a4451] text-white placeholder:text-gray-500 rounded-xl"
                          data-testid="textarea-business-address"
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <Label className="text-gray-300 mb-2">Additional Notes</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any additional information about the client..."
                          rows={3}
                          className="bg-[#2a3441] border-[#3a4451] text-white placeholder:text-gray-500 rounded-xl"
                          data-testid="textarea-notes"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button
                    onClick={() => setCurrentStep(2)}
                    variant="outline"
                    className="border-[#2a3441] text-gray-300 hover:bg-[#2a3441]"
                    data-testid="button-back-step3"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceedStep3}
                    className="bg-gradient-to-r from-lime-400 to-green-500 text-black font-semibold hover:from-lime-500 hover:to-green-600 disabled:opacity-50"
                    data-testid="button-next-step3"
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl mb-6">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                      Review Your Deal
                    </h2>
                    <p className="text-gray-400 mb-6">Please review the information before submitting</p>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Services */}
                      <div className="bg-[#2a3441] rounded-xl p-4">
                        <h3 className="text-gray-400 text-sm mb-2">Selected Services</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedServices.map(id => {
                            const service = services.find(s => s.id === id);
                            return (
                              <Badge key={id} className={`bg-gradient-to-r ${service?.gradient} text-white border-0`}>
                                {service?.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Volume */}
                      <div className="bg-[#2a3441] rounded-xl p-4">
                        <h3 className="text-gray-400 text-sm mb-2">Monthly Volume</h3>
                        <p className="text-white font-semibold">{volumeOptions.find(v => v.id === selectedVolume)?.label}</p>
                      </div>

                      {/* Client */}
                      <div className="bg-[#2a3441] rounded-xl p-4">
                        <h3 className="text-gray-400 text-sm mb-2">Client</h3>
                        <p className="text-white font-semibold">{businessName}</p>
                        <p className="text-gray-400 text-sm">{contactName}</p>
                      </div>

                      {/* Contact */}
                      <div className="bg-[#2a3441] rounded-xl p-4">
                        <h3 className="text-gray-400 text-sm mb-2">Contact</h3>
                        <p className="text-white text-sm">{businessEmail}</p>
                        {businessPhone && <p className="text-gray-400 text-sm">{businessPhone}</p>}
                      </div>

                      {/* Card Machines */}
                      {hasCardPayments && cardMachines && (
                        <div className="bg-[#2a3441] rounded-xl p-4">
                          <h3 className="text-gray-400 text-sm mb-2">Card Machines</h3>
                          <p className="text-white font-semibold">{cardMachineOptions.find(c => c.id === cardMachines)?.label}</p>
                        </div>
                      )}

                      {/* Funding */}
                      {hasBusinessFunding && fundingAmount && (
                        <div className="bg-[#2a3441] rounded-xl p-4">
                          <h3 className="text-gray-400 text-sm mb-2">Funding Required</h3>
                          <p className="text-white font-semibold">{fundingAmountOptions.find(f => f.id === fundingAmount)?.label}</p>
                          {takesCardPayments && (
                            <div className="mt-2 pt-2 border-t border-[#3a4451]">
                              <p className="text-gray-400 text-xs">Takes Card Payments</p>
                              <p className="text-white text-sm font-medium">{takesCardPayments === 'yes' ? 'Yes' : 'No'}</p>
                              {takesCardPayments === 'yes' && currentCardProvider && (
                                <>
                                  <p className="text-gray-400 text-xs mt-1">Current Provider</p>
                                  <p className="text-white text-sm font-medium">{cardProviderOptions.find(p => p.id === currentCardProvider)?.label}</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Files */}
                      {uploadedFiles.length > 0 && (
                        <div className="bg-[#2a3441] rounded-xl p-4">
                          <h3 className="text-gray-400 text-sm mb-2">Uploaded Documents</h3>
                          <p className="text-white text-sm">{uploadedFiles.length} file(s) attached</p>
                        </div>
                      )}
                    </div>

                    {/* GDPR Consent */}
                    <div className="bg-[#2a3441] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="gdpr"
                          checked={gdprConsent}
                          onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
                          className="mt-1 border-gray-500 data-[state=checked]:bg-lime-500 data-[state=checked]:border-lime-500"
                          data-testid="checkbox-gdpr"
                        />
                        <Label htmlFor="gdpr" className="text-gray-300 text-sm cursor-pointer">
                          I confirm that I have the client's permission to share their information and they have agreed to be contacted regarding payment processing solutions. *
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button
                    onClick={() => setCurrentStep(3)}
                    variant="outline"
                    className="border-[#2a3441] text-gray-300 hover:bg-[#2a3441]"
                    data-testid="button-back-step4"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitDealMutation.isPending}
                    className="bg-gradient-to-r from-lime-400 to-green-500 text-black font-semibold hover:from-lime-500 hover:to-green-600 disabled:opacity-50 min-w-32"
                    data-testid="button-submit-deal"
                  >
                    {submitDealMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        Submit Deal <CheckCircle className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Card Machine Dialog */}
      <Dialog open={showCardMachineDialog} onOpenChange={setShowCardMachineDialog}>
        <DialogContent className="bg-[#1a1f26] border-[#2a3441] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-pink-400" />
              Card Machines Required
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              How many card machines does the client need?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {cardMachineOptions.map((option) => {
              const isSelected = cardMachines === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => setCardMachines(option.id)}
                  className={`cursor-pointer rounded-xl p-4 text-center transition-all border-2 ${isSelected
                    ? 'bg-pink-500/20 border-pink-500 text-white'
                    : 'bg-[#2a3441] border-transparent text-gray-300 hover:border-gray-500'
                    }`}
                >
                  <p className="font-semibold text-sm">{option.label}</p>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => {
              setShowCardMachineDialog(false);
              if (cardMachines) setCurrentStep(2);
            }}
            disabled={!cardMachines}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white"
          >
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
