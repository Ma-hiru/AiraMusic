import { cx } from "@emotion/css";
import { memo, type FC } from "react";

import LegacySelectionIndicator, {
  type SelectionIndicatorProps
} from "../playlist/selection-indicator";

const SelectionIndicator: FC<SelectionIndicatorProps> = ({ className, ...props }) => (
  <LegacySelectionIndicator {...props} className={cx("bottom-6!", className)} />
);

export default memo(SelectionIndicator);
