const hasMarked = () => typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function';
const hasDOMPurify = () => typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function';

const escapeHtml = value => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const renderMarkdown = (input = '') => {
    const source = (input ?? '').toString();
    if (!source.trim()) {
        return '';
    }

    let html = source;
    if (hasMarked()) {
        html = window.marked.parse(source, { breaks: true, gfm: true });
    } else {
        html = escapeHtml(source).replace(/\n/g, '<br>');
    }

    if (hasDOMPurify()) {
        return window.DOMPurify.sanitize(html);
    }
    return html;
};
