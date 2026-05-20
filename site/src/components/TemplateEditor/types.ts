export interface TreeNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  children?: TreeNode[];
}

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  languages: string[];
  variables: string[];
}

export interface TemplateListEntry {
  id: string;
  isCommon: boolean;
  manifest: TemplateManifest | null;
  tree: TreeNode;
}
