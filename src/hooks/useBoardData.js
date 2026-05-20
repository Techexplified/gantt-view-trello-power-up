import { useState, useEffect, useCallback } from "react";
import { getBoard, getLists, getCards } from "../utils/trelloApi";

export function useBoardData(boardId) {
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const [b, l, c] = await Promise.all([
        getBoard(boardId),
        getLists(boardId),
        getCards(boardId),
      ]);
      setBoard(b);
      setLists(l.sort((a, b) => a.pos - b.pos));
      setCards(c);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { board, lists, cards, loading, error, refetch: fetchAll };
}
