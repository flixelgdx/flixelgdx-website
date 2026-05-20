import {useCallback, useEffect, useState, type JSX, type MouseEvent as ReactMouseEvent} from 'react';
import type {TreeNode} from './types';
import styles from './TemplateEditor.module.css';

function dirname(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i <= 0 ? '' : rel.slice(0, i);
}

function basename(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i < 0 ? rel : rel.slice(i + 1);
}

export interface TreePanelProps {
  root: TreeNode;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onAddFile: () => void;
  onAddFolder: () => void;
  onDeletePath: (path: string) => void;
  onRenamePath: (path: string) => void;
  onMovePath: (from: string, to: string) => void | Promise<void>;
}

interface CtxState {
  x: number;
  y: number;
  path: string;
  kind: 'file' | 'dir';
}

function TreeRows({
  node,
  depth,
  expanded,
  toggle,
  selectedPath,
  onSelectFile,
  dragFrom,
  setDragFrom,
  dropHover,
  setDropHover,
  onContextMenu,
  onMovePath,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (p: string) => void;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  dragFrom: string | null;
  setDragFrom: (p: string | null) => void;
  dropHover: string | null;
  setDropHover: (p: string | null) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>, path: string, kind: 'file' | 'dir') => void;
  onMovePath: (from: string, to: string) => void | Promise<void>;
}): JSX.Element {
  const pad = {paddingLeft: `${8 + depth * 14}px`};
  if (node.type === 'file') {
    const active = selectedPath === node.path;
    return (
      <button
        type="button"
        key={node.path}
        draggable
        className={`${styles.treeItem} ${styles.treeFile} ${active ? styles.treeActive : ''} ${
          dragFrom === node.path ? styles.treeDragging : ''
        }`}
        style={pad}
        onClick={() => onSelectFile(node.path)}
        onContextMenu={(e) => onContextMenu(e, node.path, 'file')}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', node.path);
          setDragFrom(node.path);
        }}
        onDragEnd={() => {
          setDragFrom(null);
          setDropHover(null);
        }}
      >
        {node.name}
      </button>
    );
  }
  const isOpen = expanded.has(node.path);
  const isRoot = node.path === '';
  const dirPath = node.path;
  const isDropTarget = dropHover === dirPath && !!dragFrom && dragFrom !== dirPath;

  return (
    <div key={node.path || 'root'}>
      <button
        type="button"
        draggable={!isRoot}
        className={`${styles.treeItem} ${styles.treeDir} ${isDropTarget ? styles.treeDropTarget : ''} ${
          dragFrom === dirPath ? styles.treeDragging : ''
        }`}
        style={pad}
        onClick={() => toggle(node.path)}
        onContextMenu={(e) => {
          if (!isRoot) onContextMenu(e, dirPath, 'dir');
        }}
        onDragStart={(e) => {
          if (isRoot) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', dirPath);
          setDragFrom(dirPath);
        }}
        onDragEnd={() => {
          setDragFrom(null);
          setDropHover(null);
        }}
        onDragOver={(e) => {
          if (!dragFrom || dragFrom === dirPath) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropHover(dirPath);
        }}
        onDragLeave={() => {
          if (dropHover === dirPath) setDropHover(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData('text/plain') || dragFrom;
          setDropHover(null);
          setDragFrom(null);
          if (!from || from === dirPath) return;
          const base = basename(from);
          const to = dirPath ? `${dirPath}/${base}` : base;
          if (to === from || to.startsWith(`${from}/`) || from.startsWith(`${to}/`)) return;
          void onMovePath(from, to);
        }}
      >
        {isOpen ? '▼' : '▶'} {node.name || '/'}
      </button>
      {isOpen &&
        node.children?.map((ch) => (
          <TreeRows
            key={ch.path}
            node={ch}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            dragFrom={dragFrom}
            setDragFrom={setDragFrom}
            dropHover={dropHover}
            setDropHover={setDropHover}
            onContextMenu={onContextMenu}
            onMovePath={onMovePath}
          />
        ))}
    </div>
  );
}

export function TreePanel({
  root,
  selectedPath,
  onSelectFile,
  onAddFile,
  onAddFolder,
  onDeletePath,
  onRenamePath,
  onMovePath,
}: TreePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.path || '']));
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropHover, setDropHover] = useState<string | null>(null);

  const toggle = useCallback((p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const onContextMenu = useCallback((e: ReactMouseEvent, path: string, kind: 'file' | 'dir') => {
    e.preventDefault();
    setCtx({x: e.clientX, y: e.clientY, path, kind});
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [ctx]);

  return (
    <div className={styles.treeWrap}>
      <div className={styles.treeToolbar}>
        <button type="button" className={styles.btn} onClick={onAddFile}>
          Add file
        </button>
        <button type="button" className={styles.btn} onClick={onAddFolder}>
          Add folder
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => selectedPath && onRenamePath(selectedPath)}
          disabled={!selectedPath}
        >
          Rename
        </button>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={() => selectedPath && onDeletePath(selectedPath)}
          disabled={!selectedPath}
        >
          Delete
        </button>
      </div>
      <p className={styles.treeHint}>
        Right-click a file or folder for actions. Drag files or folders onto another folder to move.
      </p>
      {dragFrom && dirname(dragFrom) !== '' ? (
        <div
          className={`${styles.treeRootDrop} ${dropHover === '__root__' ? styles.treeDropTarget : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropHover('__root__');
          }}
          onDragLeave={() => {
            if (dropHover === '__root__') setDropHover(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = e.dataTransfer.getData('text/plain') || dragFrom;
            setDropHover(null);
            setDragFrom(null);
            if (!from) return;
            const to = basename(from);
            if (dirname(from) === '') return;
            void onMovePath(from, to);
          }}
        >
          Drop here to move to template root
        </div>
      ) : null}
      <div className={styles.treeScroll}>
        <TreeRows
          node={root}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          dragFrom={dragFrom}
          setDragFrom={setDragFrom}
          dropHover={dropHover}
          setDropHover={setDropHover}
          onContextMenu={onContextMenu}
          onMovePath={onMovePath}
        />
      </div>
      {ctx && (
        <div
          className={styles.ctxMenu}
          style={{left: ctx.x, top: ctx.y}}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {ctx.kind === 'file' && (
            <button
              type="button"
              className={styles.ctxItem}
              role="menuitem"
              onClick={() => {
                onSelectFile(ctx.path);
                setCtx(null);
              }}
            >
              Open
            </button>
          )}
          <button
            type="button"
            className={styles.ctxItem}
            role="menuitem"
            onClick={() => {
              onRenamePath(ctx.path);
              setCtx(null);
            }}
          >
            Rename…
          </button>
          <button
            type="button"
            className={`${styles.ctxItem} ${styles.ctxDanger}`}
            role="menuitem"
            onClick={() => {
              onDeletePath(ctx.path);
              setCtx(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
