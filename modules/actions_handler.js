// Actions Handler Module
import { XPathGenerator } from './xpathGenerators.js';

export class ActionsHandler {
  
  constructor(recorderState, ui) {
    this.recorderState = recorderState;
    this.ui = ui;
    this.inputTimers = new Map();
    this.initializeEventListeners();
  }
  
  initializeEventListeners() {
    document.addEventListener('mouseover', this.mouseOverHandler.bind(this));
    document.addEventListener('mouseout', this.mouseOutHandler.bind(this));
    document.addEventListener('click', this.clickHandler.bind(this), true);
    document.addEventListener('input', this.inputHandler.bind(this));
    document.addEventListener('keydown', this.keyboardHandler.bind(this));
  }
  
  removeEventListeners() {
    document.removeEventListener('mouseover', this.mouseOverHandler);
    document.removeEventListener('mouseout', this.mouseOutHandler);
    document.removeEventListener('click', this.clickHandler);
    document.removeEventListener('input', this.inputHandler);
    document.removeEventListener('keydown', this.keyboardHandler);
  }
  
  mouseOverHandler(e) {
    if (!this.recorderState.features.highlight) return;
    if (e.target.closest('#enhanced-test-recorder-container')) return;
    
    this.showElementHighlight(e.target);
    
    if (this.recorderState.features.xpathPreview) {
      this.showElementInfo(e.target);
    }
  }
  
  mouseOutHandler(e) {
    this.hideElementHighlight();
    this.hideElementInfo();
  }
  
  clickHandler(e) {
    if (!this.recorderState.isRecording) return;
    if (e.target.closest('#enhanced-test-recorder-container')) return;
    
    console.log('Recording click on:', e.target);
    this.recordInteraction(e.target, 'click', '');
    
    // Prevent navigation for demo purposes
    if (e.target.tagName === 'A' && e.target.href) {
      e.preventDefault();
      console.log('Navigation prevented for:', e.target.href);
    }
  }
  
  inputHandler(e) {
    if (!this.recorderState.isRecording) return;
    if (e.target.closest('#enhanced-test-recorder-container')) return;
    
    const element = e.target;
    const value = element.value;
    
    // Clear existing timer for this element
    if (this.inputTimers.has(element)) {
      clearTimeout(this.inputTimers.get(element));
    }
    
    // Set new timer to capture complete text after user stops typing
    const timer = setTimeout(() => {
      console.log('Recording complete input on:', element, 'value:', value);
      
      // Check if we already have a sendKeys action for this element
      const existingStepIndex = this.recorderState.steps.findIndex(step => 
        step.xpath === XPathGenerator.generateXPath(element) && step.action === 'sendKeys'
      );
      
      if (existingStepIndex !== -1) {
        // Update existing step with new value
        this.recorderState.steps[existingStepIndex].data = value;
        this.recorderState.steps[existingStepIndex].timestamp = new Date().toISOString();
        console.log('Updated existing step with new value:', value);
      } else {
        // Record new interaction
        this.recordInteraction(element, 'sendKeys', value);
      }
      
      this.inputTimers.delete(element);
    }, 1000); // Wait 1 second after user stops typing
    
    this.inputTimers.set(element, timer);
  }
  
  keyboardHandler(e) {
    if (e.key === 'Escape' && this.recorderState.isRecording) {
      this.ui.pauseBtn.click();
      setTimeout(() => this.ui.exportBtn.click(), 500);
    }
  }
  
  recordInteraction(element, action, data) {
    const xpath = XPathGenerator.generateXPath(element);
    const step = {
      id: ++this.recorderState.stepCounter,
      xpath: xpath,
      action: action,
      data: data,
      element: element.tagName,
      timestamp: new Date().toISOString()
    };
    
    this.recorderState.steps.push(step);
    this.ui.updateStepsDisplay();
    this.ui.updateMiniStatus();
    
    this.ui.statusBar.textContent = `🔴 Recording - ${this.recorderState.steps.length} steps captured`;
    console.log('Recorded step:', step);
  }
  
  showElementHighlight(element) {
    const rect = element.getBoundingClientRect();
    const highlighter = document.getElementById('recorder-highlighter');
    
    if (highlighter) {
      highlighter.style.display = 'block';
      highlighter.style.left = (rect.left + window.scrollX - 3) + 'px';
      highlighter.style.top = (rect.top + window.scrollY - 3) + 'px';
      highlighter.style.width = (rect.width + 6) + 'px';
      highlighter.style.height = (rect.height + 6) + 'px';
    }
  }
  
  hideElementHighlight() {
    const highlighter = document.getElementById('recorder-highlighter');
    if (highlighter) {
      highlighter.style.display = 'none';
    }
  }
  
  showElementInfo(element) {
    const rect = element.getBoundingClientRect();
    const xpath = XPathGenerator.generateXPath(element);
    const elementInfo = document.getElementById('recorder-element-info');
    
    if (elementInfo) {
      elementInfo.innerHTML = `
        <strong>Tag:</strong> ${element.tagName.toLowerCase()}<br>
        <strong>XPath:</strong> <span style="font-family: monospace; font-size: 10px;">${xpath}</span><br>
        ${element.id ? `<strong>ID:</strong> ${element.id}<br>` : ''}
        ${element.className ? `<strong>Class:</strong> ${element.className.split(' ').slice(0, 2).join(' ')}<br>` : ''}
        ${element.textContent && element.textContent.trim().length < 50 ? `<strong>Text:</strong> ${element.textContent.trim()}<br>` : ''}
      `;
      
      elementInfo.style.display = 'block';
      elementInfo.style.left = Math.min(rect.left + window.scrollX + 10, window.innerWidth - 320) + 'px';
      elementInfo.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    }
  }
  
  hideElementInfo() {
    const elementInfo = document.getElementById('recorder-element-info');
    if (elementInfo) {
      elementInfo.style.display = 'none';
    }
  }
  
  // Additional action handlers for future expansion
  scrollToElement(element) {
    this.recordInteraction(element, 'scrollToView', '');
  }
  
  hoverElement(element) {
    this.recordInteraction(element, 'hover', '');
  }
  
  doubleClickElement(element) {
    this.recordInteraction(element, 'doubleClick', '');
  }
  
  clearElement(element) {
    this.recordInteraction(element, 'clear', '');
  }
}