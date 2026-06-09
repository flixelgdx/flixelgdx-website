export type TreeNode = {
  type: 'file' | 'dir';
  name: string;
  path: string;
  children?: TreeNode[];
};

export type TemplateManifest = {
  id: string;
  name: string;
  description: string;
  languages: string[];
  variables: string[];
};

export type TemplateListEntry = {
  id: string;
  isCommon: boolean;
  manifest: TemplateManifest | null;
  tree: TreeNode;
};
