import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Star, HelpCircle, Bug, Lightbulb } from "lucide-react";

export default function FeedbackPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    type: "",
    subject: "",
    message: "",
    priority: "medium",
    rating: ""
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/account/feedback", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback. We'll get back to you within 24 hours.",
      });
      setFormData({
        type: "",
        subject: "",
        message: "",
        priority: "medium",
        rating: ""
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.subject || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    submitFeedbackMutation.mutate(formData);
  };

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />

      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'} max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-8 h-8" />
            Feedback & Support
          </h1>
          <p className="text-muted-foreground mt-2">Submit support requests or share feedback about our platform</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Submit Feedback or Support Request</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="type">Type of Request *</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger data-testid="select-feedback-type">
                        <SelectValue placeholder="Select request type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">Technical Support</SelectItem>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="general">General Feedback</SelectItem>
                        <SelectItem value="account">Account Issue</SelectItem>
                        <SelectItem value="payment">Payment Issue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority Level</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - General question</SelectItem>
                        <SelectItem value="medium">Medium - Normal issue</SelectItem>
                        <SelectItem value="high">High - Urgent issue</SelectItem>
                        <SelectItem value="critical">Critical - System down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Brief description of your request"
                      data-testid="input-subject"
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Please provide as much detail as possible..."
                      data-testid="textarea-message"
                    />
                  </div>

                  {formData.type === "general" && (
                    <div>
                      <Label htmlFor="rating">Platform Rating (Optional)</Label>
                      <Select value={formData.rating} onValueChange={(value) => setFormData({ ...formData, rating: value })}>
                        <SelectTrigger data-testid="select-rating">
                          <SelectValue placeholder="Rate your experience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent</SelectItem>
                          <SelectItem value="4">⭐⭐⭐⭐ Good</SelectItem>
                          <SelectItem value="3">⭐⭐⭐ Average</SelectItem>
                          <SelectItem value="2">⭐⭐ Poor</SelectItem>
                          <SelectItem value="1">⭐ Very Poor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full md:w-auto flex items-center gap-2"
                    disabled={submitFeedbackMutation.isPending}
                    data-testid="button-submit-feedback"
                  >
                    <Send className="w-4 h-4" />
                    {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Quick Help
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Bug className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Technical Issues</h4>
                    <p className="text-sm text-muted-foreground">Report bugs or system problems</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Feature Requests</h4>
                    <p className="text-sm text-muted-foreground">Suggest new features or improvements</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">General Feedback</h4>
                    <p className="text-sm text-muted-foreground">Share your overall experience</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Email:</strong> support@partnerconnector.com</p>
                <p className="text-sm"><strong>Phone:</strong> +44 20 1234 5678</p>
                <p className="text-sm"><strong>Hours:</strong> Mon-Fri 9:00-17:00 GMT</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}