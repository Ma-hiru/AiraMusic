import { createZustandShallowStore, createZustandStore } from "../create";
import { PlayerStoreActions, PlayerStoreConfig, PlayerStoreInitialState } from "./config";

export { type PlayerFSMEvent, PlayerFSMStatusEnum } from "./fsm";

export type PlayerStoreType = PlayerStoreInitialState & PlayerStoreActions;

const playerStore = createZustandStore(PlayerStoreConfig, "player", true);

export const usePlayerStore = createZustandShallowStore<PlayerStoreType>(playerStore);

export const getPlayerStoreSnapshot = playerStore.getState;
