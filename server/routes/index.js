const registerLocationRoutes = require('./locations');
const registerAnnotationRoutes = require('./annotations');
const registerQuestEventRoutes = require('./questEvents');

const createMatcher = pattern => {
    if (typeof pattern === 'string') {
        return pathname => (pathname === pattern ? {} : null);
    }
    if (pattern instanceof RegExp) {
        return pathname => {
            const match = pathname.match(pattern);
            if (!match) {
                return null;
            }
            return match.groups || match;
        };
    }
    throw new Error('Unsupported route pattern');
};

module.exports = function createRouter(context) {
    const routes = [];

    const register = (method, pattern, handler) => {
        routes.push({
            method: method.toUpperCase(),
            match: createMatcher(pattern),
            handler
        });
    };

    registerLocationRoutes(register, context);
    registerAnnotationRoutes(register, context);
    registerQuestEventRoutes(register, context);

    return async (req, res, urlObj) => {
        for (const route of routes) {
            if (route.method !== req.method) {
                continue;
            }
            const params = route.match(urlObj.pathname);
            if (!params) {
                continue;
            }
            await route.handler(req, res, urlObj, params);
            return true;
        }
        return false;
    };
};
