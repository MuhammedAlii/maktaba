import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  DocumentSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Type definitions
type FirestoreData = Record<string, any>;

/** Firestore query constraint içeriğinden stabil anahtar (dizi referansı her render değişse bile aynı sorgu = aynı anahtar). */
function fieldPathKey(field: unknown): string {
  if (typeof field === 'string') return field;
  const f = field as { canonicalString?: () => string; toString?: () => string };
  if (typeof f?.canonicalString === 'function') return f.canonicalString();
  if (typeof f?.toString === 'function') return f.toString();
  return String(field);
}

function serializeWhereValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.seconds === 'number' && typeof o.nanoseconds === 'number') {
      return `ts:${o.seconds}.${o.nanoseconds}`;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function singleConstraintSignature(c: unknown): string {
  if (c === null || c === undefined) return 'null';
  const x = c as Record<string, unknown> & { type?: string };
  const t = x.type;

  if (t === 'where') {
    const field = fieldPathKey((x as { _field?: unknown })._field);
    const op = String((x as { _op?: unknown })._op ?? '');
    const val = serializeWhereValue((x as { _value?: unknown })._value);
    return `where:${field}:${op}:${val}`;
  }

  if (t === 'or' || t === 'and') {
    const inner = (x as { _queryConstraints?: unknown[] })._queryConstraints ?? [];
    return `${t}:${inner.map(singleConstraintSignature).join(',')}`;
  }

  if (t === 'orderBy') {
    const field = fieldPathKey((x as { _field?: unknown })._field);
    const dir = String((x as { _direction?: unknown })._direction ?? '');
    return `orderBy:${field}:${dir}`;
  }

  if (t === 'limit' || t === 'limitToLast') {
    return `${t}:${String((x as { _limit?: unknown })._limit ?? '')}`;
  }

  return `unknown:${t ?? typeof c}`;
}

function constraintsSignature(constraints?: unknown[]): string {
  if (!constraints?.length) return '';
  return constraints.map(singleConstraintSignature).join('||');
}

// CRUD Hook'ları

/**
 * Collection'dan tüm dokümanları getir
 */
export function useCollection<T = FirestoreData>(
  collectionName: string,
  constraints?: any[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const constraintsKey = constraintsSignature(constraints);

  useEffect(() => {
    setLoading(true);
    const collectionRef = collection(db, collectionName);
    const q = constraints && constraints.length > 0
      ? query(collectionRef, ...constraints)
      : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error(`Error fetching ${collectionName}:`, err);
      }
    );

    return () => unsubscribe();
  }, [collectionName, constraintsKey]);

  return { data, loading, error };
}

/**
 * Tek bir doküman getir
 */
export function useDocument<T = FirestoreData>(
  collectionName: string,
  documentId: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error(`Error fetching document ${documentId}:`, err);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId]);

  return { data, loading, error };
}

/**
 * CRUD işlemleri için helper fonksiyonlar
 */
export const firestoreHelpers = {
  // CREATE - Yeni doküman ekle
  async add<T extends Record<string, any>>(
    collectionName: string,
    data: Omit<T, 'id'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, collectionName), data);
      return docRef.id;
    } catch (error) {
      console.error(`Error adding to ${collectionName}:`, error);
      throw error;
    }
  },

  // READ - Tek doküman getir
  async get<T = FirestoreData>(
    collectionName: string,
    documentId: string
  ): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  },

  // READ - Tüm dokümanları getir
  async getAll<T = FirestoreData>(
    collectionName: string,
    constraints?: any[]
  ): Promise<T[]> {
    try {
      const collectionRef = collection(db, collectionName);
      const q = constraints && constraints.length > 0
        ? query(collectionRef, ...constraints)
        : collectionRef;
      
      const querySnapshot = await getDocs(q);
      const items: T[] = [];
      
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as T);
      });
      
      return items;
    } catch (error) {
      console.error(`Error getting all from ${collectionName}:`, error);
      throw error;
    }
  },

  // UPDATE - Doküman güncelle
  async update<T extends Record<string, any>>(
    collectionName: string,
    documentId: string,
    data: Partial<Omit<T, 'id'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  },

  // DELETE - Doküman sil
  async delete(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  },

  // QUERY - Filtreleme ve sıralama
  query: {
    where,
    orderBy,
    limit,
  },
};
