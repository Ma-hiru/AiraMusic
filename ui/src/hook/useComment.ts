import { useCallback, useState } from "react";

export function useComment(type: "song" | "album" | "playlist", id: number, size: number) {
  const [loading, setLoading] = useState(true);
  const [totalComment, setTotalComment] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const requestComment = useCallback((page: number) => {}, []);

  return {
    loading,
    totalComment,
    currentPage
  };
}
