import { expect, test } from '@playwright/test';

type Stage = 'local' | 'test' | 'staging';

interface TestEnvironment {
  stage: Stage;
  webURL: string;
  workers: number;
  serviceToken: string;
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseEnvironment(source: NodeJS.ProcessEnv): TestEnvironment {
  const stage = required(source, 'TEST_STAGE');
  if (!['local', 'test', 'staging'].includes(stage)) {
    throw new Error(`TEST_STAGE has unsupported value: ${stage}`);
  }

  const rawURL = required(source, 'WEB_URL');
  let webURL: string;
  try {
    webURL = new URL(rawURL).toString();
  } catch {
    throw new Error('WEB_URL must be an absolute URL');
  }

  const workers = Number(required(source, 'TEST_WORKERS'));
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error('TEST_WORKERS must be a positive integer');
  }

  return Object.freeze({
    stage: stage as Stage,
    webURL,
    workers,
    serviceToken: required(source, 'SERVICE_TOKEN')
  });
}

test('parses a valid environment at one typed boundary', () => {
  const environment = parseEnvironment({
    TEST_STAGE: 'staging',
    WEB_URL: 'https://staging.qualitymart.test',
    TEST_WORKERS: '4',
    SERVICE_TOKEN: 'test-secret'
  });

  expect(environment).toEqual({
    stage: 'staging',
    webURL: 'https://staging.qualitymart.test/',
    workers: 4,
    serviceToken: 'test-secret'
  });
  expect(Object.isFrozen(environment)).toBe(true);
});

test('fails before browser work when the environment contract is invalid', () => {
  const baseline: NodeJS.ProcessEnv = {
    TEST_STAGE: 'test',
    WEB_URL: 'https://qualitymart.test',
    TEST_WORKERS: '2',
    SERVICE_TOKEN: 'test-secret'
  };

  expect(() => parseEnvironment({ ...baseline, TEST_STAGE: 'production' }))
    .toThrow('TEST_STAGE has unsupported value: production');
  expect(() => parseEnvironment({ ...baseline, WEB_URL: 'not-a-url' }))
    .toThrow('WEB_URL must be an absolute URL');
  expect(() => parseEnvironment({ ...baseline, TEST_WORKERS: '0' }))
    .toThrow('TEST_WORKERS must be a positive integer');
  expect(() => parseEnvironment({ ...baseline, SERVICE_TOKEN: ' ' }))
    .toThrow('Missing required environment variable: SERVICE_TOKEN');
});
