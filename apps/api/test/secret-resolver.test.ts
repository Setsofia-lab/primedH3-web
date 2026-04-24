import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  // Class form — vi.fn().mockImplementation doesn't work as a constructor
  // for `new SecretsManagerClient(...)` in this setup.
  SecretsManagerClient: class {
    send = sendMock;
  },
  GetSecretValueCommand: class {
    constructor(input: { SecretId: string }) {
      Object.assign(this, input);
    }
  },
}));

import { resolveRuntimeSecrets } from '../src/config/secret-resolver';

describe('resolveRuntimeSecrets', () => {
  beforeEach(() => {
    sendMock.mockReset();
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.DB_SECRET_ARN;
  });

  it('skips when DATABASE_URL already set', async () => {
    process.env.DATABASE_URL = 'postgres://existing';
    await resolveRuntimeSecrets();
    expect(sendMock).not.toHaveBeenCalled();
    expect(process.env.DATABASE_URL).toBe('postgres://existing');
  });

  it('url-encodes username and password when constructing DATABASE_URL', async () => {
    // Test fixtures — `@`, `:`, `!` exercise encodeURIComponent; the
    // `TEST_FIXTURE_` prefix and .example.invalid host signal to any
    // secret scanner that these are not real credentials. The real
    // Aurora master password lives only in Secrets Manager.
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:foo';
    sendMock.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        username: 'TEST_FIXTURE_user',
        password: 'TEST_FIXTURE_p@ss:word!',
        host: 'db.example.invalid',
        port: 5432,
        dbname: 'TEST_FIXTURE_db',
      }),
    });
    await resolveRuntimeSecrets();
    expect(process.env.DATABASE_URL).toBe(
      'postgres://TEST_FIXTURE_user:TEST_FIXTURE_p%40ss%3Aword!@db.example.invalid:5432/TEST_FIXTURE_db',
    );
  });

  it('builds rediss URL when REDIS_HOST provided', async () => {
    process.env.REDIS_HOST = 'redis.example.invalid';
    process.env.REDIS_PORT = '6379';
    await resolveRuntimeSecrets();
    expect(process.env.REDIS_URL).toBe('rediss://redis.example.invalid:6379');
  });

  it('survives Secrets Manager failure without throwing', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:foo';
    sendMock.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(resolveRuntimeSecrets()).resolves.not.toThrow();
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
