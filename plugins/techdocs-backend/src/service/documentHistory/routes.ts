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

import { stringifyEntityRef } from '@backstage/catalog-model';
import { InputError, NotFoundError } from '@backstage/errors';
import {
  TechDocsDocumentHistoryScmType,
  TechDocsDocumentSource,
} from '@backstage/plugin-techdocs-common';
import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import { CachedEntityLoader } from '../CachedEntityLoader';
import { DocumentHistoryService } from './DocumentHistoryService';

function parseSource(query: express.Request['query']): TechDocsDocumentSource {
  const type = String(query.type ?? '') as TechDocsDocumentHistoryScmType;
  const host = String(query.host ?? '');
  const owner = String(query.owner ?? '');
  const repo = String(query.repo ?? '');
  const path = String(query.path ?? '');
  const ref = query.ref ? String(query.ref) : undefined;

  if (!type || !host || !owner || !repo || !path) {
    throw new InputError(
      'Query parameters type, host, owner, repo, and path are required',
    );
  }
  if (type !== 'github' && type !== 'gitlab') {
    throw new InputError(`Unsupported SCM type '${type}'`);
  }

  return { type, host, owner, repo, path, ref };
}

/** @internal */
export function addDocumentHistoryRoutes(options: {
  router: express.Router;
  documentHistory: DocumentHistoryService;
  entityLoader: CachedEntityLoader;
  httpAuth: HttpAuthService;
}): void {
  const { router, documentHistory, entityLoader, httpAuth } = options;

  const withEntityAccess = async (
    req: express.Request,
    res: express.Response,
    handler: () => Promise<unknown>,
  ) => {
    if (!documentHistory.isEnabled()) {
      res
        .status(404)
        .json({ error: { message: 'Document history is disabled' } });
      return;
    }

    const { kind, namespace, name } = req.params;
    const entityName = { kind, namespace, name };
    const credentials = await httpAuth.credentials(req);
    const entity = await entityLoader.load(credentials, entityName);
    if (!entity) {
      throw new NotFoundError(
        `Unable to load entity '${stringifyEntityRef(entityName)}'`,
      );
    }

    res.json(await handler());
  };

  router.get('/document/:namespace/:kind/:name/history', async (req, res) => {
    await withEntityAccess(req, res, async () => {
      const source = parseSource(req.query);
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const commits = await documentHistory.listCommits(source, { limit });
      return { commits };
    });
  });

  router.get('/document/:namespace/:kind/:name/blame', async (req, res) => {
    await withEntityAccess(req, res, async () => {
      const source = parseSource(req.query);
      const lines = await documentHistory.getBlame(source);
      return { lines };
    });
  });

  router.get('/document/:namespace/:kind/:name/content', async (req, res) => {
    await withEntityAccess(req, res, async () => {
      const source = parseSource(req.query);
      return await documentHistory.getContent(source);
    });
  });

  router.get('/document/:namespace/:kind/:name/diff', async (req, res) => {
    await withEntityAccess(req, res, async () => {
      const source = parseSource(req.query);
      const fromRef = String(req.query.from ?? '');
      const toRef = String(req.query.to ?? '');
      return await documentHistory.getDiff(source, fromRef, toRef);
    });
  });

  router.get('/document/:namespace/:kind/:name/tags', async (req, res) => {
    await withEntityAccess(req, res, async () => {
      const source = parseSource(req.query);
      const tags = await documentHistory.listTags(source);
      return { tags };
    });
  });
}
