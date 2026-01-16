import { version, LocalStoreStateBase, _V1 } from "@mahiru/ui/public/store/local/state";

type MergeFunc = (old: LocalStoreStateBase) => LocalStoreStateBase;

export function mergeState(checkState: LocalStoreStateBase) {
  if (checkState.version >= version) return checkState;
  // prettier-ignore
  return [
    fromV1toV1
  ].reduce(
    (preState, merge) => merge(preState),
    checkState
  );
}

const fromV1toV1: MergeFunc = (old) => {
  if (old.version !== 1) return old;
  const v1 = <_V1>old;
  return v1;
};
