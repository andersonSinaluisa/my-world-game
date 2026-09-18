import { holdAction, releaseAction, setExpressionAction } from './character-actions';
import { closeAction, openAction, storeAction, toggleOpenAction, toggleSwitchAction } from './container-actions';
import { placeAction } from './place';
import { cycleStateAction, setStateAction } from './state-actions';
import type { ActionHandler } from './types';

/**
 * Closed set of actions (INTERACTION_SCHEMA §5). Adding one = handler + params schema + row in
 * INTERACTION_SCHEMA + tests. Content can combine these but never invent new ones.
 */
export const ACTIONS: Record<string, ActionHandler<never>> = Object.fromEntries(
  [
    placeAction,
    setStateAction,
    cycleStateAction,
    holdAction,
    releaseAction,
    setExpressionAction,
    toggleOpenAction,
    openAction,
    closeAction,
    toggleSwitchAction,
    storeAction,
  ].map((a) => [a.type, a as unknown as ActionHandler<never>]),
);

export const ACTION_TYPES = Object.keys(ACTIONS);
