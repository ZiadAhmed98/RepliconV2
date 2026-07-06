import React, { createContext, useContext } from 'react';
import { canAccessPage } from '../config/pages';

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

// Route/component guard — delegates to the canonical check in config/pages.js
// so the Sidebar and route guards can never drift apart.
export function useCan(page) {
  const { permissions, isAdmin } = useContext(PermissionContext);
  return canAccessPage(permissions, isAdmin, page);
}
