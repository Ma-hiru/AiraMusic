import { ZustandConfig, ZustandGet, ZustandSet } from "@mahiru/ui/types/zustand";

export const UserStoreConfig: ZustandConfig<UserStoreInitialState, UserStoreActions> = (
  set
) => ({});

const InitialState: UserStoreInitialState = {};

export type UserStoreInitialState = {};

export type UserStoreActions = {};

function createConfig<State, StateAndAction, Action = Omit<StateAndAction, State>>(
  config: () => StateAndAction
) {
  return config;
}
