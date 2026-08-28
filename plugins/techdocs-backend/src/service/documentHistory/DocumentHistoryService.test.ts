/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ConfigReader } from '@backstage/config';
import { DocumentHistoryService } from './DocumentHistoryService';
import { DocumentHistoryProvider } from './providers/types';

describe('DocumentHistoryService', () => {
  const provider: DocumentHistoryProvider = {
    listCommits: jest.fn().mockResolvedValue([
      {
        sha: 'abc',
        shortSha: 'abc',
        message: 'msg',
        authorName: 'Ada',
        authoredAt: '2024-01-01T00:00:00.000Z',
      },
    ]),
    getBlame: jest.fn().mockResolvedValue([]),
    getContent: jest.fn().mockResolvedValue({
      ref: 'main',
      path: 'docs/index.md',
      content: '# hi',
    }),
    getDiff: jest.fn().mockResolvedValue({
      fromRef: 'a',
      toRef: 'b',
      patch: 'diff',
    }),
    listTags: jest.fn().mockResolvedValue([]),
  };

  const source = {
    type: 'github' as const,
    host: 'github.com',
    owner: 'org',
    repo: 'repo',
    path: 'docs/index.md',
  };

  it('rejects calls when disabled', async () => {
    const service = new DocumentHistoryService(
      new ConfigReader({ techdocs: { history: { enabled: false } } }),
      { github: provider, gitlab: provider },
    );

    expect(() => service.listCommits(source)).toThrow(
      'TechDocs document history is disabled',
    );
  });

  it('delegates to the provider when enabled', async () => {
    const service = new DocumentHistoryService(
      new ConfigReader({ techdocs: { history: { enabled: true } } }),
      { github: provider, gitlab: provider },
    );

    await expect(service.listCommits(source)).resolves.toEqual([
      expect.objectContaining({ sha: 'abc' }),
    ]);
    expect(provider.listCommits).toHaveBeenCalledWith(source, undefined);
  });

  it('rejects unsafe paths', () => {
    const service = new DocumentHistoryService(
      new ConfigReader({ techdocs: { history: { enabled: true } } }),
      { github: provider, gitlab: provider },
    );

    expect(() => service.listCommits({ ...source, path: '../secret' })).toThrow(
      'must be safe',
    );
  });
});
