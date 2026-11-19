import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { RoutePathDisplay } from "@/common/routes";
import { Listenable } from "@/common/utils/listenable";
import { useListenable } from "@/common/hooks/use-listenable";
import { useWindowTitle } from "@/common/hooks/use-window-title";

class Titles extends Listenable {
  private readonly sets = new Map<keyof typeof RoutePathDisplay, string>();

  get data() {
    return this.sets.entries();
  }

  update(page: keyof typeof RoutePathDisplay, title: string) {
    this.sets.set(page, title);
    this.executeListeners();
  }
}

const titles = new Titles();

export function useDisplayTitleRegister(page: keyof typeof RoutePathDisplay, defaultTitle: string) {
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    titles.update(page, title || defaultTitle);
  }, [defaultTitle, page, title]);

  return {
    setTitle
  };
}

export function useDisplayTitle() {
  const sets = useListenable(titles).data;
  const location = useLocation();
  const { updateTitle } = useWindowTitle();

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const [page, title] of sets) {
        const active = RoutePathDisplay.matchPathname(location, RoutePathDisplay[page] as string);
        if (active) {
          updateTitle(title);
          break;
        }
      }
    }, 100);
    return () => {
      clearTimeout(timer);
    };
  }, [location, sets, updateTitle]);
}
