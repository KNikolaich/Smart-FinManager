import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_GROUPS } from './themePreferences';

function luminance(hex: string) {
  const [red, green, blue] = hex.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16) / 255);
  const linearize = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return [red, green, blue]
    .map(linearize)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function themeTokens(themeId: string, css: string) {
  const block = css.match(new RegExp(`^\\.${themeId}\\s*\\{([^}]*)\\}`, 'm'))?.[1];
  expect(block, `CSS theme block for ${themeId}`).toBeTruthy();

  const token = (name: string) => {
    const value = block!.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, 'i'))?.[1];
    expect(value, `${themeId} must define --${name} as a solid hex color`).toBeTruthy();
    return value!;
  };

  return {
    primary: token('primary'),
    onPrimary: token('text-on-primary'),
    actionText: token('color-action-text'),
    mainText: token('text-main'),
    mutedText: token('text-muted'),
    surfaces: [token('bg-main'), token('bg-surface'), token('input-bg')],
  };
}

describe('theme contrast', () => {
  it('keeps action labels and primary text at WCAG AA contrast on every theme surface', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const themeIds = THEME_GROUPS.flatMap(group => group.items.map(theme => theme.id));

    for (const themeId of themeIds) {
      const tokens = themeTokens(themeId, css);
      expect(contrastRatio(tokens.primary, tokens.onPrimary), `${themeId} action label`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.actionText, tokens.surfaces[1]), `${themeId} accent text`).toBeGreaterThanOrEqual(4.5);

      for (const surface of tokens.surfaces) {
        expect(contrastRatio(tokens.mainText, surface), `${themeId} primary text`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens.mutedText, surface), `${themeId} muted text`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});