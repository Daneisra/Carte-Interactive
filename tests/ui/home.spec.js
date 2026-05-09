const { test, expect } = require('@playwright/test');

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
