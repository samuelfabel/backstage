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

import {
  getGitLabRequestOptions,
  GitLabIntegration,
  ScmIntegrations,
} from '@backstage/integration';
import { NotFoundError, InputError } from '@backstage/errors';
import {
  TechDocsDocumentBlameLine,
  TechDocsDocumentCommit,
  TechDocsDocumentContent,
  TechDocsDocumentDiff,
  TechDocsDocumentSource,
  TechDocsDocumentTag,
} from '@backstage/plugin-techdocs-common';
import { DocumentHistoryProvider } from './types';

type GitLabCommitResponse = {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email?: string;
  authored_date: string;
  web_url?: string;
};

type GitLabBlameLine = {
  commit: {
    id: string;
    parent_ids?: string[];
    message: string;
    author_name: string;
    author_email?: string;
    authored_date: string;
  };
  lines: string[];
};

type GitLabTagResponse = {
  name: string;
  target: string;
  commit?: { id: string };
};

/** @internal */
export class GitlabDocumentHistoryProvider implements DocumentHistoryProvider {
  private readonly integrations: ScmIntegrations;

  constructor(integrations: ScmIntegrations) {
    this.integrations = integrations;
  }

  private getIntegration(source: TechDocsDocumentSource): GitLabIntegration {
    const integration = this.integrations.gitlab.byHost(source.host);
    if (!integration) {
      throw new InputError(
        `No GitLab integration configured for host '${source.host}'`,
      );
    }
    return integration;
  }

  private projectPath(source: TechDocsDocumentSource): string {
    return encodeURIComponent(`${source.owner}/${source.repo}`);
  }

  private async request(
    source: TechDocsDocumentSource,
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const integration = this.getIntegration(source);
    const { headers } = getGitLabRequestOptions(integration.config);
    const url = `${integration.config.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {}),
      },
    });
    if (response.status === 404) {
      throw new NotFoundError(
        `GitLab resource not found for ${source.owner}/${source.repo}${path}`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `GitLab request failed (${response.status} ${response.statusText}) for ${path}`,
      );
    }
    return response;
  }

  async listCommits(
    source: TechDocsDocumentSource,
    options?: { limit?: number },
  ): Promise<TechDocsDocumentCommit[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const params = new URLSearchParams({
      path: source.path,
      per_page: String(limit),
    });
    if (source.ref) {
      params.set('ref_name', source.ref);
    }
    const response = await this.request(
      source,
      `/projects/${this.projectPath(source)}/repository/commits?${params}`,
    );
    const commits = (await response.json()) as GitLabCommitResponse[];
    return commits.map(commit => ({
      sha: commit.id,
      shortSha: commit.short_id,
      message: commit.title || commit.message.split('\n')[0],
      authorName: commit.author_name,
      authorEmail: commit.author_email,
      authoredAt: commit.authored_date,
      htmlUrl: commit.web_url,
    }));
  }

  async getContent(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentContent> {
    const ref = source.ref || 'HEAD';
    const filePath = encodeURIComponent(source.path);
    const params = new URLSearchParams({ ref });
    const response = await this.request(
      source,
      `/projects/${this.projectPath(
        source,
      )}/repository/files/${filePath}/raw?${params}`,
    );
    return { ref, path: source.path, content: await response.text() };
  }

  async getBlame(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentBlameLine[]> {
    const ref = source.ref || 'HEAD';
    const filePath = encodeURIComponent(source.path);
    const params = new URLSearchParams({ ref });
    const response = await this.request(
      source,
      `/projects/${this.projectPath(
        source,
      )}/repository/files/${filePath}/blame?${params}`,
    );
    const blame = (await response.json()) as GitLabBlameLine[];
    const lines: TechDocsDocumentBlameLine[] = [];
    let lineNumber = 1;
    for (const hunk of blame) {
      for (const content of hunk.lines) {
        lines.push({
          lineNumber,
          content,
          sha: hunk.commit.id,
          shortSha: hunk.commit.id.slice(0, 7),
          authorName: hunk.commit.author_name,
          authoredAt: hunk.commit.authored_date,
        });
        lineNumber += 1;
      }
    }
    return lines;
  }

  async getDiff(
    source: TechDocsDocumentSource,
    fromRef: string,
    toRef: string,
  ): Promise<TechDocsDocumentDiff> {
    const params = new URLSearchParams({
      from: fromRef,
      to: toRef,
      straight: 'true',
    });
    const response = await this.request(
      source,
      `/projects/${this.projectPath(source)}/repository/compare?${params}`,
    );
    const body = (await response.json()) as {
      diffs?: Array<{
        old_path: string;
        new_path: string;
        diff: string;
      }>;
    };
    const fileDiff = body.diffs?.find(
      d => d.new_path === source.path || d.old_path === source.path,
    );
    const [fromContent, toContent] = await Promise.all([
      this.getContent({ ...source, ref: fromRef })
        .then(r => r.content)
        .catch(() => undefined),
      this.getContent({ ...source, ref: toRef })
        .then(r => r.content)
        .catch(() => undefined),
    ]);
    return {
      fromRef,
      toRef,
      patch: fileDiff?.diff,
      fromContent,
      toContent,
    };
  }

  async listTags(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentTag[]> {
    const response = await this.request(
      source,
      `/projects/${this.projectPath(source)}/repository/tags?per_page=50`,
    );
    const tags = (await response.json()) as GitLabTagResponse[];
    const results: TechDocsDocumentTag[] = [];
    for (const tag of tags.slice(0, 20)) {
      let containsFile: boolean | undefined;
      try {
        await this.getContent({ ...source, ref: tag.name });
        containsFile = true;
      } catch {
        containsFile = false;
      }
      results.push({
        name: tag.name,
        sha: tag.commit?.id || tag.target,
        containsFile,
        htmlUrl: `https://${source.host}/${source.owner}/${source.repo}/-/tags/${tag.name}`,
      });
    }
    return results;
  }
}
