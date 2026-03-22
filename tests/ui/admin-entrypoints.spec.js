const { test, expect } = require('@playwright/test');

const loginAsAdmin = async page => {
  const loginResponse = await page.request.get('/auth/discord/login', { maxRedirects: 0 });
  expect(loginResponse.status()).toBe(302);

  const redirect = loginResponse.headers()['location'];
  expect(redirect).toBeTruthy();

  const state = new URL(redirect).searchParams.get('state');
  expect(state).toBeTruthy();

  const callbackResponse = await page.request.get(`/auth/discord/callback?code=stub-code&state=${state}`, {
    maxRedirects: 0
  });
  expect(callbackResponse.status()).toBe(302);
};

test.describe('Points d\'entree admin', () => {
  test('l accueil expose un acces admin dedie vers la section accueil', async ({ page }) => {
    await loginAsAdmin(page);
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/admin/home-config') || url.includes('/api/admin/timeline')) {
        requests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const adminEntry = page.locator('#home-admin-entry');
    await expect(adminEntry).toBeVisible();
    await expect(adminEntry).toHaveAttribute('href', '/map/?adminSection=home');

    await page.goto('/map/?adminSection=home');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#admin-overlay')).toBeVisible();
    await expect(page.locator('#admin-section-home-config')).toHaveClass(/is-targeted/);
    await page.waitForTimeout(300);
    expect(requests.some(url => url.includes('/api/admin/home-config'))).toBeTruthy();
    expect(requests.some(url => url.includes('/api/admin/timeline'))).toBeFalsy();
  });

  test('la chronologie expose un acces admin dedie vers la section chronologie', async ({ page }) => {
    await loginAsAdmin(page);
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/admin/home-config') || url.includes('/api/admin/timeline')) {
        requests.push(url);
      }
    });

    await page.goto('/timeline/');
    await page.waitForLoadState('domcontentloaded');

    const adminEntry = page.locator('#timeline-admin-entry');
    await expect(adminEntry).toBeVisible();
    await expect(adminEntry).toHaveAttribute('href', '/map/?adminSection=timeline');

    await page.goto('/map/?adminSection=timeline');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#admin-overlay')).toBeVisible();
    await expect(page.locator('#admin-section-timeline-config')).toHaveClass(/is-targeted/);
    await page.waitForTimeout(300);
    expect(requests.some(url => url.includes('/api/admin/timeline'))).toBeTruthy();
    expect(requests.some(url => url.includes('/api/admin/home-config'))).toBeFalsy();
  });

  test('le panneau admin carte n ouvre pas les chargements accueil et chronologie par defaut', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/map/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#profile-button').click();
    const adminButton = page.locator('#quick-admin-panel');
    await expect(adminButton).toBeVisible();

    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/admin/home-config') || url.includes('/api/admin/timeline')) {
        requests.push(url);
      }
    });

    await adminButton.click();
    await expect(page.locator('#admin-overlay')).toBeVisible();
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(0);
  });
});
