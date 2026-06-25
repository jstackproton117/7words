import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, ensureSignedIn } from "../firebase";

export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    void ensureSignedIn().catch(() => {
      // Surface auth issues through the UI elsewhere — silent here.
    });
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  return user;
}
