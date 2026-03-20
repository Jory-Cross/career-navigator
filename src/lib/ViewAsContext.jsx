import React, { createContext, useContext, useState } from "react";

const ViewAsContext = createContext({ viewAsUser: null, setViewAsUser: () => {} });

export function ViewAsProvider({ children }) {
  const [viewAsUser, setViewAsUser] = useState(null); // null = myself, full user object = impersonating
  return (
    <ViewAsContext.Provider value={{ viewAsUser, setViewAsUser }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}