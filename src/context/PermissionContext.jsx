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
  // Pages that require the hard isAdmin flag — no permission override
  if (['settings', 'administration'].includes(page)) return isAdmin;
  // Always accessible to any authenticated user
  if (!page || page === 'myTimesheet') return true;
  // Strict check: admin OR explicit permission grant
  return isAdmin || permissions[page] === true;
}
