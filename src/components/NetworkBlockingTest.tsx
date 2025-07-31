import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const TestContainer = styled.div`
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 300px;
  z-index: 1000;
`;

const TestButton = styled.button`
  margin: 2px;
  padding: 4px 8px;
  font-size: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &.allowed {
    background: #4CAF50;
    color: white;
  }
  
  &.blocked {
    background: #f44336;
    color: white;
  }
  
  &.testing {
    background: #ff9800;
    color: white;
  }
`;

const TestResult = styled.div<{ status: 'success' | 'blocked' | 'error' }>`
  margin: 2px 0;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 10px;
  
  ${({ status }) => {
    switch (status) {
      case 'success':
        return 'background: #4CAF50; color: white;';
      case 'blocked':
        return 'background: #f44336; color: white;';
      case 'error':
        return 'background: #ff9800; color: white;';
      default:
        return 'background: #666; color: white;';
    }
  }}
`;

interface TestResult {
  url: string;
  status: 'success' | 'blocked' | 'error';
  message: string;
  timestamp: string;
}

const NetworkBlockingTest: React.FC<{ enabled?: boolean }> = ({ enabled = false }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (url: string, status: 'success' | 'blocked' | 'error', message: string) => {
    const result: TestResult = {
      url,
      status,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setResults(prev => [result, ...prev.slice(0, 4)]); // Keep last 5 results
  };

  const testRequest = async (url: string, description: string) => {
    try {
      setTesting(true);
      console.log(`🧪 Testing request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const data = await response.text();
      
      if (response.headers.get('X-Request-Blocked') === 'true' || 
          (data.includes('"blocked":true') && data.includes('"reason"'))) {
        addResult(url, 'blocked', `${description} - Blocked as expected`);
      } else if (response.ok) {
        addResult(url, 'success', `${description} - Allowed as expected`);
      } else {
        addResult(url, 'error', `${description} - Unexpected response: ${response.status}`);
      }
    } catch (error) {
      addResult(url, 'error', `${description} - Error: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const runTests = async () => {
    setResults([]);
    
    // Test BioSense API (should be allowed)
    await testRequest('https://api.biosensesignal.com/', 'BioSense API');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test external API that should be blocked
    await testRequest('https://httpbin.org/json', 'External API');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test another external service
    await testRequest('https://api.github.com/users/octocat', 'GitHub API');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test a CDN resource (static resources should be allowed)
    await testRequest('https://cdn.jsdelivr.net/npm/react@17/package.json', 'CDN Resource');
  };

  const clearResults = () => {
    setResults([]);
  };

  if (!enabled) {
    return null;
  }

  return (
    <TestContainer>
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
        🔒 External Request Blocking Test
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <TestButton 
          className="testing" 
          onClick={runTests} 
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Run Tests'}
        </TestButton>
        <TestButton 
          className="blocked" 
          onClick={clearResults}
        >
          Clear
        </TestButton>
      </div>
      
      <div>
        {results.map((result, index) => (
          <TestResult key={index} status={result.status}>
            <div style={{ fontWeight: 'bold' }}>
              {result.timestamp} - {result.status.toUpperCase()}
            </div>
            <div>{result.message}</div>
            <div style={{ fontSize: '9px', opacity: 0.8 }}>
              {result.url.substring(0, 40)}...
            </div>
          </TestResult>
        ))}
      </div>
      
      <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.7 }}>
        Green = Allowed | Red = Blocked | Orange = Error
      </div>
    </TestContainer>
  );
};

export default NetworkBlockingTest;