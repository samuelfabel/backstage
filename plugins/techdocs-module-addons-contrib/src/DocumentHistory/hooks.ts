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

import parseGitUrl from 'git-url-parse';

import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  replaceGithubUrlType,
  replaceGitLabUrlType,
} from '@backstage/integration';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import {
  TechDocsDocumentSource,
  useShadowRootElements,
  useTechDocsReaderPage,
} from '@backstage/plugin-techdocs-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  DOCS_REF_QUERY_PARAM,
  HISTORY_REPO_TYPES_SUPPORTED,
  PAGE_EDIT_LINK_SELECTOR,
  STORAGE_KEY_PREFIX,
} from './constants';

const resolveBlobUrl = (url: string, type: string) => {
  if (type === 'github') {
    return replaceGithubUrlType(url, 'blob');
  }
  if (type === 'gitlab') {
    return replaceGitLabUrlType(url, 'blob');
  }
  return url;
};

export const useHistoryEnabled = () => {
  const configApi = useApi(configApiRef);
  return configApi.getOptionalBoolean('techdocs.history.enabled') === true;
};

export const useDocumentSource = (): TechDocsDocumentSource | null => {
  const scmIntegrationsApi = useApi(scmIntegrationsApiRef);
  const [editLink] = useShadowRootElements([PAGE_EDIT_LINK_SELECTOR]);
  const url = (editLink as HTMLAnchorElement | undefined)?.href ?? '';

  return useMemo(() => {
    if (!url) {
      return null;
    }
    const type = scmIntegrationsApi.byUrl(url)?.type;
    if (!type || !HISTORY_REPO_TYPES_SUPPORTED.includes(type)) {
      return null;
    }
    const parsed = parseGitUrl(resolveBlobUrl(url, type));
    if (!parsed.owner || !parsed.name || !parsed.filepath) {
      return null;
    }
    return {
      type: type as 'github' | 'gitlab',
      host: parsed.resource,
      owner: parsed.owner,
      repo: parsed.name,
      path: parsed.filepath,
      ref: parsed.ref || undefined,
    };
  }, [scmIntegrationsApi, url]);
};

export const useSelectedDocsRef = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { entityRef } = useTechDocsReaderPage();
  const storageKey = `${STORAGE_KEY_PREFIX}${entityRef.namespace}:${entityRef.kind}:${entityRef.name}`;

  const docsRef = searchParams.get(DOCS_REF_QUERY_PARAM);

  // Restore selected revision across in-docs navigation that drops query params
  useEffect(() => {
    if (docsRef) {
      try {
        window.sessionStorage.setItem(storageKey, docsRef);
      } catch {
        // ignore storage errors
      }
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(storageKey);
    } catch {
      stored = null;
    }
    if (stored) {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.set(DOCS_REF_QUERY_PARAM, stored!);
          return next;
        },
        { replace: true },
      );
    }
  }, [docsRef, setSearchParams, storageKey]);

  const setDocsRef = useCallback(
    (ref: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (ref) {
            next.set(DOCS_REF_QUERY_PARAM, ref);
          } else {
            next.delete(DOCS_REF_QUERY_PARAM);
          }
          return next;
        },
        { replace: true },
      );
      try {
        if (ref) {
          window.sessionStorage.setItem(storageKey, ref);
        } else {
          window.sessionStorage.removeItem(storageKey);
        }
      } catch {
        // ignore storage errors
      }
    },
    [setSearchParams, storageKey],
  );

  return { docsRef, setDocsRef };
};
