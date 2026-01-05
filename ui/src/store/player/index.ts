import { createZustandShallowStore, createZustandStore } from "../create";
import { PlayerStoreActions, PlayerStoreConfig, PlayerStoreInitialState } from "./config";
import { addCloseTask } from "@mahiru/ui/utils/close";

function initPlayerStore() {
  const playerStore = createZustandStore(PlayerStoreConfig, "player", true);
  const { InitPlayerCore, SavePlayerCore } = playerStore.getState();
  InitPlayerCore();
  addCloseTask("save_player_core", async () => SavePlayerCore());
  return playerStore;
}

const playerStore = initPlayerStore();

export { type PlayerFSMEvent, PlayerFSMStatusEnum } from "./fsm";

export type PlayerStoreType = PlayerStoreInitialState & PlayerStoreActions;

export const usePlayerStore = createZustandShallowStore<PlayerStoreType>(playerStore);

export const getPlayerStoreSnapshot = playerStore.getState;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function PlayerStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "snapshot", {
      get() {
        return getPlayerStoreSnapshot();
      }
    });
    Object.defineProperty(this.prototype, "audio", {
      get() {
        return getPlayerStoreSnapshot().AudioRefGetter();
      }
    });
  });
}

export abstract class WithPlayerSnapshot {
  declare readonly snapshot: ReturnType<typeof getPlayerStoreSnapshot>;
  declare readonly audio: Nullable<HTMLAudioElement>;
}
