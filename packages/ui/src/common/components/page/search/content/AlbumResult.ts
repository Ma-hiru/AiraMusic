import { FC } from "react";

interface AlbumResultProps {
  className?: string;
  keywords?: string;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
}

const AlbumResult: FC<AlbumResultProps> = ({ className, keywords, onJumpAlbum }) => {};

export default AlbumResult;
