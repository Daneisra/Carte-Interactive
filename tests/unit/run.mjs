import assert from 'node:assert/strict';
import { renderMarkdown } from '../../js/ui/markdown.mjs';

const tests = [
    {
        name: 'renders basic paragraphs with inline formatting',
        run: () => {
            const html = renderMarkdown('Hello **world**');
            assert.equal(html, '<p>Hello <strong>world</strong></p>');
        }
    },
    {
        name: 'converts new lines into <br> elements',
        run: () => {
            const html = renderMarkdown('First line\nSecond line');
            assert.equal(html, '<p>First line<br>Second line</p>');
        }
    },
    {
        name: 'sanitizes dangerous links',
        run: () => {
            const html = renderMarkdown('[click me](javascript:evil)');
            assert.equal(html, '<p><a href="#" target="_blank" rel="noopener noreferrer">click me</a></p>');
        }
    },
    {
        name: 'supports fenced code blocks',
        run: () => {
            const html = renderMarkdown('```\nconst answer = 42;\n```');
            assert.equal(html, '<pre><code>const answer = 42;</code></pre>');
        }
    },
    {
        name: 'renders unordered lists',
        run: () => {
            const html = renderMarkdown('- Item one\n- Item two');
            assert.equal(html, '<ul><li>Item one</li><li>Item two</li></ul>');
        }
    }
];

let failed = false;

for (const test of tests) {
    try {
        test.run();
        console.log(`ok - ${test.name}`);
    } catch (error) {
        failed = true;
        console.error(`not ok - ${test.name}`);
        console.error(error);
    }
}

if (failed) {
    process.exitCode = 1;
}
