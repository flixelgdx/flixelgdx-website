import {useCallback, useState, type JSX} from 'react';
import type {TreeNode} from './types';
import styles from './TemplateEditor.module.css';

interface TreePanelProps {
  root: TreeNode;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onAddFile: () => void;
  onAddFolder: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function TreeRows({
  node,
  depth,
  expanded,
  toggle,
  selectedPath,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (p: string) => void;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}): JSX.Element {
  const pad = {paddingLeft: `${8 + depth * 14}px`};
  if (node.type === 'file') {
    const active = selectedPath === node.path;
    return (
      <button
        type="button"
        key={node.path}
        className={`${styles.treeItem} ${styles.treeFile} ${active ? styles.treeActive : ''}`}
        style={pad}
        onClick={() => onSelectFile(node.path)}
      >
        {node.name}
      </button>
    );
  }
  const isOpen = expanded.has(node.path);
  return (
    <div key={node.path || 'root'}>
      <button
        type="button"
        className={`${styles.treeItem} ${styles.treeDir}`}
        style={pad}
        onClick={() => toggle(node.path)}
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
  onDelete,
  onRename,
}: TreePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.path || '']));

  const toggle = useCallback((p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  return (
    <div className={styles.treeWrap}>
      <div className={styles.treeToolbar}>
        <button type="button" className={styles.btn} onClick={onAddFile}>
          Add file
        </button>
        <button type="button" className={styles.btn} onClick={onAddFolder}>
          Add folder
        </button>
        <button type="button" className={styles.btn} onClick={onRename} disabled={!selectedPath}>
          Rename
        </button>
        <button type="button" className={styles.btnDanger} onClick={onDelete} disabled={!selectedPath}>
          Delete
        </button>
      </div>
      <div className={styles.treeScroll}>
        <TreeRows
          node={root}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      </div>
    </div>
  );
}
