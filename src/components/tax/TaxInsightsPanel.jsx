import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Target,
  PiggyBank,
  FileText,
  Zap,
  Lightbulb,
  Calendar,
  DollarSign,
  ArrowRight,
  Star,
  BookOpen,
  Calculator
} from 'lucide-react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

const TaxInsightsPanel = ({ creatorId, insights: passedInsights }) => {
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [dismissedInsights, setDismissedInsights] = useState(new Set());

  // Mock AI insights data - replace with actual API data
  const mockInsights = passedInsights || [
    {
      id: 'insight_1',
      category: 'optimization',
      priority: 'high',
      type: 'tax_savings',
      title: 'Quarterly Payment Optimization Opportunity',
      description: 'Based on your income pattern, you could save $450 annually by adjusting your quarterly payment strategy.',
      impact: {
        savingsAmount: 450,
        timeFrame: 'annually',
        confidence: 87
      },
      actionable: true,
      actions: [
        'Increase Q4 2024 payment to $3,650',
        'Reduce Q1 2025 payment to $3,100',
        'Set up automatic adjustments for seasonal income'
      ],
      relatedMetrics: {
        currentStrategy: 'Equal quarterly payments',
        recommendedStrategy: 'Income-based adjustments',
        potentialSavings: '$450/year'
      },
      aiReasoning: 'Your income shows a 23% spike in Q4 historically. Front-loading taxes during high-earning periods reduces penalties and optimizes cash flow.',
      createdAt: '2024-12-28T10:30:00Z',
      expiresAt: '2025-01-15T23:59:59Z'
    },
    {
      id: 'insight_2',
      category: 'compliance',
      priority: 'high',
      type: 'deadline_reminder',
      title: 'Quarterly Filing Deadline Approaching',
      description: 'Q4 2024 estimated taxes are due in 18 days. Based on your YTD income, the recommended payment is $3,251.',
      impact: {
        penaltyRisk: 125,
        timeFrame: 'immediate',
        confidence: 95
      },
      actionable: true,
      actions: [
        'Calculate final Q4 payment amount',
        'Schedule payment by January 15, 2025',
        'Review and adjust for actual Q4 earnings'
      ],
      relatedMetrics: {
        dueDate: '2025-01-15',
        estimatedAmount: '$3,251',
        penaltyIfLate: '$125/month'
      },
      aiReasoning: 'Missing this deadline incurs penalties. Your payment history shows 100% on-time compliance - maintaining this protects your record.',
      createdAt: '2024-12-28T08:15:00Z',
      urgent: true
    },
    {
      id: 'insight_3',
      category: 'vault',
      priority: 'medium',
      type: 'vault_optimization',
      title: 'Tax Vault Balance Optimization',
      description: 'Your Tax Vault is currently 21% below optimal level. Consider increasing contributions from the next 3 payouts.',
      impact: {
        shortfall: 2350,
        timeFrame: 'next quarter',
        confidence: 82
      },
      actionable: true,
      actions: [
        'Increase vault contribution to 30% for next 3 payouts',
        'Set up automatic vault transfers',
        'Review vault strategy monthly'
      ],
      relatedMetrics: {
        currentBalance: '$8,950',
        recommendedBalance: '$11,300',
        shortfall: '$2,350'
      },
      aiReasoning: 'Based on your seasonal income patterns and upcoming tax obligations, building a 15% buffer above required amounts prevents cash flow issues.',
      createdAt: '2024-12-27T14:20:00Z'
    },
    {
      id: 'insight_4',
      category: 'deductions',
      priority: 'medium',
      type: 'deduction_opportunity',
      title: 'Home Office Deduction Opportunity',
      description: 'You may be eligible for a home office deduction worth approximately $1,200 annually.',
      impact: {
        savingsAmount: 1200,
        timeFrame: 'annually',
        confidence: 75
      },
      actionable: true,
      actions: [
        'Document home office space usage',
        'Calculate home office percentage',
        'Consult with tax professional for setup'
      ],
      relatedMetrics: {
        estimatedDeduction: '$4,800',
        taxSavings: '$1,200',
        requirements: 'Exclusive business use required'
      },
      aiReasoning: 'Your content creation activities suggest regular home office use. This deduction applies to mortgage interest, utilities, and maintenance costs.',
      createdAt: '2024-12-26T16:45:00Z'
    },
    {
      id: 'insight_5',
      category: 'planning',
      priority: 'low',
      type: 'year_end_planning',
      title: 'Equipment Purchase Tax Strategy',
      description: 'Purchasing $2,000+ in equipment before year-end could reduce your 2024 tax liability through Section 179 deduction.',
      impact: {
        savingsAmount: 500,
        timeFrame: '2024 tax year',
        confidence: 68
      },
      actionable: true,
      actions: [
        'Review needed equipment purchases',
        'Calculate optimal purchase timing',
        'Ensure proper business use documentation'
      ],
      relatedMetrics: {
        section179Limit: '$1,160,000',
        currentEquipmentExpenses: '$850',
        potentialDeduction: '$2,000'
      },
      aiReasoning: 'Section 179 allows immediate deduction of equipment purchases. Your current tax bracket makes this timing advantageous.',
      createdAt: '2024-12-25T11:30:00Z'
    }
  ];

  const categories = {
    all: { label: 'All Insights', icon: Brain },
    optimization: { label: 'Optimization', icon: Target },
    compliance: { label: 'Compliance', icon: CheckCircle },
    vault: { label: 'Tax Vault', icon: PiggyBank },
    deductions: { label: 'Deductions', icon: FileText },
    planning: { label: 'Planning', icon: Calendar }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityBadge = (priority, urgent = false) => {
    if (urgent) {
      return <Badge variant="destructive" className="gap-1">
        <Zap className="h-3 w-3" />
        Urgent
      </Badge>;
    }
    
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium Priority</Badge>;
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>;
      default:
        return <Badge variant="outline">Standard</Badge>;
    }
  };

  const filteredInsights = activeCategory === 'all' 
    ? mockInsights
    : mockInsights.filter(insight => insight.category === activeCategory);

  const visibleInsights = filteredInsights.filter(insight => !dismissedInsights.has(insight.id));

  const dismissInsight = (insightId) => {
    setDismissedInsights(prev => new Set([...prev, insightId]));
  };

  const highPriorityCount = mockInsights.filter(i => i.priority === 'high' && !dismissedInsights.has(i.id)).length;
  const urgentCount = mockInsights.filter(i => i.urgent && !dismissedInsights.has(i.id)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-brand" />
            AI Tax Insights
          </h2>
          <p className="text-muted-foreground mt-1">
            Personalized tax optimization powered by FANZ AI
          </p>
        </div>
        
        {/* Insights Summary */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-brand">{visibleInsights.length}</p>
            <p className="text-xs text-muted-foreground">Active Insights</p>
          </div>
          {urgentCount > 0 && (
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{urgentCount}</p>
              <p className="text-xs text-muted-foreground">Urgent</p>
            </div>
          )}
        </div>
      </div>

      {/* Urgent Alerts */}
      {urgentCount > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Action Required:</strong> You have {urgentCount} urgent tax insights that need immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-6">
          {Object.entries(categories).map(([key, { label, icon: Icon }]) => (
            <TabsTrigger key={key} value={key} className="gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(categories).map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            {visibleInsights.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No insights available</h3>
                  <p className="text-muted-foreground">
                    All caught up! Check back later for new AI-powered insights.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {visibleInsights.map((insight) => (
                  <Card 
                    key={insight.id}
                    className={`relative ${insight.urgent ? 'border-red-300 shadow-red-100' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg">{insight.title}</CardTitle>
                            {getPriorityBadge(insight.priority, insight.urgent)}
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissInsight(insight.id)}
                          className="ml-2"
                        >
                          ×
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Impact Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                        {insight.impact.savingsAmount && (
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(insight.impact.savingsAmount)}
                            </p>
                            <p className="text-xs text-muted-foreground">Potential Savings</p>
                          </div>
                        )}
                        
                        {insight.impact.shortfall && (
                          <div className="text-center">
                            <p className="text-2xl font-bold text-orange-600">
                              {formatCurrency(insight.impact.shortfall)}
                            </p>
                            <p className="text-xs text-muted-foreground">Current Shortfall</p>
                          </div>
                        )}
                        
                        {insight.impact.penaltyRisk && (
                          <div className="text-center">
                            <p className="text-2xl font-bold text-red-600">
                              {formatCurrency(insight.impact.penaltyRisk)}
                            </p>
                            <p className="text-xs text-muted-foreground">Penalty Risk</p>
                          </div>
                        )}
                        
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {insight.impact.confidence}%
                          </p>
                          <p className="text-xs text-muted-foreground">AI Confidence</p>
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      <Alert className="border-purple-200 bg-purple-50">
                        <Lightbulb className="h-4 w-4 text-purple-600" />
                        <AlertDescription className="text-purple-800">
                          <strong>AI Analysis:</strong> {insight.aiReasoning}
                        </AlertDescription>
                      </Alert>

                      {/* Action Items */}
                      {insight.actionable && insight.actions && (
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-brand" />
                            Recommended Actions
                          </h4>
                          <div className="space-y-2">
                            {insight.actions.map((action, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                <span className="text-sm">{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Related Metrics */}
                      {insight.relatedMetrics && (
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-brand" />
                            Key Metrics
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(insight.relatedMetrics).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <span className="text-sm text-muted-foreground capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                <span className="font-medium text-sm">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button className="gap-2">
                          <Zap className="h-4 w-4" />
                          Take Action
                        </Button>
                        <Button variant="outline" className="gap-2">
                          <BookOpen className="h-4 w-4" />
                          Learn More
                        </Button>
                        {insight.urgent && (
                          <Button variant="outline" className="gap-2 ml-auto">
                            <Calendar className="h-4 w-4" />
                            Schedule Reminder
                          </Button>
                        )}
                      </div>

                      {/* Expiry Notice */}
                      {insight.expiresAt && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          This opportunity expires on {new Date(insight.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* AI Learning Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-600" />
            AI Tax Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            FANZ AI analyzes your income patterns, spending habits, and tax history to provide personalized 
            recommendations that could save you thousands annually.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">$2,450</div>
              <div className="text-xs text-muted-foreground">Average Annual Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">87%</div>
              <div className="text-xs text-muted-foreground">Prediction Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">24/7</div>
              <div className="text-xs text-muted-foreground">Continuous Monitoring</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaxInsightsPanel;