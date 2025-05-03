// Tab switching functionality
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs and contents
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    tab.classList.add('active');
    const tabId = `${tab.dataset.tab}-tab`;
    document.getElementById(tabId).classList.add('active');
  });
});

// Setup check buttons
const checkButtons = document.querySelectorAll('.check-button');
const runAllButton = document.getElementById('runAllChecks');
const clearResultsButton = document.getElementById('clearResults');
const exportReportButton = document.getElementById('exportReport');
const resultsContent = document.getElementById('resultsContent');
const summaryPass = document.getElementById('summaryPass');
const summaryFail = document.getElementById('summaryFail');
const overallScore = document.getElementById('overallScore');
const issuesByCategory = document.getElementById('issuesByCategory');

// Initialize state
let validationResults = [];
let passCount = 0;
let failCount = 0;

// Run individual accessibility check
async function runCheck(checkType) {
  // Show loading state on button
  const button = document.querySelector(`[data-check="${checkType}"]`);
  const originalContent = button.innerHTML;
  button.innerHTML = '<div class="loading"></div> Checking...';
  button.disabled = true;
  
  try {
    // Send message to content script to run the check
    const results = await runAccessibilityCheck(checkType);
    
    // Update results display
    addResultToUI(results);
    updateSummary();
    
    // Switch to results tab
    tabs[1].click();
  } catch (error) {
    console.error('Error running check:', error);
    
    // Add error result
    addResultToUI({
      type: checkType,
      status: 'error',
      message: `Error running check: ${error.message}`,
      details: [],
      timestamp: new Date().toISOString()
    });
  } finally {
    // Restore button state
    button.innerHTML = originalContent;
    button.disabled = false;
  }
}

// Run all accessibility checks
async function runAllChecks() {
  // Show loading state
  runAllButton.innerHTML = '<div class="loading"></div> Running all checks...';
  runAllButton.disabled = true;
  
  try {
    const allCheckTypes = Array.from(checkButtons).map(button => button.dataset.check);
    
    for (const checkType of allCheckTypes) {
      const results = await runAccessibilityCheck(checkType);
      addResultToUI(results);
    }
    
    updateSummary();
    
    // Switch to results tab
    tabs[1].click();
  } catch (error) {
    console.error('Error running all checks:', error);
  } finally {
    // Restore button state
    runAllButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
    Run All Accessibility Checks`;
    runAllButton.disabled = false;
  }
}

// Simulate running an accessibility check (will be replaced with actual implementation)
function runAccessibilityCheck(checkType) {
  return new Promise((resolve) => {
    // Communicate with the content script to run the check
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]?.id) {
        resolve({
          type: checkType,
          status: 'error',
          message: 'No active tab found',
          details: [],
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'runCheck', checkType }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          resolve({
            type: checkType,
            status: 'error',
            message: 'Error communicating with page',
            details: [],
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        resolve(response || simulateCheckResult(checkType));
      });
    });
  });
}

// Add a validation result to the UI
function addResultToUI(result) {
  // Add to results array
  validationResults.push(result);
  
  // Update the results UI
  updateResultsUI();
  
  // Update pass/fail counts
  if (result.status === 'pass') {
    passCount++;
  } else if (result.status === 'fail') {
    failCount++;
  }
  
  // Update summary
  updateSummary();
}

// Update the results UI based on validationResults array
function updateResultsUI() {
  if (validationResults.length === 0) {
    resultsContent.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list">
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <path d="M12 11h4"/>
          <path d="M12 16h4"/>
          <path d="M8 11h.01"/>
          <path d="M8 16h.01"/>
        </svg>
        <p>No validation results yet.</p>
        <p>Run a check to see results here.</p>
      </div>
    `;
    return;
  }
  
  // Sort results with newest first
  const sortedResults = [...validationResults].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  // Create HTML for results
  const resultsHTML = sortedResults.map(result => {
    const statusClass = result.status === 'pass' ? 'pass' : 'fail';
    const statusText = result.status === 'pass' ? 'Passed' : 'Failed';
    
    const detailsHTML = result.details.map(detail => {
      return `
        <div class="result-detail">
          <p>${detail.message}</p>
          ${detail.element ? `<code class="element-path">${detail.element}</code>` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <div class="result-item">
        <div class="result-item-header">
          <span class="result-type">${getReadableCheckName(result.type)}</span>
          <span class="result-status ${statusClass}">${statusText}</span>
        </div>
        <div class="result-details">
          <p>${result.message}</p>
          ${detailsHTML}
        </div>
        <div class="result-actions">
          ${result.status === 'fail' ? `
            <button class="highlight-button" data-selector="${result.details[0]?.selector || ''}">
              Highlight Issues
            </button>
            <button class="fix-button" data-type="${result.type}">
              Suggest Fix
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  resultsContent.innerHTML = resultsHTML;
  
  // Add event listeners to buttons
  document.querySelectorAll('.highlight-button').forEach(button => {
    button.addEventListener('click', () => {
      const selector = button.dataset.selector;
      if (selector) {
        highlightElements(selector);
      }
    });
  });
  
  document.querySelectorAll('.fix-button').forEach(button => {
    button.addEventListener('click', () => {
      const checkType = button.dataset.type;
      suggestFix(checkType);
    });
  });
}

// Update summary information
function updateSummary() {
  summaryPass.textContent = passCount;
  summaryFail.textContent = failCount;
  
  // Calculate and update overall score
  if (passCount + failCount > 0) {
    const score = Math.round((passCount / (passCount + failCount)) * 100);
    overallScore.textContent = score;
    
    // Update score label
    const scoreLabel = document.querySelector('.score-label');
    if (score >= 90) {
      scoreLabel.textContent = 'Excellent';
      scoreLabel.style.color = 'var(--success)';
    } else if (score >= 70) {
      scoreLabel.textContent = 'Good';
      scoreLabel.style.color = 'var(--primary)';
    } else if (score >= 50) {
      scoreLabel.textContent = 'Needs Improvement';
      scoreLabel.style.color = 'var(--warning)';
    } else {
      scoreLabel.textContent = 'Poor';
      scoreLabel.style.color = 'var(--error)';
    }
  } else {
    overallScore.textContent = '-';
    document.querySelector('.score-label').textContent = 'Not enough data';
    document.querySelector('.score-label').style.color = 'var(--text-light)';
  }
  
  // Update issues by category
  updateIssuesByCategory();
}

// Update issues by category in the report tab
function updateIssuesByCategory() {
  // Count issues by category
  const categories = {};
  
  validationResults.forEach(result => {
    if (result.status === 'fail') {
      const category = getCategoryForCheckType(result.type);
      categories[category] = (categories[category] || 0) + 1;
    }
  });
  
  // Create HTML for categories
  if (Object.keys(categories).length === 0) {
    issuesByCategory.innerHTML = `
      <div class="empty-state small">
        <p>No issues found yet</p>
      </div>
    `;
    return;
  }
  
  const categoriesHTML = Object.entries(categories)
    .sort((a, b) => b[1] - a[1]) // Sort by count (highest first)
    .map(([category, count]) => {
      return `
        <div class="category-item">
          <span class="category-name">${category}</span>
          <span class="category-count">${count}</span>
        </div>
      `;
    }).join('');
  
  issuesByCategory.innerHTML = categoriesHTML;
}

// Clear all results
function clearResults() {
  validationResults = [];
  passCount = 0;
  failCount = 0;
  updateResultsUI();
  updateSummary();
}

// Export report as JSON
function exportReport() {
  const report = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    summary: {
      passCount,
      failCount,
      score: passCount + failCount > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0
    },
    results: validationResults
  };
  
  // Create downloadable JSON file
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const a = document.createElement('a');
  a.href = url;
  a.download = `accessibility-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Highlight elements matching a selector
function highlightElements(selector) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) return;
    
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'highlightElements', 
      selector 
    });
  });
}

// Suggest fix for a specific check type
function suggestFix(checkType) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) return;
    
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'suggestFix', 
      checkType 
    });
  });
}

// Helper functions
function getReadableCheckName(checkType) {
  const names = {
    'altText': 'Alt Text Check',
    'captions': 'Captions & Transcripts',
    'keyboardNav': 'Keyboard Navigation',
    'focusVisible': 'Visible Focus Indicators',
    'formLabels': 'Form Labels',
    'timeouts': 'Time Limits',
    'linkText': 'Link Text',
    'headings': 'Heading Structure',
    'animations': 'Animations & Flashing'
  };
  
  return names[checkType] || checkType;
}

function getCategoryForCheckType(checkType) {
  const categories = {
    'altText': 'Images & Media',
    'captions': 'Images & Media',
    'keyboardNav': 'Navigation & Interaction',
    'focusVisible': 'Navigation & Interaction',
    'formLabels': 'Forms & Interaction',
    'timeouts': 'Forms & Interaction',
    'linkText': 'Content & Structure',
    'headings': 'Content & Structure',
    'animations': 'Content & Structure'
  };
  
  return categories[checkType] || 'Other';
}

// Simulate check results for development/demo purposes
function simulateCheckResult(checkType) {
  const isPassing = Math.random() > 0.5;
  
  const results = {
    'altText': {
      pass: {
        message: 'All images have appropriate alt text',
        details: []
      },
      fail: {
        message: 'Found images missing alt text',
        details: [
          { 
            message: 'Image missing alt text', 
            element: '<img src="logo.png">', 
            selector: 'img[src*="logo"]' 
          },
          { 
            message: 'Image with insufficient alt text', 
            element: '<img src="banner.jpg" alt="image">', 
            selector: 'img[alt="image"]' 
          }
        ]
      }
    },
    'keyboardNav': {
      pass: {
        message: 'All interactive elements are keyboard accessible',
        details: []
      },
      fail: {
        message: 'Found elements not accessible via keyboard',
        details: [
          { 
            message: 'Element not focusable with keyboard', 
            element: '<div onclick="handleClick()">Click me</div>', 
            selector: 'div[onclick]' 
          }
        ]
      }
    },
    'formLabels': {
      pass: {
        message: 'All form fields have proper labels',
        details: []
      },
      fail: {
        message: 'Found form fields without labels',
        details: [
          { 
            message: 'Input missing label association', 
            element: '<input type="text" placeholder="Email">', 
            selector: 'input[placeholder="Email"]' 
          }
        ]
      }
    },
    'linkText': {
      pass: {
        message: 'All links have descriptive text',
        details: []
      },
      fail: {
        message: 'Found links with non-descriptive text',
        details: [
          { 
            message: 'Link text is not descriptive', 
            element: '<a href="/page">Click here</a>', 
            selector: 'a:contains("Click here")' 
          },
          { 
            message: 'Link text is not descriptive', 
            element: '<a href="/page">Read more</a>', 
            selector: 'a:contains("Read more")' 
          }
        ]
      }
    },
    'headings': {
      pass: {
        message: 'Heading structure is properly nested',
        details: []
      },
      fail: {
        message: 'Found improper heading structure',
        details: [
          { 
            message: 'Heading levels skipped (h1 to h3)', 
            element: '<h3>Section Title</h3>', 
            selector: 'h3' 
          }
        ]
      }
    }
  };
  
  // Default result if specific check not found
  const defaultResult = {
    pass: {
      message: `${getReadableCheckName(checkType)} passed all checks`,
      details: []
    },
    fail: {
      message: `${getReadableCheckName(checkType)} failed some checks`,
      details: [
        { 
          message: 'Issue detected with this feature', 
          element: '<div>Example element</div>', 
          selector: 'div' 
        }
      ]
    }
  };
  
  const checkResult = results[checkType] || defaultResult;
  const result = isPassing ? checkResult.pass : checkResult.fail;
  
  return {
    type: checkType,
    status: isPassing ? 'pass' : 'fail',
    message: result.message,
    details: result.details,
    timestamp: new Date().toISOString()
  };
}

// Initialize
// Add event listeners to buttons
checkButtons.forEach(button => {
  button.addEventListener('click', () => {
    const checkType = button.dataset.check;
    runCheck(checkType);
  });
});

runAllButton.addEventListener('click', runAllChecks);
clearResultsButton.addEventListener('click', clearResults);
exportReportButton.addEventListener('click', exportReport);

// Handle messages from background script or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkComplete') {
    addResultToUI(message.result);
  }
  
  // Always return true for async response
  return true;
});