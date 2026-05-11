const { test, expect } = require('@playwright/test');

test.describe('Accueil - compteur Discord', () => {
  test('affiche le compteur Discord live quand l API repond', async ({ page }) => {
    await page.route('**/api/community/discord', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        live: true,
        fallback: false,
        count: 321,
        label: 'membres sur Discord',
        note: 'Compteur Discord live actif.'
      })
    }));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const proof = page.locator('#home-community-discord-proof');
    await expect(proof).toHaveText('321 membres sur Discord en direct');
    await expect(proof).toHaveAttribute('data-state', 'live');
    await expect(page.locator('#home-community-note')).toContainText('Compteur Discord live actif.');
  });

  test('affiche un fallback clair quand le compteur Discord live est indisponible', async ({ page }) => {
    await page.route('**/api/community/discord', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        live: false,
        fallback: true,
        count: 200,
        label: 'membres sur Discord',
        message: 'Compteur live indisponible - estimation: 200 membres sur Discord',
        note: 'Lore, sessions, annonces et coordination des groupes JDR.'
      })
    }));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const proof = page.locator('#home-community-discord-proof');
    await expect(proof).toHaveText('Compteur live indisponible - estimation: 200 membres sur Discord');
    await expect(proof).toHaveAttribute('data-state', 'fallback');
    await expect(page.locator('#home-community-note')).toContainText('Lore, sessions, annonces et coordination des groupes JDR.');
  });
});

test.describe('Accueil - mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la page accueil reste lisible et sans debordement horizontal sur telephone', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toHaveClass(/home-ready/);

    await expect(page.locator('.home-header')).toBeVisible();
    await expect(page.locator('.home-nav')).toBeVisible();
    await expect(page.locator('#home-enter-map')).toBeVisible();
    await expect(page.locator('#home-support-title')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    ));
    expect(hasHorizontalOverflow).toBeFalsy();

    const navBox = await page.locator('.home-nav').boundingBox();
    const headerBox = await page.locator('.home-header').boundingBox();
    expect(navBox).toBeTruthy();
    expect(headerBox).toBeTruthy();
    expect(navBox.width).toBeLessThanOrEqual(headerBox.width);

    const roll20Links = page.locator('.home-support-roll20-list .home-link-button');
    await expect(roll20Links.first()).toBeVisible();
    const firstWishlistBox = await roll20Links.first().boundingBox();
    expect(firstWishlistBox).toBeTruthy();
    expect(firstWishlistBox.width).toBeGreaterThan(280);
    expect(firstWishlistBox.width).toBeLessThanOrEqual(366);
  });
});
