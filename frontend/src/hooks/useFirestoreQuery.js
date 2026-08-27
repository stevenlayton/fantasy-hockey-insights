import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

/**
 * Subscribe to a Firestore query. `queryFactory` must be a function that
 * returns a Firestore Query/CollectionReference (created fresh each call -
 * Firestore query objects are cheap and this avoids stale-closure bugs).
 * Pass a `deps` array like the one you'd give useEffect - the subscription
 * is torn down and recreated whenever deps change.
 */
export function useFirestoreQuery(queryFactory, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    let query;
    try {
      query = queryFactory();
    } catch (err) {
      setError(err);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
