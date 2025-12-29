import { createZustandShallowStore, createZustandStore } from "../create";
import { PlayerStoreActions, PlayerStoreConfig, PlayerStoreInitialState } from "./config";

export { PlayerFSMEvent, PlayerFSMStatus } from "./fsm";

export type PlayerStoreType = PlayerStoreInitialState & PlayerStoreActions;

export const usePlayerStore = createZustandShallowStore<PlayerStoreType>(
  createZustandStore(PlayerStoreConfig, "player", false)
);
