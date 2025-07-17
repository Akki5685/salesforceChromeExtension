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
}
