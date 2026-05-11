import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { renderMarkdown } from '../../js/ui/markdown.mjs';

const require = createRequire(import.meta.url);
const registerAnnotationRoutes = require('../../server/routes/annotations');
const {
    buildZipArgs,
    buildTarArgs,
    getArchiveDescriptor
} = require('../../server/utils/assetsArchive');

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
    },
    {
        name: 'deletes annotations using named router params and persists the file',
        run: async () => {
            const routes = [];
            let writtenAnnotations = null;
            let broadcastPayload = null;
            let responseStatus = null;

            registerAnnotationRoutes((method, pattern, handler) => {
                routes.push({ method, pattern, handler });
            }, {
                logger: { child: () => ({}) },
                json: (_res, status) => {
                    responseStatus = status;
                },
                ensureAuthorized: async () => true,
                readAnnotationsFile: async () => [
                    { id: 'annotation 1', label: 'A supprimer' },
                    { id: 'annotation_2', label: 'A garder' }
                ],
                writeAnnotationsFile: async annotations => {
                    writtenAnnotations = annotations;
                },
                collectBody: async () => '',
                normalizeString: value => (value ?? '').toString().trim(),
                broadcastSse: (_eventName, payload) => {
                    broadcastPayload = payload;
                }
            });

            const route = routes.find(entry => entry.method === 'DELETE');
            assert.ok(route);

            await route.handler({}, {}, null, { id: 'annotation%201' });

            assert.equal(responseStatus, 204);
            assert.deepEqual(writtenAnnotations, [
                { id: 'annotation_2', label: 'A garder' }
            ]);
            assert.equal(broadcastPayload.id, 'annotation 1');
            assert.equal(broadcastPayload.annotation.label, 'A supprimer');
        }
    },
    {
        name: 'builds asset archive commands with consistent exclusions',
        run: () => {
            assert.deepEqual(getArchiveDescriptor('zip'), {
                filename: 'assets.zip',
                contentType: 'application/zip'
            });
            assert.deepEqual(getArchiveDescriptor('tar'), {
                filename: 'assets.tar.gz',
                contentType: 'application/gzip'
            });
            assert.deepEqual(buildZipArgs('/tmp/assets.zip'), [
                '-r',
                '/tmp/assets.zip',
                '.',
                '-x',
                'logs/*',
                '-x',
                'icons/README.md'
            ]);
            assert.deepEqual(buildTarArgs('/tmp/assets.tar.gz'), [
                '-czf',
                '/tmp/assets.tar.gz',
                '--exclude=logs',
                '--exclude=icons/README.md',
                '.'
            ]);
        }
    }
];

let failed = false;

for (const test of tests) {
    try {
        await test.run();
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
