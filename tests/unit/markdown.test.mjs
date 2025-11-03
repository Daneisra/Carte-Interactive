import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../../js/ui/markdown.mjs';

test('renders basic paragraphs with inline formatting', () => {
    const html = renderMarkdown('Hello **world**');
    assert.equal(html, '<p>Hello <strong>world</strong></p>');
});

test('converts new lines into <br> elements', () => {
    const html = renderMarkdown('First line\nSecond line');
    assert.equal(html, '<p>First line<br>Second line</p>');
});

test('sanitizes dangerous links', () => {
    const html = renderMarkdown('[click me](javascript:evil)');
    assert.equal(html, '<p><a href="#" target="_blank" rel="noopener noreferrer">click me</a></p>');
});

test('supports fenced code blocks', () => {
    const html = renderMarkdown('```\nconst answer = 42;\n```');
    assert.equal(html, '<pre><code>const answer = 42;</code></pre>');
});

test('renders unordered lists', () => {
    const html = renderMarkdown('- Item one\n- Item two');
    assert.equal(html, '<ul><li>Item one</li><li>Item two</li></ul>');
});
