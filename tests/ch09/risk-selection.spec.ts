import { expect, test } from '@playwright/test';

type Risk = {
  name: string;
  likelihood: number;
  impact: number;
  exposure: number;
};

const priority = (risk: Risk) =>
  risk.likelihood * risk.impact * risk.exposure;

const selectCriticalRisks = (risks: Risk[], threshold: number) =>
  risks
    .filter(risk => priority(risk) >= threshold)
    .sort((left, right) => priority(right) - priority(left))
    .map(risk => risk.name);

test('risk selection makes the portfolio decision explicit', () => {
  const risks: Risk[] = [
    { name: 'duplicate charge', likelihood: 3, impact: 5, exposure: 5 },
    { name: 'wrong search sort', likelihood: 3, impact: 2, exposure: 3 },
    { name: 'refund authorization', likelihood: 2, impact: 5, exposure: 4 },
    { name: 'recommendation outage', likelihood: 4, impact: 1, exposure: 3 }
  ];

  expect(selectCriticalRisks(risks, 40)).toEqual([
    'duplicate charge',
    'refund authorization'
  ]);
});
