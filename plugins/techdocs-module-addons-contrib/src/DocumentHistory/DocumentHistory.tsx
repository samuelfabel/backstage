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

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  makeStyles,
  Typography,
} from '@material-ui/core';
import HistoryIcon from '@material-ui/icons/History';
import Alert from '@material-ui/lab/Alert';
import { MarkdownContent } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  techdocsApiRef,
  useShadowRootElements,
  useTechDocsReaderPage,
} from '@backstage/plugin-techdocs-react';
import { DocumentHistoryDialog } from './DocumentHistoryDialog';
import {
  useDocumentSource,
  useHistoryEnabled,
  useSelectedDocsRef,
} from './hooks';

const useStyles = makeStyles(theme => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    padding: theme.spacing(1, 0),
  },
  versionBanner: {
    width: '100%',
    marginBottom: theme.spacing(1),
  },
  versionContent: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
  },
}));

/**
 * TechDocs addon that provides Confluence-like document history tooling:
 * commit history, tag browsing, diff compare, blame, and versioned reading
 * that persists across navigation within the same documentation site.
 *
 * @public
 */
export const DocumentHistoryAddon = () => {
  const classes = useStyles();
  const enabled = useHistoryEnabled();
  const source = useDocumentSource();
  const { docsRef, setDocsRef } = useSelectedDocsRef();
  const techdocsApi = useApi(techdocsApiRef);
  const { entityRef } = useTechDocsReaderPage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState(0);
  const [versionContent, setVersionContent] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [contentRoot] = useShadowRootElements([
    '[data-md-component="main"] .md-content',
  ]);

  useEffect(() => {
    if (!docsRef || !source || !techdocsApi.getDocumentContent) {
      setVersionContent(null);
      setVersionError(null);
      if (contentRoot?.style) {
        contentRoot.style.display = '';
      }
      return undefined;
    }

    let cancelled = false;
    const getContent = techdocsApi.getDocumentContent;
    (async () => {
      setVersionLoading(true);
      setVersionError(null);
      try {
        const result = await getContent(entityRef, {
          ...source,
          ref: docsRef,
        });
        if (!cancelled) {
          setVersionContent(result.content);
          if (contentRoot?.style) {
            contentRoot.style.display = 'none';
          }
        }
      } catch (e) {
        if (!cancelled) {
          setVersionContent(null);
          setVersionError(e instanceof Error ? e.message : String(e));
          if (contentRoot?.style) {
            contentRoot.style.display = '';
          }
        }
      } finally {
        if (!cancelled) {
          setVersionLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docsRef, source, techdocsApi, entityRef, contentRoot]);

  if (!enabled || !source) {
    return null;
  }

  const openDialog = (tab: number) => {
    setDialogTab(tab);
    setDialogOpen(true);
  };

  return (
    <>
      <div className={classes.bar}>
        <Button
          size="small"
          startIcon={<HistoryIcon />}
          onClick={() => openDialog(0)}
        >
          History
        </Button>
        <Button size="small" onClick={() => openDialog(1)}>
          Tags
        </Button>
        <Button size="small" onClick={() => openDialog(2)}>
          Compare
        </Button>
        <Button size="small" onClick={() => openDialog(3)}>
          Blame
        </Button>
        {docsRef && (
          <Chip
            size="small"
            color="primary"
            label={`Viewing ${docsRef.slice(0, 12)}`}
            onDelete={() => setDocsRef(null)}
          />
        )}
      </div>
      {docsRef && (
        <div className={classes.versionBanner}>
          <Alert severity="info">
            Viewing documentation source at revision <strong>{docsRef}</strong>.
            Navigation within this docs site keeps this revision selected.
          </Alert>
          {versionLoading && (
            <Box display="flex" justifyContent="center" my={2}>
              <CircularProgress size={24} />
            </Box>
          )}
          {versionError && (
            <Box mt={1}>
              <Alert severity="warning">{versionError}</Alert>
            </Box>
          )}
          {versionContent !== null && (
            <div className={classes.versionContent}>
              <Typography variant="subtitle2" gutterBottom>
                {source.path} @ {docsRef}
              </Typography>
              <MarkdownContent content={versionContent} dialect="gfm" />
            </div>
          )}
        </div>
      )}
      <DocumentHistoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        source={source}
        docsRef={docsRef}
        onSelectRef={setDocsRef}
        initialTab={dialogTab}
      />
    </>
  );
};
