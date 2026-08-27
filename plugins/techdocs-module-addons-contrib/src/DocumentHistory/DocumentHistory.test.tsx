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

import { TechDocsAddonTester } from '@backstage/plugin-techdocs-addons-test-utils';
import { ConfigReader } from '@backstage/config';
import { configApiRef } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import {
  techdocsApiRef,
  useShadowRootElements,
} from '@backstage/plugin-techdocs-react';
import { entityPresentationApiRef } from '@backstage/plugin-catalog-react';
import { screen } from '@testing-library/react';
import { DocumentHistory } from '../plugin';

jest.mock('@backstage/plugin-techdocs-react', () => ({
  ...jest.requireActual('@backstage/plugin-techdocs-react'),
  useShadowRootElements: jest.fn(),
}));

describe('DocumentHistory', () => {
  const byUrl = jest.fn();
  const getDocumentHistory = jest.fn();
  const useShadowRootElementsMock = useShadowRootElements as jest.Mock;
  const entityPresentationApiMock = {
    forEntity: jest.fn().mockReturnValue({
      snapshot: { primaryTitle: 'Test Entity' },
    }),
  };

  const techdocsApiMock = {
    getDocumentHistory,
    getDocumentTags: jest.fn().mockResolvedValue({ tags: [] }),
    getDocumentBlame: jest.fn().mockResolvedValue({ lines: [] }),
    getDocumentContent: jest.fn().mockResolvedValue({
      ref: 'main',
      path: 'docs/index.md',
      content: '# Hello',
    }),
    getDocumentDiff: jest.fn().mockResolvedValue({
      fromRef: 'a',
      toRef: 'b',
      patch: '',
    }),
    getApiOrigin: async () => 'http://localhost',
    getCookie: async () => ({ expiresAt: new Date().toISOString() }),
    getTechDocsMetadata: async () => ({
      site_name: 'site',
      site_description: 'desc',
    }),
    getEntityMetadata: async () => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    byUrl.mockReturnValue({ type: 'github' });
    getDocumentHistory.mockResolvedValue({
      commits: [
        {
          sha: 'abcdef0123456789',
          shortSha: 'abcdef0',
          message: 'Update docs',
          authorName: 'Ada',
          authoredAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    useShadowRootElementsMock.mockImplementation((selectors: string[]) => {
      if (selectors.includes('[title^="Edit this page"]')) {
        return [
          {
            href: 'https://github.com/org/repo/edit/main/docs/index.md',
          },
        ];
      }
      return [];
    });
  });

  it('renders nothing when history is disabled', async () => {
    await TechDocsAddonTester.buildAddonsInTechDocs([<DocumentHistory />])
      .withApis([
        [
          configApiRef,
          new ConfigReader({ techdocs: { history: { enabled: false } } }),
        ],
        [scmIntegrationsApiRef, { byUrl }],
        [techdocsApiRef, techdocsApiMock],
        [entityPresentationApiRef, entityPresentationApiMock],
      ])
      .withDom(<body>content</body>)
      .renderWithEffects();

    expect(screen.queryByText('History')).toBeNull();
  });

  it('renders history controls when enabled', async () => {
    await TechDocsAddonTester.buildAddonsInTechDocs([<DocumentHistory />])
      .withApis([
        [
          configApiRef,
          new ConfigReader({ techdocs: { history: { enabled: true } } }),
        ],
        [scmIntegrationsApiRef, { byUrl }],
        [techdocsApiRef, techdocsApiMock],
        [entityPresentationApiRef, entityPresentationApiMock],
      ])
      .withDom(<body>content</body>)
      .renderWithEffects();

    expect(await screen.findByText('History')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Blame')).toBeInTheDocument();
  });
});
