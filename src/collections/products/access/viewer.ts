import type { Access } from 'payload'

export const viewer: Access = () => {
  // all users and non users have access to view products
  return true
}
