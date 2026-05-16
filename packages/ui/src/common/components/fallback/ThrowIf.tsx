import { FC } from "react";

interface ThrowIfProps {
  when: boolean;
  message?: string;
}

const ThrowIf: FC<ThrowIfProps> = ({ when, message }) => {
  if (when) throw new Error(message);
  return null;
};

export default ThrowIf;
