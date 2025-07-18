// popup.js - Enhanced Test Recorder with Frame Handling, XPath Fixes, and Input Action Management
document.addEventListener('DOMContentLoaded', function () {
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

  // Initialize global state with persistence check
  if (!window.recorderState) {
    // Try to restore from sessionStorage
    const savedState = sessionStorage.getItem('testRecorderState');
    if (savedState) {
      try {
        window.recorderState = JSON.parse(savedState);
        console.log('📥 Restored state from session storage:', window.recorderState);
      } catch (e) {
        console.warn('Failed to restore saved state:', e);
        window.recorderState = createDefaultState();
      }
    } else {
      window.recorderState = createDefaultState();
    }
  }

  function createDefaultState() {
    return {
      isRecording: false,
      isPaused: false,
      sessionStarted: false,
      steps: [],
      stepCounter: 0,
      isMinimized: false,
      currentFrame: 'main', // Track current frame context
      frameMap: new Map(),   // Map frame names to their window objects
      features: {
        highlight: true,
        xpathPreview: true,
        smartWait: true,
        salesforce: true
      }
    };
  }

  // Auto-save state function
  function saveState() {
    try {
      sessionStorage.setItem('testRecorderState', JSON.stringify(window.recorderState));
      console.log('💾 State saved to session storage');
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }

  // Complete inline modules
  const RecorderModules = {
    // FIX 1: Enhanced Frame Handler
    FrameHandler: {
      init() {
        this.detectFrames();
        this.setupFrameListeners();
        console.log('FrameHandler initialized');
        return this;
      },

      detectFrames() {
        // Detect all iframes in the current page
        const frames = document.querySelectorAll('iframe, frame');
        window.recorderState.frameMap.clear();
        
        // Add main window
        window.recorderState.frameMap.set('main', window);
        
        frames.forEach((frame, index) => {
          try {
            const frameName = frame.name || frame.id || `frame_${index}`;
            const frameWindow = frame.contentWindow;
            
            if (frameWindow && this.isAccessibleFrame(frameWindow)) {
              window.recorderState.frameMap.set(frameName, frameWindow);
              console.log(`📋 Detected accessible frame: ${frameName}`);
              
              // Inject frame detection into the frame
              this.injectFrameDetection(frameWindow, frameName);
            }
          } catch (e) {
            console.warn(`Cannot access frame ${index}:`, e.message);
          }
        });
        
        console.log(`🔍 Total accessible frames: ${window.recorderState.frameMap.size}`);
      },

      isAccessibleFrame(frameWindow) {
        try {
          // Test access by trying to read a property
          return frameWindow.document && frameWindow.document.readyState;
        } catch (e) {
          return false;
        }
      },

      injectFrameDetection(frameWindow, frameName) {
        try {
          // Inject frame identification into the frame
          frameWindow.eval(`
            if (!window.frameIdentifier) {
              window.frameIdentifier = '${frameName}';
              window.parentRecorder = window.parent;
              console.log('Frame ${frameName} identified');
            }
          `);
        } catch (e) {
          console.warn(`Failed to inject into frame ${frameName}:`, e);
        }
      },

      setupFrameListeners() {
        // Listen for messages from frames
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'RECORDER_FRAME_EVENT') {
            this.handleFrameEvent(event.data);
          }
        });
      },

      handleFrameEvent(eventData) {
        const { frameName, elementData, action, data } = eventData;
        console.log(`📨 Received frame event from ${frameName}:`, action);
        
        // Switch context to the frame and record the action
        const originalFrame = window.recorderState.currentFrame;
        window.recorderState.currentFrame = frameName;
        
        // Record the interaction with frame context
        const step = {
          id: ++window.recorderState.stepCounter,
          xpath: elementData.xpath,
          action: action,
          data: data || '',
          element: elementData.tagName,
          frame: frameName,
          timestamp: new Date().toISOString()
        };

        window.recorderState.steps.push(step);
        saveState();
        
        // Update UI
        const ui = window.recorderUI;
        if (ui) {
          ui.updateStepsDisplay();
          ui.updateMiniStatus();
          ui.statusBar.textContent = `🔴 Recording - ${window.recorderState.steps.length} steps captured (Frame: ${frameName})`;
        }
        
        // Restore original frame context
        window.recorderState.currentFrame = originalFrame;
      },

      getCurrentFrameWindow() {
        return window.recorderState.frameMap.get(window.recorderState.currentFrame) || window;
      },

      switchToFrame(frameName) {
        if (window.recorderState.frameMap.has(frameName)) {
          window.recorderState.currentFrame = frameName;
          console.log(`🔄 Switched to frame: ${frameName}`);
          return true;
        }
        console.warn(`❌ Frame not found: ${frameName}`);
        return false;
      }
    },

    // FIX 2: Enhanced XPath Generator with Precise Element Targeting
    XPathGenerator: {
      generateXPath(element) {
        if (!element) return '';

        // FIX: Ensure we're targeting the exact element with text content
        const finalElement = this.getTextContainingElement(element);
        const allAttrs = this.extractAttributes(finalElement);
        const stableAttrs = this.filterAttributes(allAttrs);

        const strategies = [
          () => this.exactTextXPath(finalElement),
          () => this.titleBasedXPath(finalElement),
          () => this.labelBasedXPath(finalElement),
          () => this.nameBasedXPath(finalElement, stableAttrs),
          () => this.idBasedXPath(finalElement),
          () => this.attrBasedXPath(finalElement, stableAttrs),
          () => this.salesforceXPath(finalElement, stableAttrs),
          () => this.structuralXPath(finalElement, stableAttrs),
          () => this.positionalFallbackXPath(finalElement)
        ];

        for (const strategy of strategies) {
          const xpath = strategy();
          if (xpath && this.isUnique(xpath)) return xpath;
        }

        const fallback = this.fallbackXPath(finalElement);
        console.warn('⚠️ Using fallback XPath:', fallback);
        return fallback;
      },

      // FIX: Get the most specific element that contains the text
      getTextContainingElement(element) {
        // If element has direct text content (not just from children), use it
        const directText = this.getDirectTextContent(element);
        if (directText && directText.length > 0) {
          return element;
        }

        // Find the most specific child element with text
        const textElements = this.findTextElements(element);
        if (textElements.length > 0) {
          // Return the most specific (deepest) text element
          return textElements.reduce((prev, current) => {
            return this.getElementDepth(current) > this.getElementDepth(prev) ? current : prev;
          });
        }

        return element;
      },

      getDirectTextContent(element) {
        // Get only the direct text content, excluding text from child elements
        const childNodes = Array.from(element.childNodes);
        return childNodes
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim())
          .filter(text => text.length > 0)
          .join(' ');
      },

      findTextElements(element) {
        const textElements = [];
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              const directText = this.getDirectTextContent(node);
              return directText.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
          }
        );

        let node;
        while (node = walker.nextNode()) {
          textElements.push(node);
        }

        return textElements;
      },

      getElementDepth(element) {
        let depth = 0;
        let current = element;
        while (current.parentElement) {
          depth++;
          current = current.parentElement;
        }
        return depth;
      },

      // FIX: Exact text matching strategy
      exactTextXPath(el) {
        const directText = this.getDirectTextContent(el);
        if (directText && directText.length > 0 && directText.length < 50) {
          const tag = el.tagName.toLowerCase();
          const cleanText = this.clean(directText);
          
          // Try exact text match first
          let xpath = `//${tag}[normalize-space(text())="${cleanText}"]`;
          if (this.isUnique(xpath)) return xpath;
          
          // Try contains if exact doesn't work
          xpath = `//${tag}[contains(normalize-space(text()),"${cleanText}")]`;
          if (this.isUnique(xpath)) return xpath;
        }
        return null;
      },

      extractAttributes(el) {
        const attrs = {};
        [...el.attributes].forEach(({ name, value }) => {
          if (!name.match(/id|class/i)) attrs[name] = value;
        });
        
        // Add text content
        const directText = this.getDirectTextContent(el);
        if (directText) attrs['text()'] = directText;
        
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
        try {
          const frameWindow = RecorderModules.FrameHandler.getCurrentFrameWindow();
          const result = frameWindow.document.evaluate(
            xpath, 
            frameWindow.document, 
            null, 
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
            null
          );
          const count = result.snapshotLength;

          if (count === 0) {
            console.warn("❌ No elements matched.");
            return false;
          } else if (count > 1) {
            console.warn(`⚠️ XPath matched ${count} elements.`);
            return false;
          } else {
            const el = result.snapshotItem(0);
            console.log("✅ XPath is unique. Element:", el);
            return true;
          }
        } catch (e) {
          console.error("XPath evaluation error:", e);
          return false;
        }
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

      idBasedXPath(el) {
        if (el.id) {
          const matchingNode = Array.from(document.querySelectorAll(`[for="${el.id}"]`))
            .find(el => el.textContent?.trim());

          const labelText = matchingNode?.textContent?.trim();

          if (labelText) {
            return `//${el.tagName.toLowerCase()}[@id=//*[normalize-space(text())="${labelText}"]/@for]`;
          }
        }
      },

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
        const text = this.getDirectTextContent(el);
        if (text && text.length < 50) conditions.push(`contains(text(),"${this.clean(text)}")`);
        return conditions.length ? `//${tag}[${conditions.join(' and ')}]` : this.positionalFallbackXPath(el);
      },

      clean(txt) {
        return txt.replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
      }
    },

    // FIX 3: Enhanced Actions Handler with Input Action Management
    ActionsHandler: {
      init(recorderState, ui) {
        this.recorderState = recorderState;
        this.ui = ui;
        this.inputTimers = new Map();
        this.inputHistory = new Map(); // Track input history per element
        this.lastInputValues = new Map(); // Track last values for deduplication

        this.bindEvents();
        console.log('ActionsHandler initialized');
        return this;
      },

      bindEvents() {
        this.mouseoverHandler = this.mouseoverHandler.bind(this);
        this.mouseoutHandler = this.mouseoutHandler.bind(this);
        this.clickHandler = this.clickHandler.bind(this);
        this.inputHandler = this.inputHandler.bind(this);
        this.keyboardHandler = this.keyboardHandler.bind(this);
        this.altClickHandler = this.altClickHandler.bind(this);

        // Bind to both main window and all frames
        this.bindToWindow(window);
        
        // Bind to all accessible frames
        window.recorderState.frameMap.forEach((frameWindow, frameName) => {
          if (frameName !== 'main') {
            try {
              this.bindToWindow(frameWindow, frameName);
            } catch (e) {
              console.warn(`Failed to bind to frame ${frameName}:`, e);
            }
          }
        });
      },

      bindToWindow(targetWindow, frameName = 'main') {
        const doc = targetWindow.document;
        
        doc.addEventListener('mouseover', this.mouseoverHandler, true);
        doc.addEventListener('mouseout', this.mouseoutHandler, true);
        doc.addEventListener('click', this.altClickHandler, true);
        doc.addEventListener('click', this.clickHandler, true);
        doc.addEventListener('input', this.inputHandler, true);
        doc.addEventListener('keydown', this.keyboardHandler, true);
        
        console.log(`Events bound to ${frameName}`);
      },

      removeEvents() {
        // Remove from main window
        document.removeEventListener('mouseover', this.mouseoverHandler, true);
        document.removeEventListener('mouseout', this.mouseoutHandler, true);
        document.removeEventListener('click', this.altClickHandler, true);
        document.removeEventListener('click', this.clickHandler, true);
        document.removeEventListener('input', this.inputHandler, true);
        document.removeEventListener('keydown', this.keyboardHandler, true);

        // Remove from all frames
        window.recorderState.frameMap.forEach((frameWindow, frameName) => {
          if (frameName !== 'main') {
            try {
              const doc = frameWindow.document;
              doc.removeEventListener('mouseover', this.mouseoverHandler, true);
              doc.removeEventListener('mouseout', this.mouseoutHandler, true);
              doc.removeEventListener('click', this.altClickHandler, true);
              doc.removeEventListener('click', this.clickHandler, true);
              doc.removeEventListener('input', this.inputHandler, true);
              doc.removeEventListener('keydown', this.keyboardHandler, true);
            } catch (e) {
              console.warn(`Failed to remove events from frame ${frameName}:`, e);
            }
          }
        });

        this.inputTimers.forEach(timer => clearTimeout(timer));
        this.inputTimers.clear();
        this.inputHistory.clear();
        this.lastInputValues.clear();
        console.log('Event listeners removed');
      },

      // FIX 3: Enhanced input handler with proper action separation
      inputHandler(e) {
        console.log('Input event - checking recording state:', {
          isRecording: window.recorderState?.isRecording,
          isPaused: window.recorderState?.isPaused,
          value: e.target.value
        });

        if (!window.recorderState?.isRecording || window.recorderState?.isPaused || this._ignoreElement(e.target)) return;

        const el = e.target;
        const currentValue = el.value;
        const xpath = RecorderModules.XPathGenerator.generateXPath(el);
        
        // Create unique key for this element
        const elementKey = xpath + '_' + el.tagName;
        
        // Get the previous value for this element
        const lastValue = this.lastInputValues.get(elementKey) || '';
        
        // Skip if value hasn't actually changed
        if (currentValue === lastValue) {
          console.log('Skipping input - value unchanged:', currentValue);
          return;
        }

        // Clear existing timer for this element
        if (this.inputTimers.has(elementKey)) {
          clearTimeout(this.inputTimers.get(elementKey));
        }

        // Set new timer for this element
        const timer = setTimeout(() => {
          // Double-check the value is still different when timer fires
          const finalValue = el.value;
          const storedLastValue = this.lastInputValues.get(elementKey) || '';
          
          if (finalValue !== storedLastValue) {
            // Check if we need to create a new step or update existing
            const existingStepIndex = this.findLatestInputStep(xpath, elementKey);
            
            if (existingStepIndex !== -1) {
              // Update existing step
              const existingStep = window.recorderState.steps[existingStepIndex];
              console.log(`📝 Updating existing sendKeys step ${existingStep.id}: "${existingStep.data}" → "${finalValue}"`);
              
              existingStep.data = finalValue;
              existingStep.timestamp = new Date().toISOString();
              existingStep.isUpdated = true;
              
            } else {
              // Create new step
              console.log(`📝 Creating new sendKeys step: "${finalValue}"`);
              this.recordInteraction(el, 'sendKeys', finalValue);
            }
            
            // Update the last known value
            this.lastInputValues.set(elementKey, finalValue);
            
            // Update UI
            saveState();
            this.ui.updateStepsDisplay();
          }
          
          // Clean up timer
          this.inputTimers.delete(elementKey);
        }, 1000); // 1 second delay

        this.inputTimers.set(elementKey, timer);
      },

      // Find the most recent input step for this element within recent steps
      findLatestInputStep(xpath, elementKey) {
        const steps = window.recorderState.steps;
        
        // Look at the last 5 steps for efficiency
        const recentSteps = steps.slice(-5);
        
        for (let i = recentSteps.length - 1; i >= 0; i--) {
          const step = recentSteps[i];
          const actualIndex = steps.length - recentSteps.length + i;
          
          if (step.xpath === xpath && step.action === 'sendKeys') {
            // Check if this step was recorded recently (within last 5 seconds)
            const stepTime = new Date(step.timestamp);
            const now = new Date();
            const timeDiff = (now - stepTime) / 1000;
            
            if (timeDiff <= 5) {
              return actualIndex;
            }
          }
        }
        
        return -1;
      },

      getLabelForElement(element) {
        if (!element || !element.textContent) {
          console.warn('⚠️ Invalid or empty input element');
          return null;
        }

        const formElement = element.closest('.slds-form-element');
        if (!formElement) {
          console.warn('⚠️ Could not find .slds-form-element ancestor');
          return null;
        }

        let labelEl = formElement.querySelector('.test-id__field-label-container span');

        if (!labelEl || !labelEl.textContent.trim()) {
          labelEl = Array.from(formElement.querySelectorAll('span'))
            .find(el => el.textContent && el.textContent.trim().length > 0);
        }

        if (!labelEl || !labelEl.textContent.trim()) {
          console.warn('⚠️ Label element with readable text not found');
          return null;
        }

        const labelText = labelEl.textContent.trim();
        const valueContainer = formElement.querySelector('.slds-form-element__control');
        if (!valueContainer) {
          console.warn('⚠️ No value container found');
          return null;
        }

        const anchorEl = Array.from(valueContainer.querySelectorAll('a'))
          .find(a => a.textContent && a.textContent.trim().length > 0);
        if (anchorEl) {
          return {
            label: labelText,
            tag: 'a',
            xpath: `(//span[normalize-space(text())='${labelText}']/ancestor::div[contains(@class,'slds-form-element')]/div[contains(@class,'slds-form-element__control')]//a)[1]`
          };
        }

        const spanEl = Array.from(valueContainer.querySelectorAll('span'))
          .find(span => span.textContent && span.textContent.trim().length > 0);
        if (spanEl) {
          return {
            label: labelText,
            tag: 'span',
            xpath: `(//span[normalize-space(text())='${labelText}']/ancestor::div[contains(@class,'slds-form-element')]/div[contains(@class,'slds-form-element__control')]//span/text())[1]]`
          };
        }

        const lightningEl = Array.from(valueContainer.querySelectorAll('lightning-formatted-text, lightning-formatted-number, lightning-formatted-date-time'))
          .find(el => el.textContent && el.textContent.trim().length > 0);
        if (lightningEl) {
          return {
            label: labelText,
            tag: lightningEl.tagName.toLowerCase(),
            xpath: `(//span[normalize-space(text())='${labelText}']/ancestor::div[contains(@class,'slds-form-element')]/div[contains(@class,'slds-form-element__control')]//${lightningEl.tagName.toLowerCase()}/text())[1]`
          };
        }

        console.warn('⚠️ No value element with text found under label:', labelText);
        return null;
      },

      mouseoverHandler(e) {
        if (!window.recorderState?.features?.highlight || this._ignoreElement(e.target)) return;
        this.showHighlight(e.target);
        if (window.recorderState?.features?.xpathPreview) this.showElementInfo(e.target);
      },

      mouseoutHandler() {
        this.hideHighlight();
        this.hideElementInfo();
      },

      altClickHandler(e) {
        console.log('Alt+Click event - checking recording state:', {
          isRecording: window.recorderState?.isRecording,
          isPaused: window.recorderState?.isPaused,
          altKey: e.altKey,
          ignored: this._ignoreElement(e.target)
        });

        if (
          !window.recorderState?.isRecording ||
          window.recorderState?.isPaused ||
          !e.altKey ||
          this._ignoreElement(e.target)
        ) {
          console.log('❌ Alt+Click ignored - not recording, paused, no alt key, or element ignored');
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const labelInfo = this.getLabelForElement(e.target);
        if (!labelInfo) {
          console.warn("⚠️ Label-value not found for:", e.target);
          return;
        }

        const { label, xpath, tag } = labelInfo;
        const value = e.target.textContent?.trim() || e.target.value || '';

        const step = {
          id: ++window.recorderState.stepCounter,
          xpath,
          action: 'save',
          data: label,
          value,
          element: tag || e.target.tagName,
          frame: this.getElementFrame(e.target),
          timestamp: new Date().toISOString()
        };

        window.recorderState.steps.push(step);
        saveState();
        this.ui.updateStepsDisplay();
        this.ui.updateMiniStatus();
        this.ui.statusBar.textContent = `🔴 Recording - ${window.recorderState.steps.length} steps captured`;

        console.log('✅ Alt+Click recorded step:', step);
      },

      clickHandler(e) {
        console.log('Click event - checking recording state:', {
          isRecording: window.recorderState?.isRecording,
          isPaused: window.recorderState?.isPaused,
          element: e.target.tagName,
          ignored: this._ignoreElement(e.target)
        });

        if (!window.recorderState?.isRecording || window.recorderState?.isPaused || this._ignoreElement(e.target)) {
          console.log('❌ Click ignored - not recording or element ignored');
          return;
        }

        e.preventDefault();
        console.log('✅ Recording click on:', e.target);
        this.recordInteraction(e.target, 'click', '');
      },

      keyboardHandler(e) {
        // Escape key works regardless of recording state
        if (e.key === 'Escape') {
          e.preventDefault();
          console.log('🔄 Escape pressed - handling escape key');

          const handleEscape = async () => {
            try {
              if (window.recorderState.steps.length > 0) {
                console.log(`📦 Exporting ${window.recorderState.steps.length} steps before reset...`);

                const exportHandler = RecorderModules.ExportHandler;
                if (!exportHandler) {
                  console.error('ExportHandler not found in RecorderModules');
                  return;
                }

                const ui = this.ui || window.recorderUI;
                if (!ui) {
                  console.error('UI context not available for export');
                  return;
                }

                exportHandler.init(window.recorderState, ui);

                await new Promise((resolve, reject) => {
                  try {
                    const exportResult = exportHandler.exportFiles();

                    if (exportResult && typeof exportResult.then === 'function') {
                      exportResult
                        .then(() => {
                          console.log('✅ Export completed successfully');
                          resolve();
                        })
                        .catch(reject);
                    } else {
                      setTimeout(() => {
                        console.log('✅ Export completed (synchronous)');
                        resolve();
                      }, 1500);
                    }
                  } catch (error) {
                    reject(error);
                  }
                });

                console.log('📦 Export process finished');

              } else {
                console.log('ℹ️ No steps to export');
              }

            } catch (error) {
              console.error('❌ Export failed during escape:', error);
            }

            console.log('🔄 Resetting recorder state...');
            window.recorderState = createDefaultState();

            if (typeof saveState === 'function') {
              saveState();
            }

            const ui = this.ui || window.recorderUI;
            if (ui) {
              try {
                ui.startBtn.disabled = false;
                ui.startBtn.style.opacity = '1';
                ui.startBtn.textContent = '🔴 Start';

                ui.pauseBtn.disabled = true;
                ui.pauseBtn.style.opacity = '0.6';
                ui.pauseBtn.textContent = '⏸️ Pause';

                ui.exportBtn.disabled = true;
                ui.exportBtn.style.opacity = '0.6';
                ui.statusBar.style.background = '#f8f9fa';
                ui.statusBar.style.color = '#495057';
                ui.statusBar.textContent = window.recorderState.steps.length > 0 ?
                  '🔄 Reset after export' : '🔄 Recorder reset';

                if (typeof ui.updateStepsDisplay === 'function') {
                  ui.updateStepsDisplay();
                }
                if (typeof ui.updateMiniStatus === 'function') {
                  ui.updateMiniStatus();
                }

                console.log('✅ UI updated successfully');

              } catch (uiError) {
                console.error('❌ UI update failed:', uiError);
              }
            } else {
              console.warn('⚠️ UI not available for reset');
            }
          };

          handleEscape();
          return;
        }

        // Other keyboard shortcuts only work when actively recording
        if (!window.recorderState?.isRecording || window.recorderState?.isPaused) return;

        const el = document.activeElement;
        if (this._ignoreElement(el)) return;

        // Ctrl + V = verify
        if (e.ctrlKey && e.key.toLowerCase() === 'v') {
          const value = el.value || el.textContent?.trim() || '';
          this.recordInteraction(el, 'verify', value);
          return;
        }

        // Tab = tab action
        if (e.key === 'Tab') {
          this.recordInteraction(el, 'tab');
          return;
        }

        // Enter = pressEnter action
        if (e.key === 'Enter') {
          this.recordInteraction(el, 'pressEnter');
          return;
        }
      },

      recordInteraction(element, action, data = '') {
        try {
          console.log(`🎯 Recording ${action} interaction:`, {
            element: element.tagName,
            data: data,
            currentSteps: window.recorderState.steps.length,
            isRecording: window.recorderState.isRecording,
            isPaused: window.recorderState.isPaused
          });

          const xpath = RecorderModules.XPathGenerator.generateXPath(element);
          const frameInfo = this.getElementFrame(element);
          
          const step = {
            id: ++window.recorderState.stepCounter,
            xpath,
            action,
            data,
            element: element.tagName,
            frame: frameInfo,
            timestamp: new Date().toISOString()
          };

          window.recorderState.steps.push(step);
          saveState();

          console.log(`✅ Successfully recorded step ${step.id}:`, step);
          console.log(`📊 Total steps now: ${window.recorderState.steps.length}`);

          this.ui.updateStepsDisplay();
          this.ui.updateMiniStatus();
          
          const frameText = frameInfo !== 'main' ? ` (Frame: ${frameInfo})` : '';
          this.ui.statusBar.textContent = `🔴 Recording - ${window.recorderState.steps.length} steps captured${frameText}`;

        } catch (err) {
          console.error('❌ Failed to record step:', err);
        }
      },

      getElementFrame(element) {
        // Determine which frame this element belongs to
        try {
          const elementWindow = element.ownerDocument.defaultView;
          
          // Check if it's the main window
          if (elementWindow === window) {
            return 'main';
          }
          
          // Find the frame name
          for (const [frameName, frameWindow] of window.recorderState.frameMap) {
            if (frameWindow === elementWindow) {
              return frameName;
            }
          }
          
          // If not found, try to identify by frame element
          const frames = document.querySelectorAll('iframe, frame');
          for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            try {
              if (frame.contentWindow === elementWindow) {
                return frame.name || frame.id || `frame_${i}`;
              }
            } catch (e) {
              // Access denied - skip
            }
          }
          
          return 'unknown_frame';
        } catch (e) {
          console.warn('Failed to determine element frame:', e);
          return 'main';
        }
      },

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
        const frameInfo = this.getElementFrame(el);
        const info = document.getElementById('recorder-element-info');

        if (info) {
          info.innerHTML = `
        <strong>Tag:</strong> ${el.tagName.toLowerCase()}<br>
        <strong>Frame:</strong> ${frameInfo}<br>
        <strong>XPath:</strong> <span style="font-family: monospace; font-size: 10px;">${xpath}</span><br>
        ${el.id ? `<strong>ID:</strong> ${el.id}<br>` : ''}
        ${el.className ? `<strong>Class:</strong> ${el.className.split(' ').slice(0, 2).join(' ')}<br>` : ''}
        <strong>State:</strong> ${window.recorderState?.isRecording ? (window.recorderState?.isPaused ? '⏸️ Paused' : '🔴 Recording') : '⏹️ Stopped'}
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
        const isRecorderElement = el.closest('#enhanced-test-recorder-container');

        if (isRecorderElement) {
          console.log('🚫 Ignoring recorder UI element:', el.tagName, el.id || el.className);
        }

        return isRecorderElement;
      }
    },

    ExportHandler: {
      init(recorderState, ui) {
        this.recorderState = recorderState;
        this.ui = ui;
        console.log('ExportHandler initialized');
        return this;
      },

      async exportFiles() {
        console.log('🔍 Export triggered - checking steps...');
        console.log('Current steps:', window.recorderState?.steps?.length);

        const steps = window.recorderState?.steps || [];

        if (steps.length === 0) {
          const debugInfo = `
Debug Information:
- Steps Length: ${steps.length}
- Is Recording: ${window.recorderState?.isRecording}
- Is Paused: ${window.recorderState?.isPaused}
- Session Started: ${window.recorderState?.sessionStarted}

Please try:
1. Start recording by clicking the "Start" button
2. Interact with some elements on the page
3. You can pause and resume recording (steps will be preserved)
4. Then try exporting again
      `;

          console.error('❌ No steps to export. Debug info:', debugInfo);
          alert('No steps recorded to export!\n\n' + debugInfo);
          return;
        }

        try {
          this.updateStatus('⏳ Generating files...', '#d1ecf1', '#0c5460');

          console.log(`📝 Generating files for ${steps.length} steps...`);

          const pageElements = this.generatePageElements(steps);
          const stepDefinitions = this.generateStepDefinitions(steps);
          const featureFile = this.generateFeatureFile(steps);

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
        }
      },

      generatePageElements(steps) {
        const elementMap = new Map();
        steps.forEach(step => {
          if (step.xpath) {
            const elementName = this.generateElementName(step);
            elementMap.set(elementName, { xpath: step.xpath, frame: step.frame || 'main' });
          }
        });

        let javaCode = `package pageObjects;

import com.codeborne.selenide.SelenideElement;
import static com.codeborne.selenide.Selenide.$x;
import static com.codeborne.selenide.Selenide.switchTo;

/**
 * Page Elements - Generated by Enhanced Test Automation Recorder (Selenide)
 * Generated on: ${new Date().toISOString()}
 * Total elements: ${elementMap.size}
 * Total steps: ${steps.length}
 * Supports multiple frames: ${steps.some(s => s.frame && s.frame !== 'main') ? 'Yes' : 'No'}
 */
public class PageElements {
    
`;

        elementMap.forEach((elementInfo, elementName) => {
          const { xpath, frame } = elementInfo;
          javaCode += `    /** XPath: ${xpath}${frame !== 'main' ? ` | Frame: ${frame}` : ''} */\n`;
          
          if (frame !== 'main') {
            javaCode += `    public SelenideElement ${elementName}() {\n`;
            javaCode += `        switchTo().frame("${frame}");\n`;
            javaCode += `        return $x("${xpath}");\n`;
            javaCode += `    }\n\n`;
          } else {
            javaCode += `    public final SelenideElement ${elementName} = $x("${xpath}");\n\n`;
          }
        });

        javaCode += `    // Frame switching utilities\n`;
        javaCode += `    public void switchToMainFrame() {\n`;
        javaCode += `        switchTo().defaultContent();\n`;
        javaCode += `    }\n\n`;
        
        const frames = [...new Set(steps.filter(s => s.frame && s.frame !== 'main').map(s => s.frame))];
        frames.forEach(frameName => {
          javaCode += `    public void switchTo${this.toCamelCase(frameName)}Frame() {\n`;
          javaCode += `        switchTo().frame("${frameName}");\n`;
          javaCode += `    }\n\n`;
        });

        javaCode += `}`;
        return javaCode;
      },

      generateStepDefinitions(steps) {
        const stepMethods = new Set();
        steps.forEach(step => {
          if (step.action && step.xpath) {
            const methodName = this.generateMethodName(step);
            const stepDef = this.generateStepDefinition(step, methodName);
            stepMethods.add(stepDef);
          }
        });

        let javaCode = `package stepDefinitions;

import io.cucumber.java.en.*;
import com.codeborne.selenide.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selenide.*;
import pageObjects.PageElements;
import java.time.Duration;
import java.util.Map;
import java.util.HashMap;

/**
 * Step Definitions - Generated by Enhanced Test Automation Recorder (Selenide)
 * Generated on: ${new Date().toISOString()}
 * Total steps: ${steps.length}
 * Total methods: ${stepMethods.size}
 * Multi-frame support: ${steps.some(s => s.frame && s.frame !== 'main') ? 'Enabled' : 'Disabled'}
 */
public class StepDefinitions extends PageElements {

    private static Map<String, String> storeValue = new HashMap<>();

`;
        stepMethods.forEach(method => {
          javaCode += method + '\n';
        });
        javaCode += `}`;
        return javaCode;
      },

      generateFeatureFile(steps) {
        const stepText = this.ui?.stepTextArea?.value || 'UI Automation Test';

        const featureFile = `@UITest @Regression @Selenide

Feature: Recorded user interactions

  @SmokeTest
   Scenario Outline: ${stepText}
    Given user is on the target page
${steps.filter(step => step.action && step.xpath).map(step => `    When ${this.generateStepDescription(step)}`).join('\n')}

    Examples:
      | testData | 
      | data1    | 

# Generated from ${steps.length} recorded steps
# Generated on: ${new Date().toISOString()}
# Frames used: ${[...new Set(steps.map(s => s.frame || 'main'))].join(', ')}
`;

        return featureFile;
      },

      generateElementName(step) {
  const suffixMap = {
    'data-field-label': 'Field',
    'placeholder': 'Field',
    'aria-label': 'Element',
    'aria-labelledby': 'Element',
    'data-testid': 'Element',
    'name': 'Field',
    'id': 'Element',
    'title': 'Element',
    'alt': 'Image',
    'role': 'Role',
    'text()': 'Button',
    'normalize-space(text())': 'Button'
  };

  // Match all attribute="value" or text()="value" patterns
  const regex = /@?([\w-]+|\btext\(\)|normalize-space\(text\(\)\))\s*=\s*"([^"]+)"/g;

  let match;
  const matches = [];

  while ((match = regex.exec(step.xpath)) !== null) {
    const attr = match[1];
    const value = match[2];
    const suffix = suffixMap[attr] || 'Element';
    matches.push({ value, suffix, priority: Object.keys(suffixMap).indexOf(attr) });
  }

  // Pick the best match by priority
  if (matches.length > 0) {
    matches.sort((a, b) => a.priority - b.priority);
    const baseName = this.toCamelCase(matches[0].value);
    return baseName + matches[0].suffix;
  }

  // Fallback
  return (step.tagName?.toLowerCase() || 'element') + step.id;
},

toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, '')                   // Remove special chars
    .replace(/\s+(.)(\w*)/g, (_, first, rest) =>
      first.toUpperCase() + rest.toLowerCase())     // CamelCase
    .replace(/^./, first => first.toLowerCase());    // Lowercase first
},

      generateMethodName(step) {
        const elementName = this.generateElementName(step);
        return `user_${step.action}_${elementName}`;
      },

      generateStepDefinition(step, methodName) {
        const elementName = this.generateElementName(step);
        const hasFrame = step.frame && step.frame !== 'main';

        const templates = {
          click: {
            annotation: `@When("User clicks on ${elementName}")`,
            signature: `public void ${methodName}()`,
            body: `        ${hasFrame ? `// Switch to frame: ${step.frame}\n        switchTo().frame("${step.frame}");\n        ` : ''}// Wait for element to be visible and enabled (50 seconds timeout)
        ${hasFrame ? `${elementName}()` : `${elementName}`}.shouldBe(visible, Duration.ofSeconds(50));
        
        try {
            // Try JavaScript click first
            Object jsResult = executeJavaScript("try { arguments[0].click(); return true; } catch(e) { return false; }", ${hasFrame ? `${elementName}()` : `${elementName}`});
            
            if (Boolean.TRUE.equals(jsResult)) {
                System.out.println("✅ Clicked on ${elementName} using JavaScript");
            } else {
                // JavaScript click failed, use Selenide click as fallback
                System.out.println("⚠️ JavaScript click failed for ${elementName}, trying Selenide click...");
                ${hasFrame ? `${elementName}()` : `${elementName}`}.click();
                System.out.println("✅ Clicked on ${elementName} using Selenide click");
            }
        } finally {
            ${hasFrame ? `// Switch back to main content\n            switchTo().defaultContent();` : ''}
        }`
          },
          sendKeys: {
            annotation: `@When("User enters {string} in ${elementName}")`,
            signature: `public void ${methodName}(String text)`,
            body: `        ${hasFrame ? `// Switch to frame: ${step.frame}\n        switchTo().frame("${step.frame}");\n        ` : ''}try {
            ${hasFrame ? `${elementName}()` : `${elementName}`}.shouldBe(visible, Duration.ofSeconds(50)).setValue(text);
            System.out.println("✅ Entered text '" + text + "' in ${elementName}");
        } finally {
            ${hasFrame ? `// Switch back to main content\n            switchTo().defaultContent();` : ''}
        }`
          },
          save: {
            annotation: `@When("User saves value from ${elementName} in {string}")`,
            signature: `public void ${methodName}(String data)`,
            body: `        ${hasFrame ? `// Switch to frame: ${step.frame}\n        switchTo().frame("${step.frame}");\n        ` : ''}try {
            String value = ${hasFrame ? `${elementName}()` : `${elementName}`}.shouldBe(visible, Duration.ofSeconds(50)).getText();
            storeValue.put(data, value);
            System.out.println("✅ Saved value: " + value + " from ${elementName}");
        } finally {
            ${hasFrame ? `// Switch back to main content\n            switchTo().defaultContent();` : ''}
        }`
          },
          verify: {
            annotation: `@Then("User verifies {string} in ${elementName}")`,
            signature: `public void ${methodName}(String expectedText)`,
            body: `        ${hasFrame ? `// Switch to frame: ${step.frame}\n        switchTo().frame("${step.frame}");\n        ` : ''}try {
            String text;
            if (storeValue.containsKey(expectedText)) {
                text = storeValue.get(expectedText);
            } else {
                text = expectedText;
            }
            ${hasFrame ? `${elementName}()` : `${elementName}`}.shouldBe(visible, Duration.ofSeconds(50)).shouldHave(text(text));
            System.out.println("✅ Verified text '" + text + "' in ${elementName}");
        } finally {
            ${hasFrame ? `// Switch back to main content\n            switchTo().defaultContent();` : ''}
        }`
          }
        };

        const template = templates[step.action] || {
          annotation: `@When("User performs ${step.action} on ${elementName}")`,
          signature: `public void ${methodName}()`,
          body: `        ${hasFrame ? `// Switch to frame: ${step.frame}\n        switchTo().frame("${step.frame}");\n        ` : ''}try {
            // TODO: Implement '${step.action}' for ${elementName}
            ${hasFrame ? `${elementName}()` : `${elementName}`}.shouldBe(visible);
            System.out.println("⚠️ Action '${step.action}' needs implementation for ${elementName}");
        } finally {
            ${hasFrame ? `// Switch back to main content\n            switchTo().defaultContent();` : ''}
        }`
        };

        return `    ${template.annotation}
    ${template.signature} {
        try {
${template.body}
        } catch (Exception e) {
            System.err.println("❌ Failed to perform ${step.action} on ${elementName}: " + e.getMessage());
            throw new RuntimeException("Step failed: ${step.action} on ${elementName}", e);
        }
    }`;
      },

      generateStepDescription(step) {
        const elementName = this.generateElementName(step);
        const frameText = step.frame && step.frame !== 'main' ? ` in ${step.frame} frame` : '';
        
        const descriptions = {
          click: `user clicks on ${elementName}${frameText}`,
          sendKeys: `user enters "${step.data || '{text}'}" in ${elementName}${frameText}`,
          save: `user saves value from ${elementName}${frameText} in "${step.data}"`,
          verify: `user verifies "${step.data || '{text}'}" in ${elementName}${frameText}`
        };
        return descriptions[step.action] || `user performs ${step.action} on ${elementName}${frameText}`;
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
      }
    },
  };

  // Initialize Frame Handler
  const frameHandler = RecorderModules.FrameHandler.init();

  // Create recorder UI
  createRecorderUI();

  // Get UI references
  const ui = getUIReferences();

  // Initialize modules
  const actionsHandler = RecorderModules.ActionsHandler.init(window.recorderState, ui);
  const exportHandler = RecorderModules.ExportHandler.init(window.recorderState, ui);

  // Store UI globally for frame access
  window.recorderUI = ui;

  // Bind UI events with proper pause/resume logic
  bindUIEvents(ui, actionsHandler, exportHandler);

  // Show welcome message
  showWelcomeMessage(ui);

  console.log('✅ Enhanced Test Recorder initialized successfully with frame support!');

  // Enhanced UI functions remain the same...
  function createRecorderUI() {
    const container = document.createElement('div');
    container.id = 'enhanced-test-recorder-container';
    container.style.cssText = `
      position: fixed !important; top: 20px !important; right: 20px !important;
      z-index: 2147483647 !important; background: #002f6c !important;
      backdrop-filter: blur(10px) !important; border-radius: 16px !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important; width: 500px !important;
      max-height: 85vh !important; overflow-y: auto !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-size: 14px !important; padding: 30px !important; transition: all 0.3s ease !important;
      resize: both !important; min-width: 200px !important; min-height: 200px !important;
    `;

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 10px; padding-bottom: 10px; background-color: #002f6c; color: white; margin: -30px -30px 10px -30px; padding: 15px 30px; border-radius: 16px 16px 0 0; cursor: move; user-select: none;">
  <h1 style="color: white; font-size: 20px; font-weight: 600; margin-bottom: 2px;">Enhanced Test Recorder</h1>
  <p style="color: #e0e0e0; font-size: 12px; margin: 0;">Frame Support • Precise XPath • Smart Input Tracking</p>
</div>
<div id="recorderContent" style="transition: all 0.3s ease;">
  <div style="margin-bottom: 10px;">
    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #e0e0e0; font-size: 12px;">Scenario:</label>
    <textarea id="stepLabel" rows="2" style="width: 100%; padding: 8px 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 12px; background: white; font-family: inherit; resize: vertical; min-height: 60px; box-sizing: border-box;" placeholder="Describe the scenario here..."></textarea>
  </div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
          <button id="startRecording" style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: linear-gradient(45deg, #667eea,  #002f6c); color: white;">🔴 Start</button>
          <button id="pauseRecording" disabled style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: #f39c12; color: white; opacity: 0.6;">⏸️ Pause</button>
          <button id="exportFiles" disabled style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: #27ae60; color: white; opacity: 0.6;">📦 Export</button>
        </div>
        <div id="statusBar" style="text-align: center; margin-bottom: 15px; padding: 8px; border-radius: 6px; font-weight: 500; font-size: 11px; background: #e2e3e5; color: #6c757d; border: 1px solid #d6d8db;">Ready to record interactions</div>
        <div style="border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden; background: white;">
          <div style="background: linear-gradient(45deg, #667eea, #002f6c); color: white; padding: 12px; font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span>Steps Recorded</span>
            <span id="stepCount">0 steps</span>
          </div>
          <div id="stepsContent" style="max-height: 300px; overflow-y: auto;">
            <div style="text-align: center; padding: 30px 12px; color: #7f8c8d;">
              <h3 style="font-size: 14px; margin-bottom: 5px;">No steps recorded yet</h3>
              <p style="font-size: 11px;">Click "Start" and interact with elements</p>
            </div>
          </div>
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 8px; margin-top: 15px; text-align: center; color: #856404; font-size: 10px;">
          💡 <strong>New Features:</strong> Frame detection • Precise element targeting • Smart input deduplication • Alt+Click to save values
        </div>
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
              <div style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;">🎬</div>
              <h3 style="font-size: 14px; margin-bottom: 5px;">No steps recorded yet</h3>
              <p style="font-size: 11px;">Click "Start" and interact with elements</p>
            </div>
          `;
          return;
        }

        const tableHTML = `
          <table style="width: 100%; border-collapse: collapse;" id="stepsTable">
            <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 10;">
              <tr>
                <th style="background: #f8f9fa; padding: 8px 4px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 40px;"></th>
                <th style="background: #f8f9fa; padding: 8px 4px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 40px;">#</th>
                <th style="background: #f8f9fa; padding: 8px 4px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px;">XPath</th>
                <th style="background: #f8f9fa; padding: 8px 4px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 80px;">Action</th>
                <th style="background: #f8f9fa; padding: 8px 4px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 100px;">Data</th>
                <th style="background: #f8f9fa; padding: 8px 4px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #e0e0e0; font-size: 10px; width: 60px;">Frame</th>
              </tr>
            </thead>
            <tbody id="stepsTableBody">
              ${window.recorderState.steps.map((step, index) => this.generateStepRow(step, index)).join('')}
            </tbody>
          </table>
        `;

        this.stepsContent.innerHTML = tableHTML;
        this.initializeStepFeatures();
      },

      generateStepRow(step, index) {
        const frameDisplay = step.frame && step.frame !== 'main' ? step.frame : '—';
        const frameColor = step.frame && step.frame !== 'main' ? '#ff6b6b' : '#6c757d';
        
        return `
          <tr class="step-row" data-step-index="${index}" draggable="true" style="transition: all 0.3s ease;">
            <td style="padding: 6px 4px; border-bottom: 1px solid #e0e0e0; text-align: center;">
              <span class="drag-handle" style="cursor: move; opacity: 0.3; transition: opacity 0.3s; user-select: none;">⋮⋮</span>
            </td>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e0e0e0;">
              <span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 50%; font-size: 10px; font-weight: bold;">${step.id}</span>
            </td>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 9px; color: #e74c3c; word-break: break-all; max-width: 200px; cursor: pointer;" 
                class="xpath-editable display-mode" 
                data-field="xpath" 
                data-step-index="${index}" 
                title="Double-click to edit">${step.xpath || 'No XPath'}</td>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e0e0e0; cursor: pointer;" 
                class="action-editable display-mode" 
                data-field="action" 
                data-step-index="${index}" 
                title="Double-click to edit">
              <span style="color: #27ae60; font-weight: 500; font-size: 10px;">${step.action}</span>
            </td>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e0e0e0; color: #6c757d; font-size: 10px; cursor: pointer;" 
                class="data-editable display-mode" 
                data-field="data" 
                data-step-index="${index}" 
                title="Double-click to edit">${step.data || '—'}</td>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e0e0e0; color: ${frameColor}; font-size: 9px; font-weight: 500;" 
                title="Frame: ${step.frame || 'main'}">${frameDisplay}</td>
          </tr>
          <tr class="control-zone-row" data-after-index="${index}">
            <td colspan="6" style="height: 3px; padding: 0; border: none; background: transparent; position: relative; transition: all 0.3s ease;" 
                class="control-zone" 
                data-step-index="${index}" 
                title="Hover for controls"></td>
          </tr>
        `;
      },

      initializeStepFeatures() {
        this.initializeEditableFields();
        this.initializeDragAndDrop();
        this.initializeControlZones();
      },

      initializeEditableFields() {
        const editableFields = this.stepsContent.querySelectorAll('.xpath-editable, .data-editable, .action-editable');

        editableFields.forEach(field => {
          field.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.makeFieldEditable(field);
          });
        });
      },

      makeFieldEditable(field) {
        if (field.classList.contains('editing')) return;

        const stepIndex = parseInt(field.dataset.stepIndex);
        const fieldType = field.dataset.field;
        const currentValue = window.recorderState.steps[stepIndex][fieldType] || '';

        field.classList.remove('display-mode');
        field.classList.add('editing');

        let inputElement;

        if (fieldType === 'action') {
          inputElement = document.createElement('select');
          inputElement.style.cssText = `
            width: 100%; padding: 4px; border: 2px solid #667eea; border-radius: 3px; 
            font-size: 10px; background: white; box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
            color: #27ae60; font-weight: 500;
          `;

          const actions = ['click', 'save', 'verify', 'sendKeys'];
          actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action;
            option.textContent = action;
            option.selected = action === currentValue;
            inputElement.appendChild(option);
          });
        } else {
          inputElement = document.createElement(fieldType === 'xpath' ? 'textarea' : 'input');
          inputElement.value = currentValue;
          inputElement.style.cssText = `
            width: 100%; padding: 4px; border: 2px solid #667eea; border-radius: 3px; 
            font-size: 9px; font-family: ${fieldType === 'xpath' ? 'monospace' : 'inherit'}; 
            background: white; box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2); 
            ${fieldType === 'xpath' ? 'resize: vertical; min-height: 40px;' : ''}
          `;
        }

        const originalContent = field.innerHTML;
        field.innerHTML = '';
        field.appendChild(inputElement);

        inputElement.focus();
        if (inputElement.select) inputElement.select();

        const saveEdit = () => {
          const newValue = inputElement.value.trim();
          if (newValue !== currentValue) {
            window.recorderState.steps[stepIndex][fieldType] = newValue;
            saveState();
          }

          field.classList.remove('editing');
          field.classList.add('display-mode');

          if (fieldType === 'action') {
            field.innerHTML = `<span style="color: #27ae60; font-weight: 500; font-size: 10px;">${newValue}</span>`;
          } else {
            field.textContent = newValue || (fieldType === 'data' ? '—' : 'No XPath');
          }
        };

        const cancelEdit = () => {
          field.classList.remove('editing');
          field.classList.add('display-mode');
          field.innerHTML = originalContent;
        };

        inputElement.addEventListener('blur', saveEdit);
        inputElement.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        });
      },

      initializeDragAndDrop() {
        const tbody = this.stepsContent.querySelector('#stepsTableBody');
        if (!tbody) return;

        let draggedElement = null;
        let draggedIndex = null;

        tbody.addEventListener('dragstart', (e) => {
          if (e.target.classList.contains('step-row')) {
            draggedElement = e.target;
            draggedIndex = parseInt(e.target.dataset.stepIndex);
            e.target.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
          }
        });

        tbody.addEventListener('dragend', (e) => {
          if (e.target.classList.contains('step-row')) {
            e.target.style.opacity = '1';
            draggedElement = null;
            draggedIndex = null;
          }
        });

        tbody.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });

        tbody.addEventListener('drop', (e) => {
          e.preventDefault();

          if (!draggedElement) return;

          const targetRow = e.target.closest('.step-row');
          if (!targetRow || targetRow === draggedElement) return;

          const targetIndex = parseInt(targetRow.dataset.stepIndex);

          const draggedStep = window.recorderState.steps[draggedIndex];
          window.recorderState.steps.splice(draggedIndex, 1);
          window.recorderState.steps.splice(targetIndex, 0, draggedStep);

          window.recorderState.steps.forEach((step, index) => {
            step.id = index + 1;
          });

          saveState();
          this.updateStepsDisplay();
        });

        const stepRows = tbody.querySelectorAll('.step-row');
        stepRows.forEach(row => {
          const dragHandle = row.querySelector('.drag-handle');
          row.addEventListener('mouseenter', () => {
            if (dragHandle) dragHandle.style.opacity = '1';
          });
          row.addEventListener('mouseleave', () => {
            if (dragHandle) dragHandle.style.opacity = '0.3';
          });
        });
      },

      initializeControlZones() {
        const controlZones = this.stepsContent.querySelectorAll('.control-zone');

        controlZones.forEach(zone => {
          zone.addEventListener('mouseenter', (e) => {
            const stepIndex = parseInt(e.target.dataset.stepIndex);
            this.showControlButtons(e.target, stepIndex);
          });

          zone.addEventListener('mouseleave', (e) => {
            this.hideControlButtons(e.target);
          });
        });
      },

      showControlButtons(zone, stepIndex) {
        zone.style.height = '30px';
        zone.style.background = 'rgba(108, 117, 125, 0.1)';
        zone.style.cursor = 'pointer';

        const step = window.recorderState.steps[stepIndex];
        zone.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100%; gap: 10px;">
            <button class="control-btn delete-btn" data-action="delete" data-step-index="${stepIndex}" 
                    style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10px; cursor: pointer; transition: all 0.3s ease;"
                    title="Delete step ${step.id} above">
              🗑️ 
            </button>
            <button class="control-btn add-btn" data-action="add" data-step-index="${stepIndex}" 
                    style="background: #28a745; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10px; cursor: pointer; transition: all 0.3s ease;"
                    title="Add step above step ${step.id}">
              ➕ 
            </button>
          </div>
        `;

        const deleteBtn = zone.querySelector('.delete-btn');
        const addBtn = zone.querySelector('.add-btn');

        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteStepAbove(stepIndex);
        });

        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.addStepAbove(stepIndex);
        });

        deleteBtn.addEventListener('mouseenter', () => {
          deleteBtn.style.background = '#c82333';
          deleteBtn.style.transform = 'scale(1.05)';
        });
        deleteBtn.addEventListener('mouseleave', () => {
          deleteBtn.style.background = '#e74c3c';
          deleteBtn.style.transform = 'scale(1)';
        });

        addBtn.addEventListener('mouseenter', () => {
          addBtn.style.background = '#218838';
          addBtn.style.transform = 'scale(1.05)';
        });
        addBtn.addEventListener('mouseleave', () => {
          addBtn.style.background = '#28a745';
          addBtn.style.transform = 'scale(1)';
        });
      },

      hideControlButtons(zone) {
        zone.style.height = '3px';
        zone.style.background = 'transparent';
        zone.innerHTML = '';
      },

      deleteStepAbove(stepIndex) {
        const step = window.recorderState.steps[stepIndex];

        if (confirm(`Delete step ${step.id}: ${step.action} on ${step.xpath?.substring(0, 50)}...?`)) {
          window.recorderState.steps.splice(stepIndex, 1);

          window.recorderState.steps.forEach((step, index) => {
            step.id = index + 1;
          });

          saveState();
          this.updateStepsDisplay();
        }
      },

      addStepAbove(stepIndex) {
        const newStep = {
          id: 0,
          xpath: '//input[@placeholder="Enter XPath"]',
          action: 'click',
          data: '',
          element: 'INPUT',
          frame: 'main',
          timestamp: new Date().toISOString(),
          isManual: true
        };

        window.recorderState.steps.splice(stepIndex, 0, newStep);
        window.recorderState.stepCounter++;

        window.recorderState.steps.forEach((step, index) => {
          step.id = index + 1;
        });

        saveState();
        this.updateStepsDisplay();

        setTimeout(() => {
          const newStepRow = this.stepsContent.querySelector(`[data-step-index="${stepIndex}"] .xpath-editable`);
          if (newStepRow) {
            this.makeFieldEditable(newStepRow);
          }
        }, 100);
      },

      updateMiniStatus() {
        const miniStatus = this.container.querySelector('#miniStatus');
        if (miniStatus) {
          const state = window.recorderState.isRecording ? '🔴 Recording' :
            window.recorderState.isPaused ? '⏸️ Paused' : '⏹️ Stopped';
          miniStatus.textContent = `${state} (${window.recorderState.steps.length})`;
        }
      }
    };
  }

  function bindUIEvents(ui, actionsHandler, exportHandler) {
    // START/RESUME BUTTON HANDLER
    ui.startBtn.onclick = function () {
      console.log('🟢 START/RESUME button clicked');
      console.log('Current state before click:', {
        isRecording: window.recorderState.isRecording,
        isPaused: window.recorderState.isPaused,
        sessionStarted: window.recorderState.sessionStarted,
        steps: window.recorderState.steps.length
      });

      if (window.recorderState.isPaused && window.recorderState.sessionStarted) {
        console.log('📤 RESUMING from pause - preserving existing steps');
        window.recorderState.isRecording = true;
        window.recorderState.isPaused = false;
      } else {
        console.log('🆕 STARTING new recording session');
        window.recorderState.steps = [];
        window.recorderState.stepCounter = 0;
        window.recorderState.isRecording = true;
        window.recorderState.isPaused = false;
        window.recorderState.sessionStarted = true;
      }

      ui.startBtn.disabled = true;
      ui.startBtn.style.opacity = '0.6';
      ui.startBtn.textContent = '🔴 Recording...';

      ui.pauseBtn.disabled = false;
      ui.pauseBtn.style.opacity = '1';
      ui.pauseBtn.textContent = '⏸️ Pause';

      ui.exportBtn.disabled = true;
      ui.exportBtn.style.opacity = '0.6';

      ui.statusBar.style.background = '#d4edda';
      ui.statusBar.style.color = '#155724';
      ui.statusBar.textContent = '🔴 Recording interactions...';

      console.log('Final state after start/resume:', window.recorderState);
      saveState();
      ui.updateStepsDisplay();
      ui.updateMiniStatus();
    };

    // PAUSE/RESET BUTTON HANDLER
    ui.pauseBtn.onclick = function () {
      console.log('⏸️ PAUSE button clicked');
      console.log('Current state before pause:', window.recorderState);

      if (window.recorderState.isRecording && !window.recorderState.isPaused) {
        console.log('📥 FIRST CLICK - Pausing recording');

        window.recorderState.isRecording = false;
        window.recorderState.isPaused = true;

        ui.startBtn.disabled = false;
        ui.startBtn.style.opacity = '1';
        ui.startBtn.textContent = '▶️ Resume';

        ui.pauseBtn.disabled = false;
        ui.pauseBtn.style.opacity = '1';
        ui.pauseBtn.textContent = '🔄 Reset';
        ui.pauseBtn.style.background = '#e74c3c';

        ui.exportBtn.disabled = false;
        ui.exportBtn.style.opacity = '1';

        ui.statusBar.style.background = '#fff3cd';
        ui.statusBar.style.color = '#856404';
        ui.statusBar.textContent = `⏸️ Recording paused - ${window.recorderState.steps.length} steps captured (Click Reset to clear)`;

        console.log('✅ PAUSED - Steps preserved:', window.recorderState.steps.length);
        saveState();
        ui.updateMiniStatus();

      } else if (window.recorderState.isPaused) {
        console.log('🔄 SECOND CLICK - Resetting all data');

        if (window.recorderState.steps.length > 0) {
          if (!confirm(`Reset will permanently clear all ${window.recorderState.steps.length} recorded steps. Continue?`)) {
            return;
          }
        }

        window.recorderState = createDefaultState();
        saveState();

        ui.startBtn.disabled = false;
        ui.startBtn.style.opacity = '1';
        ui.startBtn.textContent = '🔴 Start';

        ui.pauseBtn.disabled = true;
        ui.pauseBtn.style.opacity = '0.6';
        ui.pauseBtn.textContent = '⏸️ Pause';
        ui.pauseBtn.style.background = '#f39c12';

        ui.exportBtn.disabled = true;
        ui.exportBtn.style.opacity = '0.6';

        ui.statusBar.style.background = '#f8f9fa';
        ui.statusBar.style.color = '#495057';
        ui.statusBar.textContent = '🔄 Recorder reset - ready to start new recording';

        console.log('🔄 All data reset - ready for new recording');
        ui.updateStepsDisplay();
        ui.updateMiniStatus();

      } else {
        console.warn('Cannot pause/reset - not in valid state');
      }
    };

    // Export files
    ui.exportBtn.onclick = function () {
      console.log('Export files clicked');
      exportHandler.exportFiles();
    };

    // Close recorder
    ui.closeBtn.onclick = function (e) {
      console.log('❌ Close recorder clicked');
      e.preventDefault();
      e.stopPropagation();

      if (window.recorderState.steps.length > 0) {
        if (!confirm(`Closing will clear all ${window.recorderState.steps.length} recorded steps. Continue?`)) {
          return;
        }
      }

      console.log('🗑️ Removing recorder elements...');

      actionsHandler.removeEvents();

      const container = document.getElementById('enhanced-test-recorder-container');
      const highlighter = document.getElementById('recorder-highlighter');
      const elementInfo = document.getElementById('recorder-element-info');

      if (container) container.remove();
      if (highlighter) highlighter.remove();
      if (elementInfo) elementInfo.remove();

      sessionStorage.removeItem('testRecorderState');

      console.log('✅ Recorder closed successfully');
    };

    // Minimize/Restore functionality
    ui.minimizeBtn.onclick = function () {
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
          text-align: center; font-size: 12px; color: #ffffffff;
          font-weight: 500; margin-top: 5px;
        `;
        const state = window.recorderState.isRecording ? '🔴 Recording' :
          window.recorderState.isPaused ? '⏸️ Paused' : '⏹️ Stopped';
        miniStatus.textContent = `${state} (${window.recorderState.steps.length})`;

        ui.container.appendChild(miniStatus);

      } else {
        ui.recorderContent.style.display = 'block';
        ui.container.style.width = '500px';
        ui.container.style.height = 'auto';
        ui.container.style.padding = '30px';
        ui.minimizeBtn.textContent = '−';
        ui.minimizeBtn.title = 'Minimize';

        const miniStatus = ui.container.querySelector('#miniStatus');
        if (miniStatus) miniStatus.remove();
      }
      saveState();
    };

    // Make recorder draggable
    makeDraggable(ui);

    // Restore UI state if resuming
    if (window.recorderState.isPaused && window.recorderState.sessionStarted) {
      ui.startBtn.textContent = '▶️ Resume';
      ui.pauseBtn.disabled = false;
      ui.pauseBtn.style.opacity = '1';
      ui.pauseBtn.textContent = '🔄 Reset';
      ui.pauseBtn.style.background = '#e74c3c';
      ui.exportBtn.disabled = false;
      ui.exportBtn.style.opacity = '1';
      ui.statusBar.style.background = '#fff3cd';
      ui.statusBar.style.color = '#856404';
      ui.statusBar.textContent = `⏸️ Recording paused - ${window.recorderState.steps.length} steps captured (Click Reset to clear)`;
    } else if (window.recorderState.isRecording) {
      ui.startBtn.disabled = true;
      ui.startBtn.style.opacity = '0.6';
      ui.startBtn.textContent = '🔴 Recording...';
      ui.pauseBtn.disabled = false;
      ui.pauseBtn.style.opacity = '1';
      ui.pauseBtn.textContent = '⏸️ Pause';
      ui.pauseBtn.style.background = '#f39c12';
      ui.statusBar.style.background = '#d4edda';
      ui.statusBar.style.color = '#155724';
      ui.statusBar.textContent = '🔴 Recording interactions...';
    }

    ui.updateStepsDisplay();
    ui.updateMiniStatus();
  }

  function makeDraggable(ui) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    let startX = 0, startY = 0;

    const header = ui.container.querySelector('div:first-child');
    const container = ui.container;

    if (!container.style.left && !container.style.top) {
      container.style.position = 'fixed';
      container.style.left = '20px';
      container.style.top = '20px';
    }

    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);

    function startDrag(e) {
      if (e.target === ui.minimizeBtn || e.target === ui.closeBtn) return;

      if (e.target === header || header.contains(e.target)) {
        isDragging = true;

        startX = e.clientX;
        startY = e.clientY;

        const rect = container.getBoundingClientRect();
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;

        container.style.cursor = 'grabbing';
        container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        container.style.transition = 'none';

        e.preventDefault();
      }
    }

    function drag(e) {
      if (!isDragging) return;

      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;

      const rect = container.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      container.style.left = `${newX}px`;
      container.style.top = `${newY}px`;

      e.preventDefault();
    }

    function endDrag() {
      if (!isDragging) return;

      isDragging = false;

      container.style.cursor = '';
      container.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
      container.style.transition = 'all 0.3s ease';
    }

    window.addEventListener('resize', () => {
      const rect = container.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      const currentX = parseInt(container.style.left) || 0;
      const currentY = parseInt(container.style.top) || 0;

      if (currentX > maxX || currentY > maxY) {
        container.style.left = `${Math.min(currentX, maxX)}px`;
        container.style.top = `${Math.min(currentY, maxY)}px`;
      }
    });
  }

  function showWelcomeMessage(ui) {
    if (window.recorderState.steps.length > 0) {
      ui.statusBar.style.background = '#d1ecf1';
      ui.statusBar.style.color = '#0c5460';
      ui.statusBar.textContent = `🎉 Recorder restored with ${window.recorderState.steps.length} steps!`;

      setTimeout(() => {
        if (window.recorderState.isPaused) {
          ui.statusBar.style.background = '#fff3cd';
          ui.statusBar.style.color = '#856404';
          ui.statusBar.textContent = `⏸️ Recording paused - ${window.recorderState.steps.length} steps captured`;
        } else {
          ui.statusBar.style.background = '#e2e3e5';
          ui.statusBar.style.color = '#6c757d';
          ui.statusBar.textContent = 'Ready to record interactions';
        }
      }, 3000);
    } else {
      ui.statusBar.style.background = '#d1ecf1';
      ui.statusBar.style.color = '#0c5460';
      ui.statusBar.textContent = '🎉 Enhanced Recorder loaded! Multi-frame support enabled.';

      setTimeout(() => {
        ui.statusBar.style.background = '#e2e3e5';
        ui.statusBar.style.color = '#6c757d';
        ui.statusBar.textContent = 'Ready to record interactions';
      }, 3000);
    }
  }

  // Global debug functions
  window.debugRecorderState = function () {
    console.log('🔍 Current Recorder State:');
    console.log('isRecording:', window.recorderState?.isRecording);
    console.log('isPaused:', window.recorderState?.isPaused);
    console.log('sessionStarted:', window.recorderState?.sessionStarted);
    console.log('steps:', window.recorderState?.steps?.length);
    console.log('stepCounter:', window.recorderState?.stepCounter);
    console.log('frames:', window.recorderState?.frameMap?.size);
    console.log('currentFrame:', window.recorderState?.currentFrame);
    console.log('Full state:', window.recorderState);
    return window.recorderState;
  };

  window.testRecording = function () {
    window.recorderState.isRecording = true;
    window.recorderState.isPaused = false;
    window.recorderState.sessionStarted = true;
    console.log('✅ Manually set recording state to true');
    return window.recorderState;
  };

  window.debugFrames = function () {
    console.log('🖼️ Frame Information:');
    console.log('Frame Map:', window.recorderState?.frameMap);
    console.log('Current Frame:', window.recorderState?.currentFrame);
    
    const frames = document.querySelectorAll('iframe, frame');
    console.log(`Found ${frames.length} frames on page`);
    
    frames.forEach((frame, index) => {
      const name = frame.name || frame.id || `frame_${index}`;
      console.log(`Frame ${index}: ${name}`, {
        src: frame.src,
        accessible: RecorderModules.FrameHandler.isAccessibleFrame(frame.contentWindow)
      });
    });
    
    return {
      frameMap: window.recorderState?.frameMap,
      currentFrame: window.recorderState?.currentFrame,
      totalFrames: frames.length
    };
  };
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