/**
 * Types for the subset of A2UI v0.9 surfaces that the CareLink ADK agent emits.
 * Inferred from `adk/a2ui_surfaces/examples/*.json`.
 *
 * A surface is delivered in two phases over SSE:
 *   1. `createSurface`     — registers a surfaceId so the renderer can start a new tree.
 *   2. `updateComponents`  — supplies the flat component list; one item has id "root".
 *
 * The renderer walks `root` recursively, looking up children in a Map<id, Component>.
 */

export type A2UIVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption';

export interface A2UIEvent {
  name: string;
  context?: Record<string, unknown>;
}

export interface A2UIAction {
  event?: A2UIEvent;
}

export interface A2UIDataBinding {
  path: string;
}

export interface A2UIOption {
  label: string;
  value: string;
}

export interface A2UIComponent {
  id: string;
  component: 'Column' | 'Row' | 'Card' | 'Text' | 'Button' | 'ChoicePicker' | 'TextField' | string;
  text?: string;
  variant?: A2UIVariant | string;
  child?: string;
  children?: string[];
  action?: A2UIAction;
  // ChoicePicker / TextField:
  label?: string;
  options?: A2UIOption[];
  // `value` is usually a data-model binding ({path}) but can also be a literal
  // for components that don't bind.
  value?: A2UIDataBinding | string | number | boolean | null;
}

export interface A2UICreateSurface {
  surfaceId: string;
  catalogId?: string;
}

export interface A2UIUpdateComponents {
  surfaceId: string;
  components: A2UIComponent[];
}

export interface A2UIUpdateDataModel {
  surfaceId: string;
  path: string;
  value: unknown;
}

export interface A2UIEnvelope {
  version?: string;
  createSurface?: A2UICreateSurface;
  updateComponents?: A2UIUpdateComponents;
  updateDataModel?: A2UIUpdateDataModel;
}

export interface A2UISurfaceState {
  surfaceId: string;
  catalogId?: string;
  components: Record<string, A2UIComponent>;
  // Reactive data model that ChoicePicker / TextField bind to via `value.path`.
  data: Record<string, unknown>;
}
