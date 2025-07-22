import type { Access } from 'payload'
import { checkRole } from './check-role'

export const editor: Access = ({ req: { user } }) => {
  if (user) {
    // checks if user is admin or editor
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
  }

  return false
}
