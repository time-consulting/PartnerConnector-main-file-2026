import { useState } from "react";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  GraduationCapIcon,
  BookOpenIcon,
  HelpCircleIcon,
  PlayCircleIcon,
  CheckCircleIcon,
  CreditCardIcon,
  UsersIcon,
  BarChartIcon,
  LightbulbIcon
} from "lucide-react";
import KnowledgeBase from "@/components/knowledge-base";
import DojoSalesTraining from "@/components/dojo-sales-training";
import PlatformUsageTraining from "@/components/platform-usage-training";
import { useToast } from "@/hooks/use-toast";

export default function Training() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("dashboard");

  const [userProgress, setUserProgress] = useState({
    completedModules: 15,
    totalModules: 24,
    certificationsEarned: 2
  });

  const handleModuleComplete = (moduleId: string) => {
    console.log('Module completed:', moduleId);
    setUserProgress(prev => ({
      ...prev,
      completedModules: prev.completedModules + 1
    }));

    toast({
      title: "Module Complete!",
      description: "Great work! Keep going to complete your training.",
    });
  };

  const progressPercentage = (userProgress.completedModules / userProgress.totalModules) * 100;

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />

      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'} p-4 lg:p-6`}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Simple Header */}
          <div className="text-center space-y-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Training Portal
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Complete your training to become a successful PartnerConnector partner
              </p>
            </div>

            {/* Simple Progress Card */}
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 shadow-lg max-w-2xl mx-auto">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <GraduationCapIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {userProgress.completedModules} of {userProgress.totalModules}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Modules Completed</div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-300 px-4 py-2 text-lg font-semibold" data-testid="badge-progress">
                      {progressPercentage.toFixed(0)}%
                    </Badge>
                  </div>

                  <div>
                    <Progress value={progressPercentage} className="h-3" data-testid="progress-bar" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                      {userProgress.totalModules - userProgress.completedModules} modules remaining
                    </p>
                  </div>

                  {progressPercentage >= 75 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                        You're doing great! Keep it up to complete your training.
                      </p>
                    </div>
                  )}

                  {progressPercentage < 25 && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center">
                      <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                        Get started with the Product Training to learn about Dojo and our offerings.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Navigation */}
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { id: 'dashboard', label: 'Overview', icon: <BarChartIcon className="w-4 h-4" /> },
                  { id: 'product-training', label: 'Product Training', icon: <CreditCardIcon className="w-4 h-4" /> },
                  { id: 'platform-training', label: 'Platform Training', icon: <UsersIcon className="w-4 h-4" /> },
                  { id: 'support', label: 'Support Hub', icon: <HelpCircleIcon className="w-4 h-4" /> }
                ].map((section) => (
                  <Button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    variant={activeSection === section.id ? 'default' : 'ghost'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeSection === section.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    data-testid={`nav-${section.id}`}
                  >
                    {section.icon}
                    <span className="hidden sm:inline">{section.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <div className="space-y-6">
            {/* Dashboard View */}
            {activeSection === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Progress Stats */}
                <Card className="bg-white dark:bg-slate-800 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      Modules Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        {userProgress.completedModules}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        out of {userProgress.totalModules} total
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCapIcon className="w-5 h-5 text-blue-600" />
                      Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        {userProgress.certificationsEarned}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        certificates earned
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpenIcon className="w-5 h-5 text-purple-600" />
                      In Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        {userProgress.totalModules - userProgress.completedModules}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        modules remaining
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Product Training - Full Dojo Component */}
            {activeSection === 'product-training' && (
              <div>
                <DojoSalesTraining />
              </div>
            )}

            {/* Platform Training */}
            {activeSection === 'platform-training' && (
              <div>
                <PlatformUsageTraining />
              </div>
            )}

            {/* Support Hub */}
            {activeSection === 'support' && (
              <Card className="bg-white dark:bg-slate-800 shadow-lg max-w-5xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <HelpCircleIcon className="w-7 h-7 text-blue-600" />
                    Support Hub
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Get help with your partnership questions and technical issues
                  </p>
                </CardHeader>
                <CardContent>
                  <KnowledgeBase />
                </CardContent>
              </Card>
            )}

            {/* Quick Start Guide */}
            {activeSection === 'dashboard' && (
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                    <PlayCircleIcon className="w-6 h-6" />
                    Quick Start Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button
                        onClick={() => setActiveSection('product-training')}
                        className="h-auto flex-col gap-3 py-6 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white border-2 border-blue-200 dark:border-blue-700"
                        variant="outline"
                        data-testid="quick-start-product"
                      >
                        <CreditCardIcon className="w-8 h-8 text-blue-600" />
                        <div className="text-center">
                          <div className="font-semibold">Learn about Dojo</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Products, features & benefits
                          </div>
                        </div>
                      </Button>

                      <Button
                        onClick={() => setActiveSection('platform-training')}
                        className="h-auto flex-col gap-3 py-6 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white border-2 border-purple-200 dark:border-purple-700"
                        variant="outline"
                        data-testid="quick-start-platform"
                      >
                        <UsersIcon className="w-8 h-8 text-purple-600" />
                        <div className="text-center">
                          <div className="font-semibold">Platform Basics</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            How to use PartnerConnector
                          </div>
                        </div>
                      </Button>

                      <Button
                        onClick={() => setActiveSection('support')}
                        className="h-auto flex-col gap-3 py-6 bg-white dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white border-2 border-green-200 dark:border-green-700"
                        variant="outline"
                        data-testid="quick-start-support"
                      >
                        <HelpCircleIcon className="w-8 h-8 text-green-600" />
                        <div className="text-center">
                          <div className="font-semibold">Get Help</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Resources & support
                          </div>
                        </div>
                      </Button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Welcome to Your Training Journey
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Complete the training modules to learn everything you need to know about Dojo payment solutions
                        and how to use the PartnerConnector platform effectively. Take your time and refer back to these
                        resources whenever you need them.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
