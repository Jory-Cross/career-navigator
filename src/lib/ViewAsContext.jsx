import React, { createContext, useContext, useState } from "react";
import { setViewAsUser as syncViewAsState } from "@/lib/viewAsState";
import { resetOrgCache } from "@/lib/useOrg";

const ViewAsContext = createContext({ viewAsUser: null, setViewAsUser: () => {} });

export function ViewAsProvider({ children }) {
  const [viewAsUser, setViewAsUserInternal] = useState(null); // null = myself, full user object = impersonating

  const setViewAsUser = (target) => {
    setViewAsUserInternal(target);
    syncViewAsState(target); // module-level state consumed by base44.auth.me()
    resetOrgCache();         // re-resolve the org for the new perspective
  };

  return (
    <ViewAsContext.Provider value={{ viewAsUser, setViewAsUser }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}