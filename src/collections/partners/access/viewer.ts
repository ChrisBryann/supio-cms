import { Access } from 'payload'

export const viewer: Access = () => {
  // all users have access to view partners
  return true
}
