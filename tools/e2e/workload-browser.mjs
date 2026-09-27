import assert from 'node:assert/strict';

export async function verifyWorkloadPresentation({
  navigate, waitFor, request, evaluate, assertNoOverflow, siteId, expected,
}) {
  const response = await request(`/api/work/sites/${siteId}/workload-history`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.points.length, 12, JSON.stringify(response.body));
  assert.equal(response.body.points.at(-1)?.total, expected, JSON.stringify(response.body));
  assert.ok(response.body.availableFrom, JSON.stringify(response.body));

  await navigate('/#/workload');
  await waitFor(`document.body.innerText.includes("Aktive oppdrag over tid") &&
    document.body.innerText.includes("Historikk er tilgjengelig fra") &&
    [...document.querySelectorAll('.workload-chart polyline title')]
      .some(value => value.textContent === 'Hele siten')`, `workload chart total = ${expected}`);
  const chart = await evaluate(`(() => {
    const svg = document.querySelector('.workload-chart');
    const line = [...svg.querySelectorAll('polyline')]
      .find(value => value.querySelector('title')?.textContent === 'Hele siten');
    const points = line.getAttribute('points').trim().split(/\\s+/);
    return {
      label: svg.getAttribute('aria-label'),
      monthLabels: svg.querySelectorAll('text[text-anchor="middle"]').length,
      legend: [...document.querySelectorAll('.workload-legend span')]
        .map(value => value.textContent.trim()),
      lastY: Number(points.at(-1).split(',')[1]),
    };
  })()`);
  assert.equal(chart.label, 'Registrert oppdragsbelastning de siste 12 månedene');
  assert.equal(chart.monthLabels, 12, JSON.stringify(chart));
  assert.ok(chart.legend.includes('Hele siten'), JSON.stringify(chart));
  assert.ok(Math.abs(chart.lastY - (expected ? 40 : 250)) < 0.01, JSON.stringify(chart));
  await assertNoOverflow(`Workload chart total ${expected}`);
}
