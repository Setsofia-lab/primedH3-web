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

  it('constructs DATABASE_URL from Aurora secret fields', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:foo';
    sendMock.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        username: 'primed_admin',
        password: 'p@ss:word!',
        host: 'cluster.rds.amazonaws.com',
        port: 5432,
        dbname: 'primedhealth',
      }),
    });
    await resolveRuntimeSecrets();
    expect(process.env.DATABASE_URL).toBe(
      'postgres://primed_admin:p%40ss%3Aword!@cluster.rds.amazonaws.com:5432/primedhealth',
    );
  });

  it('builds rediss URL when REDIS_HOST provided', async () => {
    process.env.REDIS_HOST = 'master.cache.amazonaws.com';
    process.env.REDIS_PORT = '6379';
    await resolveRuntimeSecrets();
    expect(process.env.REDIS_URL).toBe('rediss://master.cache.amazonaws.com:6379');
  });

  it('survives Secrets Manager failure without throwing', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:foo';
    sendMock.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(resolveRuntimeSecrets()).resolves.not.toThrow();
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
