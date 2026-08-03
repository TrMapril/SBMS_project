import { TransitionCondition } from './transition-condition.type';

export interface WorkflowTemplateStateDefinition {
  tempId: string;
  name: string;
  isStart?: boolean;
  isEnd?: boolean;
  orderIndex?: number;
}

export interface WorkflowTemplateTransitionDefinition {
  name: string;
  fromTempId: string;
  toTempId: string;
  condition?: TransitionCondition;
}

export interface WorkflowTemplateDefinition {
  states: WorkflowTemplateStateDefinition[];
  transitions: WorkflowTemplateTransitionDefinition[];
}
