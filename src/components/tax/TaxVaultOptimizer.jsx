import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { 
  PiggyBank, 
  TrendingUp, 
  Target,
  Settings,
  Zap,
  Calculator,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  ArrowUpDown,
  Lightbulb
} from 'lucide-react';
import { formatCurrency, formatPercentage, formatDate } from '../../utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const TaxVaultOptimizer = ({ creatorId, strategy }) => {
  const [optimizerSettings, setOptimizerSettings] = useState({
    autoContribute: true,
    contributionPercentage: 25,
    minimumBalance: 2000,
    maximumBalance: 15000,
    seasonalAdjustments: true,
    riskTolerance: 'moderate'
  });

  const [customContribution, setCustomContribution] = useState('');
  const [simulationResults, setSimulationResults] = useState(null);
  const [savingsGoal, setSavingsGoal] = useState(12000);

  // Mock strategy data - replace with actual API data
  const mockStrategy = strategy || {
    currentBalance: 8950,
    recommendedBalance: 11300,
    shortfall: 2350,
    monthlyContribution: 850,
    annualSavings: 2450,
    strategy: 'Income-based automatic contributions',
    nextContribution: '2024-12-30',
    projectedYear: 2024,
    confidence: 89
  };

  // Mock projection data
  const projectionData = [
    { month: 'Dec 2024', current: 8950, optimized: 8950, target: 9500 },
    { month: 'Jan 2025', current: 9200, optimized: 9800, target: 10000 },
    { month: 'Feb 2025', current: 9450, optimized: 10650, target: 10500 },
    { month: 'Mar 2025', current: 9700, optimized: 11500, target: 11000 },
    { month: 'Apr 2025', current: 9950, optimized: 12350, target: 11500 },
    { month: 'May 2025', current: 10200, optimized: 13200, target: 12000 },
    { month: 'Jun 2025', current: 10450, optimized: 14050, target: 12500 },
  ];

  const handleContributionChange = (percentage) => {
    setOptimizerSettings(prev => ({
      ...prev,
      contributionPercentage: percentage
    }));
    
    // Simulate the impact
    simulateStrategy(percentage);
  };

  const simulateStrategy = (percentage) => {
    // Mock simulation - replace with actual API call
    const monthlyIncome = 4500; // Estimated monthly income
    const monthlyContribution = (monthlyIncome * percentage) / 100;
    const annualContribution = monthlyContribution * 12;
    
    setSimulationResults({
      monthlyContribution,
      annualContribution,
      projectedBalance: mockStrategy.currentBalance + annualContribution,
      estimatedSavings: annualContribution * 0.28, // 28% tax rate
      breakEvenMonth: Math.ceil(mockStrategy.shortfall / monthlyContribution)
    });
  };

  const handleOneTimeContribution = async () => {
    if (!customContribution || parseFloat(customContribution) <= 0) return;

    // Mock API call for one-time contribution
    console.log('Processing one-time contribution:', customContribution);
    
    // Show success feedback
    alert(`One-time contribution of ${formatCurrency(parseFloat(customContribution))} scheduled successfully!`);
    setCustomContribution('');
  };

  const toggleAutoContribute = () => {
    setOptimizerSettings(prev => ({
      ...prev,
      autoContribute: !prev.autoContribute
    }));
  };

  const getVaultStatus = () => {
    const coverage = (mockStrategy.currentBalance / mockStrategy.recommendedBalance) * 100;
    
    if (coverage >= 100) {
      return { status: 'optimal', color: 'green', message: 'Your Tax Vault is optimally funded' };
    } else if (coverage >= 80) {
      return { status: 'good', color: 'blue', message: 'Your Tax Vault is well-funded' };
    } else if (coverage >= 60) {
      return { status: 'moderate', color: 'orange', message: 'Consider increasing contributions' };
    } else {
      return { status: 'low', color: 'red', message: 'Urgent: Tax Vault needs attention' };
    }
  };

  const vaultStatus = getVaultStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-brand" />
            Tax Vault Optimizer
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered tax savings automation and optimization
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant={vaultStatus.status === 'optimal' ? 'success' : vaultStatus.status === 'low' ? 'destructive' : 'warning'}>
            {vaultStatus.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatCurrency(mockStrategy.currentBalance)}
            </div>
            <Progress 
              value={(mockStrategy.currentBalance / mockStrategy.recommendedBalance) * 100}
              className="h-3 mb-2"
            />
            <p className="text-sm text-muted-foreground">
              {Math.round((mockStrategy.currentBalance / mockStrategy.recommendedBalance) * 100)}% of recommended balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-blue-600" />
              Recommended Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {formatCurrency(mockStrategy.recommendedBalance)}
            </div>
            <div className="text-sm text-muted-foreground">
              {mockStrategy.shortfall > 0 ? (
                <span className="text-orange-600">
                  Shortfall: {formatCurrency(mockStrategy.shortfall)}
                </span>
              ) : (
                <span className="text-green-600">
                  Fully funded
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Annual Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {formatCurrency(mockStrategy.annualSavings)}
            </div>
            <div className="text-sm text-muted-foreground">
              With current optimization strategy
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Alert */}
      <Alert className={`border-${vaultStatus.color}-200 bg-${vaultStatus.color}-50`}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Tax Vault Status:</strong> {vaultStatus.message}
          {mockStrategy.shortfall > 0 && (
            <span className="ml-2">
              Recommended action: Increase contributions by {formatCurrency(mockStrategy.shortfall / 12)}/month.
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Contribution Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand" />
            Contribution Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Contribute Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Automatic Contributions</Label>
              <p className="text-sm text-muted-foreground">
                Automatically contribute a percentage of each payout to your Tax Vault
              </p>
            </div>
            <Switch 
              checked={optimizerSettings.autoContribute}
              onCheckedChange={toggleAutoContribute}
            />
          </div>

          {/* Contribution Percentage Slider */}
          {optimizerSettings.autoContribute && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Contribution Percentage</Label>
                <Badge variant="outline">
                  {optimizerSettings.contributionPercentage}%
                </Badge>
              </div>
              
              <Slider
                value={[optimizerSettings.contributionPercentage]}
                onValueChange={(value) => handleContributionChange(value[0])}
                min={10}
                max={50}
                step={1}
                className="w-full"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10% (Conservative)</span>
                <span>30% (Recommended)</span>
                <span>50% (Aggressive)</span>
              </div>
            </div>
          )}

          {/* Balance Limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min-balance">Minimum Balance</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="min-balance"
                  type="number"
                  value={optimizerSettings.minimumBalance}
                  onChange={(e) => setOptimizerSettings(prev => ({ ...prev, minimumBalance: parseInt(e.target.value) }))}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="max-balance">Maximum Balance</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="max-balance"
                  type="number"
                  value={optimizerSettings.maximumBalance}
                  onChange={(e) => setOptimizerSettings(prev => ({ ...prev, maximumBalance: parseInt(e.target.value) }))}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* One-Time Contribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            One-Time Contribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="custom-contribution">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="custom-contribution"
                  type="number"
                  placeholder="1000"
                  value={customContribution}
                  onChange={(e) => setCustomContribution(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleOneTimeContribution}
                disabled={!customContribution || parseFloat(customContribution) <= 0}
                className="gap-2"
              >
                <PiggyBank className="h-4 w-4" />
                Contribute
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {[500, 1000, 2500].map(amount => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => setCustomContribution(amount.toString())}
              >
                {formatCurrency(amount)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {simulationResults && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              Strategy Simulation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(simulationResults.monthlyContribution)}
                </div>
                <div className="text-sm text-muted-foreground">Monthly Contribution</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(simulationResults.annualContribution)}
                </div>
                <div className="text-sm text-muted-foreground">Annual Total</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(simulationResults.estimatedSavings)}
                </div>
                <div className="text-sm text-muted-foreground">Tax Savings</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {simulationResults.breakEvenMonth}
                </div>
                <div className="text-sm text-muted-foreground">Months to Target</div>
              </div>
            </div>
            
            <Alert className="border-green-200 bg-green-50">
              <Lightbulb className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>AI Recommendation:</strong> This strategy will optimize your tax savings and reach your target balance in {simulationResults.breakEvenMonth} months.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Balance Projection Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand" />
            Balance Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value, 'USD', 'en-US').replace('.00', '')}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    formatCurrency(value),
                    name === 'current' ? 'Current Path' : name === 'optimized' ? 'Optimized Path' : 'Target'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="target" 
                  stackId="1" 
                  stroke="#94a3b8" 
                  fill="#94a3b8" 
                  fillOpacity={0.2}
                  name="target"
                />
                <Area 
                  type="monotone" 
                  dataKey="current" 
                  stackId="2" 
                  stroke="#f59e0b" 
                  fill="#f59e0b" 
                  fillOpacity={0.3}
                  name="current"
                />
                <Area 
                  type="monotone" 
                  dataKey="optimized" 
                  stackId="3" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.4}
                  name="optimized"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-brand" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="justify-start gap-2">
            <Target className="h-4 w-4" />
            Set Savings Goal
          </Button>
          
          <Button variant="outline" className="justify-start gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Contribution
          </Button>
          
          <Button variant="outline" className="justify-start gap-2">
            <BarChart3 className="h-4 w-4" />
            Download Strategy Report
          </Button>
          
          <Button variant="outline" className="justify-start gap-2">
            <Settings className="h-4 w-4" />
            Advanced Settings
          </Button>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-purple-600" />
            AI Tax Vault Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Optimization Opportunities</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Increase contribution to 30% for faster target achievement
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Enable seasonal adjustments for Q4 income spikes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Set up automatic rebalancing for optimal growth
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Risk Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Cash Flow Impact</span>
                  <Badge variant="success">Low Risk</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Under-funding Risk</span>
                  <Badge variant="warning">Medium Risk</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Over-contribution Risk</span>
                  <Badge variant="success">Low Risk</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaxVaultOptimizer;