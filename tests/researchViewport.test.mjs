import assert from 'node:assert/strict';
import { test } from 'node:test';
import { additionalSearchSpace, isKeyboardViewport, searchScrollAdjustment } from '../src/research/composables/useResearchViewport.ts';

const viewport = (overrides = {}) => ({
  baselineHeight: 844, visibleHeight: 844, scale: 1,
  touchCapable: true, editing: true, wasOpen: false, ...overrides,
});

test('focus alone and a hardware keyboard leave the footer visible', () => {
  assert.equal(isKeyboardViewport(viewport()), false);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 480, touchCapable: false })), false);
});

test('browser chrome changes and pinch zoom do not look like an on-screen keyboard', () => {
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 760 })), false);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 480, scale: 1.5 })), false);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 480, editing: false })), false);
});

test('a substantial visual or layout viewport reduction opens keyboard mode', () => {
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 510 })), true);
  assert.equal(isKeyboardViewport(viewport({ baselineHeight: 667, visibleHeight: 367 })), true);
});

test('opening and closing thresholds avoid keyboard animation flicker', () => {
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 650 })), true);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 670, wasOpen: true })), true);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 730, wasOpen: true })), true);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 760, wasOpen: true })), false);
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 844, wasOpen: true })), false);
});

test('blur during a result tap does not reveal the footer before the viewport recovers', () => {
  assert.equal(isKeyboardViewport(viewport({ visibleHeight: 510, editing: false, wasOpen: true })), true);
  assert.equal(isKeyboardViewport(viewport({ editing: false, wasOpen: true })), false);
});

test('search alignment leaves room for the instruction and first results', () => {
  assert.equal(searchScrollAdjustment(400, 444, 0, 480, 80), 312);
  assert.equal(searchScrollAdjustment(80, 124, 100, 480, 80), -108);
  assert.equal(searchScrollAdjustment(110, 154, 0, 480, 80), 0);
  assert.equal(searchScrollAdjustment(140, 184, 0, 240, 80), 52);
});

test('quick keyboard open/close cycles have no residual keyboard state', () => {
  let wasOpen = false;
  for (const visibleHeight of [510, 670, 844, 510, 844, 510, 844]) {
    wasOpen = isKeyboardViewport(viewport({ visibleHeight, wasOpen }));
  }
  assert.equal(wasOpen, false);
});

test('short result lists reserve enough document height without growing an already scrollable page', () => {
  assert.equal(additionalSearchSpace(0, 515, 814, 844), 515);
  assert.equal(additionalSearchSpace(290, 225, 1134, 844), 225);
  assert.equal(additionalSearchSpace(500, 100, 2000, 844), 0);
  assert.equal(additionalSearchSpace(290, -108, 1134, 844), 0);
  assert.equal(additionalSearchSpace(0, 50.2, 844, 844), 51);
});
