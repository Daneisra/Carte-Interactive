const { test, expect } = require('@playwright/test');
const locationsByContinent = require('../../assets/locations.json');

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const collectLocationNames = source => Object.values(source || {})
  .flatMap(entries => Array.isArray(entries) ? entries : [])
  .map(entry => entry?.name)
  .filter(Boolean);

const mapLocationNames = new Set(collectLocationNames(locationsByContinent).map(normalizeText));

const loadTimelineEntries = async page => {
  const response = await page.request.get('/api/timeline');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return Array.isArray(payload?.timeline?.entries) ? payload.timeline.entries : [];
};

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
  await page.goto('/map/');
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

  test('un lieu affiche les evenements lies dans la chronologie', async ({ page }) => {
    const entries = await loadTimelineEntries(page);
    const linkedEntries = entries
      .map(entry => {
        const names = Array.isArray(entry.locationNames) ? entry.locationNames : [];
        const matchingLocation = names.find(name => mapLocationNames.has(normalizeText(name)));
        return matchingLocation ? { entry, locationName: matchingLocation } : null;
      })
      .filter(Boolean);

    test.skip(!linkedEntries.length, 'Aucun evenement chronologique ne pointe vers un lieu de la carte.');

    const selectedLocationName = linkedEntries[0].locationName;
    const exactMatches = linkedEntries
      .filter(item => normalizeText(item.locationName) === normalizeText(selectedLocationName))
      .sort((left, right) => Number(left.entry?.year || 0) - Number(right.entry?.year || 0));

    await waitForAppReady(page);

    await page.getByPlaceholder(/Rechercher un lieu/i).fill(selectedLocationName);
    const targetLocation = page.locator('.location').filter({ hasText: new RegExp(selectedLocationName, 'i') }).first();
    await expect(targetLocation).toBeVisible();
    await targetLocation.click();

    const timelineSection = page.locator('#timeline-section');
    await expect(timelineSection).toBeVisible();
    await expect(timelineSection).toContainText(/Chronologie liee/i);
    await expect(timelineSection.locator('.timeline-link-card')).toHaveCount(exactMatches.length);
    await expect(timelineSection.locator('.timeline-link-title').first()).toHaveText(exactMatches[0].entry.title);
    await expect(timelineSection.locator('.timeline-link-button').first()).toHaveAttribute(
      'href',
      new RegExp(`/timeline/\\?event=${exactMatches[0].entry.id}`)
    );
  });
});
