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

/**
 * SCM providers supported by TechDocs document history.
 *
 * @public
 */
export type TechDocsDocumentHistoryScmType = 'github' | 'gitlab';

/**
 * Identifies a documentation source file in an SCM repository.
 *
 * @public
 */
export type TechDocsDocumentSource = {
  type: TechDocsDocumentHistoryScmType;
  host: string;
  owner: string;
  repo: string;
  path: string;
  /** Branch, tag, or commit SHA. Defaults to the repository default when omitted. */
  ref?: string;
};

/**
 * A commit that touched a documentation source file.
 *
 * @public
 */
export type TechDocsDocumentCommit = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authoredAt: string;
  htmlUrl?: string;
};

/**
 * A single line of git blame for a documentation source file.
 *
 * @public
 */
export type TechDocsDocumentBlameLine = {
  lineNumber: number;
  content: string;
  sha: string;
  shortSha: string;
  authorName: string;
  authoredAt: string;
};

/**
 * A git tag associated with the documentation repository.
 *
 * @public
 */
export type TechDocsDocumentTag = {
  name: string;
  sha: string;
  /** True when the documentation source file exists at this tag. */
  containsFile?: boolean;
  htmlUrl?: string;
};

/**
 * A textual diff between two revisions of a documentation source file.
 *
 * @public
 */
export type TechDocsDocumentDiff = {
  fromRef: string;
  toRef: string;
  /** Unified diff patch for the file, when available. */
  patch?: string;
  fromContent?: string;
  toContent?: string;
};

/**
 * File content at a specific revision.
 *
 * @public
 */
export type TechDocsDocumentContent = {
  ref: string;
  path: string;
  content: string;
};
