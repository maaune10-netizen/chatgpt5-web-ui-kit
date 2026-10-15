/**
 * The 18 screens that exist in the Figma file's "Screen Components" section.
 *
 * Source: ChatGPT 5 Web — Free UI Kit
 * https://www.figma.com/design/J4mMUwLS0Mg1Ll5j6gH5wL  (node 386:50705)
 */

export type ScreenId =
  | 'new-chat'
  | 'thread'
  | 'library'
  | 'explore'
  | 'project-page'
  | 'gpt-chat'
  | 'temporary'
  | 'project-chat'
  | 'explore-details'
  | 'image-viewer';

export interface ScreenMeta {
  id: ScreenId;
  title: string;
  /** node id in the Figma file */
  node: string;
}

export const SCREENS: Record<ScreenId, ScreenMeta> = {
  'new-chat': { id: 'new-chat', title: 'New Chat — Logged In', node: '133:6239' },
  thread: { id: 'thread', title: 'Thread — Logged In', node: '152:6699' },
  library: { id: 'library', title: 'Library', node: '100:5759' },
  explore: { id: 'explore', title: 'Explore GPTs', node: '136:8892' },
  'project-page': { id: 'project-page', title: 'Project Page', node: '133:4503' },
  'gpt-chat': { id: 'gpt-chat', title: 'GPT Chat', node: '126:9142' },
  temporary: { id: 'temporary', title: 'Temporary Chat', node: '133:5657' },
  'project-chat': { id: 'project-chat', title: 'Project Chat', node: '146:14919' },
  'explore-details': { id: 'explore-details', title: 'Explore GPT Details', node: '386:46967' },
  'image-viewer': { id: 'image-viewer', title: 'Image Viewer', node: '84:6697' },
};

/** كل الشاشات الموجودة في الملف، بترتيبها */
export const ALL_SCREEN_NODES: { node: string; name: string }[] = [
  { node: '6:1101', name: 'Thread + Citations - Logged Out' },
  { node: '149:17484', name: 'Thread - Logged Out' },
  { node: '6:1288', name: 'New Chat - Logged Out' },
  { node: '126:9298', name: 'Thread + Citations - Logged In' },
  { node: '152:6699', name: 'Thread - Logged In' },
  { node: '133:5657', name: 'Temporary Chat' },
  { node: '133:6239', name: 'New Chat - Logged In' },
  { node: '126:9142', name: 'GPT Chat' },
  { node: '133:4503', name: 'Project Page' },
  { node: '146:14919', name: 'Project Chat' },
  { node: '136:8892', name: 'Explore GPTs' },
  { node: '386:46967', name: 'Explore GPT Details' },
  { node: '100:5759', name: 'Library' },
  { node: '84:6697', name: 'Image Viewer - Chat' },
  { node: '84:6681', name: 'Image Viewer - Library' },
  { node: '324:18961', name: 'Image Viewer - Web Images' },
  { node: '328:17456', name: 'Thread - Response Types' },
  { node: '328:18370', name: 'Thread - Loading Animations' },
];

export const PENDING =
  'This screen is scaffolding only. Figma rate-limited the API before its node tree ' +
  'could be read, so the inner layout still needs to be extracted.';
