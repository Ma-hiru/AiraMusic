import { FC, memo } from "react";

interface SearchContentProps {
  className?: string;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
  onJumpArtist: Optional<NormalFunc<[id: number]>>;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
}

const SearchContent: FC<SearchContentProps> = ({
  className,
  onJumpAlbum,
  onJumpArtist,
  onJumpPlaylist
}) => {
  return <></>;
};
export default memo(SearchContent);
