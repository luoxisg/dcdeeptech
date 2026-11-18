import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateDigitization, digitizationEconomics } from '../../dfplan/digitization.mjs';
const baseline = { pages:5000,photos:1500,tapes:150,video:500,tapeMinutes:60,team:4 };
test('SGD cost conversion reconciles to the supplied reference quote', () => {
 const e=digitizationEconomics();
 assert.ok(Math.abs(e.rate*46200-247822)<1e-8);
 assert.ok(Math.abs(e.directCost*e.rate-96200)<1e-8);
 assert.ok(Math.abs(e.directCost+e.contribution-46200)<1e-8);
 assert.ok(Math.abs(e.margin-0.6118181598)<1e-9);
});
test('reference scope produces the twenty-day plan, flagship SGD budget and master capacity', () => {
 const r=estimateDigitization(baseline);
 assert.equal(r.days,20);assert.equal(r.budget,46200);assert.equal(r.package,'flagship');
 assert.ok(Math.abs(r.gb-1791.04)<.00001);assert.equal(r.audioMinutes,9000);
});
test('empty work has no package or mobilization charge; quantities are bounded', () => {
 const r=estimateDigitization();assert.equal(r.days,0);assert.equal(r.budget,0);assert.equal(r.gb,0);assert.equal(r.package,'none');
 const s=estimateDigitization({pages:-10,photos:Infinity,tapes:'bad',video:NaN});assert.equal(s.gb,0);
 const large=estimateDigitization({pages:99999,photos:99999,tapes:99999,video:99999,tapeMinutes:9999});
 assert.equal(large.pages,15000);assert.equal(large.photos,5000);assert.equal(large.tapes,300);assert.equal(large.video,10000);assert.equal(large.tapeMinutes,240);
});
test('smaller teams change time, tape duration changes both capacity and budget', () => {
 const full=estimateDigitization(baseline),two=estimateDigitization({...baseline,team:2}),long=estimateDigitization({...baseline,tapeMinutes:120});
 assert.ok(two.days>full.days);assert.equal(two.budget,full.budget);assert.equal(two.gb,full.gb);
 assert.ok(long.days>full.days);assert.ok(long.gb>full.gb);assert.ok(long.budget>full.budget);
});
test('package minima agree with visible starting prices and expanded scope is costed', () => {
 assert.equal(estimateDigitization({pages:10}).budget,8000);
 const standard=estimateDigitization({pages:5000});assert.equal(standard.package,'standard');assert.equal(standard.budget,25000);
 const large=estimateDigitization({pages:15000,photos:5000,tapes:300,video:2000,tapeMinutes:120});assert.equal(large.package,'expanded');assert.ok(large.budget>46200);
});
