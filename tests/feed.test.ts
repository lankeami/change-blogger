import { describe, it, expect } from 'vitest';
import { escapeXml } from '../src/feed';

describe('escapeXml', () => {
  it('escapes less-than sign', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than sign', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  it('escapes ampersand', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
  });

  it('escapes double quote', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quote', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('');
  });

  it('leaves alphanumeric unchanged', () => {
    expect(escapeXml('hello123')).toBe('hello123');
  });

  it('escapes multiple special chars', () => {
    expect(escapeXml('<tag attr="val" & name>'))
      .toBe('&lt;tag attr=&quot;val&quot; &amp; name&gt;');
  });
});
