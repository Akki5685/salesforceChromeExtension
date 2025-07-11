// XPath Generation Module
export class XPathGenerator {
  
  static generateXPath(element) {
    if (!element) return '';
    
    // Priority 1: Label association (highest priority)
    const labelXPath = this.generateLabelAssociatedXPath(element);
    if (labelXPath && this.isXPathUnique(labelXPath)) return labelXPath;
    
    // Priority 2: Stable attributes
    const stableXPath = this.generateStableAttributeXPath(element);
    if (stableXPath && this.isXPathUnique(stableXPath)) return stableXPath;
    
    // Priority 3: Text content (buttons/links)
    const textXPath = this.generateTextContentXPath(element);
    if (textXPath && this.isXPathUnique(textXPath)) return textXPath;
    
    // Priority 4: Position-based with context
    return this.generatePositionBasedXPath(element);
  }
  
  static generateLabelAssociatedXPath(element) {
    // Case 1: Element has ID with associated label
    if (element.id && !/\d/.test(element.id)) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label?.textContent?.trim()) {
        const labelText = this.cleanTextForXPath(label.textContent);
        return `//${element.tagName.toLowerCase()}[@id=//label[normalize-space(text())="${labelText}"]/@for]`;
      }
    }
    
    // Case 2: Element inside label
    const labelParent = element.closest('label');
    if (labelParent?.textContent?.trim()) {
      const labelText = this.cleanTextForXPath(labelParent.textContent);
      return `//label[normalize-space(text())="${labelText}"]//${element.tagName.toLowerCase()}`;
    }
    
    // Case 3: Preceding label (Salesforce pattern)
    const precedingLabel = this.findPrecedingLabel(element);
    if (precedingLabel) {
      const labelText = this.cleanTextForXPath(precedingLabel.textContent);
      return `(//text()[normalize-space()="${labelText}"]/following::${element.tagName.toLowerCase()})[1]`;
    }
    
    return null;
  }
  
  static generateStableAttributeXPath(element) {
    const stableAttributes = [
      'data-testid', 'data-field-label', 'data-value', 
      'aria-label', 'aria-labelledby', 'name', 'placeholder'
    ];
    
    for (const attr of stableAttributes) {
      const value = element.getAttribute(attr);
      if (value && !/\d/.test(value)) {
        return `//*[@${attr}="${value}"]`;
      }
    }
    
    // Multi-attribute combination for uniqueness
    const validAttrs = stableAttributes
      .map(attr => ({ attr, value: element.getAttribute(attr) }))
      .filter(({value}) => value && !/\d/.test(value))
      .slice(0, 2);
      
    if (validAttrs.length >= 2) {
      const conditions = validAttrs.map(({attr, value}) => `@${attr}="${value}"`).join(' and ');
      return `//${element.tagName.toLowerCase()}[${conditions}]`;
    }
    
    return null;
  }
  
  static generateTextContentXPath(element) {
    if ((element.tagName === 'BUTTON' || element.tagName === 'A') && element.textContent?.trim()) {
      const text = this.cleanTextForXPath(element.textContent);
      if (text.length < 50) {
        return `//${element.tagName.toLowerCase()}[normalize-space(text())="${text}"]`;
      }
    }
    return null;
  }
  
  static generatePositionBasedXPath(element) {
    // Type-based for inputs
    if (element.type && element.tagName === 'INPUT') {
      const siblings = Array.from(element.parentNode?.children || [])
        .filter(child => child.tagName === 'INPUT' && child.type === element.type);
      const index = siblings.indexOf(element) + 1;
      return siblings.length === 1 ? 
        `//input[@type="${element.type}"]` : 
        `//input[@type="${element.type}"][${index}]`;
    }
    
    // Generic position-based
    const siblings = Array.from(element.parentNode?.children || [])
      .filter(child => child.tagName === element.tagName);
    const index = siblings.indexOf(element) + 1;
    
    return siblings.length === 1 ? 
      `//${element.tagName.toLowerCase()}` : 
      `//${element.tagName.toLowerCase()}[${index}]`;
  }
  
  static findPrecedingLabel(element) {
    let prev = element.previousElementSibling;
    while (prev) {
      if (prev.textContent?.trim()) return prev;
      prev = prev.previousElementSibling;
    }
    
    if (element.parentNode) {
      let parentSibling = element.parentNode.previousElementSibling;
      while (parentSibling) {
        if (parentSibling.textContent?.trim()) return parentSibling;
        parentSibling = parentSibling.previousElementSibling;
      }
    }
    return null;
  }
  
  static cleanTextForXPath(text) {
    return text.trim()
      .replace(/"/g, '\\"')
      .replace(/\s+/g, ' ');
  }
  
  static isXPathUnique(xpath) {
    try {
      const results = document.evaluate(
        xpath, document, null, 
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
      );
      return results.snapshotLength === 1;
    } catch (e) {
      console.warn('XPath evaluation error:', e);
      return false;
    }
  }
  
  // Salesforce-specific patterns
  static isSalesforceLookup(element) {
    const lookupIndicators = ['lightning-lookup', 'slds-combobox', 'lookup-pill'];
    return lookupIndicators.some(indicator => 
      element.outerHTML.includes(indicator) || 
      element.closest(`[class*="${indicator}"]`)
    );
  }
  
  static generateLookupXPath(element) {
    const lookupContainer = element.closest('[class*="lightning-lookup"], [class*="slds-combobox"]');
    if (lookupContainer) {
      const fieldLabel = lookupContainer.querySelector('[data-field-label]');
      if (fieldLabel) {
        const labelText = fieldLabel.getAttribute('data-field-label');
        return `//*[@data-field-label="${labelText}"]//input[contains(@class,"slds-input")]`;
      }
    }
    return `//div[contains(@class,"slds-combobox")]//input[contains(@class,"slds-input")]`;
  }
}