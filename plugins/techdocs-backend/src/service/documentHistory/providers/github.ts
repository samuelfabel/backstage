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
  DefaultGithubCredentialsProvider,
  GithubIntegration,
  getGithubFileFetchUrl,
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

type GithubCommitResponse = {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
  };
  author?: { login?: string } | null;
};

type GithubTagResponse = {
  name: string;
  commit: { sha: string };
};

type GithubCompareFile = {
  filename: string;
  patch?: string;
  status: string;
};

type GithubCompareResponse = {
  files?: GithubCompareFile[];
};

type GithubBlameRange = {
  startingLine: number;
  endingLine: number;
  commit: {
    oid: string;
    message: string;
    authoredDate: string;
    author?: { name?: string; email?: string } | null;
  };
};

/** @internal */
export class GithubDocumentHistoryProvider implements DocumentHistoryProvider {
  private readonly integrations: ScmIntegrations;
  private readonly credentialsProvider: DefaultGithubCredentialsProvider;

  constructor(integrations: ScmIntegrations) {
    this.integrations = integrations;
    this.credentialsProvider =
      DefaultGithubCredentialsProvider.fromIntegrations(integrations);
  }

  private getIntegration(source: TechDocsDocumentSource): GithubIntegration {
    const integration = this.integrations.github.byHost(source.host);
    if (!integration) {
      throw new InputError(
        `No GitHub integration configured for host '${source.host}'`,
      );
    }
    return integration;
  }

  private async request(
    source: TechDocsDocumentSource,
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const integration = this.getIntegration(source);
    const credentials = await this.credentialsProvider.getCredentials({
      url: `https://${source.host}/${source.owner}/${source.repo}`,
    });
    const url = `${integration.config.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        ...credentials.headers,
        ...(init?.headers ?? {}),
      },
    });
    if (response.status === 404) {
      throw new NotFoundError(
        `GitHub resource not found for ${source.owner}/${source.repo}${path}`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `GitHub request failed (${response.status} ${response.statusText}) for ${path}`,
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
      params.set('sha', source.ref);
    }
    const response = await this.request(
      source,
      `/repos/${source.owner}/${source.repo}/commits?${params}`,
    );
    const commits = (await response.json()) as GithubCommitResponse[];
    return commits.map(commit => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.commit.message.split('\n')[0] ?? commit.commit.message,
      authorName:
        commit.commit.author?.name || commit.author?.login || 'Unknown',
      authorEmail: commit.commit.author?.email,
      authoredAt: commit.commit.author?.date ?? new Date(0).toISOString(),
      htmlUrl: commit.html_url,
    }));
  }

  async getContent(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentContent> {
    const integration = this.getIntegration(source);
    const credentials = await this.credentialsProvider.getCredentials({
      url: `https://${source.host}/${source.owner}/${source.repo}`,
    });
    const ref = source.ref || 'HEAD';
    const fileUrl = `https://${source.host}/${source.owner}/${source.repo}/blob/${ref}/${source.path}`;
    const fetchUrl = getGithubFileFetchUrl(
      fileUrl,
      integration.config,
      credentials,
    );
    const response = await fetch(fetchUrl, {
      headers: {
        Accept: 'application/vnd.github.raw',
        ...credentials.headers,
      },
    });
    if (response.status === 404) {
      throw new NotFoundError(
        `File '${source.path}' not found at ref '${ref}'`,
      );
    }
    if (!response.ok) {
      // API contents endpoint returns JSON with base64 when Accept is not raw
      if (
        response.headers.get('content-type')?.includes('application/json') ||
        fetchUrl.includes('/contents/')
      ) {
        const retry = await fetch(fetchUrl, {
          headers: {
            Accept: 'application/vnd.github+json',
            ...credentials.headers,
          },
        });
        if (!retry.ok) {
          throw new Error(
            `Failed to fetch file content (${retry.status} ${retry.statusText})`,
          );
        }
        const body = (await retry.json()) as {
          content?: string;
          encoding?: string;
        };
        if (!body.content) {
          throw new NotFoundError(`File '${source.path}' has no content`);
        }
        const content =
          body.encoding === 'base64'
            ? Buffer.from(body.content, 'base64').toString('utf-8')
            : body.content;
        return { ref, path: source.path, content };
      }
      throw new Error(
        `Failed to fetch file content (${response.status} ${response.statusText})`,
      );
    }
    return { ref, path: source.path, content: await response.text() };
  }

  async getBlame(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentBlameLine[]> {
    const ref = source.ref || 'HEAD';
    const query = `
      query ($owner: String!, $name: String!, $expression: String!, $path: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: $expression) {
            ... on Commit {
              blame(path: $path) {
                ranges {
                  startingLine
                  endingLine
                  commit {
                    oid
                    message
                    authoredDate
                    author { name email }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const integration = this.getIntegration(source);
    const credentials = await this.credentialsProvider.getCredentials({
      url: `https://${source.host}/${source.owner}/${source.repo}`,
    });
    const graphqlUrl =
      source.host === 'github.com'
        ? 'https://api.github.com/graphql'
        : `${
            new URL(
              integration.config.apiBaseUrl ?? `https://${source.host}/api/v3`,
            ).origin
          }/api/graphql`;
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...credentials.headers,
      },
      body: JSON.stringify({
        query,
        variables: {
          owner: source.owner,
          name: source.repo,
          expression: ref,
          path: source.path,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(
        `GitHub GraphQL blame request failed (${response.status} ${response.statusText})`,
      );
    }
    const payload = (await response.json()) as {
      data?: {
        repository?: {
          object?: { blame?: { ranges: GithubBlameRange[] } };
        };
      };
      errors?: Array<{ message: string }>;
    };
    if (payload.errors?.length) {
      throw new Error(payload.errors.map(e => e.message).join('; '));
    }
    const ranges = payload.data?.repository?.object?.blame?.ranges ?? [];
    const file = await this.getContent(source);
    const fileLines = file.content.split('\n');
    const lines: TechDocsDocumentBlameLine[] = [];
    for (const range of ranges) {
      for (
        let lineNumber = range.startingLine;
        lineNumber <= range.endingLine;
        lineNumber++
      ) {
        lines.push({
          lineNumber,
          content: fileLines[lineNumber - 1] ?? '',
          sha: range.commit.oid,
          shortSha: range.commit.oid.slice(0, 7),
          authorName: range.commit.author?.name || 'Unknown',
          authoredAt: range.commit.authoredDate,
        });
      }
    }
    return lines;
  }

  async getDiff(
    source: TechDocsDocumentSource,
    fromRef: string,
    toRef: string,
  ): Promise<TechDocsDocumentDiff> {
    const response = await this.request(
      source,
      `/repos/${source.owner}/${source.repo}/compare/${encodeURIComponent(
        fromRef,
      )}...${encodeURIComponent(toRef)}`,
    );
    const body = (await response.json()) as GithubCompareResponse;
    const file = body.files?.find(f => f.filename === source.path);
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
      patch: file?.patch,
      fromContent,
      toContent,
    };
  }

  async listTags(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentTag[]> {
    const response = await this.request(
      source,
      `/repos/${source.owner}/${source.repo}/tags?per_page=50`,
    );
    const tags = (await response.json()) as GithubTagResponse[];
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
        sha: tag.commit.sha,
        containsFile,
        htmlUrl: `https://${source.host}/${source.owner}/${
          source.repo
        }/releases/tag/${encodeURIComponent(tag.name)}`,
      });
    }
    return results;
  }
}
