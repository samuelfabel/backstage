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
  TechDocsDocumentBlameLine,
  TechDocsDocumentCommit,
  TechDocsDocumentContent,
  TechDocsDocumentDiff,
  TechDocsDocumentSource,
  TechDocsDocumentTag,
} from '@backstage/plugin-techdocs-common';

/** @internal */
export type DocumentHistoryProvider = {
  listCommits(
    source: TechDocsDocumentSource,
    options?: { limit?: number },
  ): Promise<TechDocsDocumentCommit[]>;
  getBlame(
    source: TechDocsDocumentSource,
  ): Promise<TechDocsDocumentBlameLine[]>;
  getContent(source: TechDocsDocumentSource): Promise<TechDocsDocumentContent>;
  getDiff(
    source: TechDocsDocumentSource,
    fromRef: string,
    toRef: string,
  ): Promise<TechDocsDocumentDiff>;
  listTags(source: TechDocsDocumentSource): Promise<TechDocsDocumentTag[]>;
};
