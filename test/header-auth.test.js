import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const headerCss = readFileSync(new URL('../blocks/header/header.css', import.meta.url), 'utf8');

describe('header authentication control', () => {
  it('does not hide the login or logout control at the mobile breakpoint', () => {
    expect(headerCss).not.toMatch(
      /header nav \.nav-tools \.nav-auth-link\s*\{\s*display:\s*none;\s*\}/,
    );
  });
});
