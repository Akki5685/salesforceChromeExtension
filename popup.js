// popup.js - Complete working version with all functions
document.addEventListener('DOMContentLoaded', function() {
  console.log('Enhanced Test Recorder popup loaded');

  const injectButton = document.getElementById('injectRecorder');
  const statusDiv = document.getElementById('status');

  injectButton.addEventListener('click', async () => {
    const originalText = injectButton.textContent;
    injectButton.textContent = '⏳ Injecting...';
    injectButton.disabled = true;
    statusDiv.textContent = 'Injecting recorder...';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab.url);
      
      // Validate tab URL
      if (!isValidInjectionTarget(tab.url)) {
        throw new Error('Cannot inject into browser internal pages');
      }
      
      // Use the reliable inline approach
      await injectInlineRecorder(tab.id);
      console.log('Recorder injected successfully');
      
      injectButton.textContent = '✅ Injected!';
      statusDiv.textContent = 'Recorder launched successfully!';
      
      // Close popup after success
      setTimeout(() => window.close(), 1500);
      
    } catch (error) {
      console.error('Injection error:', error);
      handleInjectionError(error, statusDiv, injectButton, originalText);
    }
  });
});

function isValidInjectionTarget(url) {
  const blockedSchemes = [
    'chrome://', 'chrome-extension://', 'edge://', 
    'moz-extension://', 'about:', 'file://'
  ];
  
  return !blockedSchemes.some(scheme => url.startsWith(scheme));
}

// Direct inline injection approach (most reliable)
async function injectInlineRecorder(tabId) {
  try {
    console.log('Injecting complete recorder...');
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: initializeCompleteRecorder
    });
    
    console.log('Complete recorder injection successful');
    
  } catch (error) {
    console.error('Injection failed:', error);
    throw new Error('Recorder injection failed: ' + error.message);
  }
}

function initializeCompleteRecorder() {
  console.log('Initializing complete recorder...');
  
  // Remove existing recorder if present
  const existing = document.getElementById('enhanced-test-recorder-container');
  if (existing) {
    existing.remove();
    console.log('Removed existing recorder');
  }
  
  // Initialize global state
  window.recorderState = {
    isRecording: false,
    steps: [],
    stepCounter: 0,
    isMinimized: false,
    features: {
      highlight: true,
      xpathPreview: true,
      smartWait: true,
      salesforce: true
    }
  };
  
  // Complete inline modules
  const RecorderModules = {
   XPathGenerator: {
  // Enhanced Salesforce XPath Generator - NO ID attributes, NO classes, NO contains() class logic
  generateXPath(element) {
    if (!element) return '';

    const allAttrs = this.extractAttributes(element);
    const stableAttrs = this.filterAttributes(allAttrs);

    const strategies = [
      () => this.labelBasedXPath(element),
      () => this.titleBasedXPath(element),
      () => this.nameBasedXPath(element, stableAttrs),
      () => this.textBasedXPath(element),
      () => this.attrBasedXPath(element, stableAttrs),
      () => this.salesforceXPath(element, stableAttrs),
      () => this.structuralXPath(element, stableAttrs),
      () => this.positionalFallbackXPath(element)
    ];

    for (const strategy of strategies) {
      const xpath = strategy();
      if (xpath && this.isUnique(xpath)) return xpath;
    }

    const fallback = this.fallbackXPath(element);
    console.warn('⚠️ Using fallback XPath:', fallback);
    return fallback;
  },

  extractAttributes(el) {
    const attrs = {};
    [...el.attributes].forEach(({ name, value }) => {
      if (!name.match(/id|class/i)) attrs[name] = value;
    });
    if (el.textContent?.trim()) attrs['text()'] = el.textContent.trim();
    if (el.tagName) attrs['tagName'] = el.tagName.toLowerCase();
    return { ...attrs, ...this.salesforceContext(el) };
  },

  filterAttributes(attrs) {
    const patterns = [/^\d+$/, /[a-f0-9]{8,}/i, /timestamp|session|guid/i, /\d{4,}/];
    const blacklist = ['id', 'class', 'data-id', 'recordid', 'data-aura-id'];

    return Object.fromEntries(
      Object.entries(attrs).filter(([k, v]) =>
        v && typeof v === 'string' &&
        !blacklist.includes(k.toLowerCase()) &&
        !patterns.some(p => p.test(v)) &&
        v.length > 1 && v.length < 100
      )
    );
  },

  salesforceContext(el) {
    const context = {};
    const getClosestAttr = (selector, attr, key) => {
      const c = el.closest(selector);
      if (c?.getAttribute(attr)) context[key] = c.getAttribute(attr);
    };
    getClosestAttr('[data-field-label]', 'data-field-label', 'field-label-context');
    getClosestAttr('[role="tab"]', 'aria-label', 'tab-context');
    getClosestAttr('[data-record-type]', 'data-record-type', 'record-context');
    getClosestAttr('[aria-label]', 'aria-label', 'section-context');
    getClosestAttr('form', 'name', 'form-context');
    return context;
  },

  isUnique(xpath) {
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return result.snapshotLength === 1;
  },

  labelBasedXPath(el) {
    const label = el.closest('label');
    if (label?.textContent?.trim()) {
      const txt = this.clean(label.textContent);
      return `//label[normalize-space(text())="${txt}"]//${el.tagName.toLowerCase()}`;
    }
    return null;
  },

  titleBasedXPath(el) {
    const title = el.title;
    if (title) {
      const tag = el.tagName.toLowerCase();
      return `//${tag}[@title="${title}"]`;
    }
    return null;
  },

  nameBasedXPath(el, attrs) {
    if (attrs.name) {
      return `//${el.tagName.toLowerCase()}[@name="${attrs.name}"]`;
    }
    return null;
  },

textBasedXPath(el) {
  if (!el || el.children.length > 0) return null;

  const text = el.textContent?.trim();
  if (!text) return null;

  const tag = el.tagName.toLowerCase();
  const safeText = this.clean(text);

  return `//${tag}[normalize-space(text())="${safeText}"]`;
}
,

  attrBasedXPath(el, attrs) {
    const tag = el.tagName.toLowerCase();
    const keys = ['aria-label', 'placeholder', 'title', 'role'];
    for (const key of keys) {
      if (attrs[key]) return `//${tag}[@${key}="${attrs[key]}"]`;
    }
    return null;
  },

  salesforceXPath(el, attrs) {
    if (el.tagName === 'INPUT' && attrs['data-field-label']) {
      return `//div[@data-field-label="${attrs['data-field-label']}"]//input`;
    }
    return null;
  },
  highlightValueByLabel(label) {
  const xpathPatterns = [
    `(//p[@title='${label}'])[1]/following-sibling::*/descendant::a`,
    `(//span[text()='${label}']/../following-sibling::*/descendant::button/span)[1]`,
    `//span[text()='${label}']/parent::div/following-sibling::*/descendant::lightning-formatted-text`,
    `//p[text()='${label}']//following-sibling::*//a`,
    `//span[text()='${label}']/ancestor::div[contains(@class,'slds-form-element')]/div[contains(@class,'slds-form-element__control')]//a | //span[text()='${label}']/ancestor::div[contains(@class,'slds-form-element')]/div[contains(@class,'slds-form-element__control')]//span`
  ];

  for (const xpath of xpathPatterns) {
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    if (result) {
      // Highlight visually
      const rect = result.getBoundingClientRect();
      const hl = document.getElementById('recorder-highlighter');
      if (hl) {
        Object.assign(hl.style, {
          display: 'block',
          left: `${rect.left + window.scrollX - 3}px`,
          top: `${rect.top + window.scrollY - 3}px`,
          width: `${rect.width + 6}px`,
          height: `${rect.height + 6}px`
        });
      }

      // Return value
      return result.innerText?.trim() || result.textContent?.trim() || '';
    }
  }

  console.warn(`No value found for label: "${label}"`);
  return null;
},


  structuralXPath(el, attrs) {
    let current = el;
    const path = [];
    for (let i = 0; i < 3 && current; i++) {
      const tag = current.tagName?.toLowerCase();
      if (!tag) break;
      const attr = current.getAttribute('data-testid') || current.getAttribute('aria-label') || null;
      if (attr) path.unshift(`${tag}[@data-testid="${attr}"]`);
      else path.unshift(tag);
      current = current.parentNode;
    }
    return `//${path.join('/')}`;
  },

  positionalFallbackXPath(el) {
    const tag = el.tagName.toLowerCase();
    const siblings = [...(el.parentNode?.children || [])].filter(c => c.tagName === el.tagName);
    const index = siblings.indexOf(el) + 1;
    return siblings.length === 1 ? `//${tag}` : `//${tag}[${index}]`;
  },

  fallbackXPath(el) {
    const tag = el.tagName.toLowerCase();
    const conditions = [];
    ['role', 'aria-label', 'name', 'title'].forEach(attr => {
      const val = el.getAttribute(attr);
      if (val) conditions.push(`@${attr}="${val}"`);
    });
    const text = el.textContent?.trim();
    if (text && text.length < 50) conditions.push(`contains(text(),"${this.clean(text)}")`);
    return conditions.length ? `//${tag}[${conditions.join(' and ')}]` : this.positionalFallbackXPath(el);
  },

  clean(txt) {
    return txt.replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
  }
},

    
   ActionsHandler : {
  init(recorderState, ui) {
    this.recorderState = recorderState;
    this.ui = ui;
    this.inputTimers = new Map();
    this.bindEvents();
    console.log('ActionsHandler initialized');
    return this;
  },

getLabelForElement(el) {
  if (!el) return null;

  let current = el;
  let level = 0;

  while (current && level < 20) {
    const sibling = current.previousElementSibling;
    
    if (sibling && sibling.textContent.trim()) {
      return sibling.textContent.trim();
    }

    current = current.parentElement;
    level++;
  }

  return null;
}
,

 bindEvents() {
  this.mouseoverHandler = this.mouseoverHandler.bind(this);
  this.mouseoutHandler = this.mouseoutHandler.bind(this);
  this.clickHandler = this.clickHandler.bind(this);
  this.inputHandler = this.inputHandler.bind(this);
  this.keyboardHandler = this.keyboardHandler.bind(this);
  this.altClickHandler = this.altClickHandler.bind(this);

  document.addEventListener('mouseover', this.mouseoverHandler, true);
  document.addEventListener('mouseout', this.mouseoutHandler, true);
    document.addEventListener('click', this.altClickHandler, true); // First: Alt+Click
  document.addEventListener('click', this.clickHandler, true);
  document.addEventListener('input', this.inputHandler, true);
  document.addEventListener('keydown', this.keyboardHandler, true);
}
,

  removeEvents() {
  document.removeEventListener('mouseover', this.mouseoverHandler, true);
  document.removeEventListener('mouseout', this.mouseoutHandler, true);
  document.removeEventListener('click', this.altClickHandler, true); // First: Alt+Click
  document.removeEventListener('click', this.clickHandler, true);
  document.removeEventListener('input', this.inputHandler, true);
  document.removeEventListener('keydown', this.keyboardHandler, true);

  this.inputTimers.forEach(timer => clearTimeout(timer));
  this.inputTimers.clear();
  console.log('Event listeners removed');
}
,

getValueByLabel(label) {
  if (!el) return null;

  const parent = el.parentElement;
  if (!parent) return null;

  const siblings = Array.from(parent.children);
  for (const sibling of siblings) {
    if (sibling === el) continue;

    const text = sibling.textContent?.trim();
    const hasTitle = sibling.hasAttribute('title');

    if (text && text.length <= 50 && (hasTitle || /^[A-Za-z\s]+$/.test(text))) {
      return text;
    }

    // Handle deeply nested <span> or <p> inside sibling
    const nested = sibling.querySelector('p[title], span');
    if (nested && nested.textContent.trim()) {
      return nested.textContent.trim();
    }
  }

  return null;
},


  mouseoverHandler(e) {
    if (!this.recorderState.features.highlight || this._ignoreElement(e.target)) return;
    this.showHighlight(e.target);
    if (this.recorderState.features.xpathPreview) this.showElementInfo(e.target);
  },

  mouseoutHandler() {
    this.hideHighlight();
    this.hideElementInfo();
  },



altClickHandler(e) {
  if (!this.recorderState.isRecording || this._ignoreElement(e.target)) return;

  if (!e.altKey) return; // Only proceed if Alt key is pressed

  e.preventDefault();

  const label = this.getLabelForElement(e.target);
  const value = e.target.textContent?.trim() || e.target.value || '';

  this.recordInteraction(e.target, 'getText', label);
  console.log('Alt+Click recorded label-value pair:', label, value);
},

  clickHandler(e) {
    if (!this.recorderState.isRecording || this._ignoreElement(e.target)) return;
    e.preventDefault(); // prevent navigation for anchor tags
    console.log('Recording click on:', e.target);
    this.recordInteraction(e.target, 'click', '');
  },

  inputHandler(e) {
    if (!this.recorderState.isRecording || this._ignoreElement(e.target)) return;
    const el = e.target;
    const value = el.value;

    if (this.inputTimers.has(el)) clearTimeout(this.inputTimers.get(el));

    const timer = setTimeout(() => {
      const xpath = RecorderModules.XPathGenerator.generateXPath(el);
      const existing = this.recorderState.steps.findIndex(
        s => s.xpath === xpath && s.action === 'sendKeys'
      );

      if (existing !== -1) {
        this.recorderState.steps[existing].data = value;
        this.recorderState.steps[existing].timestamp = new Date().toISOString();
      } else {
        this.recordInteraction(el, 'sendKeys', value);
      }
      this.inputTimers.delete(el);
    }, 1000);

    this.inputTimers.set(el, timer);
  },

  keyboardHandler(e) {
    if (!this.recorderState.isRecording) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.ui.pauseBtn.click();
      setTimeout(() => this.ui.exportBtn.click(), 500);
    }

    // Shortcuts for getText (Ctrl+G) and verify (Ctrl+V)
    if (e.ctrlKey && e.key.toLowerCase() === 'g') {
      const el = document.activeElement;
      if (!this._ignoreElement(el)) {
        const text = el.textContent?.trim();
        this.recordInteraction(el, 'getText', text || '');
      }
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      const el = document.activeElement;
      if (!this._ignoreElement(el)) {
        const value = el.value || el.textContent?.trim() || '';
        this.recordInteraction(el, 'verify', value);
      }
    }
  },

  recordInteraction(element, action, data = '') {
  try {
    const xpath = RecorderModules.XPathGenerator.generateXPath(element);
    const step = {
      id: ++this.recorderState.stepCounter,
      xpath,
      action,
      data,
      element: element.tagName,
      timestamp: new Date().toISOString()
    };

    this.recorderState.steps.push(step);
    this.ui.updateStepsDisplay();
    this.ui.updateMiniStatus();

    this.ui.statusBar.textContent = `🔴 Recording - ${this.recorderState.steps.length} steps captured`;
    console.log('Recorded step:', step);
  } catch (err) {
    console.error('Failed to record step:', err);
  }
}
,

  showHighlight(el) {
    const rect = el.getBoundingClientRect();
    const hl = document.getElementById('recorder-highlighter');
    if (hl) {
      Object.assign(hl.style, {
        display: 'block',
        left: `${rect.left + window.scrollX - 3}px`,
        top: `${rect.top + window.scrollY - 3}px`,
        width: `${rect.width + 6}px`,
        height: `${rect.height + 6}px`
      });
    }
  },

  hideHighlight() {
    const hl = document.getElementById('recorder-highlighter');
    if (hl) hl.style.display = 'none';
  },

  showElementInfo(el) {
    const rect = el.getBoundingClientRect();
    const xpath = RecorderModules.XPathGenerator.generateXPath(el);
    const info = document.getElementById('recorder-element-info');

    if (info) {
      info.innerHTML = `
        <strong>Tag:</strong> ${el.tagName.toLowerCase()}<br>
        <strong>XPath:</strong> <span style="font-family: monospace; font-size: 10px;">${xpath}</span><br>
        ${el.id ? `<strong>ID:</strong> ${el.id}<br>` : ''}
        ${el.className ? `<strong>Class:</strong> ${el.className.split(' ').slice(0, 2).join(' ')}<br>` : ''}
      `;

      Object.assign(info.style, {
        display: 'block',
        left: `${Math.min(rect.left + window.scrollX + 10, window.innerWidth - 320)}px`,
        top: `${rect.bottom + window.scrollY + 10}px`
      });
    }
  },

  hideElementInfo() {
    const info = document.getElementById('recorder-element-info');
    if (info) info.style.display = 'none';
  },

  _ignoreElement(el) {
    return el.closest('#enhanced-test-recorder-container');
  }
},
    
   ExportHandler: {
  init(recorderState, ui) {
    this.recorderState = recorderState;
    this.ui = ui;
    console.log('ExportHandler initialized');
    console.log('Initial recorder state:', this.recorderState);
    return this;
  },
  
  async exportFiles() {
    // Enhanced debugging for the export issue
    console.log('🔍 Export triggered - debugging recorder state...');
    console.log('Recorder state object:', this.recorderState);
    console.log('Steps array:', this.recorderState?.steps);
    console.log('Steps length:', this.recorderState?.steps?.length);
    console.log('Window recorder state:', window.recorderState);
    
    // Check if we have steps in either location
    const steps = this.recorderState?.steps || window.recorderState?.steps || [];
    console.log('Resolved steps:', steps);
    
    if (steps.length === 0) {
      // Enhanced error message with debugging info
      const debugInfo = `
Debug Information:
- Recorder State Exists: ${!!this.recorderState}
- Steps Array Exists: ${!!this.recorderState?.steps}
- Steps Length: ${this.recorderState?.steps?.length || 0}
- Window State Steps: ${window.recorderState?.steps?.length || 0}
- Is Recording: ${this.recorderState?.isRecording || window.recorderState?.isRecording}

Please try:
1. Start recording by clicking the "Start" button
2. Interact with some elements on the page
3. Pause recording
4. Then try exporting again
      `;
      
      console.error('❌ No steps to export. Debug info:', debugInfo);
      alert('No steps recorded to export!\n\n' + debugInfo);
      return;
    }
    
    try {
      this.updateStatus('⏳ Generating files...', '#d1ecf1', '#0c5460');
      
      // Use the resolved steps array
      console.log(`📝 Generating files for ${steps.length} steps...`);
      
      const pageElements = this.generatePageElements(steps);
      const stepDefinitions = this.generateStepDefinitions(steps);
      const featureFile = this.generateFeatureFile(steps);
      
      // Log generated content length for debugging
      console.log('Generated files:', {
        pageElements: pageElements.length + ' chars',
        stepDefinitions: stepDefinitions.length + ' chars', 
        featureFile: featureFile.length + ' chars'
      });
      
      this.downloadFile('PageElements.java', pageElements);
      setTimeout(() => this.downloadFile('StepDefinitions.java', stepDefinitions), 300);
      setTimeout(() => this.downloadFile('UITest.feature', featureFile), 600);
      
      this.updateStatus('✅ Files exported successfully!', '#d4edda', '#155724');
      
      setTimeout(() => {
        this.updateStatus('Ready to record interactions', '#e2e3e5', '#6c757d');
      }, 3000);
      
    } catch (error) {
      console.error('Export error:', error);
      this.updateStatus('❌ Export failed - ' + error.message, '#f8d7da', '#721c24');
    }
  },
  
  updateStatus(message, bgColor, textColor) {
    if (this.ui?.statusBar) {
      this.ui.statusBar.style.background = bgColor;
      this.ui.statusBar.style.color = textColor;
      this.ui.statusBar.textContent = message;
    } else {
      console.warn('Status bar not found, message:', message);
    }
  },
  
  generatePageElements(steps = null) {
    // Use provided steps or fall back to instance steps
    const stepsToUse = steps || this.recorderState?.steps || window.recorderState?.steps || [];
    console.log(`Generating PageElements for ${stepsToUse.length} steps`);
    
    const elementMap = new Map();
    stepsToUse.forEach(step => {
      const elementName = this.generateElementName(step);
      elementMap.set(elementName, step.xpath);
      console.log(`Added element: ${elementName} -> ${step.xpath}`);
    });

    let javaCode = `package pageObjects;

import org.openqa.selenium.By;

/**
 * Page Elements - Generated by Enhanced Test Automation Recorder
 * Generated on: ${new Date().toISOString()}
 * Total elements: ${elementMap.size}
 * Total steps: ${stepsToUse.length}
 */
public class PageElements {
    
`;
    
    elementMap.forEach((xpath, elementName) => {
      javaCode += `    /** XPath: ${xpath} */\n`;
      javaCode += `    public static final By ${elementName} = By.xpath("${xpath}");\n\n`;
    });
    
    javaCode += `}`;
    console.log('Generated PageElements.java:', javaCode.length + ' characters');
    return javaCode;
  },
  
  generateStepDefinitions(steps = null) {
    const stepsToUse = steps || this.recorderState?.steps || window.recorderState?.steps || [];
    console.log(`Generating StepDefinitions for ${stepsToUse.length} steps`);
    
    const stepMethods = new Set();
    stepsToUse.forEach(step => {
      const methodName = this.generateMethodName(step);
      const stepDef = this.generateStepDefinition(step, methodName);
      stepMethods.add(stepDef);
      console.log(`Added step method: ${methodName}`);
    });

    let javaCode = `package stepDefinitions;

import io.cucumber.java.en.*;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.JavascriptExecutor;
import java.time.Duration;
import pageObjects.PageElements;

/**
 * Step Definitions - Generated by Enhanced Test Automation Recorder
 * Generated on: ${new Date().toISOString()}
 * Total steps: ${stepsToUse.length}
 * Total methods: ${stepMethods.size}
 */
public class StepDefinitions {
    
    private WebDriver driver;
    private WebDriverWait wait;
    private Actions actions;
    private JavascriptExecutor js;
    
    public StepDefinitions(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        this.actions = new Actions(driver);
        this.js = (JavascriptExecutor) driver;
    }
    
`;
    
    stepMethods.forEach(method => {
      javaCode += method + '\n';
    });
    
    javaCode += `}`;
    console.log('Generated StepDefinitions.java:', javaCode.length + ' characters');
    return javaCode;
  },
  
  generateFeatureFile(steps = null) {
    const stepsToUse = steps || this.recorderState?.steps || window.recorderState?.steps || [];
    const stepText = this.ui?.stepTextArea?.value || 'UI Automation Test';
    
    console.log(`Generating FeatureFile for ${stepsToUse.length} steps`);
    
    const featureFile = `@UITest @Regression
Feature: ${stepText}
  As a user
  I want to perform UI operations on the application
  So that I can accomplish my business tasks

  Background:
    Given the user has access to the application
    And the page is loaded successfully

  Scenario: Recorded user interactions
    Given user is on the target page
${stepsToUse.map(step => `    When ${this.generateStepDescription(step)}`).join('\n')}
    Then the operation should complete successfully
    And no errors should be displayed on the page

  # Additional scenarios can be added here
  @SmokeTest  
  Scenario Outline: Data-driven test execution
    Given user is on the target page
    When user performs the recorded actions with "<testData>"
    Then the expected result "<expectedResult>" should be displayed
    
    Examples:
      | testData | expectedResult |
      | data1    | result1       |
      | data2    | result2       |
`;
    
    console.log('Generated UITest.feature:', featureFile.length + ' characters');
    return featureFile;
  },
  
  generateElementName(step) {
    console.log('Generating element name for step:', step);
    
    // Enhanced element name generation with more patterns
    const patterns = [
      { regex: /@data-field-label="([^"]+)"/, suffix: 'Field', priority: 1 },
      { regex: /@placeholder="([^"]+)"/, suffix: 'Field', priority: 2 },
      { regex: /@aria-label="([^"]+)"/, suffix: 'Element', priority: 3 },
      { regex: /@name="([^"]+)"/, suffix: 'Element', priority: 4 },
      { regex: /normalize-space\(text\(\)\)="([^"]+)"/, suffix: 'Button', priority: 5 },
      { regex: /@title="([^"]+)"/, suffix: 'Element', priority: 6 },
      { regex: /@data-testid="([^"]+)"/, suffix: 'Element', priority: 7 }
    ];
    
    // Sort by priority and try each pattern
    patterns.sort((a, b) => a.priority - b.priority);
    
    for (const pattern of patterns) {
      const match = step.xpath.match(pattern.regex);
      if (match && match[1]) {
        const elementName = this.toCamelCase(match[1]) + pattern.suffix;
        console.log(`Generated element name: ${elementName} from ${pattern.regex}`);
        return elementName;
      }
    }
    
    // Fallback to step-based naming
    const fallbackName = `element${step.id}`;
    console.log(`Using fallback element name: ${fallbackName}`);
    return fallbackName;
  },
  
  generateMethodName(step) {
    const elementName = this.generateElementName(step);
    const methodName = `user_${step.action}_${elementName}`;
    console.log(`Generated method name: ${methodName}`);
    return methodName;
  },
  
  generateStepDefinition(step, methodName) {
    const elementName = this.generateElementName(step);
    
    const templates = {
      click: {
        annotation: `@When("User clicks on ${elementName}")`,
        signature: `public void ${methodName}()`,
        body: `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(PageElements.${elementName}));
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
        element.click();
        System.out.println("✅ Successfully clicked on ${elementName}");`
      },
      sendKeys: {
        annotation: `@When("User enters {string} in ${elementName}")`,
        signature: `public void ${methodName}(String text)`,
        body: `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
        element.clear();
        element.sendKeys(text);
        System.out.println("✅ Successfully entered text: '" + text + "' in ${elementName}");`
      },
      clear: {
        annotation: `@When("User clears ${elementName}")`,
        signature: `public void ${methodName}()`,
        body: `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
        element.clear();
        System.out.println("✅ Successfully cleared ${elementName}");`
      },
      hover: {
        annotation: `@When("User hovers over ${elementName}")`,
        signature: `public void ${methodName}()`,
        body: `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
        actions.moveToElement(element).perform();
        System.out.println("✅ Successfully hovered over ${elementName}");`
      },
      doubleClick: {
        annotation: `@When("User double clicks on ${elementName}")`,
        signature: `public void ${methodName}()`,
        body: `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(PageElements.${elementName}));
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
        actions.doubleClick(element).perform();
        System.out.println("✅ Successfully double clicked on ${elementName}");`
      }
    };
    
    const template = templates[step.action] || {
      annotation: `@When("User performs ${step.action} on ${elementName}")`,
      signature: `public void ${methodName}()`,
      body: `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
        // TODO: Implement ${step.action} action for ${elementName}
        System.out.println("⚠️ Action ${step.action} needs implementation for ${elementName}");`
    };
    
    return `    ${template.annotation}
    ${template.signature} {
        try {
${template.body}
        } catch (Exception e) {
            System.err.println("❌ Failed to perform ${step.action} on ${elementName}: " + e.getMessage());
            js.executeScript("arguments[0].style.border='3px solid red';", driver.findElement(PageElements.${elementName}));
            throw new RuntimeException("Step failed: ${step.action} on ${elementName}", e);
        }
    }
`;
  },
  
  generateStepDescription(step) {
    const elementName = this.generateElementName(step);
    const descriptions = {
      click: `user clicks on ${elementName}`,
      sendKeys: `user enters "${step.data || '{text}'}" in ${elementName}`,
      clear: `user clears ${elementName}`,
      hover: `user hovers over ${elementName}`,
      doubleClick: `user double clicks on ${elementName}`
    };
    return descriptions[step.action] || `user performs ${step.action} on ${elementName}`;
  },
  
  toCamelCase(str) {
    return str.replace(/[^a-zA-Z0-9]/g, ' ')
              .trim()
              .split(' ')
              .filter(word => word.length > 0)
              .map((word, index) => 
                index === 0 ? word.toLowerCase() : 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join('');
  },
  
  downloadFile(filename, content) {
    console.log(`📥 Attempting to download: ${filename} (${content.length} chars)`);
    
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Successfully downloaded: ${filename}`);
    } catch (error) {
      console.error(`❌ Download failed for ${filename}:`, error);
      this.fallbackDownload(filename, content);
    }
  },
  
  fallbackDownload(filename, content) {
    console.log(`🔄 Using fallback download method for: ${filename}`);
    
    try {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${filename}</title>
            <style>
              body { font-family: 'Courier New', monospace; margin: 20px; background: #f5f5f5; }
              .header { background: #667eea; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd; }
              textarea { width: 100%; height: 70vh; font-family: monospace; font-size: 12px; }
              button { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 10px 5px; }
              button:hover { background: #5a6fd8; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>📄 ${filename}</h2>
              <p>Generated by Enhanced Test Automation Recorder</p>
              <p>⚠️ Auto-download failed. Please copy the content and save manually.</p>
            </div>
            <div class="content">
              <button onclick="selectAll()">📋 Select All</button>
              <button onclick="copyToClipboard()">📋 Copy to Clipboard</button>
              <button onclick="window.close()">❌ Close</button>
              <br><br>
              <textarea id="content" readonly>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
            <script>
              function selectAll() {
                document.getElementById('content').select();
              }
              function copyToClipboard() {
                const textarea = document.getElementById('content');
                textarea.select();
                document.execCommand('copy');
                alert('Content copied to clipboard!');
              }
              window.onload = function() { selectAll(); };
            </script>
          </body>
          </html>
        `;
        
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        console.log(`📄 Opened fallback window for: ${filename}`);
      } else {
        throw new Error('Could not open new window');
      }
    } catch (fallbackError) {
      console.error('❌ Fallback download also failed:', fallbackError);
      alert(`Download failed for ${filename}.\n\nContent preview:\n${content.substring(0, 500)}...`);
    }
  },
  
  // Debug method to manually check recorder state
  debugRecorderState() {
    console.log('🔍 Manual debug of recorder state:');
    console.log('this.recorderState:', this.recorderState);
    console.log('window.recorderState:', window.recorderState);
    console.log('Steps in this.recorderState:', this.recorderState?.steps);
    console.log('Steps in window.recorderState:', window.recorderState?.steps);
    
    return {
      localSteps: this.recorderState?.steps?.length || 0,
      globalSteps: window.recorderState?.steps?.length || 0,
      isRecording: this.recorderState?.isRecording || window.recorderState?.isRecording
    };
  }
},
  };
  
  
  // Create recorder UI
  createRecorderUI();
  
  // Get UI references
  const ui = getUIReferences();
  
  // Initialize modules
  const actionsHandler = RecorderModules.ActionsHandler.init(window.recorderState, ui);
  const exportHandler = RecorderModules.ExportHandler.init(window.recorderState, ui);
  
  // Bind UI events
  bindUIEvents(ui, actionsHandler, exportHandler);
  
  // Show welcome message
  showWelcomeMessage(ui);
  
  console.log('✅ Complete Test Recorder initialized successfully!');
  
  // Shared UI functions
  function createRecorderUI() {
    const container = document.createElement('div');
    container.id = 'enhanced-test-recorder-container';
    container.style.cssText = `
      position: fixed !important; top: 20px !important; right: 20px !important;
      z-index: 2147483647 !important; background: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px) !important; border-radius: 16px !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important; width: 450px !important;
      max-height: 85vh !important; overflow-y: auto !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-size: 14px !important; padding: 30px !important; transition: all 0.3s ease !important;
      resize: both !important; min-width: 350px !important; min-height: 200px !important;
    `;
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; background-color: #002f6c; color: white; margin: -30px -30px 20px -30px; padding: 20px 30px; border-radius: 16px 16px 0 0; cursor: move; user-select: none;">
        <h1 style="color: white; font-size: 20px; font-weight: 600; margin-bottom: 5px;">🚀 Test Recorder</h1>
        <p style="color: #e0e0e0; font-size: 12px;">Advanced BDD Test Generation</p>
      </div>
      <div id="recorderContent" style="transition: all 0.3s ease;">
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #34495e; font-size: 12px;">Write Steps:</label>
          <textarea id="stepLabel" rows="2" style="width: 100%; padding: 8px 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 12px; background: white; font-family: inherit; resize: vertical; min-height: 60px; box-sizing: border-box;" placeholder="Write your test steps here..."></textarea>
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
          <button id="startRecording" style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: linear-gradient(45deg, #667eea, #764ba2); color: white;">🔴 Start</button>
          <button id="pauseRecording" disabled style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: #f39c12; color: white; opacity: 0.6;">⏸️ Pause</button>
          <button id="exportFiles" disabled style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: #27ae60; color: white; opacity: 0.6;">📦 Export</button>
        </div>
        <div id="statusBar" style="text-align: center; margin-bottom: 15px; padding: 8px; border-radius: 6px; font-weight: 500; font-size: 11px; background: #e2e3e5; color: #6c757d; border: 1px solid #d6d8db;">Ready to record interactions</div>
        <div style="border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden; background: white;">
          <div style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 12px; font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span>Steps Recorded</span>
            <span id="stepCount">0 steps</span>
          </div>
          <div id="stepsContent">
            <div style="text-align: center; padding: 30px 12px; color: #7f8c8d;">
              <div style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;">🎭</div>
              <h3 style="font-size: 14px; margin-bottom: 5px;">No steps recorded yet</h3>
              <p style="font-size: 11px;">Click "Start" and interact with elements</p>
            </div>
          </div>
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 8px; margin-top: 15px; text-align: center; color: #856404; font-size: 10px;">💡 <strong>Tip:</strong> Press <kbd>Escape</kbd> to pause and export</div>
      </div>
      <button id="minimizeRecorder" style="position: absolute; top: 10px; left: 10px; background: rgba(52, 152, 219, 0.8); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;" title="Minimize">−</button>
      <button id="closeRecorder" style="position: absolute; top: 10px; right: 10px; background: rgba(231, 76, 60, 0.8); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;" title="Close">×</button>
    `;
    
    document.body.appendChild(container);
    
    // Create helper elements
    const highlighter = document.createElement('div');
    highlighter.id = 'recorder-highlighter';
    highlighter.style.cssText = `
      position: absolute; border: 3px solid #e74c3c; background: rgba(231, 76, 60, 0.1);
      pointer-events: none; z-index: 9999; border-radius: 4px; display: none; transition: all 0.2s ease;
    `;
    document.body.appendChild(highlighter);
    
    const elementInfo = document.createElement('div');
    elementInfo.id = 'recorder-element-info';
    elementInfo.style.cssText = `
      position: absolute; background: #2c3e50; color: white; padding: 8px 12px; border-radius: 6px;
      font-size: 12px; z-index: 10000; max-width: 300px; word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); display: none; font-family: inherit; transition: all 0.2s ease;
    `;
    document.body.appendChild(elementInfo);
    
    console.log('Recorder UI created successfully');
  }
  
  function getUIReferences() {
    const container = document.getElementById('enhanced-test-recorder-container');
    
    return {
      container,
      startBtn: container.querySelector('#startRecording'),
      pauseBtn: container.querySelector('#pauseRecording'),
      exportBtn: container.querySelector('#exportFiles'),
      closeBtn: container.querySelector('#closeRecorder'),
      minimizeBtn: container.querySelector('#minimizeRecorder'),
      statusBar: container.querySelector('#statusBar'),
      stepsContent: container.querySelector('#stepsContent'),
      stepCount: container.querySelector('#stepCount'),
      stepTextArea: container.querySelector('#stepLabel'),
      recorderContent: container.querySelector('#recorderContent'),
      
      updateStepsDisplay() {
        this.stepCount.textContent = `${window.recorderState.steps.length} steps`;
        
        if (window.recorderState.steps.length === 0) {
          this.stepsContent.innerHTML = `
            <div style="text-align: center; padding: 30px 12px; color: #7f8c8d;">
              <div style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;">🎭</div>
              <h3 style="font-size: 14px; margin-bottom: 5px;">No steps recorded yet</h3>
              <p style="font-size: 11px;">Click "Start" and interact with elements</p>
            </div>
          `;
          return;
        }
        
        const tableHTML = `
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="position: sticky; top: 0; background: #f8f9fa;">
                <tr>
                  <th style="background: #f8f9fa; padding: 8px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 30px;">#</th>
                  <th style="background: #f8f9fa; padding: 8px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px;">XPath</th>
                  <th style="background: #f8f9fa; padding: 8px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 60px;">Action</th>
                  <th style="background: #f8f9fa; padding: 8px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 80px;">Data</th>
                </tr>
              </thead>
              <tbody>
                ${window.recorderState.steps.map((step) => `
                  <tr style="border-bottom: 1px solid #e0e0e0;" title="Step ${step.id}: ${step.timestamp}">
                    <td style="padding: 8px; font-size: 10px;">${step.id}</td>
                    <td style="padding: 8px; font-size: 9px; font-family: monospace; color: #e74c3c; word-break: break-all; max-width: 200px;" title="${step.xpath}">${step.xpath.length > 50 ? step.xpath.substring(0, 50) + '...' : step.xpath}</td>
                    <td style="padding: 8px; font-size: 10px; color: #27ae60; font-weight: 500;">${step.action}</td>
                    <td style="padding: 8px; font-size: 10px; color: #6c757d;" title="${step.data || ''}">${step.data ? (step.data.length > 20 ? step.data.substring(0, 20) + '...' : step.data) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        
        this.stepsContent.innerHTML = tableHTML;
      },
      
      updateMiniStatus() {
        const miniStatus = this.container.querySelector('#miniStatus');
        if (miniStatus) {
          miniStatus.textContent = window.recorderState.isRecording ? 
            `🔴 Recording (${window.recorderState.steps.length})` : 
            `⏸️ Paused (${window.recorderState.steps.length})`;
        }
      }
    };
  }
  
  function bindUIEvents(ui, actionsHandler, exportHandler) {
    // Start recording
    ui.startBtn.onclick = function() {
      console.log('Start recording clicked');
      window.recorderState.isRecording = true;
      window.recorderState.steps = [];
      window.recorderState.stepCounter = 0;
      
      ui.startBtn.disabled = true;
      ui.startBtn.style.opacity = '0.6';
      ui.pauseBtn.disabled = false;
      ui.pauseBtn.style.opacity = '1';
      ui.exportBtn.disabled = true;
      ui.exportBtn.style.opacity = '0.6';
      
      ui.statusBar.style.background = '#d4edda';
      ui.statusBar.style.color = '#155724';
      ui.statusBar.textContent = '🔴 Recording interactions...';
      
      ui.updateStepsDisplay();
      ui.updateMiniStatus();
    };
    
    // Pause recording
    ui.pauseBtn.onclick = function() {
      console.log('Pause recording clicked');
      window.recorderState.isRecording = false;
      
      ui.startBtn.disabled = false;
      ui.startBtn.style.opacity = '1';
      ui.pauseBtn.disabled = true;
      ui.pauseBtn.style.opacity = '0.6';
      ui.exportBtn.disabled = false;
      ui.exportBtn.style.opacity = '1';
      
      ui.statusBar.style.background = '#fff3cd';
      ui.statusBar.style.color = '#856404';
      ui.statusBar.textContent = `⏸️ Recording paused - ${window.recorderState.steps.length} steps captured`;
      
      ui.updateMiniStatus();
    };
    
    // Export files
    ui.exportBtn.onclick = function() {
      console.log('Export files clicked');
      exportHandler.exportFiles();
    };
    
    // Close recorder
    ui.closeBtn.onclick = function() {
      console.log('Close recorder clicked');
      ui.container.remove();
      document.getElementById('recorder-highlighter')?.remove();
      document.getElementById('recorder-element-info')?.remove();
      actionsHandler.removeEvents();
    };
    
    // Minimize/Restore functionality
    ui.minimizeBtn.onclick = function() {
      window.recorderState.isMinimized = !window.recorderState.isMinimized;
      
      if (window.recorderState.isMinimized) {
        ui.recorderContent.style.display = 'none';
        ui.container.style.width = '200px';
        ui.container.style.height = '60px';
        ui.container.style.padding = '15px 30px';
        ui.minimizeBtn.textContent = '+';
        ui.minimizeBtn.title = 'Restore';
        
        const miniStatus = document.createElement('div');
        miniStatus.id = 'miniStatus';
        miniStatus.style.cssText = `
          text-align: center; font-size: 12px; color: #2c3e50;
          font-weight: 500; margin-top: 5px;
        `;
        miniStatus.textContent = window.recorderState.isRecording ? 
          `🔴 Recording (${window.recorderState.steps.length})` : 
          `⏸️ Paused (${window.recorderState.steps.length})`;
        
        ui.container.appendChild(miniStatus);
        
      } else {
        ui.recorderContent.style.display = 'block';
        ui.container.style.width = '450px';
        ui.container.style.height = 'auto';
        ui.container.style.padding = '30px';
        ui.minimizeBtn.textContent = '−';
        ui.minimizeBtn.title = 'Minimize';
        
        const miniStatus = ui.container.querySelector('#miniStatus');
        if (miniStatus) miniStatus.remove();
      }
    };
    
    // Make recorder draggable
    makeDraggable(ui);
  }
  
  function makeDraggable(ui) {
    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0, yOffset = 0;
    
    const header = ui.container.querySelector('div:first-child');
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      if (e.target === ui.minimizeBtn || e.target === ui.closeBtn) return;
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    }
    
    function dragMove(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        const rect = ui.container.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        xOffset = Math.max(0, Math.min(xOffset, maxX));
        yOffset = Math.max(0, Math.min(yOffset, maxY));
        
        ui.container.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    }
    
    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }
  }
  
  function showWelcomeMessage(ui) {
    ui.statusBar.style.background = '#d1ecf1';
    ui.statusBar.style.color = '#0c5460';
    ui.statusBar.textContent = '🎉 Recorder loaded! Click Start to begin recording.';
    
    setTimeout(() => {
      ui.statusBar.style.background = '#e2e3e5';
      ui.statusBar.style.color = '#6c757d';
      ui.statusBar.textContent = 'Ready to record interactions';
    }, 3000);
  }
}

function handleInjectionError(error, statusDiv, injectButton, originalText) {
  let errorMsg = 'Cannot inject into this page.';
  
  if (error.message.includes('Cannot access')) {
    errorMsg = 'This page blocks extensions. Try a different website.';
  } else if (error.message.includes('browser internal')) {
    errorMsg = 'Cannot inject into browser pages. Try a regular website.';
  } else if (error.message.includes('file://')) {
    errorMsg = 'Cannot inject into local files. Try a website.';
  } else if (error.message.includes('injection failed')) {
    errorMsg = 'Injection failed. Please refresh page and try again.';
  }
  
  statusDiv.textContent = '❌ ' + errorMsg;
  statusDiv.className = 'status error';
  
  injectButton.textContent = originalText;
  injectButton.disabled = false;
}


