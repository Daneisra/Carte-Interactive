const { test, expect } = require('@playwright/test');

const expandAllContinents = async page => {
  const toggles = page.locator('.continent-toggle');
  await toggles.first().waitFor();

  const count = await toggles.count();
  for (let i = 0; i < count; i += 1) {
    const toggle = toggles.nth(i);
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click();
    }
  }
};

const waitForAppReady = async page => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expandAllContinents(page);
  await page.waitForSelector('.location:visible');
};

test.describe('Carte Interactive - UI', () => {
  test('sélection d’un lieu met à jour le panneau information', async ({ page }) => {
    await waitForAppReady(page);

    const firstLocation = page.locator('.location:visible').first();
    const expectedTitle = await firstLocation.locator('.location-label').innerText();

    await firstLocation.click();

    const sidebar = page.locator('#info-sidebar');
    await expect(sidebar).toHaveClass(/open/);
    await expect(page.locator('#info-title')).toHaveText(expectedTitle, { timeout: 10_000 });
  });

  test('le clustering est activable/désactivable via la case à cocher', async ({ page }) => {
    await waitForAppReady(page);

    const toggle = page.locator('#clustering-toggle');
    await expect(toggle).toBeVisible();

    await toggle.check();
    await expect(toggle).toBeChecked();

    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
  });

  test('la galerie média affiche les vidéos d’un lieu avec un titre', async ({ page }) => {
    await waitForAppReady(page);

    await page.getByPlaceholder(/Rechercher un lieu/i).fill('Nikaïus');
    const targetLocation = page.locator('.location').filter({ hasText: /nikaïus/i }).first();
    await expect(targetLocation).toBeVisible();
    await targetLocation.click();

    const galleryVideos = page.locator('#image-gallery .gallery-video-container');
    await expect(galleryVideos).not.toHaveCount(0);
    await expect(galleryVideos.first().locator('.gallery-video-title')).toHaveText(/.+/);
  });
});
