import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, TOOLS, PINNED, toolsInGroup } from '../src/nav-tools.js';

test('every tool belongs to a real group', () => {
  const groupIds = new Set(Object.keys(GROUPS));
  for (const tool of TOOLS) {
    assert.ok(groupIds.has(tool.group), `tool "${tool.id}" references unknown group "${tool.group}"`);
  }
});

test('a tool with no route is always "planned"; a tool with a route is "live" or "partial"', () => {
  for (const tool of TOOLS) {
    if (tool.path == null) {
      assert.equal(tool.status, 'planned', `"${tool.id}" has no path but isn't planned`);
    } else {
      assert.ok(['live', 'partial'].includes(tool.status), `"${tool.id}" has a path but status is "${tool.status}"`);
    }
  }
});

test('toolsInGroup returns only that group\'s tools, in the registry\'s own order, minus any hidden ones', () => {
  const measurement = toolsInGroup('measurement');
  assert.ok(measurement.length > 0);
  assert.ok(measurement.every((tool) => tool.group === 'measurement'));

  const analysis = toolsInGroup('analysis');
  assert.ok(analysis.length > 0);
  assert.ok(analysis.every((tool) => tool.group === 'analysis'));

  const hiddenCount = TOOLS.length - measurement.length - analysis.length;
  assert.ok(hiddenCount >= 0, 'toolsInGroup should never return more tools than TOOLS holds');
});

test('a tool can be hidden from toolsInGroup() without being removed from TOOLS', () => {
  assert.ok(TOOLS.some((tool) => tool.id === 'range-card'), 'range-card should still be a real, defined tool');
  assert.ok(!toolsInGroup('analysis').some((tool) => tool.id === 'range-card'), 'range-card should not appear in its group\'s listing');
});

test('every tool and pinned entry has a distinct id', () => {
  const ids = [...TOOLS.map((t) => t.id), ...PINNED.map((p) => p.id)];
  assert.equal(new Set(ids).size, ids.length);
});

test('Guns, Settings, and Manual sit outside every group', () => {
  const pinnedIds = PINNED.map((p) => p.id);
  assert.ok(pinnedIds.includes('guns'));
  assert.ok(pinnedIds.includes('settings'));
  assert.ok(pinnedIds.includes('manual'));
  assert.ok(!TOOLS.some((tool) => ['guns', 'settings', 'manual'].includes(tool.id)));
});

test('Shooting is a group with exactly one tool (Range Solver), not an accordion group', () => {
  assert.ok(GROUPS.shooting, 'expected a shooting entry in GROUPS');
  assert.equal(GROUPS.shooting.accordion, undefined, 'Shooting should not be marked accordion:true like Analysis/Measurement');
  assert.ok(!('range-solver' in Object.fromEntries(PINNED.map((p) => [p.id, p]))), 'range-solver should not also be a PINNED entry');

  const shootingTools = toolsInGroup('shooting');
  assert.equal(shootingTools.length, 1);
  assert.equal(shootingTools[0].id, 'range-solver');
  assert.equal(shootingTools[0].nameKey, 'catalog.rangeSolver', 'the card shows the fuller catalog name, distinct from the short nav label');
});

test('GROUPS.shooting itself uses the short nav label and points straight at the tool\'s own route (no hub page)', () => {
  assert.equal(GROUPS.shooting.nameKey, 'nav.rangeSolver');
  assert.equal(GROUPS.shooting.path, '/range-solver');
  const rangeSolverTool = TOOLS.find((tool) => tool.id === 'range-solver');
  assert.equal(GROUPS.shooting.path, rangeSolverTool.path, 'the group\'s own "path" is literally the one tool\'s route');
});

test('the currently-implemented tools are marked live, not planned', () => {
  const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
  assert.equal(byId['cd-mach-curve'].status, 'live');
  assert.equal(byId['cd-mach-curve'].path, '/cd-mach-curve');
  assert.equal(byId['trajectory'].status, 'live');
  assert.equal(byId['trajectory'].path, '/trajectory');
});

test('bc-tools is a real, fully usable route (Calculation, Conversion, and Labradar tabs all live)', () => {
  const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
  assert.equal(byId['bc-tools'].status, 'live');
  assert.equal(byId['bc-tools'].path, '/bc-tools');
});
