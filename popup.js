document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');

  const injectButton = document.getElementById('injectRecorder');
  const statusDiv = document.getElementById('status');

  injectButton.addEventListener('click', async () => {
    const originalText = injectButton.textContent;
    injectButton.textContent = '⏳ Injecting...';
    injectButton.disabled = true;
    statusDiv.textContent = 'Injecting recorder...';
    statusDiv.className = 'status loading';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab.url);
      
      // Check if we can inject into this page
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('edge://') || 
          tab.url.startsWith('moz-extension://') ||
          tab.url.startsWith('about:') ||
          tab.url.startsWith('file://')) {
        throw new Error('Cannot inject into browser internal pages');
      }
      
      // Inject the recorder
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectRecorderDirectly
      });
      
      console.log('Recorder injected successfully');
      injectButton.textContent = '✅ Injected!';
      statusDiv.textContent = 'Recorder launched successfully!';
      statusDiv.className = 'status success';
      
      // Close popup after success
      setTimeout(() => window.close(), 1500);
      
    } catch (error) {
      console.error('Injection error:', error);
      
      let errorMsg = 'Cannot inject into this page.';
      if (error.message.includes('Cannot access')) {
        errorMsg = 'This page blocks extensions. Try a different website.';
      } else if (error.message.includes('browser internal')) {
        errorMsg = 'Cannot inject into browser pages. Try a regular website.';
      } else if (error.message.includes('file://')) {
        errorMsg = 'Cannot inject into local files. Try a website.';
      }
      
      // Show error
      statusDiv.textContent = '❌ ' + errorMsg;
      statusDiv.className = 'status error';
      
      injectButton.textContent = originalText;
      injectButton.disabled = false;
    }
  });
});

function injectRecorderDirectly() {
  console.log('Direct injection starting...');
  
  // Remove existing recorder if present
  const existing = document.getElementById('enhanced-test-recorder-container');
  if (existing) {
    existing.remove();
    console.log('Removed existing recorder');
  }
  
  // Global recorder state
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
  
  // Create main container
  const container = document.createElement('div');
  container.id = 'enhanced-test-recorder-container';
  container.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px) !important;
    border-radius: 16px !important;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
    width: 450px !important;
    max-height: 85vh !important;
    overflow-y: auto !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
    font-size: 14px !important;
    padding: 30px !important;
    transition: all 0.3s ease !important;
    resize: both !important;
    min-width: 350px !important;
    min-height: 200px !important;
  `;
  
  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0; background-color: #002f6c; color: white;">
      <h1 style="color:rgb(244, 244, 244); font-size: 20px; font-weight: 600; margin-bottom: 5px;">🚀 Test Recorder</h1>
      <p style="color:rgb(229, 240, 240); font-size: 12px;">Advanced BDD Test Generation</p>
    </div>

    <div id="recorderContent" style="transition: all 0.3s ease;">
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #34495e; font-size: 12px;">Write Steps:</label>
        <textarea id="stepLabel" rows="2" style="width: 100%; padding: 8px 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 12px; background: white; font-family: inherit; resize: vertical; min-height: 60px; box-sizing: border-box;" placeholder="Write your test steps here..."></textarea>
      </div>

      <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
        <button id="startRecording" style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: linear-gradient(45deg, #667eea, #764ba2); color: white;">🔴 Start Recording</button>
        <button id="pauseRecording" disabled style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: #f39c12; color: white; opacity: 0.6;">⏸️ Pause Recording</button>
        <button id="exportFiles" disabled style="padding: 8px 16px; border: none; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; background: #27ae60; color: white; opacity: 0.6;">📦 Export Files</button>
      </div>

      <div id="statusBar" style="text-align: center; margin-bottom: 15px; padding: 8px; border-radius: 6px; font-weight: 500; font-size: 11px; background: #e2e3e5; color: #6c757d; border: 1px solid #d6d8db;">
        Ready to record interactions
      </div>

      <div style="border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden; background: white;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 12px; font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span>Steps Recorded</span>
          <span id="stepCount">0 steps</span>
        </div>
        <div id="stepsContent">
          <div style="text-align: center; padding: 30px 12px; color: #7f8c8d;">
            <div style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;">🎭</div>
            <h3 style="font-size: 14px; margin-bottom: 5px;">No steps recorded yet</h3>
            <p style="font-size: 11px;">Click "Start Recording" and interact with elements</p>
          </div>
        </div>
      </div>

      <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 8px; margin-top: 15px; text-align: center; color: #856404; font-size: 10px;">
        💡 <strong>Tip:</strong> Press <kbd>Escape</kbd> to pause and export
      </div>
    </div>

    <!-- Control buttons -->
    <button id="minimizeRecorder" style="position: absolute; top: 10px; left: 10px; background: rgba(52, 152, 219, 0.8); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;" title="Minimize">−</button>
    <button id="closeRecorder" style="position: absolute; top: 10px; right: 10px; background: rgba(231, 76, 60, 0.8); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;" title="Close">×</button>
  `;
  
  document.body.appendChild(container);
  console.log('Recorder container added to page');
  
  // Create highlighter elements
  const highlighter = document.createElement('div');
  highlighter.id = 'recorder-highlighter';
  highlighter.style.cssText = `
    position: absolute;
    border: 3px solid #e74c3c;
    background: rgba(231, 76, 60, 0.1);
    pointer-events: none;
    z-index: 9999;
    border-radius: 4px;
    display: none;
    transition: all 0.2s ease;
  `;
  document.body.appendChild(highlighter);
  
  const elementInfo = document.createElement('div');
  elementInfo.id = 'recorder-element-info';
  elementInfo.style.cssText = `
    position: absolute;
    background: #2c3e50;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10000;
    max-width: 300px;
    word-wrap: break-word;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: none;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    transition: all 0.2s ease;
  `;
  document.body.appendChild(elementInfo);
  
  // Get UI elements
  const startBtn = container.querySelector('#startRecording');
  const pauseBtn = container.querySelector('#pauseRecording');
  const exportBtn = container.querySelector('#exportFiles');
  const closeBtn = container.querySelector('#closeRecorder');
  const minimizeBtn = container.querySelector('#minimizeRecorder');
  const statusBar = container.querySelector('#statusBar');
  const stepsContent = container.querySelector('#stepsContent');
  const stepCount = container.querySelector('#stepCount');
  const stepTextArea = container.querySelector('#stepLabel');
  const recorderContent = container.querySelector('#recorderContent');
  
  // Minimize/Restore functionality
  minimizeBtn.onclick = function() {
    window.recorderState.isMinimized = !window.recorderState.isMinimized;
    
    if (window.recorderState.isMinimized) {
      // Minimize
      recorderContent.style.display = 'none';
      container.style.width = '200px';
      container.style.height = '60px';
      container.style.padding = '15px 30px';
      minimizeBtn.textContent = '+';
      minimizeBtn.title = 'Restore';
      
      // Show mini status
      const miniStatus = document.createElement('div');
      miniStatus.id = 'miniStatus';
      miniStatus.style.cssText = `
        text-align: center;
        font-size: 12px;
        color: #2c3e50;
        font-weight: 500;
        margin-top: 5px;
      `;
      miniStatus.textContent = window.recorderState.isRecording ? 
        `🔴 Recording (${window.recorderState.steps.length})` : 
        `⏸️ Paused (${window.recorderState.steps.length})`;
      
      container.appendChild(miniStatus);
      
    } else {
      // Restore
      recorderContent.style.display = 'block';
      container.style.width = '450px';
      container.style.height = 'auto';
      container.style.padding = '30px';
      minimizeBtn.textContent = '−';
      minimizeBtn.title = 'Minimize';
      
      // Remove mini status
      const miniStatus = container.querySelector('#miniStatus');
      if (miniStatus) miniStatus.remove();
    }
  };
  
  // Event handlers
  startBtn.onclick = function() {
    console.log('Start recording clicked');
    window.recorderState.isRecording = true;
    window.recorderState.steps = [];
    window.recorderState.stepCounter = 0;
    
    startBtn.disabled = true;
    startBtn.style.opacity = '0.6';
    pauseBtn.disabled = false;
    pauseBtn.style.opacity = '1';
    exportBtn.disabled = true;
    exportBtn.style.opacity = '0.6';
    
    statusBar.style.background = '#d4edda';
    statusBar.style.color = '#155724';
    statusBar.textContent = '🔴 Recording interactions...';
    
    updateStepsDisplay();
    
    // Update minimize status if minimized
    updateMiniStatus();
  };
  
  pauseBtn.onclick = function() {
    console.log('Pause recording clicked');
    window.recorderState.isRecording = false;
    
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
    pauseBtn.disabled = true;
    pauseBtn.style.opacity = '0.6';
    exportBtn.disabled = false;
    exportBtn.style.opacity = '1';
    
    statusBar.style.background = '#fff3cd';
    statusBar.style.color = '#856404';
    statusBar.textContent = `⏸️ Recording paused - ${window.recorderState.steps.length} steps captured`;
    
    // Update minimize status if minimized
    updateMiniStatus();
  };
  
  closeBtn.onclick = function() {
    console.log('Close recorder clicked');
    container.remove();
    highlighter.remove();
    elementInfo.remove();
    
    // Remove event listeners
    document.removeEventListener('mouseover', mouseOverHandler);
    document.removeEventListener('mouseout', mouseOutHandler);
    document.removeEventListener('click', clickHandler);
    document.removeEventListener('input', inputHandler);
    document.removeEventListener('keydown', keyboardHandler);
  };
  
  exportBtn.onclick = function() {
    console.log('Export files clicked');
    if (window.recorderState.steps.length === 0) {
      alert('No steps recorded to export!');
      return;
    }
    
    try {
      statusBar.style.background = '#d1ecf1';
      statusBar.style.color = '#0c5460';
      statusBar.textContent = '⏳ Generating files...';
      
      const pageElements = generatePageElements();
      const stepDefinitions = generateStepDefinitions();
      const featureFile = generateFeatureFile();
      
      downloadFile('PageElements.java', pageElements);
      setTimeout(() => downloadFile('StepDefinitions.java', stepDefinitions), 300);
      setTimeout(() => downloadFile('UITest.feature', featureFile), 600);
      
      statusBar.style.background = '#d4edda';
      statusBar.style.color = '#155724';
      statusBar.textContent = '✅ Files exported successfully!';
      
      // Reset status after 3 seconds
      setTimeout(() => {
        statusBar.style.background = '#e2e3e5';
        statusBar.style.color = '#6c757d';
        statusBar.textContent = 'Ready to record interactions';
      }, 3000);
      
    } catch (error) {
      console.error('Export error:', error);
      statusBar.style.background = '#f8d7da';
      statusBar.style.color = '#721c24';
      statusBar.textContent = '❌ Export failed';
    }
  };
  
  function updateMiniStatus() {
    const miniStatus = container.querySelector('#miniStatus');
    if (miniStatus) {
      miniStatus.textContent = window.recorderState.isRecording ? 
        `🔴 Recording (${window.recorderState.steps.length})` : 
        `⏸️ Paused (${window.recorderState.steps.length})`;
    }
  }
  
  // Mouse over handler
  function mouseOverHandler(e) {
    if (!window.recorderState.features.highlight) return;
    if (e.target.closest('#enhanced-test-recorder-container')) return;
    
    const rect = e.target.getBoundingClientRect();
    
    highlighter.style.display = 'block';
    highlighter.style.left = (rect.left + window.scrollX - 3) + 'px';
    highlighter.style.top = (rect.top + window.scrollY - 3) + 'px';
    highlighter.style.width = (rect.width + 6) + 'px';
    highlighter.style.height = (rect.height + 6) + 'px';
    
    if (window.recorderState.features.xpathPreview) {
      const xpath = generateXPath(e.target);
      elementInfo.innerHTML = `
        <strong>Tag:</strong> ${e.target.tagName.toLowerCase()}<br>
        <strong>XPath:</strong> <span style="font-family: monospace; font-size: 10px;">${xpath}</span><br>
        ${e.target.id ? `<strong>ID:</strong> ${e.target.id}<br>` : ''}
        ${e.target.className ? `<strong>Class:</strong> ${e.target.className.split(' ').slice(0, 2).join(' ')}<br>` : ''}
        ${e.target.textContent && e.target.textContent.trim().length < 50 ? `<strong>Text:</strong> ${e.target.textContent.trim()}<br>` : ''}
      `;
      
      elementInfo.style.display = 'block';
      elementInfo.style.left = Math.min(rect.left + window.scrollX + 10, window.innerWidth - 320) + 'px';
      elementInfo.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    }
  }
  
  // Mouse out handler
  function mouseOutHandler(e) {
    highlighter.style.display = 'none';
    elementInfo.style.display = 'none';
  }
  
  // Click handler
  function clickHandler(e) {
    if (!window.recorderState.isRecording) return;
    if (e.target.closest('#enhanced-test-recorder-container')) return;
    
    console.log('Recording click on:', e.target);
    recordInteraction(e.target, 'click', '');
    
    // Prevent navigation for demo purposes
    if (e.target.tagName === 'A' && e.target.href) {
      e.preventDefault();
      console.log('Navigation prevented for:', e.target.href);
    }
  }
  
  // Input handler with debouncing for complete text capture
  let inputTimers = new Map();
  
  function inputHandler(e) {
    if (!window.recorderState.isRecording) return;
    if (e.target.closest('#enhanced-test-recorder-container')) return;
    
    const element = e.target;
    const value = element.value;
    
    // Clear existing timer for this element
    if (inputTimers.has(element)) {
      clearTimeout(inputTimers.get(element));
    }
    
    // Set new timer to capture complete text after user stops typing
    const timer = setTimeout(() => {
      console.log('Recording complete input on:', element, 'value:', value);
      
      // Check if we already have a sendKeys action for this element
      const existingStepIndex = window.recorderState.steps.findIndex(step => 
        step.xpath === generateXPath(element) && step.action === 'sendKeys'
      );
      
      if (existingStepIndex !== -1) {
        // Update existing step with new value
        window.recorderState.steps[existingStepIndex].data = value;
        window.recorderState.steps[existingStepIndex].timestamp = new Date().toISOString();
        console.log('Updated existing step with new value:', value);
      } else {
        // Record new interaction
        recordInteraction(element, 'sendKeys', value);
      }
      
      inputTimers.delete(element);
    }, 1000); // Wait 1 second after user stops typing
    
    inputTimers.set(element, timer);
  }
  
  // Keyboard handler
  function keyboardHandler(e) {
    if (e.key === 'Escape' && window.recorderState.isRecording) {
      pauseBtn.click();
      setTimeout(() => exportBtn.click(), 500);
    }
  }
  
  // Add event listeners
  document.addEventListener('mouseover', mouseOverHandler);
  document.addEventListener('mouseout', mouseOutHandler);
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('input', inputHandler);
  document.addEventListener('keydown', keyboardHandler);
  
  function recordInteraction(element, action, data) {
    const xpath = generateXPath(element);
    const step = {
      id: ++window.recorderState.stepCounter,
      xpath: xpath,
      action: action,
      data: data,
      element: element.tagName,
      timestamp: new Date().toISOString()
    };
    
    window.recorderState.steps.push(step);
    updateStepsDisplay();
    updateMiniStatus();
    
    statusBar.textContent = `🔴 Recording - ${window.recorderState.steps.length} steps captured`;
    console.log('Recorded step:', step);
  }
  
 function generateXPath(element) {
    if (!element) return '';

    document.addEventListener('mouseover', function (event) {
  if (!event.ctrlKey) return; // Only proceed if CTRL key is pressed

  const element = event.target;
  let ancestor = element.parentElement;

  const targetAncestor = (() => {
    while (ancestor) {
      const prev = ancestor.previousElementSibling;
      if (prev && prev.textContent?.trim()) return { prev };
      ancestor = ancestor.parentElement;
    }
    return null;
  })();

  if (targetAncestor) {
    const labelText = targetAncestor.prev.textContent.trim();
    const tagName = targetAncestor.prev.tagName;
    const xpath = `(//${tagName}[normalize-space(text())="${labelText}"]//following-sibling::*//span)[1]`;
    console.log('Generated XPath:', xpath);
    // Optional: Display in UI or clipboard
  }
});

    
    if (element.id) {
  const labelText = document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim();
  if (labelText) {
    return `//${element.tagName.toLowerCase()}[@id=//label[normalize-space(text())="${labelText}"]/@for]`;
  } 
}
     
    if (element.name) {
      return `//${element.tagName.toLowerCase()}[@name="${element.name}"]`;
    }
    
    if (element.getAttribute('aria-label')) {
      return `//*[@aria-label="${element.getAttribute('aria-label')}"]`;
    }
    
    if (element.placeholder) {
      return `//${element.tagName.toLowerCase()}[@placeholder="${element.placeholder}"]`;
    }

    // Priority 2: Text content for buttons and links
    if ((element.tagName === 'BUTTON' || element.tagName === 'A') && element.textContent?.trim()) {
      const text = element.textContent.trim();
      if (text.length < 50) {
        return `//${element.tagName.toLowerCase()}[normalize-space(text())="${text}"]`;
      }
    }

 


    // Priority 3: Type for inputs
    if (element.type && element.tagName === 'INPUT') {
      const siblings = Array.from(element.parentNode?.children || [])
        .filter(child => child.tagName === 'INPUT' && child.type === element.type);
      if (siblings.length === 1) {
        return `//input[@type="${element.type}"]`;
      } else {
        const index = siblings.indexOf(element) + 1;
        return `//input[@type="${element.type}"][${index}]`;
      }
    }
    
    // Priority 4: Position-based (last resort)
    const siblings = Array.from(element.parentNode?.children || [])
      .filter(child => child.tagName === element.tagName);
    const index = siblings.indexOf(element) + 1;
    
    if (siblings.length === 1) {
      return `//${element.tagName.toLowerCase()}`;
    } else {
      return `//${element.tagName.toLowerCase()}[${index}]`;
    }
  }

     


  
  function updateStepsDisplay() {
    stepCount.textContent = `${window.recorderState.steps.length} steps`;
    
    if (window.recorderState.steps.length === 0) {
      stepsContent.innerHTML = `
        <div style="text-align: center; padding: 30px 12px; color: #7f8c8d;">
          <div style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;">🎭</div>
          <h3 style="font-size: 14px; margin-bottom: 5px;">No steps recorded yet</h3>
          <p style="font-size: 11px;">Click "Start Recording" and interact with elements</p>
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
            ${window.recorderState.steps.map((step, index) => `
              <tr style="border-bottom: 1px solid #e0e0e0;" title="Step ${step.id}: ${step.timestamp}">
                <td style="padding: 8px; font-size: 10px;">${step.id}</td>
                <td style="padding: 8px; font-size: 9px; font-family: monospace; color: #e74c3c; word-break: break-all; max-width: 200px;" title="${step.xpath}">${step.xpath.length > 50 ? step.xpath.substring(0, 50) + '...' : step.xpath}</td>
                <td style="padding: 8px; font-size: 10px; color: #27ae60; font-weight: 500;">${step.action}</td>
                <td style="padding: 8px; font-size: 10px; color: #6c757d;" title="${step.data}">${step.data ? (step.data.length > 20 ? step.data.substring(0, 20) + '...' : step.data) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    stepsContent.innerHTML = tableHTML;
  }
  
  function generatePageElements() {
    const elementMap = new Map();
    
    window.recorderState.steps.forEach(step => {
      const elementName = generateElementName(step);
      elementMap.set(elementName, step.xpath);
    });

    let javaCode = `package pageObjects;

import org.openqa.selenium.By;

/**
 * Page Elements - Generated by Test Automation Recorder
 * Generated on: ${new Date().toISOString()}
 */
public class PageElements {
    
`;

    elementMap.forEach((xpath, elementName) => {
      javaCode += `    public static final By ${elementName} = By.xpath("${xpath}");\n`;
    });

    javaCode += `\n}`;
    return javaCode;
  }
  
  function generateStepDefinitions() {
    const stepMethods = new Set();
    
    window.recorderState.steps.forEach(step => {
      const methodName = generateMethodName(step);
      stepMethods.add(generateStepDefinition(step, methodName));
    });

    let javaCode = `package stepDefinitions;

import io.cucumber.java.en.*;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.JavascriptExecutor;
import pageObjects.PageElements;

/**
 * Step Definitions - Generated by Test Automation Recorder
 * Generated on: ${new Date().toISOString()}
 */
public class StepDefinitions {
    
    private WebDriver driver;
    private WebDriverWait wait;
    
    public StepDefinitions(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, 10);
    }
    
`;

    stepMethods.forEach(method => {
      javaCode += method + '\n';
    });

    javaCode += `\n}`;
    return javaCode;
  }
  
  function generateFeatureFile() {
    const stepText = stepTextArea.value || 'UI Automation Test';
    
    return `@UITest
Feature: ${stepText}
  As a user
  I want to perform UI operations
  So that I can accomplish my tasks

  Scenario: Recorded user interactions
    Given user is on the target page
${window.recorderState.steps.map(step => `    When ${generateStepDescription(step)}`).join('\n')}
    Then the operation should complete successfully
`;
  }
  
  function generateElementName(step) {
    if (step.xpath.includes('@placeholder=')) {
      const match = step.xpath.match(/@placeholder="([^"]+)"/);
      if (match) return toCamelCase(match[1]) + 'Field';
    }
    
    if (step.xpath.includes('normalize-space(text())=')) {
      const match = step.xpath.match(/normalize-space\(text\(\)\)="([^"]+)"/);
      if (match) return toCamelCase(match[1]) + 'Button';
    }
    
    if (step.xpath.includes('@name=')) {
      const match = step.xpath.match(/@name="([^"]+)"/);
      if (match) return toCamelCase(match[1]) + 'Element';
    }
    
    return `element${step.id}`;
  }
  
  function generateMethodName(step) {
    const elementName = generateElementName(step);
    return `user_${step.action}_${elementName}`;
  }
  
  function generateStepDefinition(step, methodName) {
    const elementName = generateElementName(step);
    
    switch (step.action) {
      case 'click':
        return `    @When("User clicks on ${elementName}")
    public void ${methodName}() {
        wait.until(ExpectedConditions.elementToBeClickable(PageElements.${elementName})).click();
    }
`;
      case 'sendKeys':
        return `    @When("User enters {string} in ${elementName}")
    public void ${methodName}(String text) {
        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        element.clear();
        element.sendKeys(text);
    }
`;
      case 'clear':
        return `    @When("User clears ${elementName}")
    public void ${methodName}() {
        wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName})).clear();
    }
`;
      case 'hover':
        return `    @When("User hovers over ${elementName}")
    public void ${methodName}() {
        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        Actions actions = new Actions(driver);
        actions.moveToElement(element).perform();
    }
`;
      case 'doubleClick':
        return `    @When("User double clicks on ${elementName}")
    public void ${methodName}() {
        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(PageElements.${elementName}));
        Actions actions = new Actions(driver);
        actions.doubleClick(element).perform();
    }
`;
      case 'scrollToView':
        return `    @When("User scrolls to ${elementName}")
    public void ${methodName}() {
        WebElement element = driver.findElement(PageElements.${elementName});
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
    }
`;
      default:
        return `    @When("User performs ${step.action} on ${elementName}")
    public void ${methodName}() {
        // TODO: Implement ${step.action} action
        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(PageElements.${elementName}));
        // Add implementation for ${step.action}
    }
`;
    }
  }
  
  function generateStepDescription(step) {
    const elementName = generateElementName(step);
    switch (step.action) {
      case 'click': 
        return `user clicks on ${elementName}`;
      case 'sendKeys': 
        return `user enters "${step.data}" in ${elementName}`;
      case 'clear':
        return `user clears ${elementName}`;
      case 'hover':
        return `user hovers over ${elementName}`;
      case 'doubleClick':
        return `user double clicks on ${elementName}`;
      case 'scrollToView':
        return `user scrolls to ${elementName}`;
      default: 
        return `user performs ${step.action} on ${elementName}`;
    }
  }
  
  function toCamelCase(str) {
    return str.replace(/[^a-zA-Z0-9]/g, ' ')
              .trim()
              .split(' ')
              .filter(word => word.length > 0)
              .map((word, index) => 
                index === 0 ? word.toLowerCase() : 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join('');
  }
  
  function downloadFile(filename, content) {
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
      
      console.log(`✅ Downloaded: ${filename}`);
    } catch (error) {
      console.error(`❌ Download failed for ${filename}:`, error);
      
      // Fallback: show content in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>${filename}</title></head>
            <body>
              <h2>${filename}</h2>
              <pre style="white-space: pre-wrap; word-wrap: break-word;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    }
  }
  
  // Make recorder draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  const header = container.querySelector('div:first-child');
  header.style.cursor = 'move';
  header.style.userSelect = 'none';
  
  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
  
  function dragStart(e) {
    if (e.target === minimizeBtn || e.target === closeBtn) return;
    
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
      
      // Keep within viewport bounds
      const rect = container.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      xOffset = Math.max(0, Math.min(xOffset, maxX));
      yOffset = Math.max(0, Math.min(yOffset, maxY));
      
      container.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  }
  
  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
  
  // Enhanced error handling
  window.addEventListener('error', function(e) {
    console.error('Recorder error:', e.error);
    if (statusBar) {
      statusBar.style.background = '#f8d7da';
      statusBar.style.color = '#721c24';
      statusBar.textContent = '❌ Error occurred - check console';
    }
  });
  
  console.log('✅ Enhanced Test Recorder injected and ready!');
  console.log('Features enabled:', window.recorderState.features);
  
  // Show welcome message
  statusBar.style.background = '#d1ecf1';
  statusBar.style.color = '#0c5460';
  statusBar.textContent = '🎉 Recorder loaded! Start recording to capture interactions.';
  
  setTimeout(() => {
    statusBar.style.background = '#e2e3e5';
    statusBar.style.color = '#6c757d';
    statusBar.textContent = 'Ready to record interactions';
  }, 3000);
}