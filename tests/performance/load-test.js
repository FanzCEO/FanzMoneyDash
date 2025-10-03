import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const authLatency = new Trend('auth_latency');
const transactionLatency = new Trend('transaction_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete within 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be less than 10%
    error_rate: ['rate<0.1'],
    auth_latency: ['p(95)<200'],
    transaction_latency: ['p(95)<1000'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const testUsers = [
  { email: 'admin@fanz.network', password: 'admin123', role: 'admin' },
  { email: 'creator@fanz.network', password: 'creator123', role: 'creator' },
  { email: 'fan@fanz.network', password: 'fan123', role: 'fan' },
];

// Authentication helper
function authenticate(user) {
  const loginStart = new Date();
  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const loginEnd = new Date();
  authLatency.add(loginEnd - loginStart);

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  if (!success) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  return response.json('token');
}

// Test scenarios
export default function () {
  // Choose random user
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const token = authenticate(user);

  if (!token) {
    console.log('Authentication failed, skipping tests');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Health Check
  const healthResponse = http.get(`${BASE_URL}/health`);
  check(healthResponse, {
    'health check passed': (r) => r.status === 200,
    'health response time OK': (r) => r.timings.duration < 100,
  });

  sleep(0.5);

  // Test 2: Get Financial Overview (based on user role)
  if (user.role === 'admin') {
    const overviewResponse = http.get(`${BASE_URL}/api/admin/financial-overview?timeframe=7d`, {
      headers,
    });
    
    check(overviewResponse, {
      'financial overview loaded': (r) => r.status === 200,
      'overview has required fields': (r) => {
        const data = r.json('data');
        return data && 
               data.totalRevenue !== undefined && 
               data.pendingTransactions !== undefined;
      },
    });
  }

  sleep(1);

  // Test 3: Transaction Processing (for fans and creators)
  if (user.role === 'fan') {
    const transactionStart = new Date();
    const paymentResponse = http.post(`${BASE_URL}/api/fans/test-fan-id/payments`, JSON.stringify({
      creatorId: 'test-creator-id',
      platform: 'boyfanz',
      amount: '25.00',
      currency: 'USD',
      paymentMethod: 'card',
      paymentDetails: {
        cardToken: 'test-card-token',
        last4: '4242'
      },
      deviceFingerprint: 'test-device-fingerprint'
    }), { headers });
    
    const transactionEnd = new Date();
    transactionLatency.add(transactionEnd - transactionStart);

    check(paymentResponse, {
      'payment processing': (r) => r.status === 200 || r.status === 201,
      'transaction ID returned': (r) => r.json('data.transactionId') !== undefined,
    });
  }

  sleep(1);

  // Test 4: Creator Dashboard
  if (user.role === 'creator') {
    const summaryResponse = http.get(`${BASE_URL}/api/creators/test-creator-id/financial-summary`, {
      headers,
    });
    
    check(summaryResponse, {
      'creator summary loaded': (r) => r.status === 200,
      'balance information present': (r) => {
        const data = r.json('data');
        return data && data.balance !== undefined;
      },
    });
  }

  sleep(0.5);

  // Test 5: Audit Logs (admin only)
  if (user.role === 'admin') {
    const auditResponse = http.get(`${BASE_URL}/api/security/audit-log?limit=10`, {
      headers,
    });
    
    check(auditResponse, {
      'audit logs accessible': (r) => r.status === 200,
      'audit logs format correct': (r) => {
        const data = r.json('data');
        return Array.isArray(data);
      },
    });
  }

  sleep(1);

  // Test 6: MFA Operations
  const mfaStatusResponse = http.get(`${BASE_URL}/api/auth/mfa/status`, {
    headers,
  });
  
  check(mfaStatusResponse, {
    'MFA status check': (r) => r.status === 200,
    'MFA status valid': (r) => {
      const data = r.json('data');
      return data && typeof data.enabled === 'boolean';
    },
  });

  sleep(0.5);

  // Test 7: System Status
  const statusResponse = http.get(`${BASE_URL}/api/system/status`, {
    headers,
  });
  
  check(statusResponse, {
    'system status accessible': (r) => r.status === 200 || r.status === 403, // 403 for non-admin users
  });

  sleep(1);
}

// Setup function (runs once per VU at the beginning)
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  
  // Verify the service is running
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Service is not healthy. Status: ${healthCheck.status}`);
  }
  
  return { baseUrl: BASE_URL };
}

// Teardown function (runs once after all VUs finish)
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Base URL: ${data.baseUrl}`);
}

// Handle different test scenarios
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
    'summary.html': htmlReport(data),
  };
}

// Custom summary functions
function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = `${indent}Load Test Results:\n`;
  summary += `${indent}==================\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%\n`;
  summary += `${indent}Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  
  if (data.metrics.auth_latency) {
    summary += `${indent}Auth Latency (avg): ${data.metrics.auth_latency.values.avg.toFixed(2)}ms\n`;
  }
  
  if (data.metrics.transaction_latency) {
    summary += `${indent}Transaction Latency (avg): ${data.metrics.transaction_latency.values.avg.toFixed(2)}ms\n`;
  }
  
  return summary;
}

function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>FanzMoneyDash Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; }
        .passed { color: green; }
        .failed { color: red; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>FanzMoneyDash Load Test Report</h1>
    <div class="metric">Total Requests: ${data.metrics.http_reqs.values.count}</div>
    <div class="metric">Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</div>
    <div class="metric">Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</div>
    <div class="metric">95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</div>
    
    <h2>Thresholds</h2>
    <table>
        <tr><th>Metric</th><th>Threshold</th><th>Status</th></tr>
        ${Object.entries(data.thresholds || {}).map(([metric, threshold]) => 
          `<tr><td>${metric}</td><td>${threshold.threshold}</td><td class="${threshold.ok ? 'passed' : 'failed'}">${threshold.ok ? 'PASSED' : 'FAILED'}</td></tr>`
        ).join('')}
    </table>
</body>
</html>`;
}