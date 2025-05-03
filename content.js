// Inject CSS for highlighting elements
const style = document.createElement('style');
style.textContent = `
  .accessibility-highlight {
    outline: 2px solid #EF4444 !important;
    background-color: rgba(239, 68, 68, 0.1) !important;
    position: relative !important;
  }
  
  .accessibility-highlight::after {
    content: attr(data-accessibility-issue);
    position: absolute;
    top: 100%;
    left: 0;
    background-color: #EF4444;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    white-space: nowrap;
  }
  
  .accessibility-warning {
    outline: 2px solid #F97316 !important;
    background-color: rgba(249, 115, 22, 0.1) !important;
  }
  
  .accessibility-fix {
    outline: 2px solid #10B981 !important;
    transition: outline 0.3s ease;
  }
`;
document.head.appendChild(style);

// Handle messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'runCheck') {
    const result = runAccessibilityCheck(message.checkType);
    sendResponse(result);
  } else if (message.action === 'highlightElements') {
    highlightElements(message.selector);
    sendResponse({ success: true });
  } else if (message.action === 'suggestFix') {
    suggestFix(message.checkType);
    sendResponse({ success: true });
  }
  
  // Return true for async response
  return true;
});

// Run an accessibility check
function runAccessibilityCheck(checkType) {
  switch (checkType) {
    case 'altText':
      return checkAltText();
    case 'keyboardNav':
      return checkKeyboardNavigation();
    case 'focusVisible':
      return checkFocusVisible();
    case 'formLabels':
      return checkFormLabels();
    case 'linkText':
      return checkLinkText();
    case 'headings':
      return checkHeadingStructure();
    case 'captions':
      return checkCaptions();
    case 'timeouts':
      return checkTimeouts();
    case 'animations':
      return checkAnimations();
    default:
      return {
        type: checkType,
        status: 'error',
        message: `Unknown check type: ${checkType}`,
        details: [],
        timestamp: new Date().toISOString()
      };
  }
}

// Check for alt text on images
function checkAltText() {
  const images = document.querySelectorAll('img');
  const issues = [];
  
  images.forEach(img => {
    if (!img.hasAttribute('alt')) {
      issues.push({
        message: 'Image missing alt text',
        element: elementToString(img),
        selector: generateSelector(img)
      });
    } else if (img.alt === '') {
      // Empty alt is okay for decorative images, but we'll note it
      // This isn't necessarily an issue, but we'll track it
    } else if (img.alt.length < 5 && !isDecorativeImage(img)) {
      issues.push({
        message: 'Image has potentially insufficient alt text',
        element: elementToString(img),
        selector: generateSelector(img)
      });
    }
  });
  
  // Check for background images that might need context
  const elementsWithBgImage = getElementsWithBackgroundImage();
  elementsWithBgImage.forEach(el => {
    if (el.getAttribute('role') !== 'presentation' && 
        !el.getAttribute('aria-hidden') === 'true') {
      issues.push({
        message: 'Element with background image may need text alternative',
        element: elementToString(el),
        selector: generateSelector(el)
      });
    }
  });
  
  return {
    type: 'altText',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All images have appropriate alt text' 
      : `Found ${issues.length} image(s) with missing or insufficient alt text`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check keyboard navigation
function checkKeyboardNavigation() {
  const issues = [];
  
  // Check for elements that might not be keyboard accessible
  const clickableElements = document.querySelectorAll('div[onclick], span[onclick], p[onclick]');
  clickableElements.forEach(el => {
    if (!el.hasAttribute('tabindex')) {
      issues.push({
        message: 'Element with click handler is not keyboard focusable',
        element: elementToString(el),
        selector: generateSelector(el)
      });
    }
  });
  
  // Check for tabindex > 0
  const elementsWithPositiveTabindex = document.querySelectorAll('[tabindex]');
  elementsWithPositiveTabindex.forEach(el => {
    const tabindex = parseInt(el.getAttribute('tabindex'));
    if (tabindex > 0) {
      issues.push({
        message: 'Element with tabindex > 0 disrupts natural tab order',
        element: elementToString(el),
        selector: generateSelector(el)
      });
    }
  });
  
  // Check for potentially inaccessible custom controls
  const customControls = document.querySelectorAll('[role="button"], [role="checkbox"], [role="radio"], [role="slider"], [role="menuitem"]');
  customControls.forEach(el => {
    if (!el.hasAttribute('tabindex') && !isNativeInteractiveElement(el)) {
      issues.push({
        message: 'Custom control missing keyboard accessibility',
        element: elementToString(el),
        selector: generateSelector(el)
      });
    }
  });
  
  return {
    type: 'keyboardNav',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All interactive elements are keyboard accessible' 
      : `Found ${issues.length} element(s) with keyboard accessibility issues`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check visible focus indicators
function checkFocusVisible() {
  const issues = [];
  
  // This requires manual testing or CSS parsing, which is complex
  // We'll check for common patterns that might hide focus
  
  // Check for outline: none or outline: 0 without alternative
  const styleSheets = document.styleSheets;
  let outlineNoneFound = false;
  
  try {
    for (const sheet of styleSheets) {
      if (sheet.cssRules) {
        for (const rule of sheet.cssRules) {
          if (rule.style && (rule.style.outline === 'none' || rule.style.outline === '0')) {
            outlineNoneFound = true;
            break;
          }
        }
      }
      
      if (outlineNoneFound) break;
    }
  } catch (e) {
    // Cross-origin stylesheet access will cause errors, we'll skip those
    console.log('Could not access some stylesheets due to cross-origin restrictions');
  }
  
  if (outlineNoneFound) {
    issues.push({
      message: 'Potential focus indicator removal detected in stylesheets',
      element: '<style> or <link> elements',
      selector: 'style, link[rel="stylesheet"]'
    });
  }
  
  // Find elements with inline style that removes outline
  const elementsWithoutlineNone = document.querySelectorAll('[style*="outline: none"], [style*="outline:none"]');
  elementsWithoutlineNone.forEach(el => {
    if (isInteractiveElement(el)) {
      issues.push({
        message: 'Interactive element has outline:none style',
        element: elementToString(el),
        selector: generateSelector(el)
      });
    }
  });
  
  return {
    type: 'focusVisible',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'No issues detected with focus visibility' 
      : `Found ${issues.length} potential issue(s) with focus visibility`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check form labels
function checkFormLabels() {
  const issues = [];
  
  // Check inputs without associated labels
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea');
  
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const hasAriaLabel = input.hasAttribute('aria-label') && input.getAttribute('aria-label').trim() !== '';
    const hasAriaLabelledby = input.hasAttribute('aria-labelledby') && input.getAttribute('aria-labelledby').trim() !== '';
    const hasTitle = input.hasAttribute('title') && input.getAttribute('title').trim() !== '';
    
    // Check for proper label association
    let hasAssociatedLabel = false;
    
    if (id) {
      const associatedLabel = document.querySelector(`label[for="${id}"]`);
      if (associatedLabel) {
        hasAssociatedLabel = true;
      }
    }
    
    // Check if input is inside a label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      hasAssociatedLabel = true;
    }
    
    // If no proper labeling found, report issue
    if (!hasAssociatedLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
      // Special handling for certain input types
      if (input.type === 'submit' || input.type === 'button' || input.type === 'reset') {
        // These should have value attributes instead of labels
        if (!input.value) {
          issues.push({
            message: `${input.type} input is missing value attribute`,
            element: elementToString(input),
            selector: generateSelector(input)
          });
        }
      } else {
        issues.push({
          message: `${input.tagName.toLowerCase()} element has no associated label`,
          element: elementToString(input),
          selector: generateSelector(input)
        });
      }
    }
    
    // Check for placeholder-only labels (not sufficient for accessibility)
    if (!hasAssociatedLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle && 
        input.hasAttribute('placeholder')) {
      issues.push({
        message: 'Input has placeholder but no proper label',
        element: elementToString(input),
        selector: generateSelector(input)
      });
    }
  });
  
  return {
    type: 'formLabels',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All form fields have proper labels' 
      : `Found ${issues.length} form field(s) without proper labels`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check descriptive link text
function checkLinkText() {
  const issues = [];
  const links = document.querySelectorAll('a');
  
  const problematicTexts = [
    'click here', 'click', 'here', 'this link', 'this', 
    'more', 'read more', 'details', 'learn more', 'link'
  ];
  
  links.forEach(link => {
    const linkText = link.textContent.trim().toLowerCase();
    
    // Check for empty links
    if (linkText === '') {
      // Only flag if no aria-label and no img with alt text
      if (!link.hasAttribute('aria-label') && !link.hasAttribute('title')) {
        const img = link.querySelector('img[alt]');
        if (!img || img.alt.trim() === '') {
          issues.push({
            message: 'Link has no text content',
            element: elementToString(link),
            selector: generateSelector(link)
          });
        }
      }
    } 
    // Check for non-descriptive link text
    else if (problematicTexts.includes(linkText)) {
      issues.push({
        message: `Link text "${linkText}" is not descriptive`,
        element: elementToString(link),
        selector: generateSelector(link)
      });
    }
    
    // Check for URLs as link text
    if (linkText.startsWith('http') || linkText.startsWith('www.')) {
      issues.push({
        message: 'Link text contains raw URL',
        element: elementToString(link),
        selector: generateSelector(link)
      });
    }
  });
  
  return {
    type: 'linkText',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All links have descriptive text' 
      : `Found ${issues.length} link(s) with non-descriptive text`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check heading structure
function checkHeadingStructure() {
  const issues = [];
  
  // Get all headings
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headingsArray = Array.from(headings);
  
  // Check if there's an h1
  const h1Elements = document.querySelectorAll('h1');
  if (h1Elements.length === 0) {
    issues.push({
      message: 'Page does not contain an h1 heading',
      element: '<body>',
      selector: 'body'
    });
  } else if (h1Elements.length > 1) {
    issues.push({
      message: 'Page contains multiple h1 headings',
      element: elementToString(h1Elements[1]),
      selector: 'h1'
    });
  }
  
  // Check for proper heading sequence
  let previousLevel = 0;
  
  headingsArray.forEach(heading => {
    const currentLevel = parseInt(heading.tagName.substring(1));
    
    // Heading levels should not skip (e.g., h1 -> h3)
    if (previousLevel > 0 && currentLevel > previousLevel + 1) {
      issues.push({
        message: `Heading level skipped from h${previousLevel} to h${currentLevel}`,
        element: elementToString(heading),
        selector: generateSelector(heading)
      });
    }
    
    previousLevel = currentLevel;
  });
  
  // Check for empty headings
  headingsArray.forEach(heading => {
    if (heading.textContent.trim() === '') {
      issues.push({
        message: `Empty ${heading.tagName} heading`,
        element: elementToString(heading),
        selector: generateSelector(heading)
      });
    }
  });
  
  return {
    type: 'headings',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'Heading structure is properly nested' 
      : `Found ${issues.length} issue(s) with heading structure`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check for captions/transcripts in media
function checkCaptions() {
  const issues = [];
  
  // Check videos
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    const tracks = video.querySelectorAll('track[kind="captions"], track[kind="subtitles"]');
    if (tracks.length === 0) {
      issues.push({
        message: 'Video element does not have captions',
        element: elementToString(video),
        selector: generateSelector(video)
      });
    }
  });
  
  // Check iframes (could be YouTube or other video providers)
  const iframes = document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]');
  iframes.forEach(iframe => {
    const src = iframe.getAttribute('src');
    if (!src.includes('cc_load_policy=1') && !src.includes('&cc=1')) {
      issues.push({
        message: 'Video iframe does not have captions parameter',
        element: elementToString(iframe),
        selector: generateSelector(iframe)
      });
    }
  });
  
  // Check audio elements
  const audios = document.querySelectorAll('audio');
  audios.forEach(audio => {
    // Look for nearby transcript element
    const isTranscriptNearby = checkForNearbyTranscript(audio);
    if (!isTranscriptNearby) {
      issues.push({
        message: 'Audio element does not have an identified transcript',
        element: elementToString(audio),
        selector: generateSelector(audio)
      });
    }
  });
  
  return {
    type: 'captions',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All media elements have captions or transcripts' 
      : `Found ${issues.length} media element(s) without captions or transcripts`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check for time limits in forms and interactions
function checkTimeouts() {
  const issues = [];
  
  // Check for meta refresh
  const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    issues.push({
      message: 'Page uses meta refresh which can cause accessibility issues',
      element: elementToString(metaRefresh),
      selector: 'meta[http-equiv="refresh"]'
    });
  }
  
  // Check for forms with potential auto-submission
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    if (form.hasAttribute('onsubmit') && 
        form.getAttribute('onsubmit').includes('setTimeout')) {
      issues.push({
        message: 'Form may use timed submission',
        element: elementToString(form),
        selector: generateSelector(form)
      });
    }
  });
  
  // Look for potential timeout scripts
  // This is limited as we can't analyze all JavaScript
  const scripts = document.querySelectorAll('script');
  let timeoutFound = false;
  
  scripts.forEach(script => {
    const content = script.textContent;
    if (content && 
        (content.includes('setTimeout') || content.includes('setInterval')) &&
        (content.includes('form') || content.includes('submit') || content.includes('redirect'))) {
      timeoutFound = true;
    }
  });
  
  if (timeoutFound) {
    issues.push({
      message: 'Page may contain scripts with timeouts affecting user interaction',
      element: '<script> elements',
      selector: 'script'
    });
  }
  
  return {
    type: 'timeouts',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'No time limit issues detected' 
      : `Found ${issues.length} potential time limit issue(s)`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Check for flashing content and excessive animations
function checkAnimations() {
  const issues = [];
  
  // Check for animation CSS properties
  const animatedElements = document.querySelectorAll('*');
  const potentiallyFlashing = [];
  
  animatedElements.forEach(el => {
    const style = window.getComputedStyle(el);
    const hasAnimation = style.animation !== 'none' || style.transition !== 'none';
    
    if (hasAnimation) {
      // Check animations that change opacity or visibility rapidly
      if (style.animation.includes('opacity') || 
          style.animation.includes('flash') || 
          style.transition.includes('opacity')) {
        potentiallyFlashing.push(el);
      }
    }
  });
  
  if (potentiallyFlashing.length > 0) {
    potentiallyFlashing.forEach(el => {
      issues.push({
        message: 'Element has animation that may cause issues for users with sensitivities',
        element: elementToString(el),
        selector: generateSelector(el)
      });
    });
  }
  
  // Check for elements with blinking or marquee
  const blinkingElements = document.querySelectorAll('marquee, blink, [style*="animation: blink"], [style*="animation:blink"]');
  blinkingElements.forEach(el => {
    issues.push({
      message: 'Element uses outdated blinking or marquee effect',
      element: elementToString(el),
      selector: generateSelector(el)
    });
  });
  
  // Check for rapid GIFs or videos
  const gifs = document.querySelectorAll('img[src*=".gif"]');
  gifs.forEach(gif => {
    issues.push({
      message: 'GIF image may contain flashing content (manual review required)',
      element: elementToString(gif),
      selector: generateSelector(gif)
    });
  });
  
  return {
    type: 'animations',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'No potentially problematic animations detected' 
      : `Found ${issues.length} element(s) with potentially problematic animations`,
    details: issues,
    timestamp: new Date().toISOString()
  };
}

// Highlight elements matching a selector
function highlightElements(selector) {
  // First, clear any existing highlights
  clearHighlights();
  
  if (!selector) return;
  
  try {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach((el, index) => {
      el.classList.add('accessibility-highlight');
      
      // Scroll the first element into view
      if (index === 0) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    });
    
    // Auto-clear highlights after 5 seconds
    setTimeout(clearHighlights, 5000);
  } catch (e) {
    console.error('Invalid selector:', e);
  }
}

// Clear highlights
function clearHighlights() {
  const highlighted = document.querySelectorAll('.accessibility-highlight, .accessibility-warning, .accessibility-fix');
  
  highlighted.forEach(el => {
    el.classList.remove('accessibility-highlight', 'accessibility-warning', 'accessibility-fix');
    el.removeAttribute('data-accessibility-issue');
  });
}

// Suggest fixes for accessibility issues
function suggestFix(checkType) {
  // Implement fix suggestions for each check type
  switch (checkType) {
    case 'altText':
      suggestAltTextFixes();
      break;
    case 'formLabels':
      suggestFormLabelFixes();
      break;
    case 'linkText':
      suggestLinkTextFixes();
      break;
    case 'headings':
      suggestHeadingFixes();
      break;
    default:
      alert('Fix suggestions not implemented for this check type yet.');
  }
}

// Helper function to suggest alt text fixes
function suggestAltTextFixes() {
  const images = document.querySelectorAll('img:not([alt])');
  let fixed = 0;
  
  images.forEach(img => {
    // Generate suggested alt text based on context
    let suggestedAlt = '';
    
    // Try to derive alt from parent links, surrounding text, or filename
    if (img.parentElement && img.parentElement.tagName === 'A') {
      suggestedAlt = img.parentElement.textContent.trim();
    }
    
    if (!suggestedAlt && img.src) {
      // Extract filename from src
      const filename = img.src.split('/').pop().split('?')[0];
      // Clean up filename
      suggestedAlt = filename
        .replace(/[_-]/g, ' ')
        .replace(/\.\w+$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
        
      // Capitalize first letter
      suggestedAlt = suggestedAlt.charAt(0).toUpperCase() + suggestedAlt.slice(1);
    }
    
    // Highlight the image and suggest the alt text
    img.classList.add('accessibility-highlight');
    img.setAttribute('data-accessibility-issue', `Suggested alt: "${suggestedAlt}"`);
    fixed++;
  });
  
  // Scroll to the first highlighted element
  const firstHighlighted = document.querySelector('.accessibility-highlight');
  if (firstHighlighted) {
    firstHighlighted.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // Auto-clear highlights after 10 seconds
    setTimeout(clearHighlights, 10000);
  }
  
  if (fixed === 0) {
    alert('No images found that need alt text fixes.');
  } else {
    alert(`Suggested alt text for ${fixed} image(s). Check the highlighted elements.`);
  }
}

// Helper function to suggest form label fixes
function suggestFormLabelFixes() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea');
  let fixed = 0;
  
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const parentLabel = input.closest('label');
    
    if (!hasLabel && !parentLabel && !input.hasAttribute('aria-label')) {
      // Generate a unique ID if none exists
      let inputId = id;
      if (!inputId) {
        inputId = `input_${Math.random().toString(36).substring(2, 9)}`;
        input.setAttribute('id', inputId);
      }
      
      // Suggest label text based on context
      let suggestedLabel = '';
      
      // Try to derive from placeholder, name, or nearby text
      if (input.hasAttribute('placeholder')) {
        suggestedLabel = input.getAttribute('placeholder');
      } else if (input.hasAttribute('name')) {
        suggestedLabel = input.getAttribute('name')
          .replace(/[_-]/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .trim();
          
        // Capitalize first letter
        suggestedLabel = suggestedLabel.charAt(0).toUpperCase() + suggestedLabel.slice(1);
      }
      
      // Highlight the input
      input.classList.add('accessibility-highlight');
      input.setAttribute('data-accessibility-issue', 
        `Add label: <label for="${inputId}">${suggestedLabel}</label>`);
      fixed++;
    }
  });
  
  // Scroll to the first highlighted element
  const firstHighlighted = document.querySelector('.accessibility-highlight');
  if (firstHighlighted) {
    firstHighlighted.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // Auto-clear highlights after 10 seconds
    setTimeout(clearHighlights, 10000);
  }
  
  if (fixed === 0) {
    alert('No form inputs found that need label fixes.');
  } else {
    alert(`Suggested label fixes for ${fixed} input(s). Check the highlighted elements.`);
  }
}

// Helper function to suggest link text fixes
function suggestLinkTextFixes() {
  const problematicTexts = [
    'click here', 'click', 'here', 'this link', 'this', 
    'more', 'read more', 'details', 'learn more', 'link'
  ];
  
  const links = document.querySelectorAll('a');
  let fixed = 0;
  
  links.forEach(link => {
    const linkText = link.textContent.trim().toLowerCase();
    
    if (problematicTexts.includes(linkText)) {
      // Try to generate better link text
      let suggestedText = '';
      
      // Check if the link has a title attribute
      if (link.hasAttribute('title')) {
        suggestedText = link.getAttribute('title');
      } 
      // Check destination URL for clues
      else if (link.hasAttribute('href')) {
        const href = link.getAttribute('href');
        const urlParts = href.split('/').filter(Boolean);
        
        if (urlParts.length > 0) {
          const lastPart = urlParts[urlParts.length - 1]
            .replace(/[_-]/g, ' ')
            .replace(/\.\w+$/, '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim();
            
          if (lastPart) {
            suggestedText = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
          }
        }
      }
      
      if (!suggestedText) {
        suggestedText = "More specific link text needed";
      }
      
      // Highlight the link
      link.classList.add('accessibility-highlight');
      link.setAttribute('data-accessibility-issue', 
        `Replace "${linkText}" with more descriptive text like "${suggestedText}"`);
      fixed++;
    }
  });
  
  // Scroll to the first highlighted element
  const firstHighlighted = document.querySelector('.accessibility-highlight');
  if (firstHighlighted) {
    firstHighlighted.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // Auto-clear highlights after 10 seconds
    setTimeout(clearHighlights, 10000);
  }
  
  if (fixed === 0) {
    alert('No links found that need text improvements.');
  } else {
    alert(`Suggested text improvements for ${fixed} link(s). Check the highlighted elements.`);
  }
}

// Helper function to suggest heading structure fixes
function suggestHeadingFixes() {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headingsArray = Array.from(headings);
  let fixed = 0;
  
  // Check for missing h1
  const h1Elements = document.querySelectorAll('h1');
  if (h1Elements.length === 0) {
    // Look for potential h1 candidate (usually a main title)
    const potentialH1 = document.querySelector('.title, #title, .main-title, #main-title');
    if (potentialH1) {
      potentialH1.classList.add('accessibility-highlight');
      potentialH1.setAttribute('data-accessibility-issue', 
        'This element should be an <h1> heading');
      fixed++;
    }
  }
  
  // Check for proper heading sequence
  let previousLevel = 0;
  let previousHeading = null;
  
  headingsArray.forEach(heading => {
    const currentLevel = parseInt(heading.tagName.substring(1));
    
    // Heading levels should not skip (e.g., h1 -> h3)
    if (previousLevel > 0 && currentLevel > previousLevel + 1) {
      heading.classList.add('accessibility-highlight');
      heading.setAttribute('data-accessibility-issue', 
        `This h${currentLevel} should be an h${previousLevel + 1} to maintain hierarchy`);
      fixed++;
    }
    
    previousLevel = currentLevel;
    previousHeading = heading;
  });
  
  // Scroll to the first highlighted element
  const firstHighlighted = document.querySelector('.accessibility-highlight');
  if (firstHighlighted) {
    firstHighlighted.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    // Auto-clear highlights after 10 seconds
    setTimeout(clearHighlights, 10000);
  }
  
  if (fixed === 0) {
    alert('No heading structure issues found that need fixing.');
  } else {
    alert(`Suggested heading fixes for ${fixed} element(s). Check the highlighted elements.`);
  }
}

// Helper functions

// Check if an element is a native interactive element
function isNativeInteractiveElement(el) {
  const interactiveTags = [
    'a', 'button', 'input', 'select', 'textarea', 'video', 'audio'
  ];
  
  return interactiveTags.includes(el.tagName.toLowerCase());
}

// Check if an element is interactive
function isInteractiveElement(el) {
  if (isNativeInteractiveElement(el)) return true;
  
  if (el.hasAttribute('tabindex')) return true;
  
  const interactiveRoles = [
    'button', 'link', 'checkbox', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'radio', 'searchbox', 'slider', 'spinbutton',
    'switch', 'tab', 'textbox'
  ];
  
  return el.hasAttribute('role') && interactiveRoles.includes(el.getAttribute('role'));
}

// Check if an image is likely decorative
function isDecorativeImage(img) {
  // If it has empty alt, it's explicitly marked as decorative
  if (img.hasAttribute('alt') && img.alt === '') return true;
  
  // Check if it has role="presentation" or aria-hidden="true"
  if (img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true') {
    return true;
  }
  
  // Check if it's likely a small icon or decoration
  const width = parseInt(img.getAttribute('width') || img.style.width || 0);
  const height = parseInt(img.getAttribute('height') || img.style.height || 0);
  
  // Small images are often decorative
  if ((width > 0 && width <= 24) && (height > 0 && height <= 24)) {
    return true;
  }
  
  // Check for common decorative image patterns
  const src = img.getAttribute('src') || '';
  return src.includes('separator') || 
         src.includes('spacer') || 
         src.includes('divider') || 
         src.includes('icon') ||
         src.includes('bg') ||
         src.includes('background');
}

// Find elements with background images
function getElementsWithBackgroundImage() {
  const allElements = document.querySelectorAll('*');
  const elementsWithBgImage = [];
  
  allElements.forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.includes('gradient')) {
      elementsWithBgImage.push(el);
    }
  });
  
  return elementsWithBgImage;
}

// Check if there's a transcript near an audio element
function checkForNearbyTranscript(audioElement) {
  // Look for common transcript indicators nearby
  const parent = audioElement.parentElement;
  if (!parent) return false;
  
  // Check for transcript-related elements in parent or siblings
  const transcriptElements = parent.querySelectorAll(
    '[id*="transcript"], [class*="transcript"], a[href*="transcript"]'
  );
  
  if (transcriptElements.length > 0) return true;
  
  // Check sibling elements for transcript text
  const siblings = Array.from(parent.children);
  for (const sibling of siblings) {
    const text = sibling.textContent.toLowerCase();
    if (text.includes('transcript') || text.includes('text version')) {
      return true;
    }
  }
  
  return false;
}

// Convert element to string representation
function elementToString(el) {
  const clone = el.cloneNode(false);
  
  // Don't include long content or URLs
  if (clone.textContent && clone.textContent.length > 20) {
    clone.textContent = clone.textContent.substring(0, 20) + '...';
  }
  
  let outerHTML = clone.outerHTML;
  
  // Truncate if too long
  if (outerHTML.length > 100) {
    outerHTML = outerHTML.substring(0, 100) + '...>';
  }
  
  return outerHTML;
}

// Generate a CSS selector for an element
function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const tag = element.tagName.toLowerCase();
  
  if (tag === 'body' || tag === 'html') {
    return tag;
  }
  
  if (element.className) {
    const classes = Array.from(element.classList).filter(c => !c.startsWith('accessibility-'));
    if (classes.length > 0) {
      return `${tag}.${classes.join('.')}`;
    }
  }
  
  // For common elements, use attribute selectors
  if (tag === 'img' && element.src) {
    const src = element.src.split('/').pop().split('?')[0];
    return `img[src*="${src}"]`;
  }
  
  if (tag === 'a' && element.href) {
    const href = element.href.split('/').pop().split('?')[0];
    return `a[href*="${href}"]`;
  }
  
  if (element.hasAttribute('name')) {
    return `${tag}[name="${element.getAttribute('name')}"]`;
  }
  
  // Fallback to nth-child
  const parent = element.parentElement;
  if (parent) {
    const children = Array.from(parent.children);
    const index = children.indexOf(element) + 1;
    return `${generateSelector(parent)} > ${tag}:nth-child(${index})`;
  }
  
  return tag;
}