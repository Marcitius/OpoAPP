import { emptyAccount, type LocalAccount } from "./models";
const DB = "opogc-account-v10";
let opened: Promise<IDBDatabase> | undefined;
function database() {
  return (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("accounts");
      req.result.createObjectStore("legacy");
      req.result.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new Error(
          "No se puede abrir el almacenamiento local. Desactiva la navegación privada o revisa el espacio disponible.",
        ),
      );
  }));
}
export async function readAccount(user: string): Promise<LocalAccount> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction("accounts").objectStore("accounts").get(user);
    r.onsuccess = () => resolve(r.result ?? emptyAccount());
    r.onerror = () => reject(r.error);
  });
}
// A read + modification + outbox insertion is one IDB transaction, shared by tabs.
export async function transact(
  user: string,
  mutate: (a: LocalAccount) => void,
): Promise<LocalAccount> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readwrite");
    const s = tx.objectStore("accounts");
    const r = s.get(user);
    let account: LocalAccount;
    r.onsuccess = () => {
      try {
        account = r.result ?? emptyAccount();
        mutate(account);
        s.put(account, user);
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => resolve(account);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ??
          new Error("No se pudo guardar. La acción no se ha confirmado."),
      );
  });
}
export async function readValue<T>(
  store: "legacy" | "blobs",
  key: string,
): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function writeValue(
  store: "legacy" | "blobs",
  key: string,
  value: unknown,
) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
