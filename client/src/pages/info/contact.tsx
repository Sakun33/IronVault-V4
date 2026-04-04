import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoLayout } from '@/components/info-layout';
import { Mail, Phone, MessageSquare, MapPin, Clock, Send } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function ContactPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create mailto link with pre-filled data
    const mailtoLink = `mailto:subsafeironvault@gmail.com?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\nCategory: ${formData.category}\n\nMessage:\n${formData.message}`)}`;
    
    window.location.href = mailtoLink;
    
    toast({
      title: "Opening Email Client",
      description: "Your default email client will open with the pre-filled message.",
    });
  };

  return (
    <InfoLayout title="Contact Us">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-foreground">
            Get in Touch
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions, feedback, or need support? We're here to help!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Send Us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name *</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Your Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="support">Technical Support</SelectItem>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="security">Security Concern</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="How can we help?"
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" size="lg">
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    This will open your default email client with a pre-filled message.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Direct Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <a 
                  href="mailto:subsafeironvault@gmail.com"
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors group"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground mb-1">Email</div>
                    <div className="text-xs text-primary group-hover:underline break-all">
                      subsafeironvault@gmail.com
                    </div>
                  </div>
                </a>


                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground mb-1">Response Time</div>
                    <div className="text-xs text-muted-foreground">
                      Within 24-48 hours
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Office</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground mb-1">IronVault</div>
                    <div className="text-xs text-muted-foreground">
                      India
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="pt-6">
                <h4 className="font-semibold text-foreground mb-2 text-center">Need Immediate Help?</h4>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Check out our support resources
                </p>
                <div className="space-y-2">
                  <a href="/support" className="block">
                    <Button variant="outline" className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Support Center
                    </Button>
                  </a>
                  <a href="/docs" className="block">
                    <Button variant="outline" className="w-full">
                      <Mail className="w-4 h-4 mr-2" />
                      Documentation
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}

