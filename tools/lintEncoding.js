#!/usr/bin/env node

const path = require('path');
const { promises: fs } = require('fs');
const { TextDecoder } = require('util');

const ALLOWED_EXTENSIONS = new Set(['.md', '.js', '.json', '.ts', '.css', '.html']);
const decoder = new TextDecoder('utf-8', { fatal: true });

const hasUtf8Bom = buffer =>
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

async function collectTargets(targetPath) {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
        const entries = await fs.readdir(targetPath);
        const collected = [];
        for (const entry of entries) {
            if (entry.startsWith('.')) {
                continue;
            }
            const nested = await collectTargets(path.join(targetPath, entry));
            collected.push(...nested);
        }
        return collected;
    }

    const extension = path.extname(targetPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return [];
    }
    return [targetPath];
}

async function lintFile(filePath) {
    const buffer = await fs.readFile(filePath);
    const issues = [];

    if (hasUtf8Bom(buffer)) {
        issues.push('contient un BOM UTF-8');
    }

    try {
        decoder.decode(buffer);
    } catch (error) {
        issues.push(`encodage invalide: ${error.message}`);
        return issues;
    }

    return issues;
}

async function main() {
    const args = process.argv.slice(2);
    const targets = args.length ? args : ['docs', path.join('js', 'i18n.js')];
    const root = process.cwd();
    const results = [];

    for (const target of targets) {
        try {
            const absoluteTarget = path.resolve(root, target);
            const files = await collectTargets(absoluteTarget);
            for (const file of files) {
                const issues = await lintFile(file);
                if (issues.length) {
                    results.push({ file: path.relative(root, file), issues });
                }
            }
        } catch (error) {
            results.push({ file: target, issues: [`impossible de lire: ${error.message}`] });
        }
    }

    if (results.length) {
        console.error('✖ Problèmes d\'encodage detectes:');
        results.forEach(entry => {
            console.error(`  - ${entry.file}`);
            entry.issues.forEach(issue => console.error(`      • ${issue}`));
        });
        process.exitCode = 1;
        return;
    }

    console.log('✓ Encodage valide (UTF-8 sans BOM) pour les fichiers inspectes.');
}

main().catch(error => {
    console.error('✖ Erreur inattendue lors du lint encodage:', error);
    process.exitCode = 1;
});
