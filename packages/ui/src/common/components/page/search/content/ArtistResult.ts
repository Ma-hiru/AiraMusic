import { FC } from "react";

interface ArtistResultProps {
  className?: string;
  keywords?: string;
  onJumpArtist: Optional<NormalFunc<[id: number]>>;
}

const ArtistResult: FC<ArtistResultProps> = ({ className, keywords, onJumpArtist }) => {};

export default ArtistResult;
