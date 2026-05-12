import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { renderMarkdown } from '../../js/ui/markdown.mjs';
import {
    AVAILABILITY_DAYS,
    AVAILABILITY_SLOTS,
    createAvailabilityMatrix,
    normalizeAvailabilityPayload
} from '../../js/ui/availability.mjs';
import {
    isValidAccentColor,
    normalizeProfileCustomization,
    normalizeProfileUrl
} from '../../js/ui/profileCustomization.mjs';
import {
    enforceSingleActiveCharacter,
    normalizeCharacterList
} from '../../js/ui/characterModel.mjs';
import {
    normalizeAnnotationColor,
    normalizeAnnotationId
} from '../../js/ui/annotationModel.mjs';

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
        name: 'normalizes availability payloads with a stable weekly matrix',
        run: () => {
            const normalized = normalizeAvailabilityPayload({
                timezone: 'Europe/Warsaw',
                slots: [
                    [true, false, true],
                    [0, 1, '', 'yes']
                ]
            });
            assert.equal(normalized.timezone, 'Europe/Warsaw');
            assert.equal(normalized.slots.length, AVAILABILITY_DAYS.length);
            assert.equal(normalized.slots[0].length, AVAILABILITY_SLOTS.length);
            assert.deepEqual(normalized.slots[0], [true, false, true, false]);
            assert.deepEqual(normalized.slots[1], [false, true, false, true]);
            assert.deepEqual(normalized.slots[6], [false, false, false, false]);
        }
    },
    {
        name: 'creates independent availability matrices',
        run: () => {
            const first = createAvailabilityMatrix();
            const second = createAvailabilityMatrix();
            first[0][0] = true;
            assert.equal(second[0][0], false);
        }
    },
    {
        name: 'normalizes profile customization URLs and social links',
        run: () => {
            assert.equal(normalizeProfileUrl('/assets/banner.jpg'), '/assets/banner.jpg');
            assert.equal(normalizeProfileUrl('https://example.com/profile'), 'https://example.com/profile');
            assert.equal(normalizeProfileUrl('javascript:alert(1)'), null);
            assert.equal(isValidAccentColor('#60a5fa'), true);
            assert.equal(isValidAccentColor('#bad'), false);
            const profile = normalizeProfileCustomization({
                banner: 'https://example.com/banner.jpg',
                accentColor: '#60a5fa',
                bio: ` ${'x'.repeat(6100)} `,
                socials: {
                    website: 'https://example.com',
                    twitch: 'ftp://invalid.example'
                }
            });
            assert.equal(profile.banner, 'https://example.com/banner.jpg');
            assert.equal(profile.accentColor, '#60a5fa');
            assert.equal(profile.bio.length, 6000);
            assert.deepEqual(profile.socials, { website: 'https://example.com' });
        }
    },
    {
        name: 'normalizes character lists and keeps a single active character',
        run: () => {
            let nextId = 1;
            const characters = normalizeCharacterList([
                { id: ' hero ', name: '  Danny ', active: true, group: ' main ' },
                { id: 'hero', name: 'Duplicate without assign' },
                { name: ' Alienor ', avatar: ' /assets/alienor.png ', active: true },
                null,
                { id: 'empty' }
            ], {
                assignIds: true,
                createId: () => `char_test_${nextId++}`
            });
            assert.deepEqual(characters, [
                {
                    id: 'hero',
                    name: 'Danny',
                    bio: null,
                    avatar: null,
                    groupId: 'main',
                    active: true
                },
                {
                    id: 'char_test_1',
                    name: 'Duplicate without assign',
                    bio: null,
                    avatar: null,
                    groupId: null,
                    active: false
                },
                {
                    id: 'char_test_2',
                    name: 'Alienor',
                    bio: null,
                    avatar: '/assets/alienor.png',
                    groupId: null,
                    active: false
                }
            ]);
            assert.deepEqual(enforceSingleActiveCharacter([
                { id: 'a', active: true },
                { id: 'b', active: true }
            ]), [
                { id: 'a', active: true },
                { id: 'b', active: false }
            ]);
        }
    },
    {
        name: 'normalizes annotation ids and colors',
        run: () => {
            assert.equal(normalizeAnnotationId('  abc  '), 'abc');
            assert.equal(normalizeAnnotationId(null), '');
            assert.equal(normalizeAnnotationColor(''), '#ff8a00');
            assert.equal(normalizeAnnotationColor('f80'), '#f80');
            assert.equal(normalizeAnnotationColor('ff8800'), '#ff8800');
            assert.equal(normalizeAnnotationColor('#abc'), '#abc');
            assert.equal(normalizeAnnotationColor('not-a-color'), '#ff8a00');
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
