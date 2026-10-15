import type { ReactNode } from 'react';
import {
  IconNewChat,
  IconSearch,
  IconFiles,
  IconCompass,
  IconOpenaiLogo,
  IconPlus,
} from './components/icons';

export type NavKind = 'item' | 'project' | 'chat';

export interface NavItem {
  id: string;
  label: string;
  kind: NavKind;
  icon?: ReactNode;
  /** إزاحة داخلية بالبكسل للعناصر الفرعية */
  inset?: number;
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

/*
 * مطابق لشاشة "New Chat - Logged In" في الملف:
 *  - 3 عناصر في القائمة الرئيسية
 *  - 3 أقسام: GPTs (3) · Projects (5) · Chats (3)
 *  - ارتفاع كل صف 36px، وعنوان القسم 36px أيضًا، وحشو سفلي 20px
 */
export const NAV: NavSection[] = [
  {
    id: 'main',
    title: '',
    items: [
      { id: 'new-chat', label: 'New Chat', kind: 'item', icon: <IconNewChat /> },
      { id: 'search-chats', label: 'Search chats', kind: 'item', icon: <IconSearch /> },
      { id: 'library', label: 'Library', kind: 'item', icon: <IconFiles /> },
    ],
  },
  {
    id: 'gpts',
    title: 'GPTs',
    items: [
      { id: 'explore', label: 'Explore', kind: 'item', icon: <IconCompass /> },
      { id: 'gpt-1', label: 'Example GPT 1', kind: 'item', icon: <IconOpenaiLogo /> },
      { id: 'gpt-2', label: 'Example GPT 2', kind: 'item', icon: <IconOpenaiLogo /> },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    items: [
      { id: 'new-project', label: 'New Project', kind: 'item', icon: <IconPlus /> },
      { id: 'project-1', label: 'Example Project 1', kind: 'project', icon: <IconFiles /> },
      { id: 'project-1-chat-1', label: 'Project Chat 1', kind: 'chat', inset: 35 },
      { id: 'project-1-chat-2', label: 'Project Chat 2', kind: 'chat', inset: 35 },
      { id: 'project-2', label: 'Example Project 2', kind: 'project', icon: <IconFiles /> },
    ],
  },
  {
    id: 'chats',
    title: 'Chats',
    items: [
      { id: 'chat-1', label: 'Example Chat 1', kind: 'chat', inset: 10 },
      { id: 'chat-2', label: 'Response Types', kind: 'chat', inset: 10 },
      { id: 'chat-3', label: 'Loading Animations', kind: 'chat', inset: 10 },
    ],
  },
];
