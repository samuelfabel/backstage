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

import { Config } from '@backstage/config';
import { InputError, NotAllowedError } from '@backstage/errors';
import { ScmIntegrations } from '@backstage/integration';
import {
  TechDocsDocumentBlameLine,
  TechDocsDocumentCommit,
  TechDocsDocumentContent,
  TechDocsDocumentDiff,
  TechDocsDocumentHistoryScmType,
  TechDocsDocumentSource,
  TechDocsDocumentTag,
} from '@backstage/plugin-techdocs-common';
import { GithubDocumentHistoryProvider } from './providers/github';
import { GitlabDocumentHistoryProvider } from './providers/gitlab';
import { DocumentHistoryProvider } from './providers/types';

/** @internal */
export class DocumentHistoryService {
  private readonly config: Config;
  private readonly providers: Map<
    TechDocsDocumentHistoryScmType,
    DocumentHistoryProvider
  >;

  static fromConfig(config: Config): DocumentHistoryService {
    const integrations = ScmIntegrations.fromConfig(config);
    return new DocumentHistoryService(config, {
      github: new GithubDocumentHistoryProvider(integrations),
      gitlab: new GitlabDocumentHistoryProvider(integrations),
    });
  }

  constructor(
    config: Config,
    providers:
      | Map<TechDocsDocumentHistoryScmType, DocumentHistoryProvider>
      | {
          github: DocumentHistoryProvider;
          gitlab: DocumentHistoryProvider;
        },
  ) {
    this.config = config;
    this.providers =
      providers instanceof Map
        ? providers
        : new Map([
            ['github', providers.github],
            ['gitlab', providers.gitlab],
          ]);
  }

  isEnabled(): boolean {
    return this.config.getOptionalBoolean('techdocs.history.enabled') === true;
  }

  private assertEnabled() {
    if (!this.isEnabled()) {
      throw new NotAllowedError(
        'TechDocs document history is disabled. Set techdocs.history.enabled to true to use this feature.',
      );
    }
  }

  private getProvider(source: TechDocsDocumentSource): DocumentHistoryProvider {
    this.assertEnabled();
    this.validateSource(source);
    const provider = this.providers.get(source.type);
    if (!provider) {
      throw new InputError(
        `Document history is not supported for SCM type '${source.type}'`,
      );
    }
    return provider;
  }

  private validateSource(source: TechDocsDocumentSource) {
    if (!source.type || !source.host || !source.owner || !source.repo) {
      throw new InputError(
        'Document source requires type, host, owner, and repo',
      );
    }
    if (!source.path || source.path.includes('..')) {
      throw new InputError('Document source path is required and must be safe');
    }
  }

  listCommits(
    source: TechDocsDocumentSource,
    options?: { limit?: number },
  ): Promise<TechDocsDocumentCommit[]> {
    return this.getProvider(source).listCommits(source, options);
  }

  getBlame(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentBlameLine[]> {
    return this.getProvider(source).getBlame(source);
  }

  getContent(source: TechDocsDocumentSource): Promise<TechDocsDocumentContent> {
    return this.getProvider(source).getContent(source);
  }

  getDiff(
    source: TechDocsDocumentSource,
    fromRef: string,
    toRef: string,
  ): Promise<TechDocsDocumentDiff> {
    if (!fromRef || !toRef) {
      throw new InputError('Both fromRef and toRef are required for diff');
    }
    return this.getProvider(source).getDiff(source, fromRef, toRef);
  }

  listTags(source: TechDocsDocumentSource): Promise<TechDocsDocumentTag[]> {
    return this.getProvider(source).listTags(source);
  }
}
