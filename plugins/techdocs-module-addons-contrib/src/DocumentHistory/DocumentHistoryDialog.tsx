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
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Tab,
  Tabs,
  Typography,
  makeStyles,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { MarkdownContent } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  techdocsApiRef,
  TechDocsDocumentCommit,
  TechDocsDocumentDiff,
  TechDocsDocumentSource,
  TechDocsDocumentTag,
  TechDocsDocumentBlameLine,
  useTechDocsReaderPage,
} from '@backstage/plugin-techdocs-react';

const useStyles = makeStyles(theme => ({
  blameLine: {
    display: 'grid',
    gridTemplateColumns: '72px 140px 1fr',
    gap: theme.spacing(1),
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.5, 0),
  },
  patch: {
    whiteSpace: 'pre-wrap',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    background: theme.palette.background.default,
    padding: theme.spacing(1),
    overflow: 'auto',
  },
  compareSelect: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export type DocumentHistoryDialogProps = {
  open: boolean;
  onClose: () => void;
  source: TechDocsDocumentSource;
  docsRef: string | null;
  onSelectRef: (ref: string | null) => void;
  initialTab?: number;
};

export const DocumentHistoryDialog = ({
  open,
  onClose,
  source,
  docsRef,
  onSelectRef,
  initialTab = 0,
}: DocumentHistoryDialogProps) => {
  const classes = useStyles();
  const techdocsApi = useApi(techdocsApiRef);
  const { entityRef } = useTechDocsReaderPage();
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<TechDocsDocumentCommit[]>([]);
  const [tags, setTags] = useState<TechDocsDocumentTag[]>([]);
  const [blame, setBlame] = useState<TechDocsDocumentBlameLine[]>([]);
  const [diff, setDiff] = useState<TechDocsDocumentDiff | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !techdocsApi.getDocumentHistory) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === 0 || tab === 2) {
          const history = await techdocsApi.getDocumentHistory!(
            entityRef,
            source,
          );
          if (!cancelled) {
            setCommits(history.commits);
          }
        }
        if (tab === 1) {
          const result = await techdocsApi.getDocumentTags!(entityRef, source);
          if (!cancelled) {
            setTags(result.tags);
          }
        }
        if (tab === 3) {
          const result = await techdocsApi.getDocumentBlame!(entityRef, {
            ...source,
            ref: docsRef || source.ref,
          });
          if (!cancelled) {
            setBlame(result.lines);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, techdocsApi, entityRef, source, docsRef]);

  const runCompare = async () => {
    if (!compareFrom || !compareTo || !techdocsApi.getDocumentDiff) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await techdocsApi.getDocumentDiff(
        entityRef,
        source,
        compareFrom,
        compareTo,
      );
      setDiff(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const viewVersion = async (ref: string) => {
    if (!techdocsApi.getDocumentContent) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const content = await techdocsApi.getDocumentContent(entityRef, {
        ...source,
        ref,
      });
      setPreviewContent(content.content);
      onSelectRef(ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Document history</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {source.path}
          {docsRef ? ` @ ${docsRef.slice(0, 7)}` : ''}
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="History" />
          <Tab label="Tags" />
          <Tab label="Compare" />
          <Tab label="Blame" />
        </Tabs>
        <Divider />
        {error && (
          <Box mt={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
        {loading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}
        {!loading && tab === 0 && (
          <List dense>
            {commits.map(commit => (
              <ListItem key={commit.sha} divider>
                <ListItemText
                  primary={commit.message}
                  secondary={`${commit.authorName} · ${new Date(
                    commit.authoredAt,
                  ).toLocaleString()} · ${commit.shortSha}`}
                />
                <ListItemSecondaryAction>
                  <Button size="small" onClick={() => viewVersion(commit.sha)}>
                    View
                  </Button>
                  {commit.htmlUrl && (
                    <Button
                      size="small"
                      component={Link}
                      href={commit.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Commit
                    </Button>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {!commits.length && (
              <Typography variant="body2">
                No commits found for this file.
              </Typography>
            )}
          </List>
        )}
        {!loading && tab === 1 && (
          <List dense>
            {tags.map(tag => (
              <ListItem key={tag.name} divider>
                <ListItemText
                  primary={tag.name}
                  secondary={`${tag.sha.slice(0, 7)}${
                    tag.containsFile === false
                      ? ' · file not present at this tag'
                      : ''
                  }`}
                />
                <ListItemSecondaryAction>
                  <Button
                    size="small"
                    disabled={tag.containsFile === false}
                    onClick={() => viewVersion(tag.name)}
                  >
                    View
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {!tags.length && (
              <Typography variant="body2">
                No tags found for this repository.
              </Typography>
            )}
          </List>
        )}
        {!loading && tab === 2 && (
          <Box mt={2}>
            <Typography variant="body2" gutterBottom>
              Select two commits to compare this file.
            </Typography>
            <div className={classes.compareSelect}>
              <Box flex={1}>
                <Typography variant="subtitle2">From</Typography>
                {commits.map(commit => (
                  <Box
                    key={`from-${commit.sha}`}
                    display="flex"
                    alignItems="center"
                  >
                    <Checkbox
                      checked={compareFrom === commit.sha}
                      onChange={() => setCompareFrom(commit.sha)}
                      size="small"
                    />
                    <Typography variant="caption">
                      {commit.shortSha} {commit.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2">To</Typography>
                {commits.map(commit => (
                  <Box
                    key={`to-${commit.sha}`}
                    display="flex"
                    alignItems="center"
                  >
                    <Checkbox
                      checked={compareTo === commit.sha}
                      onChange={() => setCompareTo(commit.sha)}
                      size="small"
                    />
                    <Typography variant="caption">
                      {commit.shortSha} {commit.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </div>
            <Button
              variant="contained"
              color="primary"
              disabled={!compareFrom || !compareTo}
              onClick={runCompare}
            >
              Compare
            </Button>
            {diff?.patch && (
              <Box mt={2}>
                <pre className={classes.patch}>{diff.patch}</pre>
              </Box>
            )}
            {!diff?.patch && diff?.fromContent !== undefined && (
              <Box mt={2}>
                <Typography variant="subtitle2">From content</Typography>
                <pre className={classes.patch}>{diff.fromContent}</pre>
                <Typography variant="subtitle2">To content</Typography>
                <pre className={classes.patch}>{diff.toContent}</pre>
              </Box>
            )}
          </Box>
        )}
        {!loading && tab === 3 && (
          <Box mt={2}>
            {blame.map(line => (
              <div key={line.lineNumber} className={classes.blameLine}>
                <Typography component="div" variant="caption">
                  {line.lineNumber}
                </Typography>
                <Typography component="div" variant="caption" title={line.sha}>
                  {line.shortSha} {line.authorName}
                </Typography>
                <Typography component="div" variant="caption">
                  {line.content}
                </Typography>
              </div>
            ))}
            {!blame.length && (
              <Typography variant="body2">No blame data available.</Typography>
            )}
          </Box>
        )}
        {previewContent !== null && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>
              Version preview
            </Typography>
            <MarkdownContent content={previewContent} dialect="gfm" />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {docsRef && (
          <Button
            onClick={() => {
              onSelectRef(null);
              setPreviewContent(null);
            }}
          >
            Exit version view
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
