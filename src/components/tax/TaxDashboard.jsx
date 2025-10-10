import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  DollarSign, 
  TrendingUp, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Calculator,
  PiggyBank,
  Brain,
  Download,
  Eye,
  RefreshCw
} from 'lucide-react';
import TaxEstimatesWidget from './TaxEstimatesWidget';
import TaxInsightsPanel from './TaxInsightsPanel';
import TaxVaultOptimizer from './TaxVaultOptimizer';
import TaxDocuments from './TaxDocuments';
import { useFanzTax } from '../../hooks/useFanzTax';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

const TaxDashboard = ({ creatorId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const {
    estimates,
    insights,
    taxVaultStrategy,
    processingStats,
    loading,
    error,
    refreshData
  } = useFanzTax(creatorId);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const currentYear = new Date().getFullYear();

  // Mock data for demo purposes - replace with actual API data
  const mockOverviewData = {
    ytdIncome: estimates?.ytdIncome || 45250,
    estimatedTaxes: estimates?.estimatedTaxes || 11312.50,
    nextQuarterlyDue: '2025-01-15',
    complianceScore: 96,
    taxVaultBalance: taxVaultStrategy?.currentBalance || 8950,
    documentsReady: 3,
    pendingActions: insights?.filter(i => i.priority === 'high')?.length || 2
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-brand" />
          <p className="text-muted-foreground">Loading your tax dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load tax data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tax Center</h1>
          <p className="text-muted-foreground mt-1">
            Manage your taxes like a pro with FANZ Tax Intelligence
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-green-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Compliance Score</p>
                <p className="text-2xl font-bold text-green-600">{mockOverviewData.complianceScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <PiggyBank className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Tax Vault</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(mockOverviewData.taxVaultBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Next Due</p>
                <p className="text-lg font-bold text-orange-600">{mockOverviewData.nextQuarterlyDue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-purple-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">AI Insights</p>
                <p className="text-2xl font-bold text-purple-600">{insights?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions Alert */}
      {mockOverviewData.pendingActions > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You have {mockOverviewData.pendingActions} high-priority tax actions that need attention.
            <Button variant="link" className="ml-2 p-0 h-auto text-orange-600">
              View Details →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <Eye className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="estimates" className="gap-2">
            <Calculator className="h-4 w-4" />
            Estimates
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="vault" className="gap-2">
            <PiggyBank className="h-4 w-4" />
            Tax Vault
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* YTD Income Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-brand" />
                  {currentYear} Income Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Gross Income</span>
                    <span className="font-semibold">{formatCurrency(mockOverviewData.ytdIncome)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Estimated Taxes</span>
                    <span className="font-semibold text-red-600">
                      -{formatCurrency(mockOverviewData.estimatedTaxes)}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Estimated After-Tax</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(mockOverviewData.ytdIncome - mockOverviewData.estimatedTaxes)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Tax Rate</span>
                    <Badge variant="outline">
                      {formatPercentage(mockOverviewData.estimatedTaxes / mockOverviewData.ytdIncome)}
                    </Badge>
                  </div>
                  <Progress 
                    value={(mockOverviewData.estimatedTaxes / mockOverviewData.ytdIncome) * 100} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tax Vault Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-brand" />
                  Tax Vault Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Current Balance</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(mockOverviewData.taxVaultBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Recommended Balance</span>
                    <span className="font-semibold">
                      {formatCurrency(mockOverviewData.estimatedTaxes)}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Coverage</span>
                      <Badge variant={mockOverviewData.taxVaultBalance >= mockOverviewData.estimatedTaxes ? "success" : "warning"}>
                        {formatPercentage(mockOverviewData.taxVaultBalance / mockOverviewData.estimatedTaxes)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <Progress 
                    value={(mockOverviewData.taxVaultBalance / mockOverviewData.estimatedTaxes) * 100} 
                    className="h-2 mb-2" 
                  />
                  {mockOverviewData.taxVaultBalance < mockOverviewData.estimatedTaxes && (
                    <p className="text-sm text-orange-600">
                      Consider adding {formatCurrency(mockOverviewData.estimatedTaxes - mockOverviewData.taxVaultBalance)} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Deadlines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand" />
                  Upcoming Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div>
                      <p className="font-medium text-orange-800">Q4 2024 Quarterly</p>
                      <p className="text-sm text-orange-600">Due: {mockOverviewData.nextQuarterlyDue}</p>
                    </div>
                    <Badge variant="warning">15 days</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div>
                      <p className="font-medium text-blue-800">Annual Tax Return</p>
                      <p className="text-sm text-blue-600">Due: April 15, 2025</p>
                    </div>
                    <Badge variant="outline">95 days</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calculator className="h-4 w-4" />
                  Calculate Tax Impact for Next Payout
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" />
                  Download YTD Summary
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Optimize Tax Vault Strategy
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="h-4 w-4" />
                  Generate Tax Documents
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tax Estimates Tab */}
        <TabsContent value="estimates">
          <TaxEstimatesWidget creatorId={creatorId} />
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights">
          <TaxInsightsPanel creatorId={creatorId} insights={insights} />
        </TabsContent>

        {/* Tax Vault Tab */}
        <TabsContent value="vault">
          <TaxVaultOptimizer creatorId={creatorId} strategy={taxVaultStrategy} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <TaxDocuments creatorId={creatorId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaxDashboard;