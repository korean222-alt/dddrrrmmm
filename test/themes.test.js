import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, THEME_GROUPS, THEME_CYCLE, themeForLevel, cycleTheme, groupStarting } from '../public/js/themes.js';
import { LEVELS } from '../public/js/charts.js';

test('모든 단계가 맵 묶음 하나에 들어감 (1~15)', () => {
  for (const lv of LEVELS) {
    const t = themeForLevel(lv);
    assert.ok(THEMES[t.key], `${lv.id}단계 맵 없음`);
    assert.equal(t.cycle, false);
    const g = THEME_GROUPS.find((x) => lv.id >= x.from && lv.id <= x.to);
    assert.ok(g, `${lv.id}단계가 어느 묶음에도 없음`);
    assert.equal(g.key, t.key);
  }
  assert.equal(themeForLevel({ id: 1 }).key, 'sunset');
  assert.equal(themeForLevel({ id: 11 }).key, 'void');
  assert.equal(themeForLevel({ id: 15 }).key, 'lava');
});

test('단계별 무제한은 그 단계 맵, 그리그 무제한·챌린지는 Lv 마다 바뀜', () => {
  assert.deepEqual(themeForLevel({ id: 'e5', baseId: 5, endless: true, challenge: true }), { key: 'city', cycle: false });
  assert.deepEqual(themeForLevel({ id: 'endless', endless: true, challenge: true }), { key: 'space', cycle: true });
  assert.equal(cycleTheme(1), 'space');
  assert.equal(cycleTheme(2), 'sunset');
  assert.equal(cycleTheme(THEME_CYCLE.length + 1), 'space');
  for (const k of THEME_CYCLE) assert.ok(THEMES[k]);
});

test('묶음 제목은 묶음 첫 단계에만', () => {
  assert.equal(groupStarting(1).key, 'sunset');
  assert.equal(groupStarting(2), null);
  assert.equal(groupStarting(13).theme.name, THEMES.lava.name);
});
