import React, { createContext, useContext } from 'react';

const PermissionContext = createContext({ permissions: {}, isAdmin: false, ready: false });

export function PermissionProvider({ sessionUser, children }) {
  const permissions = sessionUser?.permissions || {};
  const isAdmin     = sessionUser?.isAdmin || false;
  // ready = true as soon as any sessionUser exists (even old format without permissions)
  const ready       = !!sessionUser;
  return (
    <PermissionContext.Provider value={{ permissions, isAdmin, ready }}>
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
  // myTimesheet is always visible to all authenticated users
  if (page === 'myTimesheet') return true;
  // If permissions object is empty (old session format), allow everything
  if (Object.keys(permissions).length === 0) return true;
  return isAdmin || permissions[page] === true;
}
