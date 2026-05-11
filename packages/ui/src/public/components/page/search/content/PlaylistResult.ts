import { FC } from "react";

interface PlaylistResultProps {
  className?: string;
  keywords?: string;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
}

const PlaylistResult: FC<PlaylistResultProps> = ({ className, keywords, onJumpPlaylist }) => {};

export default PlaylistResult;
