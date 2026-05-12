import type { Dispatch, SetStateAction } from "react";

export type AccountPlan = "free" | "pro";
export type AuthMode = "login" | "register";
export type AppView = "landing" | "workspace";
export type PreviewMode = "prompt" | "preview";
export type OpenDesignPreset = string;

export interface UserRecord {
  email?: string;
  emailHash?: string;
  encryptedEmail?: string;
  salt: string;
  verifier: string;
  encryptedProfile: string;
  plan: AccountPlan;
  createdAt: string;
}

export interface SessionUser {
  emailHash: string;
  displayEmail: string;
  plan: AccountPlan;
  expiresAt: number;
}

export interface ProjectRequest {
  projectName: string;
  category: string;
  style: string;
  openDesign: OpenDesignPreset;
  layout: string;
  target: string;
  prompt: string;
}

export interface ProjectHistoryItem {
  name: string;
  date: string;
  prompt: string;
  category: string;
  openDesign: OpenDesignPreset;
  target: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  title?: string;
  content: string;
  htmlCode?: string;
}

export interface OpenDesignDefinition {
  label: string;
  direction: string;
  palette: string[];
  typography: string;
  components: string[];
  layout: string[];
  elevation: string;
  tokens: string[];
  rules: string[];
  donts: string[];
}

export interface ParsedDesignMd {
  label: string;
  direction: string;
  palette: string[];
  typography: string;
  components: string[];
  layout: string[];
  elevation: string;
  rules: string[];
  donts: string[];
}

export type SetProjectRequest = Dispatch<SetStateAction<ProjectRequest>>;
