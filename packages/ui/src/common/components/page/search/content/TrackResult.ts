import { FC } from "react";

interface TrackResultProps {
  className?: string;
  keywords?: string;
  onJumpTrack: Optional<NormalFunc<[id: number]>>;
}

const TrackResult: FC<TrackResultProps> = ({ className, keywords, onJumpTrack }) => {};

export default TrackResult;
