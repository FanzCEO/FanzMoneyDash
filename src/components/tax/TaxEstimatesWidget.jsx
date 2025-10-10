import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Info,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const TaxEstimatesWidget = ({ creatorId }) => {
  const [payoutAmount, setPayoutAmount] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('quarterly');
  const [jurisdiction, setJurisdiction] = useState('US');
  const [calculating, setCalculating] = useState(false);
  const [estimates, setEstimates] = useState(null);

  // Mock data for real-time estimates
  const mockEstimates = {
    current: {
      ytdIncome: 45250,
      ytdTaxes: 11312.50,
      nextQuarterlyAmount: 3250.75,
      nextQuarterlyDue: '2025-01-15',
      effectiveTaxRate: 25.0,
      marginalTaxRate: 28.0,
      estimatedAnnual: 67875
    },
    breakdown: {
      federal: { rate: 22.0, amount: 9967.50 },
      state: { rate: 6.0, amount: 2713.50 },
      selfEmployment: { rate: 15.3, amount: 6923.25 },
      medicare: { rate: 2.35, amount: 1063.38 }
    },
    quarterly: [
      { quarter: 'Q1 2024', estimated: 2845.00, paid: 2845.00, status: 'paid' },
      { quarter: 'Q2 2024', estimated: 3120.50, paid: 3120.50, status: 'paid' },
      { quarter: 'Q3 2024', estimated: 2896.25, paid: 2896.25, status: 'paid' },
      { quarter: 'Q4 2024', estimated: 3250.75, paid: 0, status: 'due' },
      { quarter: 'Q1 2025', estimated: 3450.00, paid: 0, status: 'upcoming' }
    ],
    projections: [
      { month: 'Jan', income: 3500, taxes: 875 },
      { month: 'Feb', income: 4200, taxes: 1050 },
      { month: 'Mar', income: 3900, taxes: 975 },
      { month: 'Apr', income: 4500, taxes: 1125 },
      { month: 'May', income: 3800, taxes: 950 },
      { month: 'Jun', income: 4100, taxes: 1025 },
      { month: 'Jul', income: 4300, taxes: 1075 },
      { month: 'Aug', income: 3700, taxes: 925 },
      { month: 'Sep', income: 4000, taxes: 1000 },
      { month: 'Oct', income: 4400, taxes: 1100 },
      { month: 'Nov', income: 3900, taxes: 975 },
      { month: 'Dec', income: 4200, taxes: 1050 }
    ]
  };

  const calculatePayoutTaxes = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) return;
    
    setCalculating(true);
    
    // Simulate API call
    setTimeout(() => {
      const amount = parseFloat(payoutAmount);
      const taxRate = mockEstimates.current.marginalTaxRate / 100;
      const estimatedTaxes = amount * taxRate;
      
      setEstimates({
        payoutAmount: amount,
        estimatedTaxes,
        afterTaxAmount: amount - estimatedTaxes,
        marginalRate: mockEstimates.current.marginalTaxRate,
        recommendedVaultContribution: estimatedTaxes * 1.1 // 10% buffer
      });
      
      setCalculating(false);
    }, 1000);
  };

  const getQuarterStatus = (status) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" />Paid</Badge>;
      case 'due':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Due</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-brand" />
            Tax Estimates & Calculator
          </h2>
          <p className="text-muted-foreground mt-1">
            Real-time tax calculations and quarterly planning
          </p>
        </div>
      </div>

      {/* Quick Calculator */}
      <Card className="border-brand/20 bg-gradient-to-r from-brand/5 to-brand/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            Payout Tax Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="payout-amount">Expected Payout Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="payout-amount"
                  type="number"
                  placeholder="5000"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="jurisdiction">Tax Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={calculatePayoutTaxes} 
                disabled={calculating || !payoutAmount}
                className="w-full gap-2"
              >
                {calculating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    Calculate
                  </>
                )}
              </Button>
            </div>
          </div>

          {estimates && (
            <div className="mt-6 p-4 bg-white/50 rounded-lg border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Payout Amount</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(estimates.payoutAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Taxes</p>
                  <p className="text-xl font-bold text-red-600">
                    -{formatCurrency(estimates.estimatedTaxes)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">After-Tax Amount</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(estimates.afterTaxAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tax Rate</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatPercentage(estimates.marginalRate)}
                  </p>
                </div>
              </div>
              
              <Alert className="mt-4 border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Tax Vault Recommendation:</strong> Set aside {formatCurrency(estimates.recommendedVaultContribution)} 
                  (includes 10% safety buffer) for this payout.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* YTD Tax Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              2024 Tax Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Year-to-Date Income</span>
                <span className="font-semibold">{formatCurrency(mockEstimates.current.ytdIncome)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Taxes Paid/Owed</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(mockEstimates.current.ytdTaxes)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Effective Tax Rate</span>
                <Badge variant="outline">
                  {formatPercentage(mockEstimates.current.effectiveTaxRate)}
                </Badge>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Annual Projection</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(mockEstimates.current.estimatedAnnual)}
                  </span>
                </div>
                <Progress 
                  value={(mockEstimates.current.ytdIncome / mockEstimates.current.estimatedAnnual) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((mockEstimates.current.ytdIncome / mockEstimates.current.estimatedAnnual) * 100)}% of projected annual income
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-brand" />
              Tax Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(mockEstimates.breakdown).map(([key, { rate, amount }]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm capitalize">{key === 'selfEmployment' ? 'Self-Employment' : key}</span>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(amount)}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({formatPercentage(rate)})
                      </span>
                    </div>
                  </div>
                  <Progress value={rate} max={30} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand" />
            Quarterly Payment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockEstimates.quarterly.map((quarter, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  quarter.status === 'due' 
                    ? 'bg-red-50 border-red-200' 
                    : quarter.status === 'paid'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{quarter.quarter}</p>
                    <p className="text-sm text-muted-foreground">
                      Estimated: {formatCurrency(quarter.estimated)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {quarter.paid > 0 && (
                    <span className="text-sm text-green-600 font-medium">
                      Paid: {formatCurrency(quarter.paid)}
                    </span>
                  )}
                  {getQuarterStatus(quarter.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Income Projections Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand" />
            Monthly Income & Tax Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockEstimates.projections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    formatCurrency(value), 
                    name === 'income' ? 'Income' : 'Taxes'
                  ]}
                />
                <Bar dataKey="income" fill="#3b82f6" name="income" />
                <Bar dataKey="taxes" fill="#ef4444" name="taxes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Next Quarter Alert */}
      {mockEstimates.quarterly.find(q => q.status === 'due') && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Quarterly Payment Due:</strong> Your Q4 2024 estimated payment of{' '}
            <strong>{formatCurrency(mockEstimates.current.nextQuarterlyAmount)}</strong> is due on{' '}
            <strong>{mockEstimates.current.nextQuarterlyDue}</strong>.
            <Button variant="link" className="ml-2 p-0 h-auto text-orange-600">
              Set up payment →
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default TaxEstimatesWidget;