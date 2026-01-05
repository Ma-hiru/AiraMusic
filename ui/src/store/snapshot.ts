import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";

@AddStoreSnapshot
class StoreSnapshotClass {}
interface StoreSnapshotClass extends WithStoreSnapshot {}

export const StoreSnapshot = new StoreSnapshotClass();
