import { collection, doc, getDocs, setDoc, onSnapshot, query, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Currency, OperationType } from '../types';

const COLLECTION = 'currencies';

export const currencyService = {
  async getCurrencies(): Promise<Currency[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Currency));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION);
      return [];
    }
  },

  subscribeToCurrencies(callback: (currencies: Currency[]) => void) {
    return onSnapshot(collection(db, COLLECTION), (snapshot) => {
      const currencies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Currency));
      callback(currencies);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, COLLECTION);
    });
  },

  async seedDefaultCurrencies() {
    const defaults = [
      { id: '1', curUid: 'RUB', name: 'RUB - Russia (руб)', iso: 'RUB' },
      { id: '2', curUid: 'USD', name: 'USD - USA (US$)', iso: 'USD' },
      { id: '3', curUid: 'EUR', name: 'EUR - European Union (€)', iso: 'EUR' },
      { id: '4', curUid: 'GBP', name: 'GBP - United Kingdom (£)', iso: 'GBP' },
      { id: '5', curUid: 'JPY', name: 'JPY - Japan (¥)', iso: 'JPY' },
      { id: '6', curUid: 'CNY', name: 'CNY - China (¥)', iso: 'CNY' },
    ];

    try {
      for (const cur of defaults) {
        const { id, ...data } = cur;
        const docRef = doc(db, COLLECTION, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, data);
        }
      }
    } catch (error) {
      console.error('Error seeding currencies:', error);
    }
  }
};
