import React, { createContext, useContext } from 'react';

const PermissionContext = createContext({ permissions: {}, isAdmin: false });

export function PermissionProvider({ sessionUser, children }) {
  const permissions = sessionUser?.permissions || {};
  const isAdmin     = sessionUser?.isAdmin || false;
  return (
    <PermissionContext.Provider value={{ permissions, isAdmin }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export function useCan(page) {
  const { permissions, isAdmin } = useContext(PermissionContext);
  if (page === 'settings') return isAdmin;
  return isAdmin || permissions[page] === true;
}
